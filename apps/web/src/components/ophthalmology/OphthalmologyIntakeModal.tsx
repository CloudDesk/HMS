import { useAppointmentDetails } from '../../hooks/appointments/useAppointments';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { Modal } from '../ui/Modal';

export interface OphthalmologyIntakeModalProps {
  open: boolean;
  onClose: () => void;
  feature: OphthalmologyWorkspaceFeature;
}

export function OphthalmologyIntakeModal({ open, onClose, feature: f }: OphthalmologyIntakeModalProps) {
  const appointmentId = (f.visit as { appointment_id?: string | null } | undefined)?.appointment_id ?? null;
  const { data: appointmentData } = useAppointmentDetails(appointmentId, Boolean(appointmentId && open));
  const intake = f.intakeView?.intake;
  const shared = f.intakeView?.shared_history;
  const apptIntake = appointmentData?.consultation_intake;

  // Consolidated Fields
  const chiefComplaint =
    (intake?.complaint_codes && intake.complaint_codes.length > 0 ? intake.complaint_codes.join(', ') : null) ||
    apptIntake?.chief_complaint ||
    f.visit?.reason ||
    'General Eye Examination & Consultation';

  const hpiEyeMatch = apptIntake?.history_present_illness
    ?.match(/Affected Eye:\s*(OD|OS|OU)/i)?.[1]
    ?.toUpperCase() as 'OD' | 'OS' | 'OU' | undefined;

  const affectedEye =
    intake?.affected_eye ||
    appointmentData?.ophthalmology?.affected_eye ||
    hpiEyeMatch ||
    f.context?.affected_eye ||
    'OU';

  const eyeLabel =
    affectedEye === 'OD' ? 'OD (Right Eye)' : affectedEye === 'OS' ? 'OS (Left Eye)' : 'OU (Both Eyes)';

  const isVitalsNote = (text?: string | null) =>
    !text || text.toLowerCase().includes('vitals recorded');

  const hpiText =
    intake?.description ||
    shared?.history_present_illness ||
    apptIntake?.history_present_illness ||
    (!isVitalsNote(f.visit?.notes) ? f.visit?.notes : null) ||
    'Patient presented for routine examination. No extended HPI notes recorded at appointment check-in.';

  const allergiesText =
    shared?.allergies ||
    apptIntake?.allergies ||
    'No known drug allergies (NKDA) recorded';

  const isAllergyNegative =
    allergiesText.toLowerCase().includes('no known') ||
    allergiesText.toLowerCase().includes('nkda') ||
    allergiesText.toLowerCase().includes('none');

  const pastMedicalHistory =
    shared?.past_history ||
    apptIntake?.past_history ||
    'No systemic conditions recorded';

  const familyHistory =
    shared?.family_history ||
    apptIntake?.family_history ||
    (intake?.family_history_codes && intake.family_history_codes.length > 0
      ? intake.family_history_codes.join(', ')
      : 'No family eye history');

  const hasAlerts = Boolean(f.intakeView?.alerts && f.intakeView.alerts.some((a) => a.status === 'ACTIVE'));
  const isEmergencyPriority = f.visit?.priority === 'EMERGENCY' || hasAlerts;

  const spectacleInfo = intake?.spectacle_use?.uses
    ? `Spectacles: Yes (${intake.spectacle_use.wearing_pattern || 'Regular'})`
    : (apptIntake?.past_history?.toLowerCase().includes('spectacle') ? 'Spectacles: Yes' : 'Spectacles: No');

  const contactLensInfo = intake?.contact_lens_use?.uses
    ? `Contact Lenses: Yes (${intake.contact_lens_use.wearing_pattern || 'Daily'})`
    : (apptIntake?.past_history?.toLowerCase().includes('contact lens') ? 'Contact Lenses: Yes' : null);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      className="oph-intake-modal-dialog"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className="ph ph-clipboard-text-bold" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Clinical Intake &amp; History
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                }}
              >
                Read-only
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>
              Patient registration, triage and clinical history information.
            </p>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="doc-btn" onClick={onClose} style={{ minWidth: '90px' }}>
            Close
          </button>
        </div>
      }
    >
      <div
        className="oph-intake-modal-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: 'calc(80vh - 120px)',
          overflowY: 'auto',
          padding: '4px 2px',
        }}
      >
        {/* Section A: Clinical Overview (4 Summary Cards) */}
        <div>
          <h4
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#64748b',
              margin: '0 0 8px 2px',
            }}
          >
            Section A — Clinical Overview
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '10px',
            }}
          >
            {/* Card 1: Chief Complaint */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                  <i className="ph ph-chat-circle-dots-bold" />
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Chief Complaint
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', lineHeight: '1.3' }}>
                {chiefComplaint}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                <span className="oph-badge oph-badge-sm oph-badge-blue" style={{ marginRight: '4px' }}>
                  {eyeLabel}
                </span>
                {intake?.duration_value ? (
                  <span>
                    · {intake.duration_value} {intake.duration_unit?.toLowerCase() ?? 'days'}
                  </span>
                ) : null}
                {intake?.onset ? <span> · {intake.onset.toLowerCase()}</span> : null}
              </div>
            </div>

            {/* Card 2: Clinical Presentation (HPI) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                  <i className="ph ph-activity-bold" />
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Clinical Presentation (HPI)
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#334155',
                  lineHeight: '1.4',
                  maxHeight: '52px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
                title={hpiText}
              >
                {hpiText}
              </div>
            </div>

            {/* Card 3: Ocular & Medical History */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                  <i className="ph ph-file-text-bold" />
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Ocular &amp; Medical History
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                <div>👁️ {spectacleInfo}{contactLensInfo ? ` · ${contactLensInfo}` : ''}</div>
                <div style={{ color: '#64748b', marginTop: '2px' }}>🏥 {pastMedicalHistory}</div>
              </div>
            </div>

            {/* Card 4: Allergies & Triage */}
            <div
              style={{
                background: isAllergyNegative ? '#f8fafc' : '#fef2f2',
                border: `1px solid ${isAllergyNegative ? '#e2e8f0' : '#fecaca'}`,
                borderRadius: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: isAllergyNegative ? '#16a34a' : '#dc2626', fontSize: '0.85rem' }}>
                  <i className="ph ph-shield-check-bold" />
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: isAllergyNegative ? '#64748b' : '#b91c1c',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Allergies &amp; Triage
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: isAllergyNegative ? '#15803d' : '#b91c1c',
                  lineHeight: '1.3',
                }}
              >
                {allergiesText}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: isEmergencyPriority ? '#e11d48' : '#16a34a',
                  marginTop: '4px',
                }}
              >
                {isEmergencyPriority ? '⚠️ Urgent Triage Screening' : '✓ Routine Triage Cleared'}
              </div>
            </div>
          </div>
        </div>

        {/* Section B: Detailed History (3 Detailed Cards) */}
        <div>
          <h4
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#64748b',
              margin: '0 0 8px 2px',
            }}
          >
            Section B — Detailed History
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Detailed Card 1: Full HPI Narrative */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Full HPI Narrative
              </div>
              <div style={{ color: '#334155', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {hpiText}
              </div>
            </div>

            {/* Detailed Card 2: Ophthalmic Details */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Ophthalmic Details
              </div>
              <div style={{ color: '#334155', fontSize: '0.8rem', lineHeight: '1.6' }}>
                <div>
                  <strong>Prior Surgeries:</strong>{' '}
                  {intake?.previous_eye_surgeries && intake.previous_eye_surgeries.length > 0
                    ? intake.previous_eye_surgeries.map((s) => `${s.procedure} (${s.laterality})`).join(', ')
                    : apptIntake?.past_history
                    ? apptIntake.past_history
                    : 'None recorded'}
                </div>
                <div>
                  <strong>Prior Diseases:</strong>{' '}
                  {intake?.previous_eye_disease_codes && intake.previous_eye_disease_codes.length > 0
                    ? intake.previous_eye_disease_codes.join(', ')
                    : apptIntake?.past_history
                    ? apptIntake.past_history
                    : 'None recorded'}
                </div>
                <div>
                  <strong>Steroid Therapy:</strong>{' '}
                  {intake?.long_term_steroid_use ? `Yes (${intake.long_term_steroid_details || 'Recorded'})` : 'No'}
                </div>
                <div>
                  <strong>Family History:</strong> {familyHistory}
                </div>
              </div>
            </div>

            {/* Detailed Card 3: Documents & Triage */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Documents &amp; Triage
              </div>
              <div style={{ color: '#334155', fontSize: '0.8rem', lineHeight: '1.6' }}>
                <div>
                  <strong>Attached Documents:</strong>{' '}
                  {intake?.previous_report_document_ids?.length ?? 0} file(s) linked at booking
                </div>
                <div>
                  <strong>Priority at Reception:</strong> {f.visit?.priority} ({f.visit?.visit_type ?? 'Outpatient'})
                </div>
                <div>
                  <strong>Red-Flag Criteria:</strong>{' '}
                  {intake?.emergency_criterion_codes && intake.emergency_criterion_codes.length > 0
                    ? intake.emergency_criterion_codes.join(', ')
                    : 'None reported'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
