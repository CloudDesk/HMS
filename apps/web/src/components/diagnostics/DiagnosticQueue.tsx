import { useMemo, useState } from 'react';
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

type DiagnosticSortField = 'patient' | 'source' | 'services' | 'doctor' | 'submitted' | 'priority' | 'status' | null;
type DiagnosticSortDir = 'asc' | 'desc';

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: Exclude<DiagnosticSortField, null>;
  sortField: DiagnosticSortField;
  sortDir: DiagnosticSortDir;
}) {
  if (sortField !== field) {
    return <i className="ph ph-arrows-down-up th-sort-icon" aria-hidden="true" />;
  }
  return sortDir === 'asc' ? (
    <i className="ph ph-arrow-up th-sort-icon" aria-hidden="true" />
  ) : (
    <i className="ph ph-arrow-down th-sort-icon" aria-hidden="true" />
  );
}

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

const PRIORITY_ORDER: Record<string, number> = {
  STAT: 3,
  URGENT: 2,
  ROUTINE: 1,
};

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const sourceLabel = (value: string) => {
  switch (value) {
    case 'IP_ADMISSION':
    case 'INPATIENT_ADMISSION':
      return 'IP / Admission';
    case 'OPD_VISIT':
      return 'OPD Visit';
    case 'OPD':
      return 'OPD Consultation';
    case 'EMERGENCY_ENCOUNTER':
      return 'Emergency Encounter';
    case 'EMERGENCY':
      return 'Emergency';
    case 'PROCEDURE':
    case 'PROCEDURE_BOOKING':
      return 'Procedure';
    case 'SURGERY':
      return 'Surgery';
    default:
      return label(value ?? '');
  }
};

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

  const [sortField, setSortField] = useState<DiagnosticSortField>(null);
  const [sortDir, setSortDir] = useState<DiagnosticSortDir>('asc');

  const handleSort = (field: Exclude<DiagnosticSortField, null>) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedOrders = useMemo(() => {
    if (!sortField) return orders;
    return [...orders].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'patient':
          cmp = (a.patient_name || '').localeCompare(b.patient_name || '');
          break;
        case 'source':
          cmp = sourceLabel(a.source_type).localeCompare(sourceLabel(b.source_type));
          break;
        case 'services': {
          const aServices = a.items.map((i) => i.service_name).join(', ');
          const bServices = b.items.map((i) => i.service_name).join(', ');
          cmp = aServices.localeCompare(bServices);
          break;
        }
        case 'doctor':
          cmp = (a.doctor_name || '').localeCompare(b.doctor_name || '');
          break;
        case 'submitted': {
          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'priority': {
          const aWeight = PRIORITY_ORDER[a.priority] ?? 0;
          const bWeight = PRIORITY_ORDER[b.priority] ?? 0;
          cmp = aWeight - bWeight;
          break;
        }
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, sortDir, sortField]);

  return <div className={`diagnostic-page ${module}`}>
    <section className="appointment-page-header">
      <div className="appointment-page-title">
        <h2>{moduleName} Queue</h2>
        <p>{module === 'laboratory' ? 'Manage laboratory test orders, sample tracking, and analytical workflows' : 'Manage diagnostic imaging orders, scheduling, and radiologist reports'}</p>
      </div>
    </section>
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
        <table className="data-table diagnostic-queue-table">
          <colgroup>
            <col className="col-patient" style={{ width: '15%' }} />
            <col className="col-source" style={{ width: '11%' }} />
            <col className="col-services" style={{ width: '20%' }} />
            <col className="col-doctor" style={{ width: '13%' }} />
            <col className="col-submitted" style={{ width: '12%' }} />
            <col className="col-priority" style={{ width: '8%' }} />
            <col className="col-status" style={{ width: '11%' }} />
            <col className="col-actions" style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th
                className={`col-patient-th sortable${sortField === 'patient' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('patient')}
                aria-sort={sortField === 'patient' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Patient <SortIcon field="patient" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-source-th sortable${sortField === 'source' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('source')}
                aria-sort={sortField === 'source' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Source <SortIcon field="source" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-services-th sortable${sortField === 'services' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('services')}
                aria-sort={sortField === 'services' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Services <SortIcon field="services" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-doctor-th sortable${sortField === 'doctor' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('doctor')}
                aria-sort={sortField === 'doctor' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Doctor <SortIcon field="doctor" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-submitted-th sortable${sortField === 'submitted' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('submitted')}
                aria-sort={sortField === 'submitted' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Submitted <SortIcon field="submitted" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-priority-th sortable${sortField === 'priority' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('priority')}
                aria-sort={sortField === 'priority' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Priority <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-status-th sortable${sortField === 'status' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('status')}
                aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="col-actions-th align-right" style={{ textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <MedicalLoader
                    text={`Loading ${module === 'laboratory' ? 'laboratory' : 'imaging'} orders...`}
                    subtext="Retrieving diagnostic orders and sample statuses"
                  />
                </td>
              </tr>
            ) : null}
            {isError ? <tr><td colSpan={columnCount} className="um-state-cell"><i className="ph ph-warning" /> Unable to load orders. Retry from this page.</td></tr> : null}
            {!isLoading && !isError && sortedOrders.length === 0 ? <tr><td colSpan={columnCount} className="um-state-cell"><i className="ph ph-inbox" /> No submitted orders match these filters.</td></tr> : null}
            {!isLoading && !isError && sortedOrders.map((order) => {
              const serviceNames = order.items.map((item) => item.service_name).join(', ');
              return (
                <tr key={order.id}>
                  <td className="col-patient-cell">
                    <div className="diagnostic-patient-cell">
                      <strong className="diagnostic-patient-name" title={order.patient_name}>{order.patient_name}</strong>
                      {order.patient_number ? <span className="diagnostic-patient-mrn">{order.patient_number}</span> : null}
                    </div>
                  </td>
                  <td className="col-source-cell">
                    <span className={`diagnostic-source-badge source-${order.source_type.toLowerCase().replaceAll('_', '-')}`}>
                      {sourceLabel(order.source_type)}
                    </span>
                  </td>
                  <td className="col-services-cell">
                    <span className="diagnostic-service-text" title={serviceNames || '—'}>
                      {serviceNames || '—'}
                    </span>
                  </td>
                  <td className="col-doctor-cell">
                    <span className="diagnostic-doctor-name" title={order.doctor_name || '—'}>
                      {order.doctor_name || '—'}
                    </span>
                  </td>
                  <td className="col-submitted-cell">
                    <span className="diagnostic-submitted-date">{dateTime(order.submitted_at)}</span>
                  </td>
                  <td className="col-priority-cell">
                    <span className={`diagnostic-priority priority-${order.priority.toLowerCase()}`}>{order.priority}</span>
                  </td>
                  <td className="col-status-cell">
                    <span className={`diagnostic-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{label(order.status)}</span>
                  </td>
                  <td className="col-actions-cell align-right">
                    <div className="action-icons">
                      <button
                        className="action-icon-btn action-icon-workspace"
                        title="Open workspace"
                        aria-label={module === 'laboratory' ? 'Open laboratory workspace' : 'Open imaging workspace'}
                        type="button"
                        onClick={() => navigate(`/${module}/workspace?id=${order.id}`)}
                      >
                        <i className="ph ph-arrow-square-out" aria-hidden="true" />
                      </button>
                      {['IN_PROGRESS', 'RESULT_ENTERED', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.status) ? (
                        <button
                          className="action-icon-btn action-icon-report"
                          title="Open result/report"
                          aria-label={module === 'laboratory' ? 'Enter or view laboratory test results' : 'Enter or view imaging report'}
                          type="button"
                          onClick={() => navigate(`/${module}/${entryPath}?id=${order.id}`)}
                        >
                          <i className="ph ph-file-text" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="um-pagination diagnostic-queue-pagination">
        <div className="um-showing">{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total} orders` : 'No orders'}</div>
        <div className="um-page-size">
          <span>Rows:</span>
          <select aria-label="Rows per page" onChange={(event) => updateFilters({ limit: Number(event.target.value), page: 1 })} value={filters.limit}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </div>
        <div className="um-page-controls" role="navigation" aria-label="Pagination">
          <button className="pg-btn" aria-label="Previous page" disabled={filters.page <= 1 || isLoading} onClick={() => updateFilters({ page: filters.page - 1 })} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button>
          {meta.totalPages > 1
            ? buildPageNumbers(filters.page, meta.totalPages).map((p, idx) =>
                p === '…' ? (
                  <span key={`ellipsis-${idx}`} className="pg-btn pg-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`pg-btn${p === filters.page ? ' active' : ''}`}
                    aria-label={`Page ${p}`}
                    aria-current={p === filters.page ? 'page' : undefined}
                    disabled={isLoading}
                    onClick={() => updateFilters({ page: p as number })}
                    type="button"
                  >
                    {p}
                  </button>
                )
              )
            : <span className="pg-btn active" aria-current="page" aria-label={`Page ${filters.page}`}>{filters.page}</span>
          }
          <button className="pg-btn" aria-label="Next page" disabled={filters.page >= meta.totalPages || isLoading} onClick={() => updateFilters({ page: filters.page + 1 })} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  </div>;
}
