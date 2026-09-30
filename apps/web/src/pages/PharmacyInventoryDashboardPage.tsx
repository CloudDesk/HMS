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
    <div className="hms-dash-wrapper">
      <div className="hms-dash-header">
        <div className="hms-dash-title">
          <h2>Pharmacy Inventory Dashboard</h2>
          <p>Live medicine availability, stock health, and expiry exposure</p>
        </div>
        <div className="hms-dash-actions">
          {branches.length > 0 ? (
            <select
              aria-label="Inventory dashboard branch"
              className="hms-dash-select"
              onChange={(event) => setRequestedBranch(event.target.value)}
              value={activeBranchId}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="hms-dash-kpi-grid">
        {metrics.map(([icon, tone, label, value, copy, destination]) => {
          const clickable = destination !== null;
          return (
            <button
              className={`hms-dash-kpi-card${clickable ? ' clickable' : ''}`}
              disabled={!clickable}
              key={label}
              onClick={clickable ? () => openInventory(destination) : undefined}
              type="button"
            >
              <div className="hms-kpi-top">
                <span className={`hms-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span>
                {clickable ? <i className="ph ph-arrow-up-right" style={{ color: '#94a3b8', fontSize: '14px' }} /> : null}
              </div>
              <div>
                <div className="hms-kpi-label">{label}</div>
                <div className="hms-kpi-value">{isLoading ? '—' : value?.toLocaleString() ?? '—'}</div>
                <div className="hms-kpi-sub">{clickable ? `${copy} · View inventory` : copy}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hms-dash-grid two-col-7-5">
        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Stock Coverage Health</h3>
              <p className="hms-card-desc">Configured medicines currently carrying available stock</p>
            </div>
          </div>
          <div className="hms-card-body">
            <div className="inventory-coverage-content">
              <div className="inventory-coverage-value">
                <strong>{isLoading || !summary ? '—' : `${coverage}%`}</strong>
                <span>stocked</span>
              </div>
              <div className="inventory-coverage-track">
                <span style={{ width: `${coverage}%` }} />
              </div>
              <div className="inventory-coverage-caption">
                <span>{summary?.stocked_medicines ?? '—'} stocked medicines</span>
                <span>{summary?.total_medicines ?? '—'} total medicines</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Inventory Attention</h3>
              <p className="hms-card-desc">Items requiring operational review</p>
            </div>
          </div>
          <div className="hms-card-body">
            <div className="hms-attention-list">
              <button className="hms-attention-item" onClick={() => openInventory({ stockState: 'LOW_STOCK' })} type="button" style={{ borderLeft: '3px solid #f59e0b' }}>
                <div className="hms-attention-left">
                  <span className="legend-dot pending" />
                  <div className="hms-attention-text">
                    <strong>{summary?.low_stock_medicines ?? '—'} low-stock medicines</strong>
                    <small>Review replenishment levels</small>
                  </div>
                </div>
                <i className="ph ph-caret-right" style={{ color: '#94a3b8' }} />
              </button>
              <button className="hms-attention-item" onClick={() => openInventory({ stockState: 'OUT_OF_STOCK' })} type="button" style={{ borderLeft: '3px solid #ef4444' }}>
                <div className="hms-attention-left">
                  <span className="legend-dot danger" />
                  <div className="hms-attention-text">
                    <strong>{summary?.out_of_stock_medicines ?? '—'} out-of-stock medicines</strong>
                    <small>Restocking required</small>
                  </div>
                </div>
                <i className="ph ph-caret-right" style={{ color: '#94a3b8' }} />
              </button>
              <button className="hms-attention-item" onClick={() => openInventory({ expiryState: 'EXPIRING_SOON' })} type="button" style={{ borderLeft: '3px solid #9333ea' }}>
                <div className="hms-attention-left">
                  <span className="legend-dot purple" />
                  <div className="hms-attention-text">
                    <strong>{summary?.expiring_soon_medicines ?? '—'} expiring soon</strong>
                    <small>Within {summary?.expiry_warning_days ?? 30} days</small>
                  </div>
                </div>
                <i className="ph ph-caret-right" style={{ color: '#94a3b8' }} />
              </button>
              <button className="hms-attention-item" onClick={() => openInventory({ expiryState: 'EXPIRED' })} type="button" style={{ borderLeft: '3px solid #64748b' }}>
                <div className="hms-attention-left">
                  <span className="legend-dot slate" />
                  <div className="hms-attention-text">
                    <strong>{summary?.expired_medicines ?? '—'} expired medicines</strong>
                    <small>Remove from usable stock</small>
                  </div>
                </div>
                <i className="ph ph-caret-right" style={{ color: '#94a3b8' }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
