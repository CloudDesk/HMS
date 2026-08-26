import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/hms-test',
    },
  },
});
