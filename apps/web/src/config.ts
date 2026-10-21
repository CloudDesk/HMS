const appEnv = import.meta.env.VITE_APP_ENV ?? (import.meta.env.MODE === 'prod' ? 'prod' : 'dev');
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const resolveApiBaseUrl = (): string => {
  if (appEnv === 'prod') {
    if (!rawApiBaseUrl || rawApiBaseUrl.includes('localhost') || rawApiBaseUrl.includes('127.0.0.1')) {
      throw new Error('VITE_API_BASE_URL must be configured to a valid remote URL in production environments');
    }
    return rawApiBaseUrl;
  }
  return rawApiBaseUrl ?? 'http://localhost:4000/api';
};

export const appConfig = {
  appEnv,
  apiBaseUrl: resolveApiBaseUrl().replace(/\/+$/, ''),
} as const;
