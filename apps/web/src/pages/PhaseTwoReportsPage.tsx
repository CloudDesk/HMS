import { useState } from 'react';
import { useCurrencyFormatter } from '../api/useSettings';
import { usePhaseTwoReportsFeature } from '../hooks/reports/usePhaseTwoReportsFeature';
type Tab = 'beds' | 'emergency' | 'procedures' | 'payments' | 'consents' | 'pending';
const date = (value: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
const badge = (value: string) => (
  <span className="status-badge neutral">{value.replaceAll('_', ' ')}</span>
);
export function PhaseTwoReportsPage() {
  const { state, actions } = usePhaseTwoReportsFeature();
  const money = useCurrencyFormatter();
  const [tab, setTab] = useState<Tab>('beds');
  const data = state.data;
  const tabs: Array<[Tab, string, number]> = [
    ['beds', 'Bed Occupancy', data?.bed_occupancy.meta.total ?? 0],
    ['emergency', 'Emergency Register', data?.emergency_register.meta.total ?? 0],
    ['procedures', 'Procedure Schedule', data?.procedure_schedule.meta.total ?? 0],
    ['payments', 'Payment Status', data?.payment_status.meta.total ?? 0],
    ['consents', 'Consent Pending', data?.consent_pending.meta.total ?? 0],
    ['pending', 'Department Pending', data?.department_pending.meta.total ?? 0],
  ];
  const activeMeta = data
    ? ({ beds: data.bed_occupancy.meta, emergency: data.emergency_register.meta, procedures: data.procedure_schedule.meta, payments: data.payment_status.meta, consents: data.consent_pending.meta, pending: data.department_pending.meta } as const)[tab]
    : null;
  return (
    <div className="page-shell">
      <div className="page-heading">
        <h1>Phase 2 Reports &amp; Management Dashboard</h1>
        <p>
          Authoritative operational reporting from current clinical, admissions, diagnostic,
          pharmacy, consent, and billing records
        </p>
      </div>
      <div className="filters-toolbar">
        <label>
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
        <label>
          <span>From</span>
          <input
            type="date"
            value={state.dateFrom}
            onChange={(event) => actions.setDateFrom(event.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={state.dateTo}
            onChange={(event) => actions.setDateTo(event.target.value)}
          />
        </label>
        <button
          className="btn-secondary"
          disabled={state.fetching}
          onClick={() => void actions.refresh()}
        >
          Refresh
        </button>
      </div>
      {state.error && (
        <div className="admin-dashboard-state admin-dashboard-state--error">{state.error}</div>
      )}
      {state.loading || !data ? (
        <div className="admin-dashboard-state">
          <span className="loading-spinner" /> Loading reports...
        </div>
      ) : (
        <>
          <section className="kpi-grid enhanced">
            <article className="kpi-card">
              <span>Emergency volume</span>
              <strong>{data.dashboard.emergency_volume}</strong>
            </article>
            <article className="kpi-card">
              <span>Procedure schedule</span>
              <strong>{data.dashboard.procedures_scheduled}</strong>
            </article>
            <article className="kpi-card">
              <span>Available / Total beds</span>
              <strong>
                {data.dashboard.beds_available} / {data.dashboard.beds_total}
              </strong>
            </article>
            <article className="kpi-card">
              <span>Pending payments</span>
              <strong>
                {data.financial_access
                  ? money(data.dashboard.pending_payment_amount ?? 0)
                  : 'Restricted'}
              </strong>
            </article>
            <article className="kpi-card">
              <span>Department pending</span>
              <strong>
                {data.dashboard.pending_pharmacy +
                  data.dashboard.pending_laboratory +
                  data.dashboard.pending_imaging}
              </strong>
              <small>
                P {data.dashboard.pending_pharmacy} · L {data.dashboard.pending_laboratory} · I{' '}
                {data.dashboard.pending_imaging}
              </small>
            </article>
          </section>
          <div className="tabs-container">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                className={`tab-btn ${tab === key ? 'active' : ''}`}
                onClick={() => { setTab(key); actions.setPage(1); }}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <section className="content-card">
            <div className="table-scroll">
              <table className="data-table">
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
                      <td colSpan={5}>No records match the selected report filters.</td>
                    </tr>
                  ) : tab === 'beds' ? (
                    data.bed_occupancy.data.map((row) => (
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
                  ) : tab === 'emergency' ? (
                    data.emergency_register.data.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.visit_number}</strong>
                          <small>
                            {row.patient_number} · {row.patient_name}
                          </small>
                        </td>
                        <td>
                          {row.doctor_name}
                          <small>{row.department_name}</small>
                        </td>
                        <td>{date(row.visit_date)}</td>
                        <td>
                          Lab {row.laboratory_orders} · Imaging {row.imaging_orders} · Pharmacy{' '}
                          {row.pharmacy_requests}
                        </td>
                        <td>
                          {badge(row.status)}
                          <small>IP outcome unavailable</small>
                        </td>
                      </tr>
                    ))
                  ) : tab === 'procedures' ? (
                    data.procedure_schedule.data.map((row) => (
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
                  ) : tab === 'payments' ? (
                    !data.financial_access ? (
                      <tr>
                        <td colSpan={5}>Billing Invoice View permission is required.</td>
                      </tr>
                    ) : (
                      data.payment_status.data.map((row) => (
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
                    data.consent_pending.data.map((row) => (
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
                  ) : (
                    data.department_pending.data.map((row) => (
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
                  )}
                </tbody>
              </table>
            </div>
            {activeMeta && activeMeta.totalPages > 1 ? (
              <div className="doc-pagination">
                <button className="btn-secondary compact" disabled={state.page <= 1} onClick={() => actions.setPage(state.page - 1)}>Previous</button>
                <span>Page {activeMeta.page} of {activeMeta.totalPages}</span>
                <button className="btn-secondary compact" disabled={state.page >= activeMeta.totalPages} onClick={() => actions.setPage(state.page + 1)}>Next</button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
