import { useState } from 'react';
import type { ApiOpdReferralPriority, OpdVisitResponse } from '../../api/opd';
import { usePatientDetails } from '../../hooks/patients/usePatients';

export type ReferralDoctorOption = {
  id: string;
  display_name: string;
  specialization?: string | null;
  consultation_room?: string | null;
};

export type OpdReferralSectionProps = {
  referralSpecialty: string;
  setReferralSpecialty: (val: string) => void;
  uniqueSpecialties: string[];
  referralDoctorId: string;
  setReferralDoctorId: (val: string) => void;
  filteredReferralDoctors: ReferralDoctorOption[];
  referralReason: string;
  setReferralReason: (val: string) => void;
  referralBooking: boolean;
  handleSubmitReferral: () => Promise<void>;
  saveConsultationDraft: () => void;
  showDraftAction?: boolean;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;

  // Visual parity & clinical context props
  priority?: ApiOpdReferralPriority;
  setPriority?: (val: ApiOpdReferralPriority) => void;
  appointmentDate?: string;
  setAppointmentDate?: (val: string) => void;
  additionalNotes?: string;
  setAdditionalNotes?: (val: string) => void;
  visit?: OpdVisitResponse | null;
  primaryDiagnosis?: string;
  clinicalStatus?: string;
  lastExamDate?: string;
  statusLabel?: string;
  affectedEye?: string;
};

function getPatientAge(dobString?: string | null): string {
  if (!dobString) return 'Not recorded';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 'Not recorded';
  const diff = Date.now() - dob.getTime();
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${age} years`;
}

function formatGender(gender?: string | null): string {
  if (!gender) return 'Not recorded';
  const g = gender.toUpperCase();
  if (g.startsWith('M')) return 'Male';
  if (g.startsWith('F')) return 'Female';
  return gender;
}

export function OpdReferralSection({
  referralSpecialty,
  setReferralSpecialty,
  uniqueSpecialties,
  referralDoctorId,
  setReferralDoctorId,
  filteredReferralDoctors,
  referralReason,
  setReferralReason,
  referralBooking,
  handleSubmitReferral,
  saveConsultationDraft,
  showDraftAction = true,
  handleNextStep,
  canEdit,
  priority,
  setPriority,
  appointmentDate,
  setAppointmentDate,
  additionalNotes,
  setAdditionalNotes,
  visit,
  primaryDiagnosis,
  clinicalStatus,
  lastExamDate,
  statusLabel,
  affectedEye,
}: OpdReferralSectionProps) {
  const [localPriority, setLocalPriority] = useState<ApiOpdReferralPriority>('ROUTINE');
  const [localAppointmentDate, setLocalAppointmentDate] = useState('');
  const [localNotes, setLocalNotes] = useState('');

  const activePriority = priority ?? localPriority;
  const handlePriorityChange = setPriority ?? setLocalPriority;
  const activeAppointmentDate = appointmentDate ?? localAppointmentDate;
  const handleDateChange = setAppointmentDate ?? setLocalAppointmentDate;
  const activeNotes = additionalNotes ?? localNotes;
  const handleNotesChange = setAdditionalNotes ?? setLocalNotes;

  const patientQuery = usePatientDetails(visit?.patient_id ?? null, Boolean(visit?.patient_id));
  const patient = patientQuery.data;

  const patientName = visit?.patient_name || 'Not recorded';
  const patientNumber = visit?.patient_number || 'Not recorded';
  const visitNumber = visit?.visit_number || 'Not recorded';
  const patientAge = getPatientAge(patient?.date_of_birth);
  const patientGender = formatGender(patient?.gender);
  const patientBloodGroup = patient?.blood_group || 'Not recorded';

  const patientInitials = patientName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const formattedExamDate = lastExamDate
    ? lastExamDate
    : visit?.visit_date
    ? new Date(visit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not recorded';

  return (
    <article className="oph-referral-page-wrapper">
      {/* 2-Column Responsive Layout: Left Form (~64%), Right Context Panels (~36%) */}
      <div className="oph-referral-layout">
        {/* Left Column: Form Card */}
        <div className="oph-referral-left-col">
          <section className="oph-card oph-referral-form-card">
            <div className="oph-ref-header">
              <div className="oph-ref-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="oph-ref-title-wrap">
                <h3>Specialist referral &amp; direct appointment booking</h3>
                <p>Refer to a specialist and book the next appointment.</p>
              </div>
              {statusLabel && <span className="oph-continuing-status">{statusLabel}</span>}
            </div>

            <div className="oph-ref-form-body">
              {/* Row 1: Specialty & Referred Doctor */}
              <div className="oph-grid-two">
                <label className="oph-input-field" htmlFor="ref-specialty">
                  <span className="oph-input-label">Specialty <span className="oph-required">*</span></span>
                  <div className="oph-select-wrap">
                    <span className="oph-select-search-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                    <select
                      id="ref-specialty"
                      className="oph-ref-select"
                      onChange={(e) => {
                        setReferralSpecialty(e.target.value);
                        setReferralDoctorId('');
                      }}
                      value={referralSpecialty}
                      disabled={!canEdit}
                    >
                      <option value="">Select specialty</option>
                      {uniqueSpecialties.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                    <span className="oph-select-chevron">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </label>

                <label className="oph-input-field" htmlFor="ref-doctor">
                  <span className="oph-input-label">Referred doctor <span className="oph-required">*</span></span>
                  <div className="oph-select-wrap">
                    <span className="oph-select-search-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                    <select
                      disabled={!referralSpecialty || !canEdit}
                      id="ref-doctor"
                      className="oph-ref-select"
                      onChange={(e) => {
                        setReferralDoctorId(e.target.value);
                      }}
                      value={referralDoctorId}
                    >
                      <option value="">
                        {referralSpecialty ? 'Select a doctor' : 'Select a specialty first'}
                      </option>
                      {filteredReferralDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.display_name} — {doc.specialization} ({doc.consultation_room || 'OPD Room'})
                        </option>
                      ))}
                    </select>
                    <span className="oph-select-chevron">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </label>
              </div>

              {/* Row 2: Reason for Referral */}
              <label className="oph-input-field" htmlFor="ref-reason" style={{ marginTop: '16px' }}>
                <span className="oph-input-label">Reason for referral <span className="oph-required">*</span></span>
                <div className="oph-textarea-wrap">
                  <textarea
                    id="ref-reason"
                    className="oph-ref-textarea"
                    rows={3}
                    maxLength={500}
                    onChange={(e) => setReferralReason(e.target.value)}
                    placeholder="Specialist assessment, second opinion, or further evaluation..."
                    value={referralReason}
                    disabled={!canEdit}
                  />
                  <div className="oph-counter-row">
                    <span>{referralReason.length}/500</span>
                  </div>
                </div>
              </label>

              {/* Row 3: Priority & Requested Appointment Date */}
              <div className="oph-grid-two" style={{ marginTop: '16px' }}>
                <div className="oph-input-field">
                  <span className="oph-input-label">Priority</span>
                  <div className="oph-priority-segmented">
                    <button
                      type="button"
                      className={`oph-priority-pill routine ${activePriority === 'ROUTINE' ? 'selected' : ''}`}
                      onClick={() => handlePriorityChange('ROUTINE')}
                      disabled={!canEdit}
                    >
                      <span className="oph-priority-radio">{activePriority === 'ROUTINE' ? '◉' : '○'}</span>
                      <span>Routine</span>
                    </button>
                    <button
                      type="button"
                      className={`oph-priority-pill urgent ${activePriority === 'URGENT' ? 'selected' : ''}`}
                      onClick={() => handlePriorityChange('URGENT')}
                      disabled={!canEdit}
                    >
                      <span className="oph-priority-radio">{activePriority === 'URGENT' ? '◉' : '○'}</span>
                      <span>Urgent</span>
                    </button>
                    <button
                      type="button"
                      className={`oph-priority-pill emergency ${activePriority === 'EMERGENCY' ? 'selected' : ''}`}
                      onClick={() => handlePriorityChange('EMERGENCY')}
                      disabled={!canEdit}
                    >
                      <span className="oph-priority-radio">{activePriority === 'EMERGENCY' ? '◉' : '○'}</span>
                      <span>Emergency</span>
                    </button>
                  </div>
                </div>

                <label className="oph-input-field" htmlFor="ref-date">
                  <span className="oph-input-label">Requested appointment date (optional)</span>
                  <div className="oph-date-wrap">
                    <input
                      type="date"
                      id="ref-date"
                      className="oph-ref-input"
                      placeholder="dd-mm-yyyy"
                      value={activeAppointmentDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </label>
              </div>

              {/* Row 4: Additional Notes */}
              <label className="oph-input-field" htmlFor="ref-notes" style={{ marginTop: '16px' }}>
                <span className="oph-input-label">Additional notes (optional)</span>
                <div className="oph-textarea-wrap">
                  <textarea
                    id="ref-notes"
                    className="oph-ref-textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="Clinical notes for the specialist..."
                    value={activeNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    disabled={!canEdit}
                  />
                  <div className="oph-counter-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                    <span>{activeNotes.length}/500</span>
                  </div>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: Patient Summary, Clinical Context, Referral Information */}
        <div className="oph-referral-right-col">
          {/* Card 1: Patient Summary Card (Preserved styling exactly) */}
          <div className="oph-ref-patient-card">
            <div className="oph-ref-avatar">{patientInitials}</div>
            <div className="oph-ref-patient-info">
              <div className="oph-ref-patient-name">{patientName}</div>
              <div className="oph-ref-patient-ids">
                <span>MRN: {patientNumber}</span>
                <span className="oph-ref-sep">·</span>
                <span>Visit: {visitNumber}</span>
              </div>
              <div className="oph-ref-patient-meta">
                <span><i className="ph ph-cake" /> {patientAge}</span>
                <span><i className="ph ph-gender-male" /> {patientGender}</span>
                <span>{affectedEye || <><i className="ph ph-drop" style={{ color: '#dc2626' }} /> {patientBloodGroup}</>}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Current Clinical Context */}
          <div className="oph-ref-context-card">
            <div className="oph-ref-context-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <h4>Current clinical context</h4>
            </div>
            <div className="oph-ref-context-body">
              <div className="oph-ref-context-row">
                <span className="label">Primary diagnosis</span>
                <span className="val">{primaryDiagnosis || 'Not recorded'}</span>
              </div>
              <div className="oph-ref-context-row">
                <span className="label">Clinical status</span>
                <span className="val">{clinicalStatus || 'Not recorded'}</span>
              </div>
              <div className="oph-ref-context-row">
                <span className="label">Last exam date</span>
                <span className="val">{formattedExamDate}</span>
              </div>
              <div className="oph-ref-context-row">
                <span className="label">Current phase</span>
                <span className="val">Referral &amp; Follow-up</span>
              </div>
            </div>
          </div>

          {/* Card 3: Referral Information Panel */}
          <div className="oph-ref-info-panel">
            <div className="oph-ref-info-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <h4>Referral Information</h4>
            </div>
            <p className="oph-ref-info-text">
              Selected specialist and reason will link to this encounter. Appointment booking depends on availability.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="oph-ref-bottom-bar">
        <div className="oph-ref-autosave">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Save a draft to keep your changes.</span>
        </div>
        <div className="oph-ref-actions">
          {canEdit && showDraftAction && (
            <button className="oph-btn-save-draft" onClick={saveConsultationDraft} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Save draft</span>
            </button>
          )}
          {canEdit && (
            <button
              className="oph-btn-submit-ref"
              disabled={!referralDoctorId || referralBooking}
              onClick={() => void handleSubmitReferral()}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>{referralBooking ? 'Submitting...' : 'Submit referral'}</span>
            </button>
          )}
          <button
            className="oph-btn-next-followup"
            onClick={() => handleNextStep('Follow-up')}
            type="button"
          >
            <span>Next: follow-up</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
