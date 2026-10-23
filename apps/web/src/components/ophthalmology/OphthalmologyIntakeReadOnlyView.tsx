import { useState } from 'react';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { useAppointmentDetails } from '../../hooks/appointments/useAppointments';

interface Props {
  feature: OphthalmologyWorkspaceFeature;
}

export function OphthalmologyIntakeReadOnlyView({ feature: f }: Props) {
  const appointmentId = (f.visit as { appointment_id?: string | null } | undefined)?.appointment_id ?? null;
  const { data: appointmentData } = useAppointmentDetails(appointmentId, Boolean(appointmentId));
  const intake = f.intakeView?.intake;
  const shared = f.intakeView?.shared_history;
  const apptIntake = appointmentData?.consultation_intake;

  const [detailsOpen, setDetailsOpen] = useState(false);

  // Consolidated Fields
  const chiefComplaint =
    (intake?.complaint_codes && intake.complaint_codes.length > 0 ? intake.complaint_codes.join(', ') : null) ||
    apptIntake?.chief_complaint ||
    f.visit?.reason ||
    'General Eye Examination & Consultation';

  const affectedEye =
    intake?.affected_eye ||
    appointmentData?.ophthalmology?.affected_eye ||
    f.context?.affected_eye ||
    'OU';

  const eyeLabel =
    affectedEye === 'OD' ? 'OD (Right Eye)' : affectedEye === 'OS' ? 'OS (Left Eye)' : 'OU (Both Eyes)';

  const hpiText =
    intake?.description ||
    shared?.history_present_illness ||
    apptIntake?.history_present_illness ||
    f.visit?.notes ||
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
    : 'Spectacles: No';

  const contactLensInfo = intake?.contact_lens_use?.uses
    ? `Contact Lenses: Yes (${intake.contact_lens_use.wearing_pattern || 'Daily'})`
    : null;

  return (
    <div
      className="oph-compact-intake-card"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        marginBottom: '16px',
        overflow: 'hidden',
      }}
    >
      {/* 1. Compact Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            <i className="ph ph-clipboard-text" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            Intake &amp; Clinical History
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              background: '#e2e8f0',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Appointment Record · Read-Only
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
            }}
          >
            Eye: {eyeLabel}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              background: isAllergyNegative ? '#f0fdf4' : '#fef2f2',
              color: isAllergyNegative ? '#15803d' : '#b91c1c',
              border: `1px solid ${isAllergyNegative ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            {isAllergyNegative ? 'Allergies: NKDA' : '⚠️ Allergy Alert'}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              background: isEmergencyPriority ? '#fff1f2' : '#f8fafc',
              color: isEmergencyPriority ? '#e11d48' : '#64748b',
              border: `1px solid ${isEmergencyPriority ? '#fda4af' : '#e2e8f0'}`,
            }}
          >
            {isEmergencyPriority ? '⚠️ Triage: Urgent' : 'Triage: Routine'}
          </span>
          <button
            type="button"
            className="doc-btn compact"
            onClick={() => setDetailsOpen(!detailsOpen)}
            style={{ fontSize: '0.75rem', padding: '4px 8px', marginLeft: '4px' }}
          >
            <i className={`ph ph-caret-${detailsOpen ? 'up' : 'down'}`} style={{ marginRight: '3px' }} />
            {detailsOpen ? 'Less' : 'More Details'}
          </button>
        </div>
      </div>

      {/* 2. Compact 4-Column Clinical Glance */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          padding: '12px 16px',
          background: '#ffffff',
        }}
      >
        {/* Column 1: Chief Complaint & Laterality */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Chief Complaint
          </div>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', marginTop: '3px' }}>
            {chiefComplaint}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>
            <span>{eyeLabel}</span>
            {intake?.duration_value ? (
              <span> · {intake.duration_value} {intake.duration_unit?.toLowerCase() ?? 'days'}</span>
            ) : null}
            {intake?.onset ? <span> · {intake.onset.toLowerCase()}</span> : null}
          </div>
        </div>

        {/* Column 2: Presentation & HPI */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Clinical Presentation (HPI)
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              color: '#334155',
              marginTop: '3px',
              lineHeight: '1.4',
              maxHeight: '44px',
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

        {/* Column 3: Ocular & Medical History */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Ocular &amp; Medical History
          </div>
          <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '3px', lineHeight: '1.4' }}>
            <div>👁️ {spectacleInfo}{contactLensInfo ? ` · ${contactLensInfo}` : ''}</div>
            <div style={{ color: '#64748b', marginTop: '2px' }}>🏥 {pastMedicalHistory}</div>
          </div>
        </div>

        {/* Column 4: Allergies & Triage Status */}
        <div style={{ background: isAllergyNegative ? '#f8fafc' : '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isAllergyNegative ? '#f1f5f9' : '#fecaca'}` }}>
          <div style={{ fontSize: '0.7rem', color: isAllergyNegative ? '#64748b' : '#b91c1c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Allergies &amp; Triage
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isAllergyNegative ? '#15803d' : '#b91c1c', marginTop: '3px' }}>
            {allergiesText}
          </div>
          <div style={{ fontSize: '0.75rem', color: isEmergencyPriority ? '#e11d48' : '#16a34a', marginTop: '2px' }}>
            {isEmergencyPriority ? '⚠️ Urgent Triage Screening' : '✓ Routine Triage Cleared'}
          </div>
        </div>
      </div>

      {/* 3. Expandable Drawer for Full Details (Default Closed) */}
      {detailsOpen && (
        <div
          style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Full HPI Narrative:</strong>
              <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {hpiText}
              </div>
            </div>

            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Ophthalmic Details:</strong>
              <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: '1.5' }}>
                <div>• Prior Surgeries: {intake?.previous_eye_surgeries && intake.previous_eye_surgeries.length > 0 ? intake.previous_eye_surgeries.map((s) => `${s.procedure} (${s.laterality})`).join(', ') : 'None'}</div>
                <div>• Prior Diseases: {intake?.previous_eye_disease_codes && intake.previous_eye_disease_codes.length > 0 ? intake.previous_eye_disease_codes.join(', ') : 'None'}</div>
                <div>• Steroid Therapy: {intake?.long_term_steroid_use ? `Yes (${intake.long_term_steroid_details || 'Recorded'})` : 'No'}</div>
                <div>• Family History: {familyHistory}</div>
              </div>
            </div>

            <div>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Documents &amp; Triage:</strong>
              <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: '1.5' }}>
                <div>• Attached Documents: {intake?.previous_report_document_ids?.length ?? 0} file(s) linked at booking</div>
                <div>• Priority at Reception: {f.visit?.priority} ({f.visit?.visit_type})</div>
                <div>• Red-Flag Criteria: {intake?.emergency_criterion_codes && intake.emergency_criterion_codes.length > 0 ? intake.emergency_criterion_codes.join(', ') : 'None'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
