import { randomUUID } from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

const extensionByContentType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export class SettingsLogoStorage {
  private getContainer() {
    if (!env.azureStorage.connectionString) {
      throw new AppError('Hospital logo storage is not configured', 503, 'LOGO_STORAGE_UNAVAILABLE');
    }

    return BlobServiceClient.fromConnectionString(env.azureStorage.connectionString).getContainerClient(
      env.azureStorage.containerName,
    );
  }

  async upload(buffer: Buffer, contentType: string) {
    const extension = extensionByContentType[contentType];
    if (!extension) {
      throw new AppError('Hospital logo must be a PNG or JPG image', 400, 'INVALID_LOGO_TYPE');
    }

    const container = this.getContainer();
    await container.createIfNotExists();
    const blobName = `hospital-logos/${randomUUID()}.${extension}`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    return blobName;
  }

  async download(blobName: string) {
    const response = await this.getContainer().getBlobClient(blobName).download();
    if (!response.readableStreamBody) {
      throw new AppError('Hospital logo could not be read', 404, 'LOGO_NOT_FOUND');
    }

    return response.readableStreamBody;
  }

  async delete(blobName: string) {
    await this.getContainer().deleteBlob(blobName, { deleteSnapshots: 'include' });
  }
}
