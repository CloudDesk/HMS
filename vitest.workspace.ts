import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api/vitest.config.ts',
  'apps/patient-web/vitest.config.ts',
  'apps/web/vitest.config.ts'
]);

