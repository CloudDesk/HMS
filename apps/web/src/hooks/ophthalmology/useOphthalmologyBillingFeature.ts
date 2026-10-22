import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useBillingInvoices } from '../billing/useBilling';
import type { CompletionWorkspace } from './useOphthalmologyCompletionFeature';

export function useOphthalmologyBillingFeature(workspace: CompletionWorkspace) {
  const { user } = useAuth();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const allowed = (module: string, screen: string) => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'))
    || hasPermission(user?.permissions ?? [], { module, screen, action: 'View' });
  const canView = workspace.canView && allowed('OPD', 'Ophthalmology Consultation') && allowed('Billing', 'Invoices');
  const requestedPage = Number(params.get('billing_page') ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const active = canView && Boolean(workspace.visit && workspace.context) && !workspace.scopeError
    && !workspace.visitQuery.isError && !workspace.contextQuery.isError
    && (params.get('section') === 'completion' || params.get('area') === 'summary');
  const query = useBillingInvoices({ patient_id: workspace.visit?.patient_id, branch_id: workspace.visit?.branch_id,
    page, limit: 20, sortBy: 'invoice_date', sortOrder: 'desc' }, active);
  const scopeError = active && Boolean(query.data?.data.some((invoice) => invoice.patient_id !== workspace.visit?.patient_id
    || invoice.branch_id !== workspace.visit?.branch_id));
  const invoices = active && !scopeError && !query.isError ? query.data?.data ?? [] : [];
  const setPage = (nextPage: number) => {
    if (!active || !Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > (query.data?.meta.totalPages ?? 1)) return;
    const next = new URLSearchParams(search); next.set('billing_page', String(nextPage));
    navigate(`/opd/ophthalmology?${next}`);
  };
  return { canView, active, query, scopeError, invoices, page, setPage, visitId: workspace.visitId,
    refresh: () => active ? query.refetch() : Promise.resolve(undefined),
    openInvoice: (id: string) => { if (invoices.some((invoice) => invoice.id === id)) navigate(`/billing/workspace?id=${encodeURIComponent(id)}`); },
  };
}
