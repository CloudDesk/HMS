export const appConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/+$/, ''),
  staffWebUrl: import.meta.env.VITE_STAFF_WEB_URL ?? (import.meta.env.DEV ? 'http://localhost:5173/login' : ''),
} as const;
