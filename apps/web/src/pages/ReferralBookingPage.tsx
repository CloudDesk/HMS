import { useReferralBookingFeature } from '../hooks/reception/useReferralBookingFeature';
import { MedicalLoader } from '../components/ui/MedicalLoader';

export function ReferralBookingPage() {
  const { state, actions } = useReferralBookingFeature();
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
                state.referrals.map((item) => (
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
      </section>
    </div>
  );
}
