import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

const extensionByContentType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export class SettingsLogoStorage {
  private readonly rootDirectory = path.resolve(env.storage.localHospitalLogosPath);

  private resolveStoragePath(storageKey: string) {
    const resolvedPath = path.resolve(this.rootDirectory, ...storageKey.split('/'));
    const isInsideRoot =
      resolvedPath === this.rootDirectory || resolvedPath.startsWith(`${this.rootDirectory}${path.sep}`);

    if (!isInsideRoot) {
      throw new AppError('Hospital logo storage key is invalid', 400, 'INVALID_LOGO_STORAGE_KEY');
    }

    return resolvedPath;
  }

  async upload(buffer: Buffer, contentType: string) {
    const extension = extensionByContentType[contentType];
    if (!extension) {
      throw new AppError('Hospital logo must be a PNG or JPG image', 400, 'INVALID_LOGO_TYPE');
    }

    const storageKey = `${randomUUID()}.${extension}`;
    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(storagePath, buffer);

    return storageKey;
  }

  async download(storageKey: string) {
    const storagePath = this.resolveStoragePath(storageKey);
    return readFile(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new AppError('Hospital logo could not be read', 404, 'LOGO_NOT_FOUND');
      }

      throw error;
    });
  }

  async delete(storageKey: string) {
    const storagePath = this.resolveStoragePath(storageKey);
    await unlink(storagePath).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    });
  }
}
