import type { ProcedureBooking } from '../../api/surgery';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

export type SurgeryBookingDetailModalProps = {
  booking: ProcedureBooking | null;
  onClose: () => void;
  onConfirm: (booking: ProcedureBooking) => void;
  onReschedule: (booking: ProcedureBooking) => void;
  onCancel: (booking: ProcedureBooking) => void;
  onComplete: (booking: ProcedureBooking) => void;
  displayDate: (value: string) => string;
  statusTone: (status: string) => 'green' | 'red' | 'orange' | 'blue';
  canConfirm?: boolean;
  canReschedule?: boolean;
  canCancel?: boolean;
  canComplete?: boolean;
};

export function SurgeryBookingDetailModal({
  booking,
  onClose,
  onConfirm,
  onReschedule,
  onCancel,
  onComplete,
  displayDate,
  statusTone,
  canConfirm = true,
  canReschedule = true,
  canCancel = true,
  canComplete = true,
}: SurgeryBookingDetailModalProps) {
  if (!booking) return null;

  return (
    <Modal
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            alignItems: 'center',
          }}
        >
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {booking.status === 'PENDING_CONFIRMATION' && canConfirm && (
              <button
                className="btn-primary"
                onClick={() => {
                  onConfirm(booking);
                  onClose();
                }}
                type="button"
              >
                <i className="ph ph-check-circle" /> Confirm Booking
              </button>
            )}
            {booking.status === 'BOOKED' && (
              <>
                {canReschedule && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      onReschedule(booking);
                      onClose();
                    }}
                    type="button"
                  >
                    <i className="ph ph-calendar" /> Reschedule
                  </button>
                )}
                {canCancel && (
                  <button
                    className="btn-danger"
                    onClick={() => {
                      onCancel(booking);
                      onClose();
                    }}
                    type="button"
                  >
                    <i className="ph ph-x" /> Cancel
                  </button>
                )}
                {canComplete && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      onComplete(booking);
                      onClose();
                    }}
                    type="button"
                  >
                    <i className="ph ph-check-fat" /> Complete Procedure
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      }
      icon="ph-calendar-check"
      onClose={onClose}
      open={Boolean(booking)}
      size="large"
      title={`Booking Details — ${booking.booking_number ?? 'Procedure'}`}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '0.25rem',
        }}
      >
        {/* Header summary banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '14px 18px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
                {booking.booking_number}
              </strong>
              <StatusBadge tone={statusTone(booking.status)}>
                {booking.status.replaceAll('_', ' ')}
              </StatusBadge>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
              Scheduled: <strong>{displayDate(booking.scheduled_start)}</strong> (
              {booking.duration_minutes} mins)
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '0.74rem',
                color: '#64748b',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Surgeon
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>
              {booking.doctor_name || 'Dr. Assigned'}
            </div>
          </div>
        </div>

        {/* Grid of info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
            }}
          >
            <h4
              style={{
                margin: '0 0 8px',
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              Patient Details
            </h4>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
              {booking.patient_name}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              MRN: {booking.patient_number}
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
            }}
          >
            <h4
              style={{
                margin: '0 0 8px',
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              Procedure &amp; Theater
            </h4>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
              {booking.service_name}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              Duration: {booking.duration_minutes} minutes
            </div>
          </div>
        </div>

        {/* Prerequisites */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <h4
            style={{
              margin: '0 0 10px',
              fontSize: '0.82rem',
              textTransform: 'uppercase',
              color: '#64748b',
              fontWeight: 700,
            }}
          >
            Prerequisites &amp; Clearances
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                background: booking.prerequisite_snapshot?.bed_required
                  ? booking.prerequisite_snapshot?.bed_hold_id
                    ? '#f0fdf4'
                    : '#fef2f2'
                  : '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  display: 'block',
                  fontWeight: 600,
                }}
              >
                Bed Hold
              </span>
              <strong
                style={{
                  fontSize: '0.82rem',
                  color: booking.prerequisite_snapshot?.bed_required
                    ? booking.prerequisite_snapshot?.bed_hold_id
                      ? '#16a34a'
                      : '#dc2626'
                    : '#64748b',
                }}
              >
                {booking.prerequisite_snapshot?.bed_required
                  ? booking.prerequisite_snapshot?.bed_hold_id
                    ? 'Hold Secured'
                    : 'Required'
                  : 'Not Required'}
              </strong>
            </div>

            <div
              style={{
                padding: '8px 10px',
                background: booking.prerequisite_snapshot?.consent_required
                  ? booking.prerequisite_snapshot?.consent_satisfied
                    ? '#f0fdf4'
                    : '#fef2f2'
                  : '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  display: 'block',
                  fontWeight: 600,
                }}
              >
                Consent Document
              </span>
              <strong
                style={{
                  fontSize: '0.82rem',
                  color: booking.prerequisite_snapshot?.consent_required
                    ? booking.prerequisite_snapshot?.consent_satisfied
                      ? '#16a34a'
                      : '#dc2626'
                    : '#64748b',
                }}
              >
                {booking.prerequisite_snapshot?.consent_required
                  ? booking.prerequisite_snapshot?.consent_satisfied
                    ? 'Signed & Attached'
                    : 'Required'
                  : 'Not Required'}
              </strong>
            </div>

            <div
              style={{
                padding: '8px 10px',
                background: booking.prerequisite_snapshot?.deposit_required
                  ? booking.prerequisite_snapshot?.deposit_satisfied
                    ? '#f0fdf4'
                    : '#fef2f2'
                  : '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  display: 'block',
                  fontWeight: 600,
                }}
              >
                Advance Deposit
              </span>
              <strong
                style={{
                  fontSize: '0.82rem',
                  color: booking.prerequisite_snapshot?.deposit_required
                    ? booking.prerequisite_snapshot?.deposit_satisfied
                      ? '#16a34a'
                      : '#dc2626'
                    : '#64748b',
                }}
              >
                {booking.prerequisite_snapshot?.deposit_required
                  ? booking.prerequisite_snapshot?.deposit_satisfied
                    ? 'Paid & Verified'
                    : `Required (${booking.prerequisite_snapshot?.deposit_required_amount})`
                  : 'Not Required'}
              </strong>
            </div>
          </div>
        </div>

        {/* Notes if any */}
        {booking.notes && (
          <div
            style={{
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.82rem',
              color: '#475569',
            }}
          >
            <span
              style={{
                fontWeight: 600,
                display: 'block',
                marginBottom: '2px',
                color: '#0f172a',
              }}
            >
              Clinical / Pre-op Notes:
            </span>
            {booking.notes}
          </div>
        )}
      </div>
    </Modal>
  );
}
