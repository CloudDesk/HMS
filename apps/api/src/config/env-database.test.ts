import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl } from './env.js';

const uri = 'mongodb+srv://user:example-password@hms.example.net/HMS_GENERAL?retryWrites=true';

describe('database destination configuration', () => {
  it('supports either existing variable and matching duplicate settings', () => {
    expect(resolveDatabaseUrl({ uri })).toBe(uri);
    expect(resolveDatabaseUrl({ legacyUrl: uri })).toBe(uri);
    expect(resolveDatabaseUrl({ uri, legacyUrl: uri })).toBe(uri);
    expect(resolveDatabaseUrl({ uri: ' ', legacyUrl: uri })).toBe(uri);
  });
  it('rejects conflicting destinations instead of silently selecting a cluster', () => {
    expect(() => resolveDatabaseUrl({ uri, legacyUrl: 'mongodb://old.example.net/HMS_GENERAL' }))
      .toThrow('MONGODB_URI and MONGODB_DATABASE_URL conflict');
  });
  it('requires an explicit URL and rejects invalid strings without echoing secrets', () => {
    expect(() => resolveDatabaseUrl({})).toThrow('MONGODB_URI or MONGODB_DATABASE_URL is required');
    expect(() => resolveDatabaseUrl({ uri: 'https://user:example-password@hms.example.net/HMS_GENERAL' }))
      .toThrow('MongoDB connection URL is invalid');
  });
  it('validates the intended cluster and exact case-sensitive database', () => {
    expect(resolveDatabaseUrl({ uri, expectedHost: 'HMS.EXAMPLE.NET', expectedDatabase: 'HMS_GENERAL' })).toBe(uri);
    expect(() => resolveDatabaseUrl({ uri, expectedHost: 'other.example.net' }))
      .toThrow('MongoDB connection host does not match MONGODB_EXPECTED_HOST');
    expect(() => resolveDatabaseUrl({ uri, expectedDatabase: 'hms_general' }))
      .toThrow('MongoDB connection database does not match MONGODB_EXPECTED_DATABASE');
  });
  it('does not mistake authSource for the application database', () => {
    expect(() => resolveDatabaseUrl({
      uri: 'mongodb+srv://hms.example.net/?authSource=HMS_GENERAL', expectedDatabase: 'HMS_GENERAL',
    })).toThrow('MongoDB connection database does not match MONGODB_EXPECTED_DATABASE');
  });
  it('supports standard seed lists and encoded credentials/database names', () => {
    const value = 'mongodb://user:p%40ss@host1:27017,host2:27017/HMS%5FGENERAL?replicaSet=rs0';
    expect(resolveDatabaseUrl({ uri: value, expectedHost: 'host1:27017,host2:27017', expectedDatabase: 'HMS_GENERAL' }))
      .toBe(value);
  });
  it('rejects malformed database encoding with a credential-free error', () => {
    expect(() => resolveDatabaseUrl({ uri: 'mongodb://user:example-password@localhost/%ZZ' }))
      .toThrow('MongoDB connection database name is invalid');
  });
});
