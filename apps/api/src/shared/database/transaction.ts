import type { ClientSession } from 'mongoose';
import { AppError } from '../errors/app-error.js';

export interface SessionCapableRepository {
  session(): Promise<ClientSession>;
}

/**
 * Executes an operation inside a MongoDB transaction on replica sets / mongos,
 * or safely falls back to executing without a transaction on standalone MongoDB instances.
 */
export async function executeTransaction<T>(
  repositoryOrSessionProvider: SessionCapableRepository | (() => Promise<ClientSession>),
  operation: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  let session: ClientSession | null = null;
  try {
    const activeSession =
      typeof repositoryOrSessionProvider === 'function'
        ? await repositoryOrSessionProvider()
        : await repositoryOrSessionProvider.session();
    session = activeSession;
    let result: T | undefined;
    await activeSession.withTransaction(async () => {
      result = await operation(activeSession);
    });
    return result as T;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      msg.includes('transaction numbers are only allowed') ||
      msg.includes('standalone') ||
      msg.includes('replica set') ||
      msg.includes('sharded cluster') ||
      msg.includes('does not support retryable writes') ||
      msg.includes('retrywrites=false') ||
      (typeof error === 'object' && error !== null && 'code' in error && (error.code === 20 || error.code === 'IllegalOperation'))
    ) {
      return await operation(undefined);
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}
