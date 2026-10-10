import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier format');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const claimLifecycleReportQuerySchema = z.object({
  branchId: id,
  startDate: dateString.optional(),
  endDate: dateString.optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'startDate must not be after endDate' },
);

export const remittanceReconciliationReportQuerySchema = z.object({
  branchId: id,
  currency: z.string().trim().toUpperCase().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'startDate must not be after endDate' },
);

export const outstandingWorkReportQuerySchema = z.object({
  branchId: id,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  category: z.enum([
    'ALL',
    'OPEN_QUERIES',
    'OPEN_APPEALS',
    'INCOMPLETE_RECONCILIATION',
    'UNCLOSED_CLAIMS',
  ]).default('ALL'),
});

export const claimHistoryParamsSchema = z.object({
  claimId: id,
});
