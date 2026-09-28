import type { SessionManager } from '../auth/session-manager';
import {
  dentalQuotationSchema,
  dentalQuotationsListSchema,
  patientDentalStagesListSchema,
  type DentalQuotation,
  type PatientDentalStage,
} from './contracts';

export class DentalApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async listQuotations(patientId: string): Promise<DentalQuotation[]> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/quotations/patient/${encodeURIComponent(patientId)}`,
      dentalQuotationsListSchema
    );

    return dentalQuotationsListSchema.parse(response);
  }

  async listPatientStages(patientId: string): Promise<PatientDentalStage[]> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/patients/${encodeURIComponent(patientId)}/stages`,
      patientDentalStagesListSchema
    );

    return patientDentalStagesListSchema.parse(response);
  }

  async getQuotation(quotationId: string): Promise<DentalQuotation> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}`,
      dentalQuotationSchema
    );

    return dentalQuotationSchema.parse(response);
  }

  async acceptQuotation(
    quotationId: string,
    payload: { selected_option_id: string; notes?: string }
  ): Promise<DentalQuotation> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/accept`,
      dentalQuotationSchema,
      {
        method: 'POST',
        body: payload,
      }
    );

    return dentalQuotationSchema.parse(response);
  }

  async rejectQuotation(
    quotationId: string,
    payload: { reason?: string }
  ): Promise<DentalQuotation> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/reject`,
      dentalQuotationSchema,
      {
        method: 'POST',
        body: payload,
      }
    );

    return dentalQuotationSchema.parse(response);
  }

  async postponeQuotation(
    quotationId: string,
    payload: { reason?: string }
  ): Promise<DentalQuotation> {
    const response = await this.sessionManager.authenticatedRequest(
      `/opd/dental/quotations/${encodeURIComponent(quotationId)}/postpone`,
      dentalQuotationSchema,
      {
        method: 'POST',
        body: payload,
      }
    );

    return dentalQuotationSchema.parse(response);
  }
}

