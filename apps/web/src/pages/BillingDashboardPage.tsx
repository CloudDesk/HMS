import type { BillingInvoiceStatus } from '../api/billing';
import { useCurrencyFormatter } from '../api/useSettings';
import { useBillingDashboardFeature } from '../hooks/billing/useBillingDashboardFeature';
import { navigate } from '../routing/navigation';
import { billingStatusLabel } from './billing-utils';

const statuses: Array<{ status: BillingInvoiceStatus; icon: string; tone: string; note: string }> = [
  { status: 'DRAFT', icon: 'ph-note-pencil', tone: 'blue', note: 'Awaiting issue' },
  { status: 'PENDING', icon: 'ph-clock', tone: 'orange', note: 'Awaiting settlement' },
  { status: 'PARTIALLY_PAID', icon: 'ph-coins', tone: 'purple', note: 'Balance remains' },
  { status: 'PAID', icon: 'ph-check-circle', tone: 'green', note: 'Fully settled' },
  { status: 'CANCELLED', icon: 'ph-x-circle', tone: 'red', note: 'Cancelled invoices' },
];

export function BillingDashboardPage() {
  const formatMoney = useCurrencyFormatter();
  const { state: { effectiveBranchId, summary }, queries: { branches, summaryQuery }, actions: { setSelectedBranchId } } = useBillingDashboardFeature({ includeRecent: false });
  const unavailable = summaryQuery.isLoading || summaryQuery.isError;
  const settlementCount = summary.by_status.PENDING + summary.by_status.PARTIALLY_PAID;
  const collectionRate = summary.billed_amount > 0 ? Math.min(100, (summary.collected_amount / summary.billed_amount) * 100) : 0;
  const collectionRateLabel = collectionRate > 0 && collectionRate < 1
    ? `${collectionRate.toFixed(2)}%`
    : `${Math.round(collectionRate)}%`;

  const openHistory = (status?: BillingInvoiceStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (effectiveBranchId) params.set('branch_id', effectiveBranchId);
    navigate('/dashboard?tab=billing', { replace: true });
    navigate(`/billing/history${params.size ? `?${params.toString()}` : ''}`);
  };

  const metrics = [
    ['ph-file-text', 'blue', 'Total Invoices', unavailable ? null : summary.total_invoices, unavailable ? 'Summary unavailable' : `${settlementCount} awaiting settlement`, undefined],
    ['ph-receipt', 'blue', 'Total Billed', unavailable ? null : formatMoney(summary.billed_amount), unavailable ? 'Summary unavailable' : 'Excludes cancelled invoices', undefined],
    ['ph-check-circle', 'green', 'Collected', unavailable ? null : formatMoney(summary.collected_amount), unavailable ? 'Summary unavailable' : `${summary.by_status.PAID} fully paid`, 'PAID'],
    ['ph-warning', 'orange', 'Outstanding', unavailable ? null : formatMoney(summary.outstanding_amount), unavailable ? 'Summary unavailable' : 'Pending patient balance', undefined],
  ] as const;

  return <div className="pharmacy-dashboard billing-summary-dashboard">
    <section className="appointment-page-header">
      <div className="appointment-page-title"><h2>Billing Dashboard</h2><p>Invoice activity, collections, and outstanding balances</p><small>Read-only operational summary</small></div>
      {branches.length > 1 ? <label className="pharmacy-dashboard-branch"><span>Branch</span><select aria-label="Billing dashboard branch" onChange={(event) => setSelectedBranchId(event.target.value)} value={effectiveBranchId}><option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : null}
    </section>

    {summaryQuery.isError ? <div className="billing-state error"><i className="ph ph-warning-circle" /><strong>Billing data could not be loaded.</strong><button onClick={() => void summaryQuery.refetch()} type="button">Retry</button></div> : null}

    <section className="doc-kpi-grid billing-summary-kpis" aria-label="Billing summary">
      {metrics.map(([icon, tone, label, value, note, status]) => <button className="doc-kpi pharmacy-dashboard-kpi clickable" key={label} onClick={() => openHistory(status)} type="button"><span className={`doc-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span><div className="doc-kpi-copy"><span>{label}</span><strong>{value ?? '—'}</strong><small>{note} · View invoices</small></div></button>)}
    </section>

    <section className="pharmacy-dashboard-grid">
      <article className="doc-card"><div className="doc-card-header"><div><h3>Collection Progress</h3><p>Collected amount compared with total billed value</p></div></div><div className="billing-collection-content"><div className="billing-collection-value"><strong>{unavailable ? '—' : collectionRateLabel}</strong><span>collected</span></div><div className="inventory-coverage-track"><span style={{ width: `${collectionRate}%` }} /></div><div className="inventory-coverage-caption"><span>{unavailable ? '—' : formatMoney(summary.collected_amount)} collected</span><span>{unavailable ? '—' : formatMoney(summary.billed_amount)} billed</span></div></div></article>
      <article className="doc-card"><div className="doc-card-header"><div><h3>Settlement Attention</h3><p>Current unpaid invoice workload</p></div></div><div className="diagnostic-attention"><span className="doc-kpi-icon orange"><i className="ph ph-clock-countdown" aria-hidden="true" /></span><div><strong>{unavailable ? '—' : settlementCount} invoices awaiting settlement</strong><span>Pending and partially paid invoices require follow-up.</span></div></div><div className="diagnostic-attention"><span className="doc-kpi-icon red"><i className="ph ph-warning" aria-hidden="true" /></span><div><strong>{unavailable ? '—' : formatMoney(summary.outstanding_amount)} outstanding</strong><span>Remaining patient balance across the selected scope.</span></div></div></article>
    </section>

    <section className="doc-card"><div className="doc-card-header"><div><h3>Invoice Status</h3><p>Invoices distributed across the billing lifecycle</p></div></div><div className="billing-status-dashboard-grid">
      {statuses.map((item) => { const value = summary.by_status[item.status]; const percent = summary.total_invoices > 0 ? Math.round((value / summary.total_invoices) * 100) : 0; return <button className="laboratory-workflow-step" key={item.status} onClick={() => openHistory(item.status)} type="button"><span className={`doc-kpi-icon ${item.tone}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span><div className="laboratory-workflow-step-copy"><span>{billingStatusLabel[item.status]}</span><strong>{unavailable ? '—' : value}</strong><small>{item.note}</small></div><div className="laboratory-workflow-step-footer"><div className="diagnostic-workflow-track"><span style={{ width: `${percent}%` }} /></div><small>{unavailable ? '—' : `${percent}%`}</small></div><i className="ph ph-arrow-right laboratory-workflow-arrow" aria-hidden="true" /></button>; })}
    </div></section>
  </div>;
}
