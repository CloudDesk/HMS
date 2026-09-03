import type { ProcedureBooking } from '../../api/surgery';
import type { ServiceResponse } from '../../api/services';
import { StatusBadge } from '../ui/StatusBadge';
import { MedicalLoader } from '../ui/MedicalLoader';

export type SurgeryBookingsTabProps = {
  bookings: ProcedureBooking[];
  services: ServiceResponse[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (item: ProcedureBooking) => void;
  displayDate: (value: string) => string;
  statusTone: (status: string) => 'green' | 'red' | 'orange' | 'blue';
};

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
      <span
        className={
          !service?.requires_consent ||
          Boolean(booking.consent_document_id) ||
          Boolean(snapshot)
            ? 'met'
            : 'blocked'
        }
      >
        Consent:{' '}
        {!service?.requires_consent
          ? 'Not required'
          : booking.consent_document_id || snapshot
            ? 'Linked'
            : 'Required'}
      </span>
      <span
        className={
          !service?.requires_advance_deposit ||
          Boolean(booking.deposit_invoice_id) ||
          Boolean(snapshot)
            ? 'met'
            : 'blocked'
        }
      >
        Deposit:{' '}
        {!service?.requires_advance_deposit
          ? 'Not required'
          : booking.deposit_invoice_id || snapshot
            ? 'Linked'
            : 'Required'}
      </span>
    </div>
  );
}

export function SurgeryBookingsTab({
  bookings,
  services,
  isLoading,
  isError,
  onSelect,
  displayDate,
  statusTone,
}: SurgeryBookingsTabProps) {
  return (
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
          {isLoading ? (
            <tr>
              <td colSpan={8} style={{ padding: '2.5rem 1rem' }}>
                <MedicalLoader
                  text="Loading procedure bookings..."
                  subtext="Retrieving surgical and procedural theater records"
                />
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td
                colSpan={8}
                className="empty-state"
                style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}
              >
                Unable to load procedure bookings.
              </td>
            </tr>
          ) : bookings.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="empty-state"
                style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}
              >
                No live procedure bookings found.
              </td>
            </tr>
          ) : (
            bookings.map((item) => (
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
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {displayDate(item.scheduled_start)}
                  </span>
                </td>
                <td>{item.doctor_name}</td>
                <td>
                  <RequirementFlags
                    booking={item}
                    service={services.find((service) => service.id === item.service_id)}
                  />
                </td>
                <td>
                  <StatusBadge tone={statusTone(item.status)}>
                    {item.status.replaceAll('_', ' ')}
                  </StatusBadge>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn-secondary compact"
                    onClick={() => onSelect(item)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                    type="button"
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
  );
}
