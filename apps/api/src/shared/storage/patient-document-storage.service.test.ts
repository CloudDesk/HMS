import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import {
  PatientDocumentStorageService,
  type PatientDocumentCloudFile,
  type PatientDocumentCloudStorageClient,
} from './patient-document-storage.service.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const createCloudHarness = () => {
  let storedData = Buffer.alloc(0);
  let storedContentType: string | null = null;
  let objectExists = false;
  const save = vi.fn<PatientDocumentCloudFile['save']>(async (data, options) => {
    storedData = data;
    storedContentType = options.metadata.contentType ?? null;
    objectExists = true;
  });
  const remove = vi.fn<PatientDocumentCloudFile['delete']>(async () => {
    if (!objectExists) throw Object.assign(new Error('missing'), { code: 404 });
    objectExists = false;
  });
  const file: PatientDocumentCloudFile = {
    exists: async () => [objectExists],
    save,
    download: async () => {
      if (!objectExists) throw Object.assign(new Error('missing'), { code: 404 });
      return [storedData];
    },
    getMetadata: async () => [{ contentType: storedContentType }, {}],
    delete: remove,
  };
  const fileLookup = vi.fn(() => file);
  const bucketLookup = vi.fn(() => ({ file: fileLookup }));
  const cloudStorageClient: PatientDocumentCloudStorageClient = { bucket: bucketLookup };

  return { cloudStorageClient, bucketLookup, fileLookup, save, remove };
};

describe('PatientDocumentStorageService', () => {
  it('preserves the existing local storage contract', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'hms-document-storage-'));
    temporaryDirectories.push(directory);
    const service = new PatientDocumentStorageService({
      provider: 'local',
      localRootDirectory: directory,
    });

    const upload = await service.uploadPatientDocument({
      patientId: 'patient-1',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('first'),
    });

    expect(await service.exists(upload.storageKey)).toBe(true);
    expect((await service.download(upload.storageKey)).data.toString()).toBe('first');

    await service.updatePatientDocument(upload.storageKey, Buffer.from('second'));
    expect((await service.download(upload.storageKey)).data.toString()).toBe('second');

    await service.deleteIfExists(upload.storageKey);
    expect(await service.exists(upload.storageKey)).toBe(false);
  });

  it('stores and retrieves private GCS objects through the configured bucket', async () => {
    const harness = createCloudHarness();
    const service = new PatientDocumentStorageService({
      provider: 'gcp',
      gcpProjectId: 'test-project',
      gcpBucketName: 'test-documents',
      cloudStorageClient: harness.cloudStorageClient,
    });

    const upload = await service.uploadPatientDocument({
      patientId: 'patient-1',
      fileName: 'scan?.png',
      mimeType: 'image/png',
      data: Buffer.from('image'),
    });

    expect(harness.bucketLookup).toHaveBeenCalledWith('test-documents');
    expect(upload.storageKey).toMatch(/^patients\/patient-1\/documents\/[\w-]+-scan-.png$/);
    expect(harness.fileLookup).toHaveBeenCalledWith(upload.storageKey);
    expect(harness.save).toHaveBeenCalledWith(
      Buffer.from('image'),
      expect.objectContaining({
        resumable: false,
        validation: 'crc32c',
        metadata: {
          cacheControl: 'private, no-store',
          contentType: 'image/png',
        },
      }),
    );
    expect(await service.exists(upload.storageKey)).toBe(true);
    await expect(service.download(upload.storageKey)).resolves.toEqual({
      data: Buffer.from('image'),
      contentType: 'image/png',
    });

    await service.updatePatientDocument(upload.storageKey, Buffer.from('updated-image'));
    expect(harness.save).toHaveBeenLastCalledWith(
      Buffer.from('updated-image'),
      expect.objectContaining({
        metadata: {
          cacheControl: 'private, no-store',
          contentType: 'image/png',
        },
      }),
    );

    await service.deleteIfExists(upload.storageKey);
    expect(await service.exists(upload.storageKey)).toBe(false);
    await expect(service.deleteIfExists(upload.storageKey)).resolves.toBeUndefined();
  });

  it('maps missing GCS objects to the existing API error contract', async () => {
    const harness = createCloudHarness();
    const service = new PatientDocumentStorageService({
      provider: 'gcp',
      gcpBucketName: 'test-documents',
      cloudStorageClient: harness.cloudStorageClient,
    });

    await expect(service.download('patients/patient-1/documents/missing.pdf')).rejects.toMatchObject({
      statusCode: 404,
      code: 'DOCUMENT_FILE_NOT_FOUND',
    } satisfies Partial<AppError>);
  });

  it('rejects traversal-like keys before accessing either provider', async () => {
    const harness = createCloudHarness();
    const service = new PatientDocumentStorageService({
      provider: 'gcp',
      gcpBucketName: 'test-documents',
      cloudStorageClient: harness.cloudStorageClient,
    });

    await expect(service.download('../secret')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STORAGE_KEY',
    } satisfies Partial<AppError>);
    expect(harness.fileLookup).not.toHaveBeenCalled();
  });
});
