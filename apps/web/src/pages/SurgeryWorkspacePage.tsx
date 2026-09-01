import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { ProcedureBooking, ProcedureRecommendation } from '../api/surgery';
import { surgeryApi } from '../api/surgery';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { NewProcedureRecommendationModal } from '../components/surgery/NewProcedureRecommendationModal';
import { usePatientDocuments } from '../hooks/patients/usePatients';
import { useBillingInvoiceDetails } from '../hooks/billing/useBilling';
import { admissionsConfigurationApi, type BedHold } from '../api/admissions-configuration';
import { useSurgeryWorkspaceFeature } from '../hooks/surgery/useSurgeryWorkspaceFeature';

const bookingSchema = z.object({ doctor_id: z.string().min(1, 'Select a doctor'), scheduled_start: z.string().min(1, 'Select date and time'), hold_id: z.string(), consent_document_id: z.string(), deposit_invoice_id: z.string(), notes: z.string().max(2000) });
const actionSchema = z.object({ scheduled_start: z.string(), doctor_id: z.string(), hold_id: z.string(), consent_document_id: z.string(), deposit_invoice_id: z.string(), reason: z.string() });
type BookingValues = z.infer<typeof bookingSchema>; type ActionValues = z.infer<typeof actionSchema>;
type ActionMode = 'confirm' | 'reschedule' | 'cancel-booking' | 'cancel-recommendation' | 'complete' | null;
const statusTone = (status: string) => status === 'BOOKED' || status === 'COMPLETED' ? 'green' : status === 'CANCELLED' ? 'red' : status === 'PENDING_CONFIRMATION' ? 'orange' : 'blue';
const displayDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const localDateTime = (value: string) => { const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); };

export function SurgeryWorkspacePage() {
  const [recommendationOpen, setRecommendationOpen] = useState(false); const [bookingFor, setBookingFor] = useState<ProcedureRecommendation | null>(null); const [selected, setSelected] = useState<ProcedureBooking | null>(null); const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [viewBookingDetail, setViewBookingDetail] = useState<ProcedureBooking | null>(null);
  const feature = useSurgeryWorkspaceFeature({ selectedBookingId: selected?.id, selectedBookingStatus: selected?.status }); const { state, actions } = feature;

  const handleViewBooking = async (bookingId: string) => {
    const found = state.bookings.find((b) => b.id === bookingId);
    if (found) {
      setViewBookingDetail(found);
      return;
    }
    try {
      const fetched = await surgeryApi.booking(bookingId, state.branchId);
      if (fetched) {
        setViewBookingDetail(fetched);
      } else {
        toast.error('Booking record not found.');
      }
    } catch {
      toast.error('Unable to load booking details.');
    }
  };
  const bookingForm = useForm<BookingValues>({ resolver: zodResolver(bookingSchema), defaultValues: { doctor_id: '', scheduled_start: '', hold_id: '', consent_document_id: '', deposit_invoice_id: '', notes: '' } });
  const actionForm = useForm<ActionValues>({ resolver: zodResolver(actionSchema), defaultValues: { scheduled_start: '', doctor_id: '', hold_id: '', consent_document_id: '', deposit_invoice_id: '', reason: '' } });
  const departmentId = bookingFor?.department_id ?? ''; const eligibleDoctors = useMemo(() => state.doctors.filter((item) => !departmentId || item.department_id === departmentId), [departmentId, state.doctors]);
  const watchedStart = bookingForm.watch('scheduled_start');
  const watchedDoctor = bookingForm.watch('doctor_id');
  const watchedActionStart = actionForm.watch('scheduled_start');
  const watchedActionDoctor = actionForm.watch('doctor_id');

  useEffect(() => {
    if (bookingFor) {
      bookingForm.reset({
        doctor_id: bookingFor.recommending_doctor_id || '',
        scheduled_start: '',
        hold_id: '',
        consent_document_id: '',
        deposit_invoice_id: '',
        notes: '',
      });
    }
  }, [bookingFor, bookingForm]);

  useEffect(() => {
    if (bookingFor && watchedStart) {
      actions.setAvailability({
        department_id: bookingFor.department_id,
        service_id: bookingFor.service_id,
        scheduled_start: watchedStart,
        doctor_id: watchedDoctor || undefined,
      });
    }
  }, [actions, bookingFor, watchedStart, watchedDoctor]);

  useEffect(() => {
    if (selected && actionMode === 'reschedule' && watchedActionStart) {
      actions.setAvailability({
        department_id: selected.department_id,
        service_id: selected.service_id,
        scheduled_start: watchedActionStart,
        doctor_id: watchedActionDoctor || undefined,
      });
    }
  }, [actions, selected, actionMode, watchedActionStart, watchedActionDoctor]);

  useEffect(() => { if (selected) actionForm.reset({ scheduled_start: localDateTime(selected.scheduled_start), doctor_id: selected.doctor_id, hold_id: selected.hold_id ?? '', consent_document_id: selected.consent_document_id ?? '', deposit_invoice_id: selected.deposit_invoice_id ?? '', reason: '' }); }, [actionForm, selected]);
  const procedure = bookingFor ? state.services.find((item) => item.id === bookingFor.service_id) : selected ? state.services.find((item) => item.id === selected.service_id) : undefined;

  const createBooking = bookingForm.handleSubmit(async (values) => {
    if (!bookingFor) return;
    try {
      const booking = await actions.createBooking({
        recommendation_id: bookingFor.id,
        branch_id: state.branchId,
        doctor_id: values.doctor_id,
        scheduled_start: values.scheduled_start,
        hold_id: values.hold_id || null,
        consent_document_id: values.consent_document_id || null,
        deposit_invoice_id: values.deposit_invoice_id || null,
        notes: values.notes || null,
      });
      toast.success('Booking created and awaiting prerequisite confirmation.');
      setBookingFor(null);
      setSelected(booking);
      bookingForm.reset();
      actions.setTab('bookings');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create booking.');
    }
  });
  const executeAction = actionForm.handleSubmit(async (values) => {
    try {
      if (actionMode === 'cancel-recommendation' && bookingFor) await actions.executeWorkflowAction({ mode: actionMode, variables: { id: bookingFor.id, reason: values.reason } });
      if (selected && actionMode === 'confirm') await actions.executeWorkflowAction({ mode: actionMode, variables: { id: selected.id, body: { hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null } } });
      if (selected && actionMode === 'reschedule') {
        await actions.executeWorkflowAction({ mode: actionMode, variables: { id: selected.id, body: { scheduled_start: values.scheduled_start, doctor_id: values.doctor_id, hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null, reason: values.reason } } });
      }
      if (selected && actionMode === 'cancel-booking') {
        await actions.executeWorkflowAction({ mode: actionMode, variables: { id: selected.id, reason: values.reason } });
      }
      if (selected && actionMode === 'complete') await actions.executeWorkflowAction({ mode: actionMode, variables: selected.id });
      toast.success(actionMode === 'reschedule' ? 'Procedure rescheduled.' : actionMode === 'confirm' ? 'Procedure booking confirmed.' : actionMode === 'complete' ? 'Procedure marked completed.' : 'Cancellation completed.');
      setActionMode(null);
      setBookingFor(null);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action could not be completed.');
    }
  });

  if (!state.branchId && state.branches.length === 0) return <div className="admin-dashboard-state"><i className="ph ph-buildings"/><strong>No authorized branch</strong><span>Assign this user to a branch before managing procedure bookings.</span></div>;

  return (
    <div className="surgery-page">
      {/* Page Header */}
      <div className="surgery-page-head">
        <div>
          <h2>Surgery &amp; Procedures</h2>
          <p>Coordinate recommendations, prerequisites and procedure schedules</p>
        </div>
        <div className="surgery-actions">
          {state.branches.length > 1 ? (
            <select
              aria-label="Select Branch"
              value={state.branchId}
              onChange={(event) => actions.setBranchId(event.target.value)}
              className="um-filter"
              style={{ minWidth: '170px', fontWeight: 500 }}
            >
              {state.branches.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          ) : null}
          <button
            className="btn-primary"
            onClick={() => setRecommendationOpen(true)}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 16px', borderRadius: '8px', fontWeight: 600 }}
          >
            <i className="ph ph-plus" /> New Recommendation
          </button>
        </div>
      </div>

      {/* 4 Modern Surgery KPI Metric Cards */}
      <section className="surgery-kpi-grid">
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon blue">
            <i className="ph ph-clipboard-text" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Active Recommendations</span>
            <strong>{state.recommendations.filter((item) => item.status === 'ACTIVE').length}</strong>
            <small>Awaiting booking</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon orange">
            <i className="ph ph-clock-countdown" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Pending Confirmation</span>
            <strong>{state.bookings.filter((item) => item.status === 'PENDING_CONFIRMATION').length}</strong>
            <small>Prerequisites pending</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon purple">
            <i className="ph ph-calendar-check" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Booked / Scheduled</span>
            <strong>{state.bookings.filter((item) => item.status === 'BOOKED').length}</strong>
            <small>Confirmed slots</small>
          </div>
        </div>
        <div className="surgery-kpi">
          <div className="surgery-kpi-icon green">
            <i className="ph ph-check-circle" />
          </div>
          <div className="surgery-kpi-copy">
            <span>Completed</span>
            <strong>{state.bookings.filter((item) => item.status === 'COMPLETED').length}</strong>
            <small>Discharged / Done</small>
          </div>
        </div>
      </section>

      {/* Toolbar & Filters */}
      <div className="surgery-toolbar">
        <div className="segmented-control">
          <button
            className={state.tab === 'recommendations' ? 'active' : ''}
            onClick={() => actions.setTab('recommendations')}
            type="button"
          >
            Recommendations
          </button>
          <button
            className={state.tab === 'bookings' ? 'active' : ''}
            onClick={() => actions.setTab('bookings')}
            type="button"
          >
            Bookings
          </button>
          <button
            className={state.tab === 'schedule' ? 'active' : ''}
            onClick={() => actions.setTab('schedule')}
            type="button"
          >
            Schedule
          </button>
        </div>

        <div className="surgery-toolbar-controls">
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <input
              placeholder="Number, MRN, patient or procedure..."
              value={state.searchText}
              onChange={(event) => actions.setSearchText(event.target.value)}
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px 0 32px', fontSize: '0.84rem' }}
            />
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
          </div>

          <select
            value={state.status}
            onChange={(event) => actions.setStatus(event.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem', background: '#fff' }}
          >
            <option value="">All statuses</option>
            {state.tab === 'recommendations' ? (
              <>
                <option value="ACTIVE">Active</option>
                <option value="BOOKED">Booked</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            ) : (
              <>
                <option value="PENDING_CONFIRMATION">Pending confirmation</option>
                <option value="BOOKED">Booked</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            )}
          </select>

          {state.tab === 'schedule' ? (
            <input
              type="date"
              value={state.date}
              onChange={(event) => actions.setDate(event.target.value)}
              style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem', background: '#fff' }}
            />
          ) : null}
        </div>
      </div>

      {/* Main Table Views */}
      {state.tab === 'recommendations' ? (
        <div className="surgery-table-card">
          <table className="data-table" style={{ minWidth: '960px' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Recommendation</th>
                <th style={{ width: '180px' }}>Patient</th>
                <th>Procedure</th>
                <th>Doctor / Department</th>
                <th>Clinical Reason</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ width: '150px', minWidth: '150px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.recommendationsQuery.isLoading ? (
                <StateRow columns={7} text="Loading recommendations..." />
              ) : state.recommendationsQuery.isError ? (
                <StateRow columns={7} text="Unable to load recommendations." />
              ) : state.recommendations.length === 0 ? (
                <StateRow columns={7} text="No live procedure recommendations found." />
              ) : (
                state.recommendations.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{item.recommendation_number}</strong>
                      <br />
                      <small style={{ color: '#64748b' }}>{new Date(item.created_at).toLocaleDateString()}</small>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.patient_name}</span>
                      <br />
                      <small style={{ color: '#64748b' }}>{item.patient_number}</small>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0369a1' }}>{item.service_name}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#334155' }}>{item.recommending_doctor_name}</span>
                      <br />
                      <small style={{ color: '#64748b' }}>{item.department_name}</small>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>{item.clinical_reason}</span>
                    </td>
                    <td>
                      <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="surgery-table-actions" style={{ justifyContent: 'flex-end' }}>
                        {item.status === 'ACTIVE' ? (
                          <>
                            <button
                              className="btn-primary compact"
                              onClick={() => { setBookingFor(item); }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                            >
                              <i className="ph ph-calendar-plus" /> Book
                            </button>
                            <button
                              className="btn-danger compact"
                              onClick={() => { setBookingFor(item); setActionMode('cancel-recommendation'); }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}
                            >
                              <i className="ph ph-x" /> Cancel
                            </button>
                          </>
                        ) : item.booking_id ? (
                          <button
                            className="btn-secondary compact"
                            onClick={() => void handleViewBooking(item.booking_id!)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                          >
                            <i className="ph ph-eye" /> View Booking
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.tab === 'bookings' ? (
        <div className="surgery-table-card">
          <table className="data-table" style={{ minWidth: '980px' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Booking</th>
                <th style={{ width: '180px' }}>Patient</th>
                <th>Procedure</th>
                <th>Schedule</th>
                <th>Doctor</th>
                <th>Prerequisites</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ width: '110px', minWidth: '110px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.bookingsQuery.isLoading ? (
                <StateRow columns={8} text="Loading procedure bookings..." />
              ) : state.bookingsQuery.isError ? (
                <StateRow columns={8} text="Unable to load procedure bookings." />
              ) : state.bookings.length === 0 ? (
                <StateRow columns={8} text="No live procedure bookings found." />
              ) : (
                state.bookings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{item.booking_number}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.patient_name}</span>
                      <br />
                      <small style={{ color: '#64748b' }}>{item.patient_number}</small>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0369a1' }}>{item.service_name}</span>
                      <br />
                      <small style={{ color: '#64748b' }}>{item.duration_minutes} min</small>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{displayDate(item.scheduled_start)}</span>
                    </td>
                    <td>{item.doctor_name}</td>
                    <td>
                      <RequirementFlags booking={item} service={state.services.find((service) => service.id === item.service_id)} />
                    </td>
                    <td>
                      <StatusBadge tone={statusTone(item.status)}>{item.status.replaceAll('_', ' ')}</StatusBadge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary compact"
                        onClick={() => setSelected(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <i className="ph ph-sliders" /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.tab === 'schedule' ? (
        <section className="surgery-table-card surgery-schedule-board">
          <div className="surgery-schedule-header-bar">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-calendar-check" style={{ color: '#0284c7' }} />
                Procedure Schedule Board
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                All procedure schedules for <strong>{new Date(`${state.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 600 }}>
                {state.scheduleRows.length} Scheduled
              </span>
            </div>
          </div>
          {state.bookingsQuery.isLoading ? (
            <div style={{ padding: '3rem 1rem' }}>
              <MedicalLoader text="Loading surgical procedure schedule..." subtext="Accessing operating theater calendar" />
            </div>
          ) : state.bookingsQuery.isError ? (
            <div className="error-state" style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
              Unable to load the procedure schedule.
            </div>
          ) : state.scheduleRows.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <i className="ph ph-calendar-x" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }} />
              <strong style={{ color: '#334155', display: 'block', fontSize: '0.92rem' }}>No Procedures Scheduled for this Date</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8rem' }}>Select another date above or book a pending recommendation.</p>
            </div>
          ) : (
            <div className="surgery-schedule-list">
              {state.scheduleRows.map((item) => (
                <div
                  className={`surgery-schedule-card status-${item.status}`}
                  key={item.id}
                >
                  <div className="surgery-schedule-time">
                    <strong>
                      <i className="ph ph-clock" style={{ color: '#0284c7', fontSize: '1.1rem' }} />
                      {new Date(item.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                    <small>Duration: {item.duration_minutes} min</small>
                  </div>

                  <div className="surgery-schedule-main">
                    <div className="surgery-schedule-patient-row">
                      <span className="surgery-schedule-patient-name">{item.patient_name}</span>
                      <span className="surgery-schedule-mrn">{item.patient_number}</span>
                      <span className="surgery-schedule-booking-num">{item.booking_number}</span>
                    </div>

                    <div className="surgery-schedule-meta">
                      <span className="surgery-schedule-meta-item">
                        <i className="ph ph-heartbeat" />
                        <strong>{item.service_name}</strong>
                      </span>
                      <span className="surgery-schedule-meta-item">
                        <i className="ph ph-user-md" />
                        {item.doctor_name}
                      </span>
                      <span className="surgery-schedule-meta-item">
                        <i className="ph ph-buildings" />
                        {item.department_name}
                      </span>
                    </div>

                    <div style={{ marginTop: '2px' }}>
                      <RequirementFlags booking={item} service={state.services.find((service) => service.id === item.service_id)} />
                    </div>
                  </div>

                  <div className="surgery-schedule-actions">
                    <StatusBadge tone={statusTone(item.status)}>{item.status.replaceAll('_', ' ')}</StatusBadge>
                    <button
                      type="button"
                      className="btn-secondary compact"
                      onClick={() => setSelected(item)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, background: '#f8fafc' }}
                    >
                      <i className="ph ph-sliders" /> Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ─── Modal 1: New Procedure Recommendation (Shared Component) ── */}
      <NewProcedureRecommendationModal
        open={recommendationOpen}
        onClose={() => setRecommendationOpen(false)}
        branchId={state.branchId}
        departments={state.departments}
        doctors={state.doctors}
        services={state.services}
        onCreateSuccess={() => {
          void state.recommendationsQuery.refetch();
        }}
      />

      {/* ─── Modal 2: Book Recommended Procedure ────────────────────────── */}
      <Modal
        open={Boolean(bookingFor && !actionMode)}
        onClose={() => setBookingFor(null)}
        title="Book Recommended Procedure"
        icon="ph-calendar-check"
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button type="button" className="btn-secondary" onClick={() => setBookingFor(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="procedure-booking-form"
              className="btn-primary"
              disabled={state.pending.createBooking}
            >
              <i className="ph ph-check-circle" /> {state.pending.createBooking ? 'Booking...' : 'Create Pending Booking'}
            </button>
          </div>
        }
      >
        <form
          id="procedure-booking-form"
          onSubmit={createBooking}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Step Progress Nav */}
          <div className="surgery-step-nav">
            <div className="surgery-step-item completed">
              <i className="ph-fill ph-check-circle" /> 1. Recommendation
            </div>
            <div className="surgery-step-item active">
              <i className="ph-fill ph-calendar" /> 2. Procedure Schedule
            </div>
            <div className="surgery-step-item">
              <i className="ph ph-shield-check" /> 3. Prerequisite Checks
            </div>
          </div>

          {/* Procedure Summary Card */}
          <div className="surgery-detail-grid">
            <div className="surgery-detail-item">
              <span>Patient</span>
              <strong>{bookingFor?.patient_name}</strong>
              <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{bookingFor?.patient_number}</small>
            </div>
            <div className="surgery-detail-item">
              <span>Procedure</span>
              <strong>{bookingFor?.service_name}</strong>
              <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{procedure?.category ?? 'Surgical'}</small>
            </div>
            <div className="surgery-detail-item">
              <span>Configured Duration</span>
              <strong>{procedure?.default_duration_minutes ?? '-'} Minutes</strong>
              <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Capacity: {procedure?.booking_capacity ?? 1} concurrent</small>
            </div>
          </div>

          {/* Doctor & Schedule Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                Operating Doctor / Surgeon <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                {...bookingForm.register('doctor_id')}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: bookingForm.formState.errors.doctor_id ? '1px solid #ef4444' : '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              >
                <option value="">Select Doctor</option>
                {eligibleDoctors.map((item) => (
                  <option value={item.id} key={item.id}>{item.display_name}</option>
                ))}
              </select>
              <FieldError text={bookingForm.formState.errors.doctor_id?.message} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                Start Date &amp; Time <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="datetime-local"
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                {...bookingForm.register('scheduled_start')}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: bookingForm.formState.errors.scheduled_start ? '1px solid #ef4444' : '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              />
              <FieldError text={bookingForm.formState.errors.scheduled_start?.message} />
            </div>
          </div>

          {/* Detailed Doctor Availability Verification */}
          <DoctorAvailabilityChecker
            watchedStart={watchedStart}
            selectedDoctorId={bookingForm.watch('doctor_id')}
            durationMinutes={procedure?.default_duration_minutes ?? 60}
            departmentName={bookingFor?.department_name ?? 'Department'}
            doctors={eligibleDoctors.map((d) => ({ id: d.id, display_name: d.display_name }))}
            alternatives={state.alternatives}
            recommendedSlots={state.recommendedSlots}
            isLoading={state.alternativesLoading}
            onSelectDoctor={(docId) => bookingForm.setValue('doctor_id', docId)}
            onSelectSlot={(time24) => {
              const baseDate = watchedStart ? watchedStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
              bookingForm.setValue('scheduled_start', `${baseDate}T${time24}`);
            }}
          />

          {/* Prerequisite Info Notice */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <i className="ph-fill ph-info" style={{ color: '#0284c7', fontSize: '1.2rem', marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
              <strong>Prerequisite Notice:</strong> Creating a pending booking automatically generates the required procedure invoice. Consent documents, advance payment, and bed holds will be verified during the <strong>Confirmation</strong> step.
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '3px' }}>
              Booking Notes <span style={{ color: '#94a3b8' }}>(Optional)</span>
            </label>
            <textarea
              {...bookingForm.register('notes')}
              rows={2}
              placeholder="Special requirements, surgical team notices..."
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
            />
          </div>
        </form>
      </Modal>

      {/* ─── Modal 3: Procedure Booking Detail ──────────────────────────── */}
      <Modal
        open={Boolean(selected && !actionMode)}
        onClose={() => setSelected(null)}
        title="Procedure Booking Detail"
        icon="ph-file-text"
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              {['PENDING_CONFIRMATION', 'BOOKED'].includes(selected?.status ?? '') ? (
                <button
                  className="btn-danger"
                  onClick={() => setActionMode('cancel-booking')}
                  type="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-x-circle" /> Cancel Booking
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
              {selected?.status === 'PENDING_CONFIRMATION' ? (
                <button className="btn-primary" onClick={() => setActionMode('confirm')} type="button">
                  <i className="ph ph-check-circle" /> Confirm Booking
                </button>
              ) : null}
              {selected?.status === 'BOOKED' ? (
                <button className="btn-primary" onClick={() => setActionMode('reschedule')} type="button">
                  <i className="ph ph-clock-counter-clockwise" /> Reschedule
                </button>
              ) : null}
              {selected?.status === 'BOOKED' ? (
                <button
                  className="btn-primary"
                  onClick={() => setActionMode('complete')}
                  type="button"
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  <i className="ph ph-check-fat" /> Complete Procedure
                </button>
              ) : null}
            </div>
          </div>
        }
      >
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="surgery-step-nav">
              <div className="surgery-step-item completed">
                <i className="ph-fill ph-check-circle" /> 1. Recommendation
              </div>
              <div className="surgery-step-item completed">
                <i className="ph-fill ph-check-circle" /> 2. Procedure Schedule
              </div>
              <div className={`surgery-step-item ${selected.status === 'BOOKED' ? 'completed' : 'active'}`}>
                <i className={`ph-fill ${selected.status === 'BOOKED' ? 'ph-check-circle' : 'ph-shield-check'}`} /> 3. Prerequisite Checks
              </div>
            </div>

            <div className="surgery-detail-grid">
              <div className="surgery-detail-item">
                <span>Booking Number</span>
                <strong>{selected.booking_number}</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Created {displayDate(selected.created_at)}</small>
              </div>
              <div className="surgery-detail-item">
                <span>Patient</span>
                <strong>{selected.patient_name}</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{selected.patient_number}</small>
              </div>
              <div className="surgery-detail-item">
                <span>Procedure</span>
                <strong>{selected.service_name}</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{selected.department_name}</small>
              </div>
              <div className="surgery-detail-item">
                <span>Surgeon</span>
                <strong>{selected.doctor_name}</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>Duration: {selected.duration_minutes} min</small>
              </div>
              <div className="surgery-detail-item">
                <span>Scheduled Window</span>
                <strong style={{ color: '#0284c7' }}>{displayDate(selected.scheduled_start)}</strong>
                <small style={{ fontSize: '0.75rem', color: '#64748b' }}>End: {displayDate(selected.scheduled_end)}</small>
              </div>
              <div className="surgery-detail-item">
                <span>Current Status</span>
                <div><StatusBadge tone={statusTone(selected.status)}>{selected.status.replaceAll('_', ' ')}</StatusBadge></div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                Prerequisite Status
              </div>
              <RequirementFlags booking={selected} service={procedure} />
            </div>

            {selected.schedule_history.length ? (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Reschedule History
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selected.schedule_history.map((row) => (
                    <div key={row.changed_at} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#0369a1', fontWeight: 600 }}>
                        {displayDate(row.previous_start)} → {displayDate(row.new_start)}
                      </span>
                      <strong style={{ color: '#334155' }}>{row.reason}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* ─── Modal 4: Action Execution Modal ────────────────────────────── */}
      <Modal
        open={Boolean(actionMode)}
        onClose={() => setActionMode(null)}
        title={
          actionMode === 'confirm'
            ? 'Confirm Procedure Booking'
            : actionMode === 'reschedule'
            ? 'Reschedule Procedure'
            : actionMode === 'complete'
            ? 'Complete Procedure'
            : 'Confirm Cancellation'
        }
        icon={actionMode?.startsWith('cancel') ? 'ph-x-circle' : actionMode === 'complete' ? 'ph-check-circle' : 'ph-gear-six'}
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <button type="button" className="btn-secondary" onClick={() => setActionMode(null)}>
              Back
            </button>
            <button
              type="submit"
              form="surgery-action-form"
              disabled={actionMode === 'complete' && Boolean(selected && new Date(selected.scheduled_start).getTime() > Date.now())}
              className={actionMode?.startsWith('cancel') ? 'btn-danger' : 'btn-primary'}
              style={
                actionMode === 'complete'
                  ? {
                      background: selected && new Date(selected.scheduled_start).getTime() <= Date.now() ? '#16a34a' : '#94a3b8',
                      borderColor: selected && new Date(selected.scheduled_start).getTime() <= Date.now() ? '#15803d' : '#94a3b8',
                      color: '#ffffff',
                      cursor: selected && new Date(selected.scheduled_start).getTime() <= Date.now() ? 'pointer' : 'not-allowed',
                    }
                  : undefined
              }
            >
              {actionMode?.startsWith('cancel') ? 'Confirm Cancellation' : actionMode === 'complete' ? 'Complete Procedure' : 'Confirm Action'}
            </button>
          </div>
        }
      >
        <form
          id="surgery-action-form"
          onSubmit={executeAction}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {actionMode === 'complete' && selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '0.92rem', fontWeight: 700 }}>
                  <i className="ph-fill ph-check-circle" style={{ fontSize: '1.25rem', color: '#16a34a' }} />
                  <span>Mark Procedure as Completed</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
                  You are about to finalize this procedure. This will mark the booking as completed, free up allocated operating theater capacity, and record the completion event on the patient’s clinical timeline.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#ffffff', border: '1px solid #dcfce7', borderRadius: '6px', padding: '12px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>PATIENT</span>
                    <strong style={{ color: '#0f172a' }}>{selected.patient_name}</strong> <span style={{ color: '#64748b' }}>({selected.patient_number})</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>PROCEDURE</span>
                    <strong style={{ color: '#0f172a' }}>{selected.service_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>OPERATING DOCTOR</span>
                    <strong style={{ color: '#0f172a' }}>{selected.doctor_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>SCHEDULED WINDOW</span>
                    <strong style={{ color: '#0f172a' }}>{new Date(selected.scheduled_start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                  </div>
                </div>

                {new Date(selected.scheduled_start).getTime() > Date.now() ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px', fontSize: '0.78rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <i className="ph-fill ph-warning" style={{ fontSize: '1.2rem', color: '#d97706', flexShrink: 0 }} />
                    <span>
                      <strong>Procedure has not started yet.</strong> This procedure is scheduled for <strong>{new Date(selected.scheduled_start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>. Clinically, a surgery can only be marked as completed on or after its scheduled start time.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {actionMode === 'confirm' && selected ? (
            <ProcedureBookingPrerequisiteManager
              booking={selected}
              branchId={state.branchId}
              procedure={procedure}
              selectedConsentId={actionForm.watch('consent_document_id')}
              selectedHoldId={actionForm.watch('hold_id')}
              onSelectConsent={(id) => actionForm.setValue('consent_document_id', id)}
              onSelectHold={(id) => actionForm.setValue('hold_id', id)}
            />
          ) : null}

          {actionMode === 'reschedule' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  Doctor
                </label>
                <select
                  {...actionForm.register('doctor_id')}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                >
                  {state.doctors
                    .filter((item) => !selected || item.department_id === selected.department_id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.display_name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  Schedule Start
                </label>
                <input
                  type="datetime-local"
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  {...actionForm.register('scheduled_start')}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          ) : null}

          {actionMode === 'reschedule' ? (
            <DoctorAvailabilityChecker
              watchedStart={actionForm.watch('scheduled_start')}
              selectedDoctorId={actionForm.watch('doctor_id')}
              durationMinutes={procedure?.default_duration_minutes ?? selected?.duration_minutes ?? 60}
              departmentName={selected?.department_name ?? 'Department'}
              doctors={state.doctors.filter((d) => !selected || d.department_id === selected.department_id).map((d) => ({ id: d.id, display_name: d.display_name }))}
              alternatives={state.alternatives}
              recommendedSlots={state.recommendedSlots}
              isLoading={state.alternativesLoading}
              onSelectDoctor={(docId) => actionForm.setValue('doctor_id', docId)}
              onSelectSlot={(time24) => {
                const cur = actionForm.watch('scheduled_start');
                const baseDate = cur ? cur.slice(0, 10) : new Date().toISOString().slice(0, 10);
                actionForm.setValue('scheduled_start', `${baseDate}T${time24}`);
              }}
            />
          ) : null}

          {actionMode && ['cancel-recommendation', 'cancel-booking', 'reschedule'].includes(actionMode) ? (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                {actionMode === 'reschedule' ? 'Reason for Rescheduling' : 'Reason for Cancellation'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                {...actionForm.register('reason')}
                rows={2}
                placeholder="State clinical or administrative reason for this action..."
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
              />
            </div>
          ) : null}
        </form>
      </Modal>

      {/* ─── Modal 5: Booking Details Modal ──────────────────────── */}
      <Modal
        title={`Booking Details — ${viewBookingDetail?.booking_number ?? 'Procedure'}`}
        open={Boolean(viewBookingDetail)}
        onClose={() => setViewBookingDetail(null)}
        icon="ph-calendar-check"
        size="large"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              onClick={() => setViewBookingDetail(null)}
              type="button"
            >
              Close
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              {viewBookingDetail?.status === 'PENDING_CONFIRMATION' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setSelected(viewBookingDetail);
                    setActionMode('confirm');
                    setViewBookingDetail(null);
                  }}
                  type="button"
                >
                  <i className="ph ph-check-circle" /> Confirm Booking
                </button>
              )}
              {viewBookingDetail?.status === 'BOOKED' && (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSelected(viewBookingDetail);
                      setActionMode('reschedule');
                      setViewBookingDetail(null);
                    }}
                    type="button"
                  >
                    <i className="ph ph-calendar" /> Reschedule
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      setSelected(viewBookingDetail);
                      setActionMode('cancel-booking');
                      setViewBookingDetail(null);
                    }}
                    type="button"
                  >
                    <i className="ph ph-x" /> Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setSelected(viewBookingDetail);
                      setActionMode('complete');
                      setViewBookingDetail(null);
                    }}
                    type="button"
                  >
                    <i className="ph ph-check-fat" /> Complete Procedure
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        {viewBookingDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem' }}>
            {/* Header summary banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{viewBookingDetail.booking_number}</strong>
                  <StatusBadge tone={statusTone(viewBookingDetail.status)}>{viewBookingDetail.status.replaceAll('_', ' ')}</StatusBadge>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                  Scheduled: <strong>{displayDate(viewBookingDetail.scheduled_start)}</strong> ({viewBookingDetail.duration_minutes} mins)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Surgeon</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>{viewBookingDetail.doctor_name || 'Dr. Assigned'}</div>
              </div>
            </div>

            {/* Grid of info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Patient Details</h4>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{viewBookingDetail.patient_name}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>MRN: {viewBookingDetail.patient_number}</div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Procedure &amp; Theater</h4>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{viewBookingDetail.service_name}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Duration: {viewBookingDetail.duration_minutes} minutes</div>
              </div>
            </div>

            {/* Prerequisites */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Prerequisites &amp; Clearances</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div style={{ padding: '8px 10px', background: viewBookingDetail.prerequisite_snapshot?.bed_required ? (viewBookingDetail.prerequisite_snapshot?.bed_hold_id ? '#f0fdf4' : '#fef2f2') : '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>Bed Hold</span>
                  <strong style={{ fontSize: '0.82rem', color: viewBookingDetail.prerequisite_snapshot?.bed_required ? (viewBookingDetail.prerequisite_snapshot?.bed_hold_id ? '#16a34a' : '#dc2626') : '#64748b' }}>
                    {viewBookingDetail.prerequisite_snapshot?.bed_required ? (viewBookingDetail.prerequisite_snapshot?.bed_hold_id ? 'Hold Secured' : 'Required') : 'Not Required'}
                  </strong>
                </div>

                <div style={{ padding: '8px 10px', background: viewBookingDetail.prerequisite_snapshot?.consent_required ? (viewBookingDetail.prerequisite_snapshot?.consent_satisfied ? '#f0fdf4' : '#fef2f2') : '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>Consent Document</span>
                  <strong style={{ fontSize: '0.82rem', color: viewBookingDetail.prerequisite_snapshot?.consent_required ? (viewBookingDetail.prerequisite_snapshot?.consent_satisfied ? '#16a34a' : '#dc2626') : '#64748b' }}>
                    {viewBookingDetail.prerequisite_snapshot?.consent_required ? (viewBookingDetail.prerequisite_snapshot?.consent_satisfied ? 'Signed & Attached' : 'Required') : 'Not Required'}
                  </strong>
                </div>

                <div style={{ padding: '8px 10px', background: viewBookingDetail.prerequisite_snapshot?.deposit_required ? (viewBookingDetail.prerequisite_snapshot?.deposit_satisfied ? '#f0fdf4' : '#fef2f2') : '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>Advance Deposit</span>
                  <strong style={{ fontSize: '0.82rem', color: viewBookingDetail.prerequisite_snapshot?.deposit_required ? (viewBookingDetail.prerequisite_snapshot?.deposit_satisfied ? '#16a34a' : '#dc2626') : '#64748b' }}>
                    {viewBookingDetail.prerequisite_snapshot?.deposit_required ? (viewBookingDetail.prerequisite_snapshot?.deposit_satisfied ? 'Paid & Verified' : `Required (${viewBookingDetail.prerequisite_snapshot?.deposit_required_amount})`) : 'Not Required'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Notes if any */}
            {viewBookingDetail.notes && (
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569' }}>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: '#0f172a' }}>Clinical / Pre-op Notes:</span>
                {viewBookingDetail.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DoctorAvailabilityChecker({
  watchedStart,
  selectedDoctorId,
  durationMinutes = 60,
  departmentName = 'Department',
  doctors = [],
  alternatives = [],
  recommendedSlots = [],
  isLoading = false,
  onSelectDoctor,
  onSelectSlot,
}: {
  watchedStart?: string;
  selectedDoctorId?: string;
  durationMinutes?: number;
  departmentName?: string;
  doctors: Array<{ id: string; display_name: string }>;
  alternatives: Array<{ doctor_id: string; doctor_name: string }>;
  recommendedSlots?: Array<{ start_time: string; end_time: string; label: string; formatted: string }>;
  isLoading: boolean;
  onSelectDoctor: (doctorId: string) => void;
  onSelectSlot?: (timeStr: string) => void;
}) {
  if (!watchedStart) {
    return (
      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="ph ph-calendar-blank" style={{ fontSize: '1.1rem', color: '#94a3b8' }} />
        <span>Select a start date &amp; time above to verify doctor shift availability, clinic schedules, and theater capacity.</span>
      </div>
    );
  }

  const startDate = new Date(watchedStart);
  const isValidDate = !isNaN(startDate.getTime());
  if (!isValidDate) return null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedDateStr = watchedStart.slice(0, 10);
  const isDateInPast = selectedDateStr < todayStr;
  const isTodayDate = selectedDateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isPastTime = isDateInPast || (isTodayDate && (startDate.getHours() * 60 + startDate.getMinutes()) < currentMinutes - 2);

  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const formattedDate = startDate.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const formattedStartTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedEndTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const isSelectedAvailable = selectedDoctorId && !isPastTime ? alternatives.some((a) => a.doctor_id === selectedDoctorId) : false;
  const otherAlternatives = alternatives.filter((a) => a.doctor_id !== selectedDoctorId);

  // Filter out any recommended slot that is prior to the selected start time or in the past
  const selectedMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const minRequiredMinutes = isTodayDate ? Math.max(selectedMinutes, currentMinutes) : selectedMinutes;

  const validRecommendedSlots = isDateInPast
    ? []
    : recommendedSlots.filter((slot) => {
        const parts = slot.start_time.split(':').map(Number);
        const slotMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
        return slotMinutes >= minRequiredMinutes;
      });

  const fallbackSlots = isDateInPast
    ? []
    : recommendedSlots.filter((slot) => {
        if (!isTodayDate) return true;
        const parts = slot.start_time.split(':').map(Number);
        const slotMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
        return slotMinutes > currentMinutes;
      });

  const slotsToDisplay = validRecommendedSlots.length > 0 ? validRecommendedSlots : fallbackSlots;

  return (
    <div
      style={{
        background: isLoading ? '#f8fafc' : selectedDoctor ? (isSelectedAvailable ? '#f0fdf4' : '#fef2f2') : '#f0f9ff',
        border: `1px solid ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#86efac' : '#fca5a5') : '#bae6fd'}`,
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: `1px solid ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#dcfce7' : '#fee2e2') : '#e0f2fe'}`, paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
          <i className="ph ph-clock" style={{ color: '#0284c7' }} />
          <span>Scheduled Window:</span>
          <span style={{ color: '#0f172a' }}>{formattedDate} · {formattedStartTime} – {formattedEndTime}</span>
        </div>
        <span style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '2px 8px', color: '#475569', fontWeight: 600 }}>
          {durationMinutes} mins duration
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>
          <i className="ph ph-spinner ph-spin" style={{ color: '#0284c7' }} />
          <span>Checking doctor shifts, leave records, and clinic appointment overlaps...</span>
        </div>
      ) : isPastTime ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>
            <i className="ph-fill ph-warning-circle" style={{ fontSize: '1.05rem', color: '#dc2626' }} />
            <span>Selected Date &amp; Time is in the Past</span>
          </div>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#991b1b' }}>
            Procedures cannot be scheduled or recommended for past dates or elapsed time slots. Please select a future date and time.
          </p>
        </div>
      ) : selectedDoctor ? (
        isSelectedAvailable ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>
              <i className="ph-fill ph-check-circle" style={{ fontSize: '1.05rem', color: '#16a34a' }} />
              <span>{selectedDoctor.display_name} is Available &amp; Confirmed</span>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#166534' }}>
              Doctor is on duty with zero overlapping OPD clinic appointments or surgery bookings for this entire interval.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <i className="ph ph-calendar-check" /> Shift On-Duty
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <i className="ph ph-user-check" /> No Active Leave
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <i className="ph ph-check" /> 0 Clinic Clashes
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <i className="ph ph-hospital" /> Theater Ready
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>
              <i className="ph-fill ph-warning-circle" style={{ fontSize: '1.05rem', color: '#dc2626' }} />
              <span>{selectedDoctor.display_name} is UNAVAILABLE for this Slot</span>
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#991b1b' }}>
              This doctor is outside their configured working shift, on approved leave, or has an overlapping OPD appointment / surgery during this interval.
            </p>
            {otherAlternatives.length > 0 ? (
              <div style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#7f1d1d', display: 'block', marginBottom: '4px' }}>
                  Available alternative surgeons in {departmentName}:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {otherAlternatives.map((alt) => (
                    <button
                      key={alt.doctor_id}
                      type="button"
                      onClick={() => onSelectDoctor(alt.doctor_id)}
                      style={{ background: '#ffffff', border: '1px solid #f87171', borderRadius: '6px', padding: '3px 8px', fontSize: '0.74rem', color: '#991b1b', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <i className="ph ph-user-plus" /> Switch to {alt.doctor_name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.73rem', color: '#991b1b', fontStyle: 'italic' }}>
                No other surgeons in {departmentName} are available for this specific slot. Please select a different date or time.
              </div>
            )}
          </div>
        )
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#0369a1', marginBottom: '4px' }}>
            <i className="ph ph-users" />
            <span>Surgeon Availability in {departmentName}:</span>
          </div>
          {alternatives.length > 0 ? (
            <div>
              <span style={{ fontSize: '0.74rem', color: '#0284c7', display: 'block', marginBottom: '4px' }}>
                {alternatives.length} surgeon{alternatives.length > 1 ? 's are' : ' is'} free for this interval. Click to assign:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {alternatives.map((alt) => (
                  <button
                    key={alt.doctor_id}
                    type="button"
                    onClick={() => onSelectDoctor(alt.doctor_id)}
                    style={{ background: '#ffffff', border: '1px solid #7dd3fc', borderRadius: '6px', padding: '3px 8px', fontSize: '0.74rem', color: '#0369a1', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <i className="ph ph-check" /> {alt.doctor_name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
              No doctors in {departmentName} have available shifts for this interval. Please try another time slot.
            </span>
          )}
        </div>
      )}

      {/* Recommended Available Free Slots */}
      {slotsToDisplay && slotsToDisplay.length > 0 ? (
        <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: `1px dashed ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#bbf7d0' : '#fca5a5') : '#bae6fd'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            <i className="ph ph-sparkle" style={{ color: '#0284c7', fontSize: '0.9rem' }} />
            <span>Recommended Available Slots on {formattedDate}{validRecommendedSlots.length > 0 && selectedMinutes > 0 ? ` (from ${formattedStartTime} onwards)` : ''}:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {slotsToDisplay.map((slot) => (
              <button
                key={slot.start_time}
                type="button"
                onClick={() => onSelectSlot?.(slot.start_time)}
                title={`Click to schedule for ${slot.formatted}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid #7dd3fc',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.74rem',
                  color: '#0369a1',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <i className="ph ph-clock" /> {slot.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StateRow({ columns, text }: { columns: number; text: string }) {
  if (text.toLowerCase().includes('loading')) {
    return (
      <tr>
        <td colSpan={columns} style={{ padding: '2.5rem 1rem' }}>
          <MedicalLoader text={text} subtext="Retrieving surgical and procedural theater records" />
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={columns} className="empty-state" style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
        {text}
      </td>
    </tr>
  );
}

function FieldError({ text }: { text?: string }) {
  return text ? <small className="form-error" style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '2px', display: 'block' }}>{text}</small> : null;
}

function RequirementFlags({
  booking,
  service,
}: {
  booking: ProcedureBooking;
  service?: { requires_bed: boolean; requires_consent: boolean; requires_advance_deposit: boolean };
}) {
  const snapshot = booking.prerequisite_snapshot;
  return (
    <div className="requirement-flags">
      <span className={!service?.requires_bed || Boolean(booking.hold_id) ? 'met' : 'blocked'}>
        Bed: {!service?.requires_bed ? 'Not required' : booking.hold_id ? 'Held' : 'Required'}
      </span>
      <span className={!service?.requires_consent || Boolean(booking.consent_document_id) || Boolean(snapshot) ? 'met' : 'blocked'}>
        Consent: {!service?.requires_consent ? 'Not required' : booking.consent_document_id || snapshot ? 'Linked' : 'Required'}
      </span>
      <span className={!service?.requires_advance_deposit || Boolean(booking.deposit_invoice_id) || Boolean(snapshot) ? 'met' : 'blocked'}>
        Deposit: {!service?.requires_advance_deposit ? 'Not required' : booking.deposit_invoice_id || snapshot ? 'Linked' : 'Required'}
      </span>
    </div>
  );
}

function ProcedureBookingPrerequisiteManager({
  booking,
  branchId,
  procedure,
  selectedConsentId,
  selectedHoldId,
  onSelectConsent,
  onSelectHold,
}: {
  booking: ProcedureBooking;
  branchId: string;
  procedure?: { requires_consent: boolean; requires_advance_deposit: boolean; minimum_advance_deposit_amount?: number | null; requires_bed: boolean };
  selectedConsentId: string;
  selectedHoldId: string;
  onSelectConsent: (id: string) => void;
  onSelectHold: (id: string) => void;
}) {
  const docsQuery = usePatientDocuments(booking.patient_id, {}, Boolean(procedure?.requires_consent));
  const invoiceQuery = useBillingInvoiceDetails(booking.deposit_invoice_id);
  const [bedHolds, setBedHolds] = useState<BedHold[]>([]);

  useEffect(() => {
    if (procedure?.requires_bed && branchId) {
      void admissionsConfigurationApi.beds({ branch_id: branchId, status: 'RESERVED' }).then((res) => {
        const patientHolds = (res.data ?? [])
          .filter((b) => b.patient_id === booking.patient_id && b.current_hold_id)
          .map((b) => ({
            id: b.current_hold_id!,
            hold_number: b.hold_number ?? 'HOLD',
            idempotency_key: '',
            patient_id: b.patient_id!,
            branch_id: b.branch_id,
            ward_id: b.ward_id,
            bed_id: b.id,
            admission_id: null,
            bed_number: b.bed_number,
            ward_name: b.ward_name,
            room_number: b.room_number,
            status: 'ACTIVE' as const,
            held_at: '',
            expires_at: b.hold_expires_at ?? '',
            reason: 'Procedure Hold',
            terminal_reason: null,
            version: b.version,
            created_at: b.created_at,
            updated_at: b.updated_at,
          }));
        setBedHolds(patientHolds);
      }).catch(() => setBedHolds([]));
    }
  }, [procedure?.requires_bed, branchId, booking.patient_id]);

  const consentRequired = Boolean(procedure?.requires_consent);
  const consentSatisfied = !consentRequired || Boolean(booking.consent_document_id) || Boolean(selectedConsentId);

  const depositRequired = Boolean(procedure?.requires_advance_deposit);
  const minDeposit = procedure?.minimum_advance_deposit_amount ?? 0;
  const invoice = invoiceQuery.data;
  const paidAmount = invoice?.paid_amount ?? 0;
  const depositSatisfied = !depositRequired || Boolean(booking.deposit_invoice_id && (paidAmount >= minDeposit || invoice?.status === 'PAID'));

  const bedRequired = Boolean(procedure?.requires_bed);
  const bedSatisfied = !bedRequired || Boolean(booking.hold_id) || Boolean(selectedHoldId);

  const docsList = Array.isArray(docsQuery.data) ? docsQuery.data : (docsQuery.data?.data ?? []);
  const validConsentDocs = docsList.filter((d: { document_type?: string; consent_category?: string | null; title?: string }) => d.document_type === 'CONSENT' || d.consent_category || (d.title && d.title.toLowerCase().includes('consent')));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Info Summary */}
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>PROCEDURE</span>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{booking.service_name}</strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{booking.department_name}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>PATIENT</span>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{booking.patient_name}</strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MRN: {booking.patient_number}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>SURGEON / OPERATING DOCTOR</span>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{booking.doctor_name}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>SCHEDULED WINDOW</span>
          <strong style={{ fontSize: '0.85rem', color: '#0284c7' }}>{new Date(booking.scheduled_start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '4px' }}>
        Service Prerequisite Verification
      </div>

      {/* 1. Consent Card */}
      <div style={{ border: `1px solid ${consentSatisfied ? '#bbf7d0' : '#fde68a'}`, background: consentSatisfied ? '#f0fdf4' : '#fffbeb', borderRadius: '8px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: consentRequired && !booking.consent_document_id ? '10px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`ph-fill ${consentSatisfied ? 'ph-check-circle' : 'ph-warning'}`} style={{ color: consentSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }} />
            <strong style={{ fontSize: '0.85rem', color: consentSatisfied ? '#15803d' : '#92400e' }}>Consent Document</strong>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: consentSatisfied ? '#166534' : '#b45309' }}>
            {!consentRequired ? '✓ Not required' : consentSatisfied ? '✓ Satisfied' : '⚠ Required'}
          </span>
        </div>

        {consentRequired && !booking.consent_document_id ? (
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Select Signed Consent Document for Patient:
            </label>
            <select
              value={selectedConsentId}
              onChange={(e) => onSelectConsent(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#ffffff' }}
            >
              <option value="">-- Select Patient Consent Document --</option>
              {validConsentDocs.map((doc: { id: string; title: string; consent_category?: string | null; document_type: string; created_at: string; consent_status?: string | null; review_status: string }) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.consent_category ?? doc.document_type}) — Uploaded {new Date(doc.created_at).toLocaleDateString()} [{doc.consent_status ?? doc.review_status}]
                </option>
              ))}
            </select>
            {validConsentDocs.length === 0 ? (
              <small style={{ color: '#b45309', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                No consent document on file for this patient. Please upload a consent document under Patient Documents first.
              </small>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 2. Advance Payment Card */}
      <div style={{ border: `1px solid ${depositSatisfied ? '#bbf7d0' : '#fde68a'}`, background: depositSatisfied ? '#f0fdf4' : '#fffbeb', borderRadius: '8px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: depositRequired ? '10px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`ph-fill ${depositSatisfied ? 'ph-check-circle' : 'ph-warning'}`} style={{ color: depositSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }} />
            <strong style={{ fontSize: '0.85rem', color: depositSatisfied ? '#15803d' : '#92400e' }}>Advance Payment / Deposit</strong>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: depositSatisfied ? '#166534' : '#b45309' }}>
            {!depositRequired ? '✓ Not required' : depositSatisfied ? '✓ Satisfied' : '⚠ Action Required'}
          </span>
        </div>

        {depositRequired ? (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>INVOICE #</span>
                <strong>{invoice?.invoice_number ?? 'Auto-generated'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>REQUIRED ADVANCE</span>
                <strong>KES {minDeposit.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>PAID AMOUNT</span>
                <strong style={{ color: paidAmount >= minDeposit ? '#16a34a' : '#dc2626' }}>KES {paidAmount.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>STATUS</span>
                <StatusBadge tone={depositSatisfied ? 'green' : 'orange'}>{invoice?.status ?? 'PENDING'}</StatusBadge>
              </div>
            </div>
            {!depositSatisfied ? (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem', color: '#b45309' }}>
                Please collect payment of KES {minDeposit.toLocaleString()} for Invoice <strong>{invoice?.invoice_number}</strong> under Billing History before confirming this booking.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 3. Bed Hold Card */}
      <div style={{ border: `1px solid ${bedSatisfied ? '#bbf7d0' : '#fde68a'}`, background: bedSatisfied ? '#f0fdf4' : '#fffbeb', borderRadius: '8px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bedRequired && !booking.hold_id ? '10px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`ph-fill ${bedSatisfied ? 'ph-check-circle' : 'ph-warning'}`} style={{ color: bedSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }} />
            <strong style={{ fontSize: '0.85rem', color: bedSatisfied ? '#15803d' : '#92400e' }}>Inpatient Bed Hold</strong>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: bedSatisfied ? '#166534' : '#b45309' }}>
            {!bedRequired ? '✓ Not required' : bedSatisfied ? '✓ Satisfied' : '⚠ Required'}
          </span>
        </div>

        {bedRequired && !booking.hold_id ? (
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Select Active Bed Reservation for Patient:
            </label>
            <select
              value={selectedHoldId}
              onChange={(e) => onSelectHold(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#ffffff' }}
            >
              <option value="">-- Select Active Reserved Bed --</option>
              {bedHolds.map((hold) => (
                <option key={hold.id} value={hold.id}>
                  {hold.ward_name} — Bed {hold.bed_number} (Expires: {hold.expires_at ? new Date(hold.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'})
                </option>
              ))}
            </select>
            {bedHolds.length === 0 ? (
              <small style={{ color: '#b45309', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                No active bed hold found for this patient. Please create a bed hold in IP Admissions configuration first.
              </small>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
