import { useMemo, useState } from 'react';
import type { ExpiryState, StockState } from '../api/pharmacy-inventory';
import { usePharmacyInventoryFeature } from '../hooks/pharmacy/usePharmacyInventoryFeature';
import { navigate } from '../routing/navigation';

type InventoryDestination = {
  stockState?: StockState;
  expiryState?: ExpiryState;
};

export function PharmacyInventoryDashboardPage() {
  const [requestedBranch, setRequestedBranch] = useState('');
  const feature = usePharmacyInventoryFeature({
    requestedBranch,
    search: '',
    stockState: '',
    expiryState: '',
    page: 1,
    limit: 5,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    selectedMedicineId: null,
    detailTab: 'batches',
    modalMode: null,
  });

  const { activeBranchId, branches, isLoading, summary } = feature;
  const coverage = useMemo(() => {
    if (!summary || summary.total_medicines === 0) return 0;
    return Math.round((summary.stocked_medicines / summary.total_medicines) * 100);
  }, [summary]);

  const openInventory = ({ stockState, expiryState }: InventoryDestination = {}) => {
    const params = new URLSearchParams();
    if (activeBranchId) params.set('branch_id', activeBranchId);
    if (stockState) params.set('stock_state', stockState);
    if (expiryState) params.set('expiry_state', expiryState);
    navigate('/dashboard?tab=pharmacy-inventory', { replace: true });
    navigate(`/pharmacy/inventory${params.size ? `?${params.toString()}` : ''}`);
  };

  const metrics = [
    ['ph-pill', 'blue', 'Medicines Stocked', summary?.stocked_medicines, summary ? `${summary.total_medicines} medicines configured` : 'Summary unavailable', {}],
    ['ph-stack', 'green', 'Total Units', summary?.total_available_quantity, 'Available across active batches', {}],
    ['ph-warning', 'orange', 'Low Stock', summary?.low_stock_medicines, 'Needs replenishment review', { stockState: 'LOW_STOCK' as const }],
    ['ph-x-circle', 'red', 'Out of Stock', summary?.out_of_stock_medicines, 'Needs immediate restocking', { stockState: 'OUT_OF_STOCK' as const }],
    ['ph-calendar-warning', 'purple', `Expiring <${summary?.expiry_warning_days ?? 30}d`, summary?.expiring_soon_medicines, summary ? `${summary.expired_medicines} already expired` : 'Summary unavailable', { expiryState: 'EXPIRING_SOON' as const }],
  ] as const;

  return (
    <div className="pharmacy-dashboard pharmacy-inventory-dashboard">
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Pharmacy Inventory Dashboard</h2>
          <p>Live medicine availability, stock health, and expiry exposure</p>
          <small>Read-only operational summary</small>
        </div>
        {branches.length > 0 ? (
          <label className="pharmacy-dashboard-branch">
            <span>Branch</span>
            <select aria-label="Inventory dashboard branch" onChange={(event) => setRequestedBranch(event.target.value)} value={activeBranchId}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
            </select>
          </label>
        ) : null}
      </section>

      <section className="doc-kpi-grid pharmacy-inventory-kpis">
        {metrics.map(([icon, tone, label, value, copy, destination]) => {
          const clickable = destination !== null;
          return (
            <button className={`doc-kpi pharmacy-dashboard-kpi${clickable ? ' clickable' : ''}`} disabled={!clickable} key={label} onClick={clickable ? () => openInventory(destination) : undefined} type="button">
              <span className={`doc-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span>
              <div className="doc-kpi-copy">
                <span>{label}</span>
                <strong>{isLoading ? '—' : value?.toLocaleString() ?? '—'}</strong>
                <small>{clickable ? `${copy} · View inventory` : copy}</small>
              </div>
            </button>
          );
        })}
      </section>

      <section className="pharmacy-dashboard-grid">
        <article className="doc-card">
          <div className="doc-card-header"><div><h3>Stock Coverage</h3><p>Configured medicines currently carrying available stock</p></div></div>
          <div className="inventory-coverage-content">
            <div className="inventory-coverage-value"><strong>{isLoading || !summary ? '—' : `${coverage}%`}</strong><span>stocked</span></div>
            <div className="inventory-coverage-track"><span style={{ width: `${coverage}%` }} /></div>
            <div className="inventory-coverage-caption">
              <span>{summary?.stocked_medicines ?? '—'} stocked medicines</span>
              <span>{summary?.total_medicines ?? '—'} total medicines</span>
            </div>
          </div>
        </article>

        <article className="doc-card">
          <div className="doc-card-header"><div><h3>Inventory Attention</h3><p>Items requiring operational review</p></div></div>
          <div className="inventory-attention-list">
            <button onClick={() => openInventory({ stockState: 'LOW_STOCK' })} type="button"><span className="legend-dot pending" /><div><strong>{summary?.low_stock_medicines ?? '—'} low-stock medicines</strong><small>Review replenishment levels</small></div><i className="ph ph-caret-right" /></button>
            <button onClick={() => openInventory({ stockState: 'OUT_OF_STOCK' })} type="button"><span className="legend-dot danger" /><div><strong>{summary?.out_of_stock_medicines ?? '—'} out-of-stock medicines</strong><small>Restocking required</small></div><i className="ph ph-caret-right" /></button>
            <button onClick={() => openInventory({ expiryState: 'EXPIRING_SOON' })} type="button"><span className="legend-dot purple" /><div><strong>{summary?.expiring_soon_medicines ?? '—'} expiring soon</strong><small>Within {summary?.expiry_warning_days ?? 30} days</small></div><i className="ph ph-caret-right" /></button>
            <button onClick={() => openInventory({ expiryState: 'EXPIRED' })} type="button"><span className="legend-dot slate" /><div><strong>{summary?.expired_medicines ?? '—'} expired medicines</strong><small>Remove from usable stock</small></div><i className="ph ph-caret-right" /></button>
          </div>
        </article>
      </section>
    </div>
  );
}
