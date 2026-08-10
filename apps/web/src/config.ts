export const appConfig = {
  appEnv: import.meta.env.VITE_APP_ENV ?? 'dev',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(
    /\/+$/,
    '',
  ),
} as const;
