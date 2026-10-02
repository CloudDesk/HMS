import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/hms-test',
    },
  },
});
