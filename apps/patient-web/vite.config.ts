import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@web': path.resolve(import.meta.dirname, '../web/src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  preview: { port: 4174 },
});
