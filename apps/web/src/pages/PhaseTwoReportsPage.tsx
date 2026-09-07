import { useMemo, useState } from 'react';
import { useCurrencyFormatter, useTimezone } from '../api/useSettings';
import { usePhaseTwoReportsFeature } from '../hooks/reports/usePhaseTwoReportsFeature';
import { formatRegionalDate } from '../utils/localization-utils';
import { MedicalLoader } from '../components/ui/MedicalLoader';

type Tab = 'beds' | 'emergency' | 'procedures' | 'conversions' | 'advances' | 'payments' | 'consents' | 'pending';

const badge = (value: string) => {
  const normalized = value.toLowerCase();
  let cls = 'neutral';
  if (['occupied', 'active', 'scheduled', 'admitted', 'received', 'paid'].some((k) => normalized.includes(k))) {
    cls = 'primary';
  } else if (['available', 'completed', 'consumed'].some((k) => normalized.includes(k))) {
    cls = 'positive';
  } else if (['pending', 'partially', 'hold', 'urgent'].some((k) => normalized.includes(k))) {
    cls = 'warning';
  } else if (['cancelled', 'abandoned', 'critical', 'emergency'].some((k) => normalized.includes(k))) {
    cls = 'danger';
  }
  return <span className={`status-badge ${cls}`}>{value.replaceAll('_', ' ')}</span>;
};

const reportMetaInfo: Record<Tab, { icon: string; description: string }> = {
  beds: { icon: 'ph-bed', description: 'Current bed utilization and availability' },
  emergency: { icon: 'ph-first-aid', description: 'Emergency patient intake & triage activity' },
  procedures: { icon: 'ph-scissors', description: 'OT and minor procedure schedule' },
  conversions: { icon: 'ph-arrows-clockwise', description: 'Emergency & OPD conversion overview' },
  advances: { icon: 'ph-receipt', description: 'IP deposit & advance ledger' },
  payments: { icon: 'ph-credit-card', description: 'Invoice payment status & outstanding balances' },
  consents: { icon: 'ph-signature', description: 'Pending clinical & admission consents' },
  pending: { icon: 'ph-hourglass', description: 'Cross-department pending service workload' },
};

export function PhaseTwoReportsPage() {
  const { state, actions } = usePhaseTwoReportsFeature();
  const money = useCurrencyFormatter();
  const timezone = useTimezone();
  const date = (value: string) => formatRegionalDate(value, timezone, 'MMM d, yyyy');
  const [tab, setTab] = useState<Tab>('beds');
  const [searchTerm, setSearchTerm] = useState('');
  const data = state.data;

  const tabs: Array<[Tab, string, number]> = [
    ['beds', 'Bed Occupancy', data?.bed_occupancy.meta.total ?? 0],
    ['emergency', 'Emergency Register', data?.emergency_register.meta.total ?? 0],
    ['procedures', 'Procedure Schedule', data?.procedure_schedule.meta.total ?? 0],
    ['conversions', 'IP Conversions', data?.ip_conversions.meta.total ?? 0],
    ['advances', 'Advance Payments', data?.advance_payments.meta.total ?? 0],
    ['payments', 'Payment Status', data?.payment_status.meta.total ?? 0],
    ['consents', 'Consent Pending', data?.consent_pending.meta.total ?? 0],
    ['pending', 'Department Pending', data?.department_pending.meta.total ?? 0],
  ];

  const activeMeta = data
    ? ({
        beds: data.bed_occupancy.meta,
        emergency: data.emergency_register.meta,
        procedures: data.procedure_schedule.meta,
        conversions: data.ip_conversions.meta,
        advances: data.advance_payments.meta,
        payments: data.payment_status.meta,
        consents: data.consent_pending.meta,
        pending: data.department_pending.meta,
      } as const)[tab]
    : null;

  const activeTabTitle = tabs.find(([k]) => k === tab)?.[1] ?? 'Report';
  const activeTabCount = tabs.find(([k]) => k === tab)?.[2] ?? 0;

  // Filtered rows for currently active table
  const filteredBeds = useMemo(() => {
    if (!data?.bed_occupancy.data) return [];
    if (!searchTerm.trim()) return data.bed_occupancy.data;
    const term = searchTerm.toLowerCase();
    return data.bed_occupancy.data.filter(
      (r) =>
        r.bed_number.toLowerCase().includes(term) ||
        r.ward_name.toLowerCase().includes(term) ||
        (r.room_number && r.room_number.toLowerCase().includes(term)) ||
        r.status.toLowerCase().includes(term),
    );
  }, [data?.bed_occupancy.data, searchTerm]);

  const filteredEmergency = useMemo(() => {
    if (!data?.emergency_register.data) return [];
    if (!searchTerm.trim()) return data.emergency_register.data;
    const term = searchTerm.toLowerCase();
    return data.emergency_register.data.filter(
      (r) =>
        r.visit_number.toLowerCase().includes(term) ||
        r.patient_name.toLowerCase().includes(term) ||
        (r.patient_number && r.patient_number.toLowerCase().includes(term)) ||
        (r.doctor_name && r.doctor_name.toLowerCase().includes(term)) ||
        r.status.toLowerCase().includes(term),
    );
  }, [data?.emergency_register.data, searchTerm]);

  const filteredProcedures = useMemo(() => {
    if (!data?.procedure_schedule.data) return [];
    if (!searchTerm.trim()) return data.procedure_schedule.data;
    const term = searchTerm.toLowerCase();
    return data.procedure_schedule.data.filter(
      (r) =>
        r.booking_number.toLowerCase().includes(term) ||
        r.patient_name.toLowerCase().includes(term) ||
        r.doctor_name.toLowerCase().includes(term) ||
        r.department_name.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term),
    );
  }, [data?.procedure_schedule.data, searchTerm]);

  const filteredConversions = useMemo(() => {
    if (!data?.ip_conversions.data) return [];
    if (!searchTerm.trim()) return data.ip_conversions.data;
    const term = searchTerm.toLowerCase();
    return data.ip_conversions.data.filter(
      (r) =>
        r.admission_number.toLowerCase().includes(term) ||
        r.patient_name.toLowerCase().includes(term) ||
        r.source_type.toLowerCase().includes(term) ||
        (r.source_reference && r.source_reference.toLowerCase().includes(term)),
    );
  }, [data?.ip_conversions.data, searchTerm]);

  const filteredAdvances = useMemo(() => {
    if (!data?.advance_payments.data) return [];
    if (!searchTerm.trim()) return data.advance_payments.data;
    const term = searchTerm.toLowerCase();
    return data.advance_payments.data.filter(
      (r) =>
        r.invoice_number.toLowerCase().includes(term) ||
        (r.patient_name && r.patient_name.toLowerCase().includes(term)) ||
        r.context_type.toLowerCase().includes(term) ||
        r.consumption_status.toLowerCase().includes(term),
    );
  }, [data?.advance_payments.data, searchTerm]);

  const filteredPayments = useMemo(() => {
    if (!data?.payment_status.data) return [];
    if (!searchTerm.trim()) return data.payment_status.data;
    const term = searchTerm.toLowerCase();
    return data.payment_status.data.filter(
      (r) =>
        r.invoice_number.toLowerCase().includes(term) ||
        (r.patient_name && r.patient_name.toLowerCase().includes(term)) ||
        r.source_type.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term),
    );
  }, [data?.payment_status.data, searchTerm]);

  const filteredConsents = useMemo(() => {
    if (!data?.consent_pending.data) return [];
    if (!searchTerm.trim()) return data.consent_pending.data;
    const term = searchTerm.toLowerCase();
    return data.consent_pending.data.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(term) ||
        r.template_name.toLowerCase().includes(term) ||
        r.context_type.toLowerCase().includes(term) ||
        r.consent_status.toLowerCase().includes(term),
    );
  }, [data?.consent_pending.data, searchTerm]);

  const filteredPending = useMemo(() => {
    if (!data?.department_pending.data) return [];
    if (!searchTerm.trim()) return data.department_pending.data;
    const term = searchTerm.toLowerCase();
    return data.department_pending.data.filter(
      (r) =>
        r.department.toLowerCase().includes(term) ||
        r.patient_name.toLowerCase().includes(term) ||
        r.source_type.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term),
    );
  }, [data?.department_pending.data, searchTerm]);

  // CSV Export utility
  const handleExportCsv = () => {
    if (!data) return;
    let csvHeader = '';
    let csvRows: string[] = [];

    if (tab === 'beds') {
      csvHeader = 'Bed Number,Ward,Room,Type,Charge Category,Status';
      csvRows = filteredBeds.map(
        (r) => `"${r.bed_number}","${r.ward_name}","${r.room_number ?? ''}","${r.bed_type}","${r.charge_category}","${r.status}"`,
      );
    } else if (tab === 'emergency') {
      csvHeader = 'Visit Number,Patient,Doctor,Department,Date,Status,Outcome';
      csvRows = filteredEmergency.map(
        (r) => `"${r.visit_number}","${r.patient_name}","${r.doctor_name ?? ''}","${r.department_name}","${r.visit_date}","${r.status}","${r.conversion_outcome ?? ''}"`,
      );
    } else if (tab === 'procedures') {
      csvHeader = 'Booking Number,Patient,Doctor,Department,Date,Time,Status';
      csvRows = filteredProcedures.map(
        (r) => `"${r.booking_number}","${r.patient_name}","${r.doctor_name}","${r.department_name}","${r.scheduled_date}","${r.start_time}","${r.status}"`,
      );
    } else if (tab === 'conversions') {
      csvHeader = 'Admission Number,Patient,Source Type,Source Ref,Date,Status';
      csvRows = filteredConversions.map(
        (r) => `"${r.admission_number}","${r.patient_name}","${r.source_type}","${r.source_reference ?? ''}","${r.admission_date}","${r.status}"`,
      );
    } else if (tab === 'advances') {
      csvHeader = 'Invoice Number,Patient,Context Type,Total,Paid,Balance,Consumption Status';
      csvRows = filteredAdvances.map(
        (r) => `"${r.invoice_number}","${r.patient_name ?? ''}","${r.context_type}",${r.total_amount},${r.paid_amount},${r.balance_amount},"${r.consumption_status}"`,
      );
    } else if (tab === 'payments') {
      csvHeader = 'Invoice Number,Patient,Source,Total,Paid,Balance,Status';
      csvRows = filteredPayments.map(
        (r) => `"${r.invoice_number}","${r.patient_name ?? ''}","${r.source_type}",${r.total_amount},${r.paid_amount},${r.balance_amount},"${r.status}"`,
      );
    } else if (tab === 'consents') {
      csvHeader = 'Patient,Context,Template Name,Category,Required Date,Status';
      csvRows = filteredConsents.map(
        (r) => `"${r.patient_name}","${r.context_type}","${r.template_name}","${r.category}","${r.required_at}","${r.consent_status}"`,
      );
    } else if (tab === 'pending') {
      csvHeader = 'Department,Patient,Source,Request Date,Status';
      csvRows = filteredPending.map(
        (r) => `"${r.department}","${r.patient_name}","${r.source_type}","${r.request_date}","${r.status}"`,
      );
    }

    const blob = new Blob([[csvHeader, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tab}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-workspace">
      {/* ── Compact Header ── */}
      <div className="reports-header">
        <h1>Reports</h1>
        <p>View hospital activity, operational metrics, and reports.</p>
      </div>

      {/* ── Compact Filter Toolbar ── */}
      <div className="reports-filter-card">
        <div className="reports-filter-group">
          <label className="reports-filter-item">
            <span>Branch</span>
            <select
              value={state.branchId}
              onChange={(event) => {
                actions.setBranchId(event.target.value);
                actions.setPage(1);
              }}
            >
              {state.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="reports-filter-item">
            <span>From</span>
            <input
              type="date"
              value={state.dateFrom}
              onChange={(event) => actions.setDateFrom(event.target.value)}
            />
          </label>
          <label className="reports-filter-item">
            <span>To</span>
            <input
              type="date"
              value={state.dateTo}
              onChange={(event) => actions.setDateTo(event.target.value)}
            />
          </label>
        </div>

        <button
          className="reports-btn-apply"
          disabled={state.fetching}
          onClick={() => void actions.refresh()}
          type="button"
        >
          <i className="ph ph-arrow-clockwise" aria-hidden="true" />
          {state.fetching ? 'Refreshing...' : 'Apply Filters'}
        </button>
      </div>

      {!state.canView ? (
        <div className="admin-dashboard-state admin-dashboard-state--error">
          Reports View permission is required.
        </div>
      ) : null}

      {state.error && (
        <div className="admin-dashboard-state admin-dashboard-state--error">{state.error}</div>
      )}

      {!state.canView ? null : state.loading || !data ? (
        <div style={{ padding: '3rem 1rem' }}>
          <MedicalLoader
            size="large"
            text="Loading hospital reports..."
            subtext="Aggregating clinical and administrative reporting analytics"
          />
        </div>
      ) : (
        <>
          {/* ── Summary Metrics Row ── */}
          <section>
            <div className="reports-section-title">
              <i className="ph ph-chart-line-up" aria-hidden="true" /> Summary
            </div>
            <div className="reports-summary-grid">
              <article className="reports-summary-card">
                <span className="reports-summary-label">Emergency</span>
                <strong className="reports-summary-value">{data.dashboard.emergency_volume}</strong>
                <span className="reports-summary-sub">Triaged visits</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">Procedures</span>
                <strong className="reports-summary-value">{data.dashboard.procedures_scheduled}</strong>
                <span className="reports-summary-sub">Scheduled</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">IP Conversions</span>
                <strong className="reports-summary-value">{data.dashboard.ip_conversions}</strong>
                <span className="reports-summary-sub">Admitted</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">Beds</span>
                <strong className="reports-summary-value">
                  {data.dashboard.beds_available} / {data.dashboard.beds_total}
                </strong>
                <span className="reports-summary-sub">Available</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">Pending Payments</span>
                <strong className="reports-summary-value">
                  {data.financial_access
                    ? money(data.dashboard.pending_payment_amount ?? 0)
                    : 'Restricted'}
                </strong>
                <span className="reports-summary-sub">Outstanding</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">Advance Received</span>
                <strong className="reports-summary-value">
                  {data.financial_access
                    ? money(data.dashboard.advance_received_amount ?? 0)
                    : 'Restricted'}
                </strong>
                <span className="reports-summary-sub">Deposits</span>
              </article>
              <article className="reports-summary-card">
                <span className="reports-summary-label">Dept Pending</span>
                <strong className="reports-summary-value">
                  {data.dashboard.pending_pharmacy +
                    data.dashboard.pending_laboratory +
                    data.dashboard.pending_imaging}
                </strong>
                <span className="reports-summary-sub">
                  P {data.dashboard.pending_pharmacy} · L {data.dashboard.pending_laboratory} · I{' '}
                  {data.dashboard.pending_imaging}
                </span>
              </article>
            </div>
          </section>

          {/* ── Reports Navigation Tiles (4x2 grid) ── */}
          <section>
            <div className="reports-section-title">
              <i className="ph ph-folders" aria-hidden="true" /> Reports
            </div>
            <div className="reports-tiles-grid">
              {tabs.map(([key, label, count]) => {
                const meta = reportMetaInfo[key];
                const isCurrent = tab === key;
                return (
                  <button
                    key={key}
                    className={`reports-tile-btn ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      setTab(key);
                      setSearchTerm('');
                      actions.setPage(1);
                    }}
                    type="button"
                    aria-pressed={isCurrent}
                  >
                    <div className="reports-tile-main">
                      <span className="reports-tile-name">{label}</span>
                      <div className="reports-tile-count-wrap">
                        <span className="reports-tile-count">{count}</span>
                        <span className="reports-tile-action">
                          {isCurrent ? 'Viewing' : 'View Report'} <i className="ph ph-arrow-right" />
                        </span>
                      </div>
                    </div>
                    <div className="reports-tile-icon">
                      <i className={`ph ${meta.icon}`} aria-hidden="true" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Active Report Detailed Content Card ── */}
          <section className="reports-detail-card">
            <div className="reports-detail-head">
              <div className="reports-detail-title-wrap">
                <div>
                  <span className="reports-detail-title">{activeTabTitle}</span>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {reportMetaInfo[tab].description}
                  </div>
                </div>
                <span className="reports-detail-badge">
                  {activeTabCount} Record{activeTabCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* ── Tailored Insight Panel Based on Selected Report ── */}
            {tab === 'beds' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Total Beds</span>
                    <span className="value">{data.dashboard.beds_total}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Occupied</span>
                    <span className="value primary">{data.dashboard.beds_occupied}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Available</span>
                    <span className="value positive">{data.dashboard.beds_available}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Occupancy Rate</span>
                    <span className="value">
                      {data.dashboard.beds_total > 0
                        ? `${Math.round((data.dashboard.beds_occupied / data.dashboard.beds_total) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>

                {data.dashboard.beds_total > 0 && (
                  <div className="reports-status-bar-wrap">
                    <div className="reports-status-bar-header">
                      <span>Bed Status Distribution</span>
                      <span>
                        {data.dashboard.beds_occupied} Occupied · {data.dashboard.beds_available} Available
                      </span>
                    </div>
                    <div className="reports-status-bar">
                      <div
                        className="reports-status-seg occupied"
                        style={{
                          width: `${(data.dashboard.beds_occupied / data.dashboard.beds_total) * 100}%`,
                        }}
                      />
                      <div
                        className="reports-status-seg available"
                        style={{
                          width: `${(data.dashboard.beds_available / data.dashboard.beds_total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="reports-status-legend">
                      <span className="reports-status-legend-item">
                        <span className="reports-legend-dot" style={{ background: '#2563eb' }} /> Occupied (
                        {data.dashboard.beds_occupied})
                      </span>
                      <span className="reports-status-legend-item">
                        <span className="reports-legend-dot" style={{ background: '#10b981' }} /> Available (
                        {data.dashboard.beds_available})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'emergency' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Total Intake</span>
                    <span className="value">{data.dashboard.emergency_volume}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Active in ER</span>
                    <span className="value warning">
                      {data.emergency_register.data.filter((r) => r.status === 'ACTIVE' || r.status === 'TRIAGED').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Completed / Discharged</span>
                    <span className="value positive">
                      {data.emergency_register.data.filter((r) => r.status === 'DISCHARGED' || r.status === 'COMPLETED').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">IP Conversions</span>
                    <span className="value primary">{data.dashboard.ip_conversions}</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'procedures' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Scheduled Procedures</span>
                    <span className="value primary">{data.dashboard.procedures_scheduled}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Completed</span>
                    <span className="value positive">
                      {data.procedure_schedule.data.filter((r) => r.status === 'COMPLETED').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Pending OT</span>
                    <span className="value warning">
                      {data.procedure_schedule.data.filter((r) => r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'conversions' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Total Conversions</span>
                    <span className="value primary">{data.dashboard.ip_conversions}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Admitted IP Patients</span>
                    <span className="value positive">
                      {data.ip_conversions.data.filter((r) => r.status === 'ADMITTED').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Emergency Sources</span>
                    <span className="value">
                      {data.ip_conversions.data.filter((r) => r.source_type === 'EMERGENCY').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">OPD Sources</span>
                    <span className="value">
                      {data.ip_conversions.data.filter((r) => r.source_type === 'OPD').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'advances' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Total Advances</span>
                    <span className="value positive">
                      {data.financial_access ? money(data.dashboard.advance_received_amount ?? 0) : 'Restricted'}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Transactions</span>
                    <span className="value">{data.advance_payments.meta.total}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Consumed / Applied</span>
                    <span className="value primary">
                      {data.advance_payments.data.filter((r) => r.consumption_status === 'CONSUMED').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Pending Utilization</span>
                    <span className="value warning">
                      {data.advance_payments.data.filter((r) => r.consumption_status === 'RECEIVED' || r.consumption_status === 'PENDING').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'payments' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Outstanding Balance</span>
                    <span className="value danger">
                      {data.financial_access ? money(data.dashboard.pending_payment_amount ?? 0) : 'Restricted'}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Invoices</span>
                    <span className="value">{data.payment_status.meta.total}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Fully Settled</span>
                    <span className="value positive">
                      {data.payment_status.data.filter((r) => r.status === 'PAID').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Pending Settlement</span>
                    <span className="value warning">
                      {data.payment_status.data.filter((r) => r.status !== 'PAID').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'consents' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Pending Consents</span>
                    <span className="value warning">{data.consent_pending.meta.total}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Admission Consents</span>
                    <span className="value">
                      {data.consent_pending.data.filter((r) => r.context_type === 'ADMISSION').length}
                    </span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Procedure Consents</span>
                    <span className="value">
                      {data.consent_pending.data.filter((r) => r.context_type === 'PROCEDURE').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'pending' && (
              <div className="reports-insight-panel">
                <div className="reports-insight-metrics">
                  <div className="reports-insight-metric">
                    <span className="label">Pharmacy Pending</span>
                    <span className="value warning">{data.dashboard.pending_pharmacy}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Laboratory Pending</span>
                    <span className="value primary">{data.dashboard.pending_laboratory}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Imaging Pending</span>
                    <span className="value danger">{data.dashboard.pending_imaging}</span>
                  </div>
                  <div className="reports-insight-metric">
                    <span className="label">Total Workload</span>
                    <span className="value">
                      {data.dashboard.pending_pharmacy +
                        data.dashboard.pending_laboratory +
                        data.dashboard.pending_imaging}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Table Toolbar (Search & Export) ── */}
            <div className="reports-table-toolbar">
              <div className="reports-table-heading">
                <i className="ph ph-list-dashes" aria-hidden="true" /> Detailed Records
              </div>
              <div className="reports-table-actions">
                <div className="reports-table-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="reports-btn-export"
                  onClick={handleExportCsv}
                  title="Export records to CSV"
                >
                  <i className="ph ph-download-simple" aria-hidden="true" /> Export CSV
                </button>
              </div>
            </div>

            {/* ── Table Records Layer ── */}
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  {tab === 'beds' ? (
                    <tr>
                      <th>Bed</th>
                      <th>Ward / Room</th>
                      <th>Type</th>
                      <th>Charge</th>
                      <th>Status</th>
                    </tr>
                  ) : tab === 'emergency' ? (
                    <tr>
                      <th>Visit / Patient</th>
                      <th>Doctor / Department</th>
                      <th>Date</th>
                      <th>Orders</th>
                      <th>Status / Outcome</th>
                    </tr>
                  ) : tab === 'procedures' ? (
                    <tr>
                      <th>Booking</th>
                      <th>Patient</th>
                      <th>Doctor / Department</th>
                      <th>Schedule</th>
                      <th>Status</th>
                    </tr>
                  ) : tab === 'conversions' ? (
                    <tr>
                      <th>Admission / Patient</th>
                      <th>Source</th>
                      <th>Source Reference</th>
                      <th>Converted</th>
                      <th>Status</th>
                    </tr>
                  ) : tab === 'advances' ? (
                    <tr>
                      <th>Invoice / Patient</th>
                      <th>Context</th>
                      <th>Total</th>
                      <th>Paid / Balance</th>
                      <th>Consumption</th>
                    </tr>
                  ) : tab === 'payments' ? (
                    <tr>
                      <th>Invoice / Patient</th>
                      <th>Source / Services</th>
                      <th>Total</th>
                      <th>Paid / Balance</th>
                      <th>Status</th>
                    </tr>
                  ) : tab === 'consents' ? (
                    <tr>
                      <th>Patient</th>
                      <th>Context</th>
                      <th>Consent</th>
                      <th>Required</th>
                      <th>Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Department</th>
                      <th>Patient</th>
                      <th>Source</th>
                      <th>Requested</th>
                      <th>Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeMeta?.total === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                        No records match the selected report filters.
                      </td>
                    </tr>
                  ) : tab === 'beds' ? (
                    filteredBeds.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No beds match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredBeds.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.bed_number}</strong>
                          </td>
                          <td>
                            {row.ward_name}
                            {row.room_number ? ` / ${row.room_number}` : ''}
                          </td>
                          <td>{row.bed_type}</td>
                          <td>{row.charge_category}</td>
                          <td>{badge(row.status)}</td>
                        </tr>
                      ))
                    )
                  ) : tab === 'emergency' ? (
                    filteredEmergency.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No emergency visits match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredEmergency.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.visit_number}</strong>
                            <small>
                              {row.patient_number ?? 'Provisional'} · {row.patient_name}
                            </small>
                          </td>
                          <td>
                            {row.doctor_name ?? 'Unassigned'}
                            <small>{row.department_name}</small>
                          </td>
                          <td>{date(row.visit_date)}</td>
                          <td>
                            Lab {row.laboratory_orders} · Imaging {row.imaging_orders} · Pharmacy{' '}
                            {row.pharmacy_requests}
                          </td>
                          <td>
                            {badge(row.status)}
                            <small>
                              {row.conversion_outcome?.replaceAll('_', ' ') ?? 'Pending disposition'}
                            </small>
                          </td>
                        </tr>
                      ))
                    )
                  ) : tab === 'procedures' ? (
                    filteredProcedures.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No procedures match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredProcedures.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.booking_number}</strong>
                          </td>
                          <td>
                            {row.patient_number} · {row.patient_name}
                          </td>
                          <td>
                            {row.doctor_name}
                            <small>{row.department_name}</small>
                          </td>
                          <td>
                            {date(row.scheduled_date)} · {row.start_time}
                          </td>
                          <td>{badge(row.status)}</td>
                        </tr>
                      ))
                    )
                  ) : tab === 'conversions' ? (
                    filteredConversions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No conversions match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredConversions.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.admission_number}</strong>
                            <small>
                              {row.patient_number} · {row.patient_name}
                            </small>
                          </td>
                          <td>{row.source_type.replaceAll('_', ' ')}</td>
                          <td>{row.source_reference ?? row.source_id}</td>
                          <td>{date(row.admission_date)}</td>
                          <td>{badge(row.status)}</td>
                        </tr>
                      ))
                    )
                  ) : tab === 'advances' ? (
                    !data.financial_access ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#dc2626' }}>
                          Billing Invoice View permission is required.
                        </td>
                      </tr>
                    ) : filteredAdvances.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No advances match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAdvances.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.invoice_number}</strong>
                            <small>
                              {row.patient_number ?? '-'} · {row.patient_name ?? 'Patient'}
                            </small>
                          </td>
                          <td>
                            {row.context_type.replaceAll('_', ' ')}
                            <small>{row.context_id}</small>
                          </td>
                          <td>{money(row.total_amount)}</td>
                          <td>
                            {money(row.paid_amount)} / {money(row.balance_amount)}
                          </td>
                          <td>{badge(row.consumption_status)}</td>
                        </tr>
                      ))
                    )
                  ) : tab === 'payments' ? (
                    !data.financial_access ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#dc2626' }}>
                          Billing Invoice View permission is required.
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No payments match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.invoice_number}</strong>
                            <small>
                              {row.patient_number} · {row.patient_name}
                            </small>
                          </td>
                          <td>
                            {row.source_type}
                            <small>{row.service_names.join(', ')}</small>
                          </td>
                          <td>{money(row.total_amount)}</td>
                          <td>
                            {money(row.paid_amount)} / {money(row.balance_amount)}
                          </td>
                          <td>{badge(row.status)}</td>
                        </tr>
                      ))
                    )
                  ) : tab === 'consents' ? (
                    filteredConsents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No consents match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredConsents.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.patient_number} · {row.patient_name}
                          </td>
                          <td>
                            {row.context_type} · {row.context_id.slice(-8)}
                          </td>
                          <td>
                            {row.template_name}
                            <small>{row.category}</small>
                          </td>
                          <td>{date(row.required_at)}</td>
                          <td>{badge(row.consent_status)}</td>
                        </tr>
                      ))
                    )
                  ) : (
                    filteredPending.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No pending orders match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPending.map((row) => (
                        <tr key={`${row.department}-${row.id}`}>
                          <td>{row.department}</td>
                          <td>
                            {row.patient_number} · {row.patient_name}
                          </td>
                          <td>{row.source_type}</td>
                          <td>{date(row.request_date)}</td>
                          <td>{badge(row.status)}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>

            {activeMeta && activeMeta.totalPages > 1 ? (
              <div className="reports-pagination">
                <span>
                  Page {activeMeta.page} of {activeMeta.totalPages}
                </span>
                <button
                  disabled={state.page <= 1}
                  onClick={() => actions.setPage(state.page - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  disabled={state.page >= activeMeta.totalPages}
                  onClick={() => actions.setPage(state.page + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

