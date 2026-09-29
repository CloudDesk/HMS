import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gcp = vi.hoisted(() => {
  const objects = new Map<string, { data: Buffer; contentType: string | null }>();
  const buckets: string[] = [];
  const projects: Array<string | undefined> = [];

  class MockFile {
    constructor(private readonly key: string) {}

    async save(data: Buffer, options?: { metadata?: { contentType?: string } }) {
      objects.set(this.key, {
        data: Buffer.from(data),
        contentType: options?.metadata?.contentType ?? objects.get(this.key)?.contentType ?? null,
      });
    }

    async exists() {
      return [objects.has(this.key)];
    }

    async download() {
      const stored = objects.get(this.key);
      if (!stored) throw Object.assign(new Error('Not found'), { code: 404 });
      return [Buffer.from(stored.data)];
    }

    async getMetadata() {
      const stored = objects.get(this.key);
      if (!stored) throw Object.assign(new Error('Not found'), { code: 404 });
      return [{ contentType: stored.contentType }];
    }

    async delete() {
      objects.delete(this.key);
      return [];
    }
  }

  class MockStorage {
    constructor(options?: { projectId?: string }) {
      projects.push(options?.projectId);
    }

    bucket(name: string) {
      buckets.push(name);
      return { file: (key: string) => new MockFile(key) };
    }
  }

  return { buckets, MockStorage, objects, projects };
});

vi.mock('@google-cloud/storage', () => ({ Storage: gcp.MockStorage }));

import { env } from '../../config/env.js';
import { PatientDocumentStorageService } from './patient-document-storage.service.js';

describe('PatientDocumentStorageService with Google Cloud Storage', () => {
  const originalProvider = env.storage.provider;
  const originalProjectId = env.storage.gcpProjectId;
  const originalBucket = env.storage.gcpPatientDocumentsBucket;

  beforeEach(() => {
    gcp.objects.clear();
    gcp.buckets.length = 0;
    gcp.projects.length = 0;
    env.storage.provider = 'gcp';
    env.storage.gcpProjectId = 'test-project';
    env.storage.gcpPatientDocumentsBucket = 'test-patient-documents';
  });

  afterEach(() => {
    env.storage.provider = originalProvider;
    env.storage.gcpProjectId = originalProjectId;
    env.storage.gcpPatientDocumentsBucket = originalBucket;
  });

  it('uploads, retrieves, updates, checks, and deletes a patient document in the configured bucket', async () => {
    const service = new PatientDocumentStorageService();
    const uploaded = await service.uploadPatientDocument({
      patientId: 'patient-1',
      fileName: 'clinical note.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('first version'),
    });

    expect(gcp.projects).toEqual(['test-project']);
    expect(gcp.buckets).toEqual(['test-patient-documents']);
    expect(uploaded.storageKey).toMatch(/^patients\/patient-1\/documents\/.+-clinical note\.pdf$/);
    await expect(service.exists(uploaded.storageKey)).resolves.toBe(true);
    await expect(service.download(uploaded.storageKey)).resolves.toMatchObject({
      data: Buffer.from('first version'),
      contentType: 'application/pdf',
    });

    await service.updatePatientDocument(uploaded.storageKey, Buffer.from('second version'));
    await expect(service.download(uploaded.storageKey)).resolves.toMatchObject({
      data: Buffer.from('second version'),
      contentType: 'application/pdf',
    });

    await service.deleteIfExists(uploaded.storageKey);
    await expect(service.exists(uploaded.storageKey)).resolves.toBe(false);
  });

  it('returns the domain not-found error for a missing bucket object', async () => {
    const service = new PatientDocumentStorageService();
    await expect(service.download('patients/patient-1/documents/missing.pdf'))
      .rejects.toMatchObject({ code: 'DOCUMENT_FILE_NOT_FOUND', statusCode: 404 });
  });

  it('rejects unsafe object keys before contacting the bucket', async () => {
    const service = new PatientDocumentStorageService();
    await expect(service.download('patients/patient-1/../another-patient/private.pdf'))
      .rejects.toMatchObject({ code: 'INVALID_STORAGE_KEY', statusCode: 400 });
  });
});
