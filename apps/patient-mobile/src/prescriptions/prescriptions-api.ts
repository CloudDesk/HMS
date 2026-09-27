import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager';
import {
  prescriptionsDataSchema,
  type PrescriptionsData,
} from './contracts';

export class PrescriptionsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async getPrescriptions(patientId?: string): Promise<PrescriptionsData> {
    const query = patientId ? { patient_id: patientId } : undefined;
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/overview',
      z.object({
        prescriptions: prescriptionsDataSchema.shape.prescriptions,
        purchased_medicines: prescriptionsDataSchema.shape.purchased_medicines,
      }),
      query ? { query } : undefined
    );

    return prescriptionsDataSchema.parse({
      prescriptions: response.prescriptions,
      purchased_medicines: response.purchased_medicines,
    });
  }
}
