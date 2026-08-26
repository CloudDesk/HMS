import {
  imagingApi,
  type ImagingReportPayload,
} from '../api/imaging';
import type { DiagnosticListParams, ImagingStatus } from '../api/laboratory';

export const imagingService = {
  list: (params: DiagnosticListParams) => imagingApi.list(params),
  summary: (branchId?: string) => imagingApi.summary(branchId),
  get: (id: string) => imagingApi.get(id),
  updateStatus: (id: string, status: Exclude<ImagingStatus, 'SUBMITTED' | 'REPORT_ENTERED'>) =>
    imagingApi.updateStatus(id, status),
  getReport: (id: string) => imagingApi.getReport(id),
  enterReport: (id: string, payload: ImagingReportPayload) => imagingApi.enterReport(id, payload),
  updateReport: (id: string, payload: ImagingReportPayload) => imagingApi.updateReport(id, payload),
};
