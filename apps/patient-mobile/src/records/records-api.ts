import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager';
import {
  recordsDataSchema,
  type RecordsData,
} from './contracts';

export class RecordsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async getRecords(patientId?: string): Promise<RecordsData> {
    const query = patientId ? { patient_id: patientId } : undefined;
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/overview',
      z.object({
        laboratory_results: recordsDataSchema.shape.laboratory_results,
        imaging_reports: recordsDataSchema.shape.imaging_reports,
      }),
      query ? { query } : undefined
    );

    return recordsDataSchema.parse({
      laboratory_results: response.laboratory_results,
      imaging_reports: response.imaging_reports,
    });
  }
}
