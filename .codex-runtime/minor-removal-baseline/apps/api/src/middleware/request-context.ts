import type { FastifyInstance } from 'fastify';

export const registerRequestContext = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
};
