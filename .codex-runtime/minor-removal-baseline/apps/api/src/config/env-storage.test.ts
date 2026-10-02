import { describe, expect, it } from 'vitest';
import {
  assertPatientDocumentStorageConfiguration,
  parsePatientDocumentStorageProvider,
} from './env.js';

describe('patient document storage configuration', () => {
  it('normalizes supported providers and rejects unknown providers', () => {
    expect(parsePatientDocumentStorageProvider(undefined)).toBe('local');
    expect(parsePatientDocumentStorageProvider(' GCP ')).toBe('gcp');
    expect(() => parsePatientDocumentStorageProvider('public-url')).toThrow(/local or gcp/i);
  });

  it('requires GCS storage in production', () => {
    expect(() => assertPatientDocumentStorageConfiguration({
      provider: 'local',
      bucketName: '',
      production: true,
    })).toThrow(/must be gcp in production/i);
  });

  it('requires a bucket whenever the GCP provider is enabled', () => {
    expect(() => assertPatientDocumentStorageConfiguration({
      provider: 'gcp',
      bucketName: ' ',
      production: false,
    })).toThrow(/bucket is required/i);

    expect(() => assertPatientDocumentStorageConfiguration({
      provider: 'gcp',
      bucketName: 'hms-dev-documents',
      production: true,
    })).not.toThrow();
  });
});
