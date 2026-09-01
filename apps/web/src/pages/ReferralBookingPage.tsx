import { useMemo, useState } from 'react';
import { useReferralBookingFeature } from '../hooks/reception/useReferralBookingFeature';
import { MedicalLoader } from '../components/ui/MedicalLoader';

export function ReferralBookingPage() {
  const { state, actions } = useReferralBookingFeature();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(state.referrals.length / pageSize));
  const paginatedReferrals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return state.referrals.slice(start, start + pageSize);
  }, [state.referrals, page, pageSize]);

  return (
    <div className="appointment-page">
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Referral Booking</h2>
          <p>Book submitted doctor referrals against validated clinician availability</p>
        </div>
      </section>
      {state.error ? <div className="form-error-banner">{state.error}</div> : null}
      <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.85rem 1rem' }}>PATIENT</th>
                <th style={{ padding: '0.85rem 1rem' }}>REFERRED BY</th>
                <th style={{ padding: '0.85rem 1rem' }}>SOURCE</th>
                <th style={{ padding: '0.85rem 1rem' }}>REFERRED TO</th>
                <th style={{ padding: '0.85rem 1rem' }}>SPECIALTY</th>
                <th style={{ padding: '0.85rem 1rem' }}>PRIORITY</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem 1rem' }}>
                    <MedicalLoader text="Loading referrals..." subtext="Accessing clinical referral queues" />
                  </td>
                </tr>
              ) : state.referrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="um-state-cell">No submitted referrals found.</td>
                </tr>
              ) : (
                paginatedReferrals.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>
                        {item.patient_name}
                      </strong>
                      <small style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>
                        {item.patient_number}
                      </small>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#334155' }}>
                      {item.referring_doctor_name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#334155' }}>
                      {item.source_type === 'EMERGENCY_ENCOUNTER' ? 'Emergency' : 'OPD'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#334155' }}>
                      {item.referred_doctor_name ?? 'Not assigned'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#334155' }}>
                      {item.specialty ?? '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#334155', fontWeight: 600 }}>
                      {item.priority}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <span
                        className={`doc-status ${
                          item.appointment_id
                            ? 'completed'
                            : item.status === 'CANCELLED'
                            ? 'cancelled'
                            : 'active'
                        }`}
                      >
                        {item.appointment_id
                          ? `Booked ${item.appointment_number}`
                          : item.status === 'CANCELLED'
                          ? 'Cancelled'
                          : 'Pending booking'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div
                        className="table-actions"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '6px',
                        }}
                      >
                        <button
                          type="button"
                          disabled={!item.patient_id}
                          onClick={() => item.patient_id && actions.openPatient(item.patient_id)}
                          title="View Patient"
                          aria-label="View Patient"
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            display: 'inline-grid',
                            placeItems: 'center',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            cursor: item.patient_id ? 'pointer' : 'not-allowed',
                            opacity: item.patient_id ? 1 : 0.5,
                            flexShrink: 0,
                          }}
                        >
                          <i className="ph ph-user" style={{ fontSize: '1rem' }} />
                        </button>
                        {item.appointment_id ? (
                          <button
                            type="button"
                            onClick={() => actions.openBooking(item)}
                            title="View Appointment"
                            aria-label="View Appointment"
                            style={{
                              width: '32px',
                              height: '32px',
                              padding: 0,
                              display: 'inline-grid',
                              placeItems: 'center',
                              borderRadius: '6px',
                              border: '1px solid #93c5fd',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <i className="ph ph-calendar-check" style={{ fontSize: '1rem' }} />
                          </button>
                        ) : item.status !== 'CANCELLED' ? (
                          <button
                            type="button"
                            disabled={!item.bookable}
                            onClick={() => actions.openBooking(item)}
                            title="Book Referral"
                            aria-label="Book Referral"
                            style={{
                              width: '32px',
                              height: '32px',
                              padding: 0,
                              display: 'inline-grid',
                              placeItems: 'center',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#2563eb',
                              color: '#ffffff',
                              cursor: item.bookable ? 'pointer' : 'not-allowed',
                              opacity: item.bookable ? 1 : 0.5,
                              flexShrink: 0,
                            }}
                          >
                            <i className="ph ph-calendar-plus" style={{ fontSize: '1rem' }} />
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

        {/* Pagination Controls */}
        {state.referrals.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.82rem',
              color: '#64748b',
              background: '#ffffff',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px',
            }}
          >
            <div>
              Showing <strong>{Math.min((page - 1) * pageSize + 1, state.referrals.length)}</strong> to{' '}
              <strong>{Math.min(page * pageSize, state.referrals.length)}</strong> of{' '}
              <strong>{state.referrals.length}</strong> referrals
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                <i className="ph ph-caret-left" /> Previous
              </button>
              <span style={{ padding: '0 8px', fontWeight: 600, color: '#1e293b' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Next <i className="ph ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
