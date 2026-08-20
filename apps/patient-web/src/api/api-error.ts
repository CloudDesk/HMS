export class ApiError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getFriendlyAuthMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'The patient portal could not connect. Please try again.';
