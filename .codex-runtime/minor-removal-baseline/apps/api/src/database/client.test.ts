import { describe, it, expect, beforeAll } from 'vitest';

describe('Database client connection baseline test', () => {
  beforeAll(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/hms-test';
  });

  it('should export database connection functions', async () => {
    const { connectDatabase, closeDatabase } = await import('./client.js');
    expect(connectDatabase).toBeTypeOf('function');
    expect(closeDatabase).toBeTypeOf('function');
  });
});
