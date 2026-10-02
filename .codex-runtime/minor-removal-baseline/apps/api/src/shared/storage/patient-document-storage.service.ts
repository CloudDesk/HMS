import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '@google-cloud/storage';
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

type CloudFileMetadata = {
  contentType?: string | null;
};

export interface PatientDocumentCloudFile {
  exists(): Promise<[boolean]>;
  save(
    data: Buffer,
    options: {
      resumable: boolean;
      validation: 'crc32c';
      metadata: {
        cacheControl: string;
        contentType?: string;
      };
    },
  ): Promise<void>;
  download(): Promise<[Buffer]>;
  getMetadata(): Promise<[CloudFileMetadata, unknown]>;
  delete(): Promise<unknown>;
}

export interface PatientDocumentCloudBucket {
  file(storageKey: string): PatientDocumentCloudFile;
}

export interface PatientDocumentCloudStorageClient {
  bucket(bucketName: string): PatientDocumentCloudBucket;
}

type PatientDocumentStorageServiceOptions = {
  provider?: 'local' | 'gcp';
  localRootDirectory?: string;
  gcpProjectId?: string;
  gcpBucketName?: string;
  cloudStorageClient?: PatientDocumentCloudStorageClient;
};

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ');

  return normalized || 'document';
};

const isMissingFileError = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = error.code;
  return code === 404 || code === '404' || code === 'ENOENT';
};

const assertValidStorageKey = (storageKey: string) => {
  const segments = storageKey.split('/');
  if (
    !storageKey ||
    storageKey !== storageKey.trim() ||
    storageKey.startsWith('/') ||
    storageKey.includes('\\') ||
    storageKey.includes('\0') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
  }
};

export class PatientDocumentStorageService {
  private readonly provider: 'local' | 'gcp';
  private readonly rootDirectory: string;
  private readonly legacyRootDirectory: string;
  private readonly cloudBucket: PatientDocumentCloudBucket | null;

  constructor(options: PatientDocumentStorageServiceOptions = {}) {
    this.provider = options.provider ?? env.storage.provider;
    const localRootDirectory = options.localRootDirectory ?? env.storage.localPatientDocumentsPath;
    this.rootDirectory = path.isAbsolute(localRootDirectory)
      ? localRootDirectory
      : path.resolve(
          fileURLToPath(new URL('../../../', import.meta.url)),
          localRootDirectory,
        );
    this.legacyRootDirectory = path.resolve(localRootDirectory);

    if (this.provider === 'gcp') {
      const bucketName = options.gcpBucketName ?? env.storage.gcpPatientDocumentsBucket;
      if (!bucketName) {
        throw new Error('GCP patient document bucket is required');
      }
      const projectId = options.gcpProjectId ?? env.storage.gcpProjectId;
      const storageClient = options.cloudStorageClient ?? new Storage(projectId ? { projectId } : {});
      this.cloudBucket = storageClient.bucket(bucketName);
    } else {
      this.cloudBucket = null;
    }
  }

  private resolveStoragePath(storageKey: string, rootDirectory = this.rootDirectory) {
    assertValidStorageKey(storageKey);
    const resolvedPath = path.resolve(rootDirectory, ...storageKey.split('/'));
    const isInsideRoot =
      resolvedPath === rootDirectory || resolvedPath.startsWith(`${rootDirectory}${path.sep}`);

    if (!isInsideRoot) {
      throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
    }

    return resolvedPath;
  }

  private getCloudFile(storageKey: string) {
    assertValidStorageKey(storageKey);
    if (!this.cloudBucket) {
      throw new Error('GCP patient document storage is not configured');
    }
    return this.cloudBucket.file(storageKey);
  }

  private async saveCloudFile(storageKey: string, data: Buffer, contentType?: string) {
    await this.getCloudFile(storageKey).save(data, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        cacheControl: 'private, no-store',
        ...(contentType ? { contentType } : {}),
      },
    });
  }

  async exists(storageKey: string): Promise<boolean> {
    if (this.provider === 'gcp') {
      const [exists] = await this.getCloudFile(storageKey).exists();
      return exists;
    }

    try {
      const storagePath = this.resolveStoragePath(storageKey);
      await access(storagePath);
      return true;
    } catch {
      try {
        const legacyStoragePath = this.resolveStoragePath(storageKey, this.legacyRootDirectory);
        await access(legacyStoragePath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async uploadPatientDocument(input: UploadPatientDocumentInput) {
    const storageKey = `patients/${input.patientId}/documents/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

    if (this.provider === 'gcp') {
      await this.saveCloudFile(storageKey, input.data, input.mimeType);
      return { storageKey };
    }

    const storagePath = this.resolveStoragePath(storageKey);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, input.data);

    return { storageKey };
  }

  async updatePatientDocument(storageKey: string, data: Buffer, contentType?: string) {
    if (this.provider === 'gcp') {
      let resolvedContentType = contentType;
      if (!resolvedContentType) {
        try {
          const [metadata] = await this.getCloudFile(storageKey).getMetadata();
          resolvedContentType = metadata.contentType ?? undefined;
        } catch (error) {
          if (!isMissingFileError(error)) throw error;
        }
      }
      await this.saveCloudFile(storageKey, data, resolvedContentType);
      return;
    }

    const storagePath = this.resolveStoragePath(storageKey);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, data);
  }

  async download(storageKey: string): Promise<DownloadedPatientDocument> {
    if (this.provider === 'gcp') {
      const file = this.getCloudFile(storageKey);
      try {
        const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
        return {
          data,
          contentType: metadata.contentType ?? null,
        };
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
        }
        throw error;
      }
    }

    const storagePath = this.resolveStoragePath(storageKey);
    const legacyStoragePath = this.resolveStoragePath(storageKey, this.legacyRootDirectory);
    const data = await readFile(storagePath).catch(async (error: unknown) => {
      if (isMissingFileError(error)) {
        if (legacyStoragePath !== storagePath) {
          return readFile(legacyStoragePath).catch((legacyError: unknown) => {
            if (isMissingFileError(legacyError)) {
              throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
            }
            throw legacyError;
          });
        }
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
    if (this.provider === 'gcp') {
      await this.getCloudFile(storageKey).delete().catch((error: unknown) => {
        if (isMissingFileError(error)) return;
        throw error;
      });
      return;
    }

    const storagePath = this.resolveStoragePath(storageKey);
    const legacyStoragePath = this.resolveStoragePath(storageKey, this.legacyRootDirectory);

    await unlink(storagePath).catch((error: unknown) => {
      if (isMissingFileError(error)) return;
      throw error;
    });

    if (legacyStoragePath !== storagePath) {
      await unlink(legacyStoragePath).catch((error: unknown) => {
        if (isMissingFileError(error)) return;
        throw error;
      });
    }
  }
}
