import type { ClinicalOrderListQuery } from '../opd/opd-clinical-order.types.js';

export type ImagingOrderListQuery = ClinicalOrderListQuery;
export type SaveImagingReportDTO = {
  findings: string;
  impression: string;
  recommendations?: string | null;
};
export type UpdateImagingStatusDTO = {
  status: 'RECEIVED' | 'IN_PROGRESS' | 'VERIFIED' | 'COMPLETED';
};
