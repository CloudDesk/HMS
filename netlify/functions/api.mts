import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from '../../apps/api/src/app.js';
import { connectDatabase } from '../../apps/api/src/database/client.js';

type LambdaProxy = ReturnType<typeof awsLambdaFastify>;

let proxyPromise: Promise<LambdaProxy> | null = null;

const getProxy = () => {
  proxyPromise ??= (async () => {
    await connectDatabase();
    const { app } = await buildApp();
    await app.ready();
    return awsLambdaFastify(app, {
      binaryMimeTypes: [
        'application/pdf',
        'application/octet-stream',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
    });
  })();
  return proxyPromise;
};

export const handler = async (
  event: Parameters<LambdaProxy>[0],
  context: Parameters<LambdaProxy>[1],
) => (await getProxy())(event, context);
