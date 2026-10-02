import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NativeSessionRepository } from './native-session.repository.js';
import { RefreshTokenModel } from './refresh-token.model.js';

describe('native sessions fail closed on standalone MongoDB', () => {
  let database: MongoMemoryServer;
  beforeAll(async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri());
    await RefreshTokenModel.init();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });
  it('does not retry an operation outside its transaction or leave a token behind', async () => {
    const repository = new NativeSessionRepository();
    const id = new mongoose.Types.ObjectId();
    const operation = vi.fn(async (session: mongoose.ClientSession) => {
      expect(session).toBeDefined();
      await repository.insertToken({ id: String(id), userId: String(new mongoose.Types.ObjectId()),
        token: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60_000), native: { sessionId: id },
      }, session);
    });
    await expect(repository.transaction(operation)).rejects.toMatchObject({
      statusCode: 503, code: 'SESSION_STORE_UNAVAILABLE',
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await RefreshTokenModel.countDocuments()).toBe(0);
  });
});
