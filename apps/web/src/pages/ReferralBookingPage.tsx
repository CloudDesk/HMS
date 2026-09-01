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
          <table className="data-table">
            <thead>
              <tr>
                <th>PATIENT</th>
                <th>REFERRED BY</th>
                <th>REFERRED TO</th>
                <th>SPECIALTY</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                    <MedicalLoader text="Loading referrals..." subtext="Accessing clinical referral queues" />
                  </td>
                </tr>
              ) : state.referrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="um-state-cell">No submitted referrals found.</td>
                </tr>
              ) : (
                paginatedReferrals.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.patient_name}</strong>
                      <br />
                      <small>{item.patient_number}</small>
                    </td>
                    <td>{item.referring_doctor_name}</td>
                    <td>{item.referred_doctor_name ?? item.facility ?? 'Not assigned'}</td>
                    <td>{item.specialty ?? '-'}</td>
                    <td>{item.priority}</td>
                    <td>
                      <span className="doc-status active">
                        {item.appointment_id ? `Booked ${item.appointment_number}` : 'Pending booking'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="doc-btn" onClick={() => actions.openPatient(item.patient_id)} type="button">
                          Patient
                        </button>
                        <button
                          className="doc-btn primary"
                          disabled={Boolean(item.appointment_id) || item.referral_type !== 'INTERNAL' || !item.referred_doctor_id}
                          onClick={() => actions.openBooking(item.visit_id)}
                          type="button"
                        >
                          Book
                        </button>
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
