import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import { toAppError } from '../utils/errors.js';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

const hasValidationDetails = (error: unknown): error is { validation: unknown } =>
  typeof error === 'object' && error !== null && 'validation' in error;

const errorLogDetails = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { error };
  }

  const maybeCodedError = error as Error & { code?: unknown };

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: maybeCodedError.code,
  };
};

const sendError = (
  error: AppError,
  request: FastifyRequest,
  reply: FastifyReply,
  details?: unknown,
) => {
  const payload: ErrorPayload = {
    error: {
      code: error.code,
      message: error.message,
      requestId: request.id,
      ...(details ? { details } : {}),
    },
  };

  return reply.status(error.statusCode).send(payload);
};

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    if (hasValidationDetails(error)) {
      return sendError(
        new AppError('Request validation failed', 400, 'VALIDATION_ERROR'),
        request,
        reply,
        error.validation,
      );
    }

    const appError = toAppError(error);

    if (appError.statusCode >= 500) {
      request.log.error({ error: errorLogDetails(error) });
    }

    return sendError(appError, request, reply, appError.details);
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(new AppError('Route not found', 404, 'ROUTE_NOT_FOUND'), request, reply),
  );
};
