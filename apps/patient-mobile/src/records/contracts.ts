import { z } from 'zod';

export const labResultItemSchema = z.object({
  serviceName: z.string(),
  value: z.string(),
  unit: z.string().nullable().optional(),
  referenceRange: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
});

export const labResultRecordSchema = z.object({
  id: z.string(),
  result_items: z.array(labResultItemSchema).default([]),
  remarks: z.string().nullable().optional(),
  entered_at: z.string(),
  verified_at: z.string(),
});

export const imagingReportRecordSchema = z.object({
  id: z.string(),
  findings: z.string(),
  impression: z.string(),
  recommendations: z.string().nullable().optional(),
  entered_at: z.string(),
  verified_at: z.string(),
});

export const recordsDataSchema = z.object({
  laboratory_results: z.array(labResultRecordSchema).default([]),
  imaging_reports: z.array(imagingReportRecordSchema).default([]),
});

export type LabResultItem = z.infer<typeof labResultItemSchema>;
export type LabResultRecord = z.infer<typeof labResultRecordSchema>;
export type ImagingReportRecord = z.infer<typeof imagingReportRecordSchema>;
export type RecordsData = z.infer<typeof recordsDataSchema>;
