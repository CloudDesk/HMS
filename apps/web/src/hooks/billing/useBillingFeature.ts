import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import {
  useBillingInvoices,
  useBillingSummary,
  useBillingInvoiceDetails,
  useBillingPayments,
  useCreateBillingInvoice,
  useUpdateBillingInvoice,
  useCancelBillingInvoice,
  useCollectBillingPayment,
  useBillingReceipt,
} from './useBilling';
import { useBranchesList } from '../branches/useBranches';
import type { BillingInvoiceListParams } from '../../api/billing';

export type BillingCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canCollectPayment: boolean;
  isSuperAdmin: boolean;
};

/**
 * Centralises Billing RBAC capability evaluation.
 * All billing pages must consume this hook's capability flags
 * rather than traversing user.permissions directly.
 */
export function useBillingCapabilities(): BillingCapabilities {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN'));

  const hasBillingAction = (action: string) =>
    isSuperAdmin ||
    hasPermission(user?.permissions ?? [], {
      module: 'Billing',
      screen: 'Invoices',
      action,
    });

  return {
    isSuperAdmin,
    canCreate: hasBillingAction('Create'),
    canEdit: hasBillingAction('Edit'),
    canCancel: hasBillingAction('Cancel'),
    canCollectPayment: hasBillingAction('CollectPayment'),
  };
}

export {
  useBillingInvoices,
  useBillingSummary,
  useBillingInvoiceDetails,
  useBillingPayments,
  useCreateBillingInvoice,
  useUpdateBillingInvoice,
  useCancelBillingInvoice,
  useCollectBillingPayment,
  useBillingReceipt,
  useBranchesList,
  type BillingInvoiceListParams,
};
