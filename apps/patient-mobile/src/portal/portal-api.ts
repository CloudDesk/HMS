import type { SessionManager } from '../auth/session-manager';
import {
  patientPortalContextSchema,
  patientPortalOverviewSchema,
  type PortalContext,
  type PortalOverview,
} from './contracts';

export class PortalApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async getContext(): Promise<PortalContext> {
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/context',
      patientPortalContextSchema
    );
  }

  async getOverview(patientId?: string): Promise<PortalOverview> {
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/overview',
      patientPortalOverviewSchema,
      patientId ? { query: { patient_id: patientId } } : undefined
    );
  }
}
