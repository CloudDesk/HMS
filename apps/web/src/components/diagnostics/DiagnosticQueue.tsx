import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { branchesApi } from '../../api/branches';
import type { DiagnosticListParams, DiagnosticPage, DiagnosticSummary } from '../../api/laboratory';
import { useAuth } from '../../auth/useAuth';
import { navigate, useAppLocation } from '../../routing/navigation';

type Props = {
  module: 'laboratory' | 'imaging';
  statuses: string[];
  list: (params: DiagnosticListParams) => Promise<DiagnosticPage>;
  summary: (branchId?: string) => Promise<DiagnosticSummary>;
};
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value)) : '—';

export function DiagnosticQueue({ module, statuses, list, summary }: Props) {
  const { user } = useAuth();
  const location = useAppLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const branchesQuery = useQuery({
    queryKey: ['branches', module, 'options'],
    queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: superAdmin,
  });
  const branches = useMemo(() => superAdmin
    ? (branchesQuery.data?.data ?? []).map(({ id, code, name }) => ({ id, code, name }))
    : (user?.branches ?? []), [branchesQuery.data?.data, superAdmin, user?.branches]);
  const selectedBranch = query.get('branch_id') ?? '';
  const search = query.get('search') ?? '';
  const status = query.get('status') ?? '';
  const priority = query.get('priority') ?? '';
  const dateFrom = query.get('date_from') ?? '';
  const dateTo = query.get('date_to') ?? '';
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.get('limit') ?? 20) || 20));
  const update = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(location.search);
    Object.entries(changes).forEach(([key, value]) => value === '' || value === null ? next.delete(key) : next.set(key, String(value)));
    navigate(`/${module}/queue${next.size ? `?${next}` : ''}`, { replace: true });
  }, [location.search, module]);
  const params = useMemo<DiagnosticListParams>(() => ({
    branch_id: selectedBranch || undefined, search: search.trim() || undefined, status: status || undefined,
    priority: priority as DiagnosticListParams['priority'] || undefined,
    date_from: dateFrom || undefined, date_to: dateTo || undefined, page, limit,
  }), [dateFrom, dateTo, limit, page, priority, search, selectedBranch, status]);
  const listQuery = useQuery({ queryKey: [module, 'orders', params], queryFn: () => list(params) });
  const summaryQuery = useQuery({ queryKey: [module, 'summary', selectedBranch], queryFn: () => summary(selectedBranch || undefined) });
  const data = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const moduleName = module === 'laboratory' ? 'Laboratory' : 'Imaging';
  const entryPath = module === 'laboratory' ? 'results' : 'reports';

  return <div className={`diagnostic-page ${module}`}>
    <div className="diagnostic-kpis">
      <div className="kpi-card"><div className="kpi-info"><span className="kpi-label">Total Orders</span><span className="kpi-value">{summaryQuery.isLoading ? '—' : summaryQuery.data?.total ?? 0}</span></div></div>
      {statuses.slice(0, 5).map((item) => <div className="kpi-card" key={item}><div className="kpi-info"><span className="kpi-label">{label(item)}</span><span className="kpi-value">{summaryQuery.isLoading ? '—' : summaryQuery.data?.by_status[item] ?? 0}</span></div></div>)}
    </div>
    <section className="card diagnostic-panel">
      <div className="diagnostic-toolbar">
        <div className="um-search"><i className="ph ph-magnifying-glass" /><input type="search" value={search} onChange={(event) => update({ search: event.target.value, page: 1 })} placeholder={`Search ${moduleName.toLowerCase()} orders...`} /></div>
        <select className="um-filter" value={selectedBranch} onChange={(event) => update({ branch_id: event.target.value, page: 1 })}><option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <select className="um-filter" value={status} onChange={(event) => update({ status: event.target.value, page: 1 })}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
        <select className="um-filter" value={priority} onChange={(event) => update({ priority: event.target.value, page: 1 })}><option value="">All priorities</option><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT</option></select>
        <input aria-label="From date" className="um-filter" type="date" value={dateFrom} onChange={(event) => update({ date_from: event.target.value, page: 1 })} />
        <input aria-label="To date" className="um-filter" type="date" value={dateTo} onChange={(event) => update({ date_to: event.target.value, page: 1 })} />
        <button className="btn-secondary" type="button" onClick={() => navigate(`/${module}/queue`, { replace: true })}>Clear</button>
      </div>
      <div className="table-responsive"><table className="data-table"><thead><tr><th>Patient</th><th>Services</th><th>Doctor</th><th>Submitted</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {listQuery.isLoading ? <tr><td colSpan={7} className="um-state-cell"><span className="loading-spinner" /> Loading orders...</td></tr> : null}
        {listQuery.isError ? <tr><td colSpan={7} className="um-state-cell"><i className="ph ph-warning" /> Unable to load orders. Retry from this page.</td></tr> : null}
        {!listQuery.isLoading && !listQuery.isError && data.length === 0 ? <tr><td colSpan={7} className="um-state-cell"><i className="ph ph-inbox" /> No submitted orders match these filters.</td></tr> : null}
        {data.map((order) => <tr key={order.id}>
          <td><div className="user-cell-info"><strong>{order.patient_name}</strong><span className="muted-cell">{order.patient_number}</span></div></td>
          <td><strong>{order.items.length}</strong><span className="muted-cell">{order.items.map((item) => item.service_name).join(', ')}</span></td>
          <td>{order.doctor_name}</td><td>{dateTime(order.submitted_at)}</td>
          <td><span className={`diagnostic-priority priority-${order.priority.toLowerCase()}`}>{order.priority}</span></td>
          <td><span className={`diagnostic-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{label(order.status)}</span></td>
          <td><div className="action-icons"><button className="action-icon-btn" title="Open workspace" type="button" onClick={() => navigate(`/${module}/workspace?id=${order.id}`)}><i className="ph ph-arrow-square-out" /></button>{['IN_PROGRESS', 'RESULT_ENTERED', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.status) ? <button className="action-icon-btn" title="Open result/report" type="button" onClick={() => navigate(`/${module}/${entryPath}?id=${order.id}`)}><i className="ph ph-file-text" /></button> : null}</div></td>
        </tr>)}
      </tbody></table></div>
      <div className="um-pagination"><span>{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : 'No orders'}</span><div className="um-page-controls"><button className="pg-btn" disabled={page <= 1} onClick={() => update({ page: page - 1 })}><i className="ph ph-caret-left" /></button><span className="pg-btn active">{page}</span><button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => update({ page: page + 1 })}><i className="ph ph-caret-right" /></button></div></div>
    </section>
  </div>;
}
