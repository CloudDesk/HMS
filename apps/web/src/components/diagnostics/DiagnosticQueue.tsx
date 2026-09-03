import type { DiagnosticOrder, DiagnosticSummary } from '../../api/laboratory';
import { navigate } from '../../routing/navigation';
import { formatRegionalDateTime } from '../../utils/localization-utils';
import { useTimezone } from '../../api/useSettings';
import { MedicalLoader } from '../ui/MedicalLoader';

type Props = {
  module: 'laboratory' | 'imaging';
  statuses: string[];

  // Data props
  orders: DiagnosticOrder[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: DiagnosticSummary | null;
  isLoading: boolean;
  isError: boolean;
  isSummaryLoading: boolean;

  // Filter props
  branches: { id: string; name: string }[];
  filters: {
    selectedBranch: string;
    search: string;
    status: string;
    priority: string;
    dateFrom: string;
    dateTo: string;
    page: number;
    limit: number;
  };
  updateFilters: (changes: Record<string, string | number | null>) => void;
  clearFilters: () => void;
};

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const sourceLabel = (value: DiagnosticOrder['source_type']) => value === 'IP_ADMISSION' ? 'IP / Admission' : label(value);

export function DiagnosticQueue({
  module,
  statuses,
  orders,
  meta,
  summary,
  isLoading,
  isError,
  isSummaryLoading,
  branches,
  filters,
  updateFilters,
  clearFilters
}: Props) {
  const timezone = useTimezone();
  const dateTime = (value: string | null) => formatRegionalDateTime(value, timezone);
  const moduleName = module === 'laboratory' ? 'Laboratory' : 'Imaging';
  const entryPath = module === 'laboratory' ? 'results' : 'reports';
  const columnCount = 8;
  return <div className={`diagnostic-page ${module}`}>
    <div className="diagnostic-kpis">
      <div className="kpi-card">
        <div className="kpi-info">
          <span className="kpi-label">Total Orders</span>
          <span className="kpi-value">{isSummaryLoading || !summary ? '---' : summary.total}</span>
        </div>
      </div>
      {statuses.slice(0, 5).map((item) => (
        <div className="kpi-card" key={item}>
          <div className="kpi-info">
            <span className="kpi-label">{label(item)}</span>
            <span className="kpi-value">{isSummaryLoading || !summary ? '---' : summary.by_status[item] ?? 0}</span>
          </div>
        </div>
      ))}
    </div>
    <section className="card diagnostic-panel">
      <div className="diagnostic-toolbar">
        <div className="um-search">
          <i className="ph ph-magnifying-glass" />
          <input type="search" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value, page: 1 })} placeholder={`Search ${moduleName.toLowerCase()} orders...`} />
        </div>
        <select className="um-filter" value={filters.selectedBranch} onChange={(event) => updateFilters({ branch_id: event.target.value, page: 1 })}>
          <option value="">All accessible branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <select className="um-filter" value={filters.status} onChange={(event) => updateFilters({ status: event.target.value, page: 1 })}>
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select className="um-filter" value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value, page: 1 })}>
          <option value="">All priorities</option>
          <option value="ROUTINE">Routine</option>
          <option value="URGENT">Urgent</option>
          <option value="STAT">STAT</option>
        </select>
        <input aria-label="From date" className="um-filter" type="date" value={filters.dateFrom} onChange={(event) => updateFilters({ date_from: event.target.value, page: 1 })} />
        <input aria-label="To date" className="um-filter" type="date" value={filters.dateTo} onChange={(event) => updateFilters({ date_to: event.target.value, page: 1 })} />
        <button className="btn-secondary" type="button" onClick={clearFilters}>Clear</button>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead><tr><th>Patient</th><th>Source</th><th>Services</th><th>Doctor</th><th>Submitted</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} style={{ padding: '2.5rem 1rem' }}>
                  <MedicalLoader
                    text={`Loading ${module === 'laboratory' ? 'laboratory' : 'imaging'} orders...`}
                    subtext="Retrieving diagnostic orders and sample statuses"
                  />
                </td>
              </tr>
            ) : null}
            {isError ? <tr><td colSpan={columnCount} className="um-state-cell"><i className="ph ph-warning" /> Unable to load orders. Retry from this page.</td></tr> : null}
            {!isLoading && !isError && orders.length === 0 ? <tr><td colSpan={columnCount} className="um-state-cell"><i className="ph ph-inbox" /> No submitted orders match these filters.</td></tr> : null}
            {orders.map((order) => <tr key={order.id}>
              <td><div className="user-cell-info"><strong>{order.patient_name}</strong></div></td>
              <td><span className="status-badge">{sourceLabel(order.source_type)}</span></td>
              <td><span className="service-text">{order.items.map((item) => item.service_name).join(', ')}</span></td>
              <td>{order.doctor_name}</td><td>{dateTime(order.submitted_at)}</td>
              <td><span className={`diagnostic-priority priority-${order.priority.toLowerCase()}`}>{order.priority}</span></td>
              <td><span className={`diagnostic-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{label(order.status)}</span></td>
              <td>
                <div className="action-icons">
                  <button className="action-icon-btn" title="Open workspace" type="button" onClick={() => navigate(`/${module}/workspace?id=${order.id}`)}><i className="ph ph-arrow-square-out" /></button>
                  {['IN_PROGRESS', 'RESULT_ENTERED', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.status) ? <button className="action-icon-btn" title="Open result/report" type="button" onClick={() => navigate(`/${module}/${entryPath}?id=${order.id}`)}><i className="ph ph-file-text" /></button> : null}
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="um-pagination">
        <span>{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1} - ${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : 'No orders'}</span>
        <div className="um-page-controls">
          <button className="pg-btn" disabled={filters.page <= 1} onClick={() => updateFilters({ page: filters.page - 1 })}><i className="ph ph-caret-left" /></button>
          <span className="pg-btn active">{filters.page}</span>
          <button className="pg-btn" disabled={filters.page >= meta.totalPages} onClick={() => updateFilters({ page: filters.page + 1 })}><i className="ph ph-caret-right" /></button>
        </div>
      </div>
    </section>
  </div>;
}
