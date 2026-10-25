import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Storage, type Bucket } from '@google-cloud/storage';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

type UploadPatientDocumentInput = {
  patientId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
};

type DownloadedPatientDocument = {
  data: Buffer;
  contentType: string | null;
};

type PatientDocumentStorageOptions = {
  provider?: string;
  environment?: 'dev' | 'test' | 'prod';
  localRootDirectory?: string;
  gcpBucketName?: string;
  gcpProjectId?: string;
  gcpBucket?: Bucket;
};

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ');

  return normalized || 'document';
};

export class PatientDocumentStorageService {
  private readonly provider: 'local' | 'gcs';
  private readonly rootDirectory: string;
  private readonly gcpBucket: Bucket | null;

  constructor(options: PatientDocumentStorageOptions = {}) {
    const provider = (options.provider ?? env.storage.provider).trim().toLowerCase();
    if (provider !== 'local' && provider !== 'gcs') {
      throw new AppError('Patient document storage provider is unsupported', 503, 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE');
    }
    const isProd = (options.environment ?? env.app.environment) === 'prod';
    let resolvedProvider = provider;
    if (provider === 'gcs' && !options.gcpBucket) {
      const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!isProd && credsPath && !existsSync(credsPath)) {
        resolvedProvider = 'local';
      }
    }
    this.provider = resolvedProvider as 'local' | 'gcs';
    if (isProd && this.provider !== 'gcs') {
      throw new AppError('Production patient document storage requires Google Cloud Storage', 503, 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE');
    }
    this.rootDirectory = path.resolve(options.localRootDirectory ?? env.storage.localPatientDocumentsPath);
    if (this.provider === 'gcs') {
      const bucketName = (options.gcpBucketName ?? env.storage.gcpPatientDocumentsBucket).trim();
      if (!bucketName && !options.gcpBucket) {
        throw new AppError('Google Cloud patient document bucket is not configured', 503, 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE');
      }
      this.gcpBucket = options.gcpBucket ?? new Storage({
        projectId: options.gcpProjectId ?? process.env.GCP_PROJECT_ID,
      }).bucket(bucketName);
    } else {
      this.gcpBucket = null;
    }
  }

  private resolveStoragePath(storageKey: string) {
    const resolvedPath = path.resolve(this.rootDirectory, ...storageKey.split('/'));
    const isInsideRoot =
      resolvedPath === this.rootDirectory || resolvedPath.startsWith(`${this.rootDirectory}${path.sep}`);

    if (!isInsideRoot) {
      throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
    }

    return resolvedPath;
  }

  async uploadPatientDocument(input: UploadPatientDocumentInput) {
    const storageKey = `patients/${input.patientId}/documents/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
    if (this.gcpBucket) {
      try {
        await this.gcpBucket.file(storageKey).save(input.data, {
          resumable: false,
          contentType: input.mimeType,
          metadata: { cacheControl: 'private, no-store', metadata: { patientId: input.patientId } },
          validation: 'crc32c',
        });
        return { storageKey };
      } catch (error) {
        if (env.app.environment !== 'prod') {
          const storagePath = this.resolveStoragePath(storageKey);
          await mkdir(path.dirname(storagePath), { recursive: true });
          await writeFile(storagePath, input.data);
          return { storageKey };
        }
        throw error;
      }
    }
    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, input.data);

    return { storageKey };
  }

  async updatePatientDocument(storageKey: string, data: Buffer, _contentType?: string) {
    if (this.gcpBucket) {
      await this.gcpBucket.file(storageKey).save(data, {
        resumable: false,
        contentType: _contentType,
        metadata: { cacheControl: 'private, no-store' },
        validation: 'crc32c',
      });
      return;
    }
    const storagePath = this.resolveStoragePath(storageKey);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, data);
  }

  async download(storageKey: string): Promise<DownloadedPatientDocument> {
    if (this.gcpBucket) {
      try {
        const file = this.gcpBucket.file(storageKey);
        const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
        return { data, contentType: metadata.contentType ?? null };
      } catch (error: unknown) {
        if (env.app.environment !== 'prod') {
          try {
            const storagePath = this.resolveStoragePath(storageKey);
            const data = await readFile(storagePath);
            return { data, contentType: null };
          } catch {}
        }
        if (this.isNotFound(error)) {
          throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
        }
        throw error;
      }
    }
    const storagePath = this.resolveStoragePath(storageKey);
    const data = await readFile(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
      }

      throw error;
    });

    return {
      data,
      contentType: null,
    };
  }

  async deleteIfExists(storageKey: string) {
    if (this.gcpBucket) {
      await this.gcpBucket.file(storageKey).delete({ ignoreNotFound: true });
      return;
    }
    const storagePath = this.resolveStoragePath(storageKey);

    await unlink(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    });
  }

  private isNotFound(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
  }
}
