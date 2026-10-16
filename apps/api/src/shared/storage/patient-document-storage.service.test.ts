import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Bucket } from '@google-cloud/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { PatientDocumentStorageService } from './patient-document-storage.service.js';

describe('PatientDocumentStorageService', () => {
  const temporaryDirectories: string[] = [];
  afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

  it('stores, downloads, updates, and deletes local development files', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'hms-storage-')); temporaryDirectories.push(directory);
    const storage = new PatientDocumentStorageService({ provider: 'local', localRootDirectory: directory });
    const uploaded = await storage.uploadPatientDocument({ patientId: 'patient-1', fileName: 'scan.png', mimeType: 'image/png', data: Buffer.from('one') });
    expect((await storage.download(uploaded.storageKey)).data.toString()).toBe('one');
    await storage.updatePatientDocument(uploaded.storageKey, Buffer.from('two'), 'image/png');
    expect((await storage.download(uploaded.storageKey)).data.toString()).toBe('two');
    await storage.deleteIfExists(uploaded.storageKey);
    await expect(storage.download(uploaded.storageKey)).rejects.toMatchObject({ code: 'DOCUMENT_FILE_NOT_FOUND' });
  });

  it('uses the configured private GCS bucket for production storage operations', async () => {
    const objects = new Map<string, { data: Buffer; contentType: string | null }>();
    const bucket = { file: (key: string) => ({
      save: async (data: Buffer, options?: { contentType?: string }) => { objects.set(key, { data, contentType: options?.contentType ?? null }); },
      download: async () => [objects.get(key)?.data ?? Buffer.alloc(0)],
      getMetadata: async () => [{ contentType: objects.get(key)?.contentType ?? undefined }],
      delete: async () => { objects.delete(key); return [{}]; },
    }) } as unknown as Bucket;
    const storage = new PatientDocumentStorageService({ provider: 'gcs', gcpBucketName: 'private-documents', gcpBucket: bucket });
    const uploaded = await storage.uploadPatientDocument({ patientId: 'patient-2', fileName: 'result.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf') });
    expect(uploaded.storageKey).toContain('patients/patient-2/documents/');
    expect(await storage.download(uploaded.storageKey)).toMatchObject({ contentType: 'application/pdf' });
    await storage.deleteIfExists(uploaded.storageKey);
    expect(objects.size).toBe(0);
  });

  it('rejects unsupported or incomplete storage configuration', () => {
    expect(() => new PatientDocumentStorageService({ provider: 'azure' })).toThrowError(expect.objectContaining({ code: 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE' }));
    expect(() => new PatientDocumentStorageService({ provider: 'gcs', gcpBucketName: '' })).toThrowError(expect.objectContaining({ code: 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE' }));
    expect(() => new PatientDocumentStorageService({ provider: 'local', environment: 'prod' })).toThrowError(expect.objectContaining({ code: 'PATIENT_DOCUMENT_STORAGE_UNAVAILABLE' }));
  });
});
