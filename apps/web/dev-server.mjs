import { createServer } from 'vite';

process.stdin.resume();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const server = await createServer({
  configFile: './vite.config.ts',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  },
});

await server.listen();
server.printUrls();

setInterval(() => {}, 1000 * 60 * 60 * 24);
