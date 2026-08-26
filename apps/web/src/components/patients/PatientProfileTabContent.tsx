import type { BillingInvoice } from '../../api/billing';
import type { DiagnosticOrder } from '../../api/laboratory';
import type { OpdPrescriptionResponse } from '../../api/opd';
import type { PatientResponse } from '../../api/patients';
import type { usePatientProfileFeature } from '../../hooks/patients/usePatientProfileFeature';
import { formatDate, formatDateTime } from '../../pages/patient-utils';
import { PatientEmrTimelineTab } from './PatientEmrTimelineTab';
import { PatientOverviewTab } from './PatientOverviewTab';

type PatientProfileFeature = ReturnType<typeof usePatientProfileFeature>;

type PatientProfileTabContentProps = {
  patient: PatientResponse;
  prescriptions: OpdPrescriptionResponse[];
  state: PatientProfileFeature['state'];
  actions: PatientProfileFeature['actions'];
  formatCurrency: (value: number) => string;
  onOpenUpload: (mode: 'DOCUMENT' | 'CONSENT') => void;
  onViewPrescription: (prescription: OpdPrescriptionResponse) => void;
  onViewLabOrder: (order: DiagnosticOrder) => void;
  onViewImagingOrder: (order: DiagnosticOrder) => void;
  onViewInvoice: (invoice: BillingInvoice) => void;
};

function EmptyRecords({ message }: { message: string }) {
  return <div className="patient-empty-inline">{message}</div>;
}

export function PatientProfileTabContent({
  patient,
  prescriptions,
  state,
  actions,
  formatCurrency,
  onOpenUpload,
  onViewPrescription,
  onViewLabOrder,
  onViewImagingOrder,
  onViewInvoice,
}: PatientProfileTabContentProps) {
  const {
    activeTab,
    timeline,
    timelineMeta,
    loadingTimeline,
    visits: visitsData,
    visitsMeta,
    loadingVisits,
    appointments,
    appointmentsMeta,
    loadingAppointments,
    labOrders,
    imagingOrders,
    documents,
    consents,
    billingInvoices,
    doctors: doctorsList,
    filters: { timeline: timelineFilters, visits: visitsFilters, appointments: appointmentFilters },
    pageInfo: { timeline: timelinePageInfo },
  } = state;
  const {
    setActiveTab,
    setTimelineFilters,
    setTimelinePage,
    setVisitsFilters,
    setVisitsPage,
    setAppointmentFilters,
    setAppointmentsPage,
  } = actions;

  const setTimelineMeta = (value: Partial<{ page: number; limit: number }>) => setTimelinePage((previous) => ({ ...previous, ...value }));
  const setVisitsMeta = (value: Partial<{ page: number; limit: number }>) => setVisitsPage((previous) => ({ ...previous, ...value }));
  const setAppointmentsMeta = (value: Partial<{ page: number; limit: number }>) => setAppointmentsPage((previous) => ({ ...previous, ...value }));

  return (
    <section className="doc-card" style={{ marginTop: '1.25rem', overflow: 'hidden', padding: 0 }}>
      {activeTab === 'Overview' ? (
        <PatientOverviewTab
          formatCurrency={formatCurrency}
          onViewBilling={() => setActiveTab('Billing')}
          patient={patient}
          prescriptions={prescriptions}
          timeline={timeline}
        />
      ) : null}

      {activeTab === 'EMR Timeline' ? (
        <PatientEmrTimelineTab
          currentPage={timelinePageInfo.page}
          filters={timelineFilters}
          loadError=""
          loading={loadingTimeline}
          meta={timelineMeta}
          setCurrentPage={(page) => setTimelineMeta({ page })}
          setFilters={setTimelineFilters}
          timeline={timeline}
        />
      ) : null}

      {activeTab === 'Medical History' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="doc-toolbar">
            <div className="doc-field">
              <label>From</label>
              <input type="date" value={timelineFilters.from} onChange={(event) => { setTimelineFilters((previous) => ({ ...previous, from: event.target.value })); setTimelineMeta({ page: 1 }); }} />
            </div>
            <div className="doc-field">
              <label>To</label>
              <input type="date" value={timelineFilters.to} onChange={(event) => { setTimelineFilters((previous) => ({ ...previous, to: event.target.value })); setTimelineMeta({ page: 1 }); }} />
            </div>
            <button className="doc-btn" type="button" onClick={() => { setTimelineFilters({ from: '', to: '' }); setTimelineMeta({ page: 1 }); }}>Reset</button>
            {loadingTimeline && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
          </div>
          {timeline.length === 0 ? (
            <EmptyRecords message="No medical history events recorded for this patient." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>EVENT</th><th>DESCRIPTION</th></tr></thead>
                <tbody>
                  {timeline.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.occurred_at)}</td>
                      <td><strong>{event.title}</strong></td>
                      <td>{event.description || 'No description recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {timelineMeta.totalPages > 1 && (
            <div className="um-pagination" style={{ marginTop: '1rem' }}>
              <span>Showing {timeline.length === 0 ? 0 : (timelineMeta.page - 1) * timelineMeta.limit + 1}-{Math.min(timelineMeta.page * timelineMeta.limit, timelineMeta.total || 0)} of {timelineMeta.total || 0} events</span>
              <div className="um-page-controls">
                <button className="pg-btn" disabled={timelineMeta.page <= 1} onClick={() => setTimelineMeta({ page: timelineMeta.page - 1 })} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button>
                <button className="pg-btn active" disabled type="button">{timelineMeta.page}</button>
                <button className="pg-btn" disabled={timelineMeta.page >= timelineMeta.totalPages} onClick={() => setTimelineMeta({ page: timelineMeta.page + 1 })} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'Visits' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="doc-toolbar">
            <div className="doc-field">
              <label>From</label>
              <input type="date" value={visitsFilters.date_from} onChange={(event) => { setVisitsFilters((previous) => ({ ...previous, date_from: event.target.value })); setVisitsMeta({ page: 1 }); }} />
            </div>
            <div className="doc-field">
              <label>To</label>
              <input type="date" value={visitsFilters.date_to} onChange={(event) => { setVisitsFilters((previous) => ({ ...previous, date_to: event.target.value })); setVisitsMeta({ page: 1 }); }} />
            </div>
            <button className="doc-btn" type="button" onClick={() => { setVisitsFilters({ date_from: '', date_to: '' }); setVisitsMeta({ page: 1 }); }}>Reset</button>
            {loadingVisits && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
          </div>
          {visitsData.length === 0 ? (
            <EmptyRecords message="No OPD visit records found for this patient." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>VISIT NUMBER</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr></thead>
                <tbody>
                  {visitsData.map((visit) => (
                    <tr key={visit.id}>
                      <td>{formatDate(visit.visit_date)}</td>
                      <td><strong>{visit.visit_number}</strong></td>
                      <td>{visit.doctor_name}</td>
                      <td>{visit.visit_type.replaceAll('_', ' ')}</td>
                      <td><span className={`status-badge status-${visit.status.toLowerCase()}`}>{visit.status.replaceAll('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visitsMeta.totalPages > 1 && (
            <div className="um-pagination" style={{ marginTop: '1rem' }}>
              <span>Showing {visitsData.length === 0 ? 0 : (visitsMeta.page - 1) * visitsMeta.limit + 1}-{Math.min(visitsMeta.page * visitsMeta.limit, visitsMeta.total || 0)} of {visitsMeta.total || 0} visits</span>
              <div className="um-page-controls">
                <button className="pg-btn" disabled={visitsMeta.page <= 1} onClick={() => setVisitsMeta({ page: visitsMeta.page - 1 })} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button>
                <button className="pg-btn active" disabled type="button">{visitsMeta.page}</button>
                <button className="pg-btn" disabled={visitsMeta.page >= visitsMeta.totalPages} onClick={() => setVisitsMeta({ page: visitsMeta.page + 1 })} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'Appointments' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="doc-toolbar">
            <div className="doc-field"><label>From</label><input type="date" value={appointmentFilters.date_from} onChange={(event) => { setAppointmentFilters((previous) => ({ ...previous, date_from: event.target.value })); setAppointmentsMeta({ page: 1 }); }} /></div>
            <div className="doc-field"><label>To</label><input type="date" value={appointmentFilters.date_to} onChange={(event) => { setAppointmentFilters((previous) => ({ ...previous, date_to: event.target.value })); setAppointmentsMeta({ page: 1 }); }} /></div>
            <div className="doc-field">
              <label>Doctor</label>
              <select value={appointmentFilters.doctor_id} onChange={(event) => { setAppointmentFilters((previous) => ({ ...previous, doctor_id: event.target.value })); setAppointmentsMeta({ page: 1 }); }}>
                <option value="">All Doctors</option>
                {doctorsList.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}
              </select>
            </div>
            <button className="doc-btn" type="button" onClick={() => { setAppointmentFilters({ date_from: '', date_to: '', doctor_id: '' }); setAppointmentsMeta({ page: 1 }); }}>Reset</button>
            {loadingAppointments && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
          </div>
          {appointments.length === 0 ? (
            <EmptyRecords message="No appointments recorded for this patient." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>TIME</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr></thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{formatDate(appointment.appointment_date)}</td>
                      <td>{appointment.start_time}</td>
                      <td>{appointment.doctor_name}</td>
                      <td>{appointment.visit_type.replaceAll('_', ' ')}</td>
                      <td><span className="doc-status active">{appointment.status.replaceAll('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {appointmentsMeta.totalPages > 1 && (
            <div className="um-pagination" style={{ marginTop: '1rem' }}>
              <span>Showing {appointments.length === 0 ? 0 : (appointmentsMeta.page - 1) * appointmentsMeta.limit + 1}-{Math.min(appointmentsMeta.page * appointmentsMeta.limit, appointmentsMeta.total || 0)} of {appointmentsMeta.total || 0} appointments</span>
              <div className="um-page-controls">
                <button className="pg-btn" disabled={appointmentsMeta.page <= 1} onClick={() => setAppointmentsMeta({ page: appointmentsMeta.page - 1 })} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button>
                <button className="pg-btn active" disabled type="button">{appointmentsMeta.page}</button>
                <button className="pg-btn" disabled={appointmentsMeta.page >= appointmentsMeta.totalPages} onClick={() => setAppointmentsMeta({ page: appointmentsMeta.page + 1 })} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'Prescriptions' ? (
        prescriptions.length === 0 ? (
          <EmptyRecords message="No prescription records found for this patient." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>DATE</th><th>DOCTOR</th><th>MEDICINES PRESCRIBED</th><th>DOSAGE &amp; FREQUENCY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr></thead>
              <tbody>
                {prescriptions.map((prescription) => (
                  <tr key={prescription.id}>
                    <td>{formatDate(prescription.created_at)}</td>
                    <td><strong>{prescription.doctor_name || 'Attending Physician'}</strong></td>
                    <td>{prescription.items.map((item) => `${item.medicine_name}${item.strength ? ` (${item.strength})` : ''}`).join(', ')}</td>
                    <td>{prescription.items.map((item) => `${item.dosage} - ${item.frequency} (${item.duration})`).join('; ')}</td>
                    <td><span className="doc-status active">{prescription.status}</span></td>
                    <td style={{ textAlign: 'center' }}><button className="doc-btn small" onClick={() => onViewPrescription(prescription)} title="View Prescription" type="button"><i aria-hidden="true" className="ph ph-file-text" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activeTab === 'Lab Results' ? (
        labOrders.length === 0 ? (
          <EmptyRecords message="No laboratory test results found for this patient." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>DATE</th><th>INVESTIGATION NAME</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr></thead>
              <tbody>
                {labOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDate(order.created_at)}</td>
                    <td><strong>{order.items.map((item) => item.investigation_name).join(', ') || 'Lab Requisition'}</strong></td>
                    <td>{order.items[0]?.category || 'General Lab'}</td>
                    <td><span className="doc-status draft">{order.priority}</span></td>
                    <td><span className="doc-status active">{order.status.replaceAll('_', ' ')}</span></td>
                    <td style={{ textAlign: 'center' }}><button className="doc-btn small" onClick={() => onViewLabOrder(order)} title="View Lab Order" type="button"><i aria-hidden="true" className="ph ph-file-text" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activeTab === 'Imaging' ? (
        imagingOrders.length === 0 ? (
          <EmptyRecords message="No radiology / imaging records found for this patient." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>DATE</th><th>SCAN / MODALITY</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr></thead>
              <tbody>
                {imagingOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatDate(order.created_at)}</td>
                    <td><strong>{order.items.map((item) => item.investigation_name).join(', ') || 'Imaging Requisition'}</strong></td>
                    <td>{order.items[0]?.category || 'Radiology'}</td>
                    <td><span className="doc-status draft">{order.priority}</span></td>
                    <td><span className="doc-status active">{order.status.replaceAll('_', ' ')}</span></td>
                    <td style={{ textAlign: 'center' }}><button className="doc-btn small" onClick={() => onViewImagingOrder(order)} title="View Imaging Order" type="button"><i aria-hidden="true" className="ph ph-file-text" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activeTab === 'Documents' ? (
        <>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="doc-btn primary" onClick={() => onOpenUpload('DOCUMENT')} type="button"><i className="ph ph-upload-simple" aria-hidden="true" /> Upload Document</button>
          </div>
          {documents.length === 0 ? (
            <EmptyRecords message="No uploaded documents found for this patient." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>TITLE</th><th>FILE</th><th>TYPE</th><th>UPLOADED BY</th></tr></thead>
                <tbody>{documents.map((document) => <tr key={document.id}><td>{formatDate(document.created_at)}</td><td><strong>{document.title}</strong></td><td>{document.file_name}</td><td>{document.document_type}</td><td>{document.uploaded_by_name || 'Recorded user'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {activeTab === 'Billing' ? (
        billingInvoices.length === 0 ? (
          <EmptyRecords message="No billing statements or invoices found for this patient." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>INVOICE #</th><th>DATE</th><th>SERVICES BILLED</th><th>TOTAL AMOUNT</th><th>BALANCE</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr></thead>
              <tbody>
                {billingInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number}</strong></td>
                    <td>{formatDate(invoice.invoice_date || invoice.created_at)}</td>
                    <td>{invoice.items.map((item) => item.service_name).join(', ') || 'OPD Services'}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                    <td><strong style={{ color: invoice.balance_amount > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(invoice.balance_amount)}</strong></td>
                    <td><span className="doc-status active">{invoice.status}</span></td>
                    <td style={{ textAlign: 'center' }}><button className="doc-btn small" onClick={() => onViewInvoice(invoice)} title="View Invoice" type="button"><i aria-hidden="true" className="ph ph-file-text" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activeTab === 'Consent' ? (
        <>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="doc-btn primary" onClick={() => onOpenUpload('CONSENT')} type="button"><i className="ph ph-upload-simple" aria-hidden="true" /> Upload Consent</button>
          </div>
          {consents.length === 0 ? (
            <EmptyRecords message="No consent forms found for this patient." />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>CONSENT</th><th>SIGNED BY</th><th>STATUS</th><th>VALID UNTIL</th></tr></thead>
                <tbody>{consents.map((consent) => <tr key={consent.id}><td>{formatDate(consent.created_at)}</td><td><strong>{consent.title}</strong></td><td>{consent.signed_by_name || 'Not recorded'}</td><td>{consent.consent_status || 'Not recorded'}</td><td>{consent.valid_until ? formatDate(consent.valid_until) : 'Not recorded'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
