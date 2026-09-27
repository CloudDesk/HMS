import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager';
import {
  billingOverviewDataSchema,
  portalInvoiceDetailsSchema,
  type PortalInvoiceDetails,
  type PortalInvoiceSummaryItem,
} from './contracts';

export class BillingApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async getBillingOverview(
    patientId?: string
  ): Promise<{ invoices: PortalInvoiceSummaryItem[]; outstandingCount: number }> {
    const query = patientId ? { patient_id: patientId } : undefined;
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/overview',
      z.object({
        invoices: billingOverviewDataSchema.shape.invoices,
        summary: billingOverviewDataSchema.shape.summary,
      }),
      query ? { query } : undefined
    );

    const parsed = billingOverviewDataSchema.parse({
      invoices: response.invoices,
      summary: response.summary,
    });

    return {
      invoices: parsed.invoices,
      outstandingCount: parsed.summary?.outstanding_invoices ?? 0,
    };
  }

  async getInvoiceDetails(
    patientId: string,
    invoiceId: string
  ): Promise<PortalInvoiceDetails> {
    const response = await this.sessionManager.authenticatedRequest(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/invoices/${encodeURIComponent(invoiceId)}`,
      portalInvoiceDetailsSchema
    );

    return portalInvoiceDetailsSchema.parse(response);
  }
}
