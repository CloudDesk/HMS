import { useState } from 'react';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { useAppointmentDetails } from '../../hooks/appointments/useAppointments';

interface Props {
  feature: OphthalmologyWorkspaceFeature;
  summaryOnly?: boolean;
}

export function OphthalmologyIntakeReadOnlyView({ feature: f, summaryOnly }: Props) {
  const appointmentId = (f.visit as { appointment_id?: string | null } | undefined)?.appointment_id ?? null;
  const { data: appointmentData } = useAppointmentDetails(appointmentId, Boolean(appointmentId));
  const intake = f.intakeView?.intake;
  const shared = f.intakeView?.shared_history;
  const apptIntake = appointmentData?.consultation_intake;

  // Consolidated Fields
  const chiefComplaint =
    (intake?.complaint_codes && intake.complaint_codes.length > 0 ? intake.complaint_codes.join(', ') : null) ||
    apptIntake?.chief_complaint ||
    f.visit?.reason ||
    'General Eye Examination & Consultation';

  const hpiEyeMatch = apptIntake?.history_present_illness?.match(/Affected Eye:\s*(OD|OS|OU)/i)?.[1]?.toUpperCase() as 'OD' | 'OS' | 'OU' | undefined;

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

  const hasCriticalWarning = Boolean(
    hasAlerts ||
    isEmergencyPriority ||
    !isAllergyNegative ||
    f.visit?.priority === 'EMERGENCY'
  );

  const [isExpanded, setIsExpanded] = useState<boolean>(() => hasCriticalWarning);

  const spectacleInfo = intake?.spectacle_use?.uses
    ? `Spectacles: Yes (${intake.spectacle_use.wearing_pattern || 'Regular'})`
    : (apptIntake?.past_history?.toLowerCase().includes('spectacle') ? 'Spectacles: Yes' : 'Spectacles: No');

  const contactLensInfo = intake?.contact_lens_use?.uses
    ? `Contact Lenses: Yes (${intake.contact_lens_use.wearing_pattern || 'Daily'})`
    : (apptIntake?.past_history?.toLowerCase().includes('contact lens') ? 'Contact Lenses: Yes' : null);

  if (summaryOnly) {
    return (
      <div
        className="oph-step2-summary-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        {/* Card 1: Chief Complaint */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
              }}
            >
              <i className="ph ph-chat-circle-dots-bold" />
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CHIEF COMPLAINT
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1e293b', lineHeight: '1.35' }}>
            {chiefComplaint}
          </div>
        </div>

        {/* Card 2: Clinical Presentation (HPI) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
              }}
            >
              <i className="ph ph-activity-bold" />
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CLINICAL PRESENTATION (HPI)
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: '1.35' }}>
            {hpiText}
          </div>
        </div>

        {/* Card 3: Ocular & Medical History */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
              }}
            >
              <i className="ph ph-file-text-bold" />
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              OCULAR &amp; MEDICAL HISTORY
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: '1.35' }}>
            {pastMedicalHistory}
          </div>
        </div>

        {/* Card 4: Allergies & Triage */}
        <div
          style={{
            background: isAllergyNegative ? '#ffffff' : '#fef2f2',
            border: `1px solid ${isAllergyNegative ? '#e2e8f0' : '#fecaca'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: isAllergyNegative ? '#eff6ff' : '#fee2e2',
                color: isAllergyNegative ? '#2563eb' : '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
              }}
            >
              <i className="ph ph-shield-check-bold" />
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ALLERGIES &amp; TRIAGE
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isAllergyNegative ? '#1e293b' : '#b91c1c', lineHeight: '1.35' }}>
            {allergiesText}. Triage Priority: {isEmergencyPriority ? 'Urgent' : 'Routine'}.
          </div>
        </div>
      </div>
    );
  }

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
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#475569',
            }}
          >
            Read-only (from Registration/Triage)
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
            Eye: {affectedEye}
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
            className="doc-btn compact oph-history-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls="oph-clinical-history-content"
            style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
            }}
          >
            <i className={`ph ph-caret-${isExpanded ? 'up' : 'down'}`} />
            <span>{isExpanded ? 'Hide Clinical History' : 'View Clinical History'}</span>
          </button>
        </div>
      </div>

      {/* Expandable History Content */}
      {isExpanded && (
        <div id="oph-clinical-history-content">
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
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CHIEF COMPLAINT
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>
                {chiefComplaint}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                <span>{eyeLabel}</span>
                {intake?.duration_value ? (
                  <span> · {intake.duration_value} {intake.duration_unit?.toLowerCase() ?? 'days'}</span>
                ) : null}
                {intake?.onset ? <span> · {intake.onset.toLowerCase()}</span> : null}
              </div>
            </div>

            {/* Column 2: Presentation & HPI */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CLINICAL PRESENTATION (HPI)
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#334155',
                  marginTop: '4px',
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
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                OCULAR &amp; MEDICAL HISTORY
              </div>
              <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '4px', lineHeight: '1.4' }}>
                <div>👁️ {spectacleInfo}{contactLensInfo ? ` · ${contactLensInfo}` : ''}</div>
                <div style={{ color: '#64748b', marginTop: '2px' }}>🏥 {pastMedicalHistory}</div>
              </div>
            </div>

            {/* Column 4: Allergies & Triage Status */}
            <div style={{ background: isAllergyNegative ? '#f8fafc' : '#fef2f2', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isAllergyNegative ? '#e2e8f0' : '#fecaca'}` }}>
              <div style={{ fontSize: '0.7rem', color: isAllergyNegative ? '#64748b' : '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ALLERGIES &amp; TRIAGE
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isAllergyNegative ? '#15803d' : '#b91c1c', marginTop: '4px' }}>
                {allergiesText}
              </div>
              <div style={{ fontSize: '0.75rem', color: isEmergencyPriority ? '#e11d48' : '#16a34a', marginTop: '2px' }}>
                {isEmergencyPriority ? '⚠️ Urgent Triage Screening' : '✓ Routine Triage Cleared'}
              </div>
            </div>
          </div>

          {/* 3. Detailed Drawer */}
          <div
            style={{
              padding: '12px 16px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>FULL HPI NARRATIVE</div>
                <div style={{ color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {hpiText}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>OPHTHALMIC DETAILS</div>
                <div style={{ color: '#334155', lineHeight: '1.5' }}>
                  <div>• Prior Surgeries: {intake?.previous_eye_surgeries && intake.previous_eye_surgeries.length > 0 ? intake.previous_eye_surgeries.map((s) => `${s.procedure} (${s.laterality})`).join(', ') : (apptIntake?.past_history ? apptIntake.past_history : 'None')}</div>
                  <div>• Prior Diseases: {intake?.previous_eye_disease_codes && intake.previous_eye_disease_codes.length > 0 ? intake.previous_eye_disease_codes.join(', ') : (apptIntake?.past_history ? apptIntake.past_history : 'None')}</div>
                  <div>• Steroid Therapy: {intake?.long_term_steroid_use ? `Yes (${intake.long_term_steroid_details || 'Recorded'})` : 'No'}</div>
                  <div>• Family History: {familyHistory}</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>DOCUMENTS &amp; TRIAGE</div>
                <div style={{ color: '#334155', lineHeight: '1.5' }}>
                  <div>• Attached Documents: {intake?.previous_report_document_ids?.length ?? 0} file(s) linked at booking</div>
                  <div>• Priority at Reception: {f.visit?.priority} ({f.visit?.visit_type})</div>
                  <div>• Red-Flag Criteria: {intake?.emergency_criterion_codes && intake.emergency_criterion_codes.length > 0 ? intake.emergency_criterion_codes.join(', ') : 'None'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
