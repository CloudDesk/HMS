import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readyState: 0,
  databaseName: 'HMS_GENERAL',
  database: {
    url: 'mongodb://localhost:27017/HMS_GENERAL', expectedDatabase: 'HMS_GENERAL',
    dnsServers: [], poolSize: 10, connectTimeoutSeconds: 15,
  },
  connect: vi.fn(), close: vi.fn(), set: vi.fn(),
}));

vi.mock('../config/env.js', () => ({ env: { database: state.database } }));
vi.mock('mongoose', () => ({
  default: {
    connect: state.connect, set: state.set,
    connection: {
      get readyState() { return state.readyState; },
      get db() { return { databaseName: state.databaseName }; },
      close: state.close,
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.readyState = 0;
  state.databaseName = 'HMS_GENERAL';
  state.database.url = 'mongodb://localhost:27017/HMS_GENERAL';
  state.database.expectedDatabase = 'HMS_GENERAL';
  state.connect.mockImplementation(async () => { state.readyState = 1; });
  state.close.mockImplementation(async () => { state.readyState = 0; });
});

describe('database connection destination guard', () => {
  it('disables automatic collection/index creation and reuses the verified connection', async () => {
    const { connectDatabase } = await import('./client.js');
    await connectDatabase();
    await connectDatabase();
    expect(state.set).toHaveBeenCalledWith('autoCreate', false);
    expect(state.set).toHaveBeenCalledWith('autoIndex', false);
    expect(state.connect).toHaveBeenCalledTimes(1);
    expect(state.connect).toHaveBeenCalledWith(state.database.url, {
      maxPoolSize: 10, serverSelectionTimeoutMS: 15000,
    });
  });
  it('closes and rejects a wrong database before returning to a writer', async () => {
    state.databaseName = 'other_database';
    const { connectDatabase } = await import('./client.js');
    await expect(connectDatabase()).rejects.toThrow('Connected MongoDB database does not match');
    expect(state.close).toHaveBeenCalledTimes(1);
    expect(state.readyState).toBe(0);
    state.databaseName = 'HMS_GENERAL';
    await expect(connectDatabase()).resolves.toBeUndefined();
    expect(state.connect).toHaveBeenCalledTimes(2);
  });
  it('refuses to reuse a connection after the configured URL changes', async () => {
    const { connectDatabase } = await import('./client.js');
    await connectDatabase();
    state.database.url = 'mongodb://different-host:27017/HMS_GENERAL';
    await expect(connectDatabase()).rejects.toThrow('restart before using another database');
    expect(state.connect).toHaveBeenCalledTimes(1);
  });
  it('allows a new destination after explicitly closing the connection', async () => {
    const { connectDatabase, closeDatabase } = await import('./client.js');
    await connectDatabase();
    await closeDatabase();
    state.database.url = 'mongodb://different-host:27017/HMS_GENERAL';
    await connectDatabase();
    expect(state.connect).toHaveBeenCalledTimes(2);
  });
  it('retains existing behavior when no expected database is configured', async () => {
    state.database.expectedDatabase = '';
    state.databaseName = 'another_existing_environment';
    const { connectDatabase } = await import('./client.js');
    await expect(connectDatabase()).resolves.toBeUndefined();
  });
});
