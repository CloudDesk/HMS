import {
  laboratoryApi,
  type DiagnosticListParams,
  type LaboratoryResultPayload,
  type LaboratoryStatus,
} from '../api/laboratory';

export const laboratoryService = {
  list: (params: DiagnosticListParams) => laboratoryApi.list(params),
  summary: (branchId?: string) => laboratoryApi.summary(branchId),
  get: (id: string) => laboratoryApi.get(id),
  updateStatus: (id: string, status: Exclude<LaboratoryStatus, 'SUBMITTED' | 'RESULT_ENTERED'>) =>
    laboratoryApi.updateStatus(id, status),
  getResult: (id: string) => laboratoryApi.getResult(id),
  enterResult: (id: string, payload: LaboratoryResultPayload) => laboratoryApi.enterResult(id, payload),
  updateResult: (id: string, payload: LaboratoryResultPayload) => laboratoryApi.updateResult(id, payload),
};
