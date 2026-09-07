import type { ProcedureRecommendation } from '../../api/surgery';
import { StatusBadge } from '../ui/StatusBadge';
import { MedicalLoader } from '../ui/MedicalLoader';

export type SurgeryRecommendationsTabProps = {
  recommendations: ProcedureRecommendation[];
  isLoading: boolean;
  isError: boolean;
  onBook: (item: ProcedureRecommendation) => void;
  onCancel: (item: ProcedureRecommendation) => void;
  onViewBooking: (bookingId: string) => void;
  statusTone: (status: string) => 'green' | 'red' | 'orange' | 'blue';
  canBook?: boolean;
  canCancel?: boolean;
  canViewBooking?: boolean;
};

export function SurgeryRecommendationsTab({
  recommendations,
  isLoading,
  isError,
  onBook,
  onCancel,
  onViewBooking,
  statusTone,
  canBook = true,
  canCancel = true,
  canViewBooking = true,
}: SurgeryRecommendationsTabProps) {
  return (
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
          {isLoading ? (
            <tr>
              <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                <MedicalLoader
                  text="Loading recommendations..."
                  subtext="Retrieving surgical and procedural theater records"
                />
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td
                colSpan={7}
                className="empty-state"
                style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}
              >
                Unable to load recommendations.
              </td>
            </tr>
          ) : recommendations.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="empty-state"
                style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}
              >
                No live procedure recommendations found.
              </td>
            </tr>
          ) : (
            recommendations.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong style={{ color: '#0f172a' }}>{item.recommendation_number}</strong>
                  <br />
                  <small style={{ color: '#64748b' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </small>
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
                  <span style={{ fontWeight: 500, color: '#334155' }}>
                    {item.recommending_doctor_name}
                  </span>
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
                        {canBook && (
                          <button
                            className="btn-primary compact"
                            onClick={() => onBook(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              whiteSpace: 'nowrap',
                            }}
                            type="button"
                          >
                            <i className="ph ph-calendar-plus" /> Book
                          </button>
                        )}
                        {canCancel && (
                          <button
                            className="btn-danger compact"
                            onClick={() => onCancel(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              whiteSpace: 'nowrap',
                            }}
                            type="button"
                          >
                            <i className="ph ph-x" /> Cancel
                          </button>
                        )}
                      </>
                    ) : item.booking_id && canViewBooking ? (
                      <button
                        className="btn-secondary compact"
                        onClick={() => onViewBooking(item.booking_id!)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          whiteSpace: 'nowrap',
                        }}
                        type="button"
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
  );
}
