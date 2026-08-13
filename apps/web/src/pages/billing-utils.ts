import type { BillingInvoiceStatus, BillingServiceType } from '../api/billing';
import { ApiError } from '../api/api-error';

export const formatBillingMoney = (value: number) => new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
}).format(value);

export const formatBillingDate = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));

export const formatBillingDateTime = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export const billingStatusLabel: Record<BillingInvoiceStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const billingServiceLabel: Record<BillingServiceType, string> = {
  CONSULTATION: 'Consultation',
  LAB_TEST: 'Laboratory Test',
  IMAGING_SERVICE: 'Imaging Service',
  PHARMACY: 'Pharmacy',
};

export const billingErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) return error.message;
  return 'Unable to complete the billing request.';
};

export const billingStatusClass = (status: BillingInvoiceStatus) => status.toLowerCase().replaceAll('_', '-');
