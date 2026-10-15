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

const isTransactionCapabilityError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('transaction numbers are only allowed')
    || message.includes('standalone')
    || message.includes('replica set')
    || message.includes('sharded cluster')
    || message.includes('does not support retryable writes')
    || message.includes('retrywrites=false')
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error.code === 20 || error.code === 'IllegalOperation'));
};

/** Executes a safety-critical operation atomically and never degrades to a non-transactional write. */
export async function executeRequiredTransaction<T>(
  repositoryOrSessionProvider: SessionCapableRepository | (() => Promise<ClientSession>),
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let session: ClientSession | null = null;
  try {
    const activeSession = typeof repositoryOrSessionProvider === 'function'
      ? await repositoryOrSessionProvider()
      : await repositoryOrSessionProvider.session();
    session = activeSession;
    let result: T | undefined;
    await activeSession.withTransaction(async () => {
      result = await operation(activeSession);
    });
    return result as T;
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    if (isTransactionCapabilityError(error)) {
      throw new AppError(
        'This workflow requires MongoDB transaction support',
        503,
        'TRANSACTION_CAPABILITY_REQUIRED',
      );
    }
    throw error;
  } finally {
    if (session) await session.endSession().catch(() => {});
  }
}
