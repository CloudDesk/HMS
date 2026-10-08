import { createHash } from 'node:crypto';
import { AuthRateLimitModel } from './auth-rate-limit.model.js';

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

export class AuthRateLimitRepository {
  async consume(scope: string, keyHash: string, limit: number, windowSeconds: number, now: Date,
    options: { retryInsertRace?: boolean } = {}) {
    const windowMs = windowSeconds * 1000;
    const bucketStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const bucketId = createHash('sha256').update(`${scope}:${keyHash}:${bucketStart.getTime()}`).digest('hex');
    try {
      const result = await AuthRateLimitModel.findOneAndUpdate(
        { _id: bucketId, count: { $lt: limit } },
        {
          $inc: { count: 1 },
          $setOnInsert: { scope, keyHash, bucketStart, expiresAt: new Date(bucketStart.getTime() + windowMs * 2) },
        },
        { upsert: true, returnDocument: 'after', lean: true },
      );
      return Boolean(result);
    } catch (error) {
      if (isDuplicateKey(error) && options.retryInsertRace) {
        // Native callers distinguish a competing first insert from an exhausted bucket.
        // No upsert here: an exhausted counter still fails closed without incrementing.
        return Boolean(await AuthRateLimitModel.findOneAndUpdate(
          { _id: bucketId, count: { $lt: limit } },
          { $inc: { count: 1 } },
          { returnDocument: 'after', lean: true },
        ));
      }
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async reset(scope: string, keyHash: string) {
    await AuthRateLimitModel.deleteMany({ scope, keyHash });
  }
}
