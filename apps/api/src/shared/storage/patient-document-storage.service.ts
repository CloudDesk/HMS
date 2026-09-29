import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage, type Bucket, type File } from '@google-cloud/storage';
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

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ');

  return normalized || 'document';
};

const isNotFoundError = (error: unknown) =>
  error instanceof Error
  && 'code' in error
  && (error.code === 404 || error.code === '404' || error.code === 'ENOENT');

export class PatientDocumentStorageService {
  private readonly provider = env.storage.provider;
  private readonly gcpBucket: Bucket | null;
  private readonly rootDirectory = path.isAbsolute(env.storage.localPatientDocumentsPath)
    ? env.storage.localPatientDocumentsPath
    : path.resolve(
        fileURLToPath(new URL('../../../', import.meta.url)),
        env.storage.localPatientDocumentsPath,
      );
  private readonly legacyRootDirectory = path.resolve(env.storage.localPatientDocumentsPath);

  constructor() {
    this.gcpBucket = this.provider === 'gcp'
      ? new Storage({ projectId: env.storage.gcpProjectId }).bucket(env.storage.gcpPatientDocumentsBucket)
      : null;
  }

  private validateStorageKey(storageKey: string) {
    const normalized = storageKey.replaceAll('\\', '/');
    const segments = normalized.split('/');
    if (
      !normalized.startsWith('patients/')
      || normalized.startsWith('/')
      || segments.some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
    }
    return normalized;
  }

  private gcpFile(storageKey: string): File {
    const key = this.validateStorageKey(storageKey);
    if (!this.gcpBucket) {
      throw new AppError('Google Cloud patient document storage is not configured', 500, 'STORAGE_NOT_CONFIGURED');
    }
    return this.gcpBucket.file(key);
  }

  private resolveStoragePath(storageKey: string, rootDirectory = this.rootDirectory) {
    const key = this.validateStorageKey(storageKey);
    const resolvedPath = path.resolve(rootDirectory, ...key.split('/'));
    const isInsideRoot =
      resolvedPath === rootDirectory || resolvedPath.startsWith(`${rootDirectory}${path.sep}`);

    if (!isInsideRoot) {
      throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
    }

    return resolvedPath;
  }

  async exists(storageKey: string): Promise<boolean> {
    if (this.provider === 'gcp') {
      try {
        const [exists] = await this.gcpFile(storageKey).exists();
        return exists;
      } catch (error) {
        if (isNotFoundError(error)) return false;
        throw error;
      }
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
      await this.gcpFile(storageKey).save(input.data, {
        resumable: false,
        validation: 'crc32c',
        metadata: {
          contentType: input.mimeType,
          cacheControl: 'private, no-store',
        },
      });
      return { storageKey };
    }

    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, input.data);

    return { storageKey };
  }

  async updatePatientDocument(storageKey: string, data: Buffer) {
    if (this.provider === 'gcp') {
      const file = this.gcpFile(storageKey);
      let contentType: string | undefined;
      try {
        const [metadata] = await file.getMetadata();
        contentType = metadata.contentType;
      } catch (error) {
        if (isNotFoundError(error)) {
          throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
        }
        throw error;
      }
      await file.save(data, {
        resumable: false,
        validation: 'crc32c',
        metadata: {
          ...(contentType ? { contentType } : {}),
          cacheControl: 'private, no-store',
        },
      });
      return;
    }

    const storagePath = this.resolveStoragePath(storageKey);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, data);
  }


  async download(storageKey: string): Promise<DownloadedPatientDocument> {
    if (this.provider === 'gcp') {
      const file = this.gcpFile(storageKey);
      try {
        const [[data], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
        return {
          data,
          contentType: metadata.contentType ?? null,
        };
      } catch (error) {
        if (isNotFoundError(error)) {
          throw new AppError('Stored patient document file was not found', 404, 'DOCUMENT_FILE_NOT_FOUND');
        }
        throw error;
      }
    }

    const storagePath = this.resolveStoragePath(storageKey);
    const legacyStoragePath = this.resolveStoragePath(storageKey, this.legacyRootDirectory);
    const data = await readFile(storagePath).catch(async (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        if (legacyStoragePath !== storagePath) {
          return readFile(legacyStoragePath).catch((legacyError: unknown) => {
            if (legacyError instanceof Error && 'code' in legacyError && legacyError.code === 'ENOENT') {
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
      try {
        await this.gcpFile(storageKey).delete({ ignoreNotFound: true });
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }
      return;
    }

    const storagePath = this.resolveStoragePath(storageKey);
    const legacyStoragePath = this.resolveStoragePath(storageKey, this.legacyRootDirectory);

    await unlink(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    });

    if (legacyStoragePath !== storagePath) {
      await unlink(legacyStoragePath).catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
        throw error;
      });
    }
  }
}
