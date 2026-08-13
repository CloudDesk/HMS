import type { ClinicalOrderListQuery } from '../opd/opd-clinical-order.types.js';

export type LaboratoryOrderListQuery = ClinicalOrderListQuery;

export type LaboratoryResultItemDTO = {
  service_id: string;
  service_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  comments?: string | null;
};

export type SaveLaboratoryResultDTO = {
  result_items: LaboratoryResultItemDTO[];
  remarks?: string | null;
};

export type UpdateLaboratoryStatusDTO = {
  status: 'RECEIVED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'VERIFIED' | 'COMPLETED';
};
