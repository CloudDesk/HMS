export const MPESA_RECONCILIATION_LEASE_MS = 60_000;
export const MPESA_SUBMISSION_STALE_MS = 120_000;
export const MPESA_RECONCILIATION_MAX_RETRIES = 5;
export const reconciliationDelay = (retries: number) => Math.min(300_000, 15_000 * 2 ** retries);
