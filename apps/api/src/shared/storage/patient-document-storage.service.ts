import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
  private readonly rootDirectory = path.resolve(env.storage.localPatientDocumentsPath);

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
    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, input.data);

    return { storageKey };
  }

  async download(storageKey: string): Promise<DownloadedPatientDocument> {
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
    const storagePath = this.resolveStoragePath(storageKey);

    await unlink(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    });
  }
}
