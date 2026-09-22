import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

export class PatientDocumentStorageService {
  private readonly rootDirectory = path.isAbsolute(env.storage.localPatientDocumentsPath)
    ? env.storage.localPatientDocumentsPath
    : path.resolve(
        fileURLToPath(new URL('../../../', import.meta.url)),
        env.storage.localPatientDocumentsPath,
      );
  private readonly legacyRootDirectory = path.resolve(env.storage.localPatientDocumentsPath);

  private resolveStoragePath(storageKey: string, rootDirectory = this.rootDirectory) {
    const resolvedPath = path.resolve(rootDirectory, ...storageKey.split('/'));
    const isInsideRoot =
      resolvedPath === rootDirectory || resolvedPath.startsWith(`${rootDirectory}${path.sep}`);

    if (!isInsideRoot) {
      throw new AppError('Patient document storage key is invalid', 400, 'INVALID_STORAGE_KEY');
    }

    return resolvedPath;
  }

  async exists(storageKey: string): Promise<boolean> {
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
    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, input.data);

    return { storageKey };
  }

  async download(storageKey: string): Promise<DownloadedPatientDocument> {
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
