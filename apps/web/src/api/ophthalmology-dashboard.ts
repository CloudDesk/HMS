import { z } from 'zod';
import { apiClient } from './client';
import { ophthalmologyIdSchema as id } from './ophthalmology';

const instant = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative();

export const ophthalmologyDashboardQuerySchema = z.object({ branch_id: id }).strict();
export const ophthalmologyDashboardMetricsSchema = z.object({
  waiting: count,
  in_progress: count,
  pending_review: count,
  reviewed: count,
  repeat_required: count,
  unable: count,
}).strict();
export const ophthalmologyDashboardSnapshotSchema = z.object({
  branchId: id,
  generatedAt: instant,
  metrics: ophthalmologyDashboardMetricsSchema,
  createdAt: instant.optional(),
  updatedAt: instant.optional(),
});

export type OphthalmologyDashboardQuery = z.infer<typeof ophthalmologyDashboardQuerySchema>;
export type OphthalmologyDashboardSnapshot = z.infer<typeof ophthalmologyDashboardSnapshotSchema>;

const path = (input: OphthalmologyDashboardQuery, action = '') => {
  const query = ophthalmologyDashboardQuerySchema.parse(input);
  return `/ophthalmology/dashboard${action}?${new URLSearchParams(query)}`;
};

export const ophthalmologyDashboardApi = {
  get: async (input: OphthalmologyDashboardQuery, signal?: AbortSignal) =>
    ophthalmologyDashboardSnapshotSchema.parse(await apiClient.request<unknown>(path(input), { signal })),
  refresh: async (input: OphthalmologyDashboardQuery) =>
    ophthalmologyDashboardSnapshotSchema.parse(await apiClient.request<unknown>(path(input, '/refresh'), { method: 'POST' })),
};
