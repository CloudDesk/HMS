import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'patient-mobile', environment: 'node', include: ['src/**/*.test.ts'] } });
