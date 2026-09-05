import type React from 'react';
import { useMemo, useState } from 'react';
import type { useForm } from 'react-hook-form';
import type {
  AdmissionRequest,
  AdmissionSourceType,
  AdmissionType,
  InpatientAdmission,
} from '../../api/inpatient-admissions';
import { Modal } from '../ui/Modal';
import { usePatientDetails } from '../../hooks/patients/usePatients';

const statusMeta: Record<AdmissionRequest['status'], { label: string; tone: string; description: string }> = {
  PENDING_VALIDATION: {
    label: 'Pending Validation',
    tone: 'pending',
    description: 'Request intent captured; bed and prerequisites not yet validated.',
  },
  READY_FOR_CONFIRMATION: {
    label: 'Ready For Confirmation',
    tone: 'ready',
    description: 'Bed and prerequisites are selected; final admission is ready for confirmation.',
  },
  CONFIRMED: {
    label: 'Confirmed',
    tone: 'approved',
    description: 'Inpatient admission has been created and patient is admitted.',
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'rejected',
    description: 'Request is cancelled/closed and cannot create an admission.',
  },
};

const sourceLabels: Record<AdmissionSourceType, string> = {
  DIRECT: 'Direct Admission',
  OPD_VISIT: 'OPD Visit',
  EMERGENCY_ENCOUNTER: 'Emergency',
  REFERRAL: 'Referral',
  TRANSFER: 'Transfer',
  PROCEDURE_BOOKING: 'Procedure Booking',
};

const admissionTypeLabels: Record<AdmissionType, string> = {
  INPATIENT: 'Inpatient',
  OBSERVATION: 'Observation',
  DAY_CARE: 'Day Care',
  ICU: 'ICU',
  HDU: 'HDU',
  MEDICAL: 'Medical',
  SURGICAL: 'Surgical',
  MATERNITY: 'Maternity',
  PAEDIATRIC: 'Paediatric',
  OTHER: 'Other',
};

const priorityMeta: Record<AdmissionRequest['priority'], { label: string; tone: string }> = {
  ROUTINE: { label: 'Routine', tone: 'routine' },
  URGENT: { label: 'Urgent', tone: 'urgent' },
  EMERGENCY: { label: 'Emergency', tone: 'emergency' },
};

export type AllocationValues = {
  ward_id: string;
  bed_id: string;
  hold_id: string;
  consent_document_id: string;
  deposit_invoice_id: string;
  admission_date: string;
};

type AdmissionRequestDetailModalProps = {
  request: AdmissionRequest | null;
  open: boolean;
  onClose: () => void;
  allocationForm: ReturnType<typeof useForm<AllocationValues>>;
  wards: Array<{ id: string; name: string }>;
  beds: Array<{ id: string; bed_number: string; room_number: string | null }>;
  policy?: {
    admission_consent_required: boolean;
    admission_advance_deposit_required: boolean;
    admission_minimum_deposit_amount: number;
  };
  loadingConfiguration: boolean;
  pending: {
    validateRequest: boolean;
    confirmRequest: boolean;
    cancelRequest: boolean;
    uploadConsent: boolean;
  };
  admissions: InpatientAdmission[];
  onValidate: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onConsent: () => void;
  canValidate?: boolean;
  canConfirm?: boolean;
  canCancel?: boolean;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatDateOnly = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PT';

export function AdmissionRequestDetailModal({
  request,
  open,
  onClose,
  allocationForm,
  wards,
  beds,
  policy,
  loadingConfiguration,
  pending,
  admissions,
  onValidate,
  onConfirm,
  onCancel,
  onConsent,
  canValidate = true,
  canConfirm = true,
  canCancel = true,
}: AdmissionRequestDetailModalProps) {
  const [confirmAdmissionOpen, setConfirmAdmissionOpen] = useState(false);

  const patientQuery = usePatientDetails(request?.patient_id ?? null, Boolean(open && request?.patient_id));
  const patient = patientQuery.data;

  const linkedAdmission = useMemo(() => {
    if (!request) return null;
    return (
      admissions.find(
        (item) => item.id === request.admission_id || item.request_id === request.id,
      ) ?? null
    );
  }, [admissions, request]);

  const activeAdmissionForPatient = useMemo(() => {
    if (!request) return null;
    return (
      admissions.find(
        (item) => item.patient_id === request.patient_id && item.status === 'ADMITTED',
      ) ?? null
    );
  }, [admissions, request]);

  if (!request) return null;

  const status = statusMeta[request.status];
  const priority = priorityMeta[request.priority];
  const isPending = request.status === 'PENDING_VALIDATION';
  const isReady = request.status === 'READY_FOR_CONFIRMATION';
  const isConfirmed = request.status === 'CONFIRMED';
  const isCancelled = request.status === 'CANCELLED';

  const selectedWardId = allocationForm.watch('ward_id');
  const selectedBedId = allocationForm.watch('bed_id');
  const selectedAdmissionDate = allocationForm.watch('admission_date');

  const selectedWardName =
    wards.find((w) => w.id === selectedWardId)?.name ??
    (request.ward_id ? wards.find((w) => w.id === request.ward_id)?.name : null) ??
    linkedAdmission?.ward_name ??
    'Not selected';

  const selectedBedObj = beds.find((b) => b.id === selectedBedId);
  const selectedBedDisplay = selectedBedObj
    ? `${selectedBedObj.bed_number}${selectedBedObj.room_number ? ` (Room ${selectedBedObj.room_number})` : ''}`
    : linkedAdmission
      ? `${linkedAdmission.bed_number}`
      : 'Not selected';

  const handleConfirmAdmissionClick = () => {
    setConfirmAdmissionOpen(true);
  };

  const executeConfirmedAdmission = () => {
    setConfirmAdmissionOpen(false);
    onConfirm();
  };

  const headerTitle = (
    <div className="admission-modal-header">
      <div className="admission-modal-header-main">
        <div className="admission-modal-header-avatar">{initials(request.patient_name)}</div>
        <div className="admission-modal-header-text">
          <h3>
            Admission Request Details
            <span className="admission-modal-req-number">{request.request_number}</span>
          </h3>
          <div className="admission-modal-patient-info">
            <strong>{request.patient_name}</strong>
            <span>·</span>
            <span>MRN: {request.patient_number}</span>
            <span>·</span>
            <span>{formatDateTime(request.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="admission-modal-header-badges">
        <span className={`admission-priority-pill ${request.priority}`}>{priority.label}</span>
        <span className={`admission-status-pill ${request.status}`}>{status.label}</span>
      </div>
    </div>
  );

  const footerContent = (
    <div className="admission-modal-footer">
      <div className="admission-modal-footer-status">
        <i className="ph ph-info" />
        <span>{status.description}</span>
      </div>
      <div className="admission-modal-footer-actions">
        <button className="adm-btn" onClick={onClose} type="button">
          Close
        </button>

        {isPending ? (
          <>
            {canCancel && (
              <button
                className="adm-btn danger"
                disabled={pending.cancelRequest}
                onClick={onCancel}
                type="button"
              >
                <i className="ph ph-x" /> Reject / Cancel
              </button>
            )}
            {canValidate && (
              <button
                className="adm-btn primary"
                disabled={pending.validateRequest}
                onClick={onValidate}
                type="button"
              >
                <i className="ph ph-check-circle" /> Validate Request
              </button>
            )}
          </>
        ) : null}

        {isReady ? (
          <>
            {canCancel && (
              <button
                className="adm-btn danger"
                disabled={pending.cancelRequest}
                onClick={onCancel}
                type="button"
              >
                <i className="ph ph-x" /> Reject / Cancel
              </button>
            )}
            {canValidate && (
              <button
                className="adm-btn"
                disabled={pending.validateRequest}
                onClick={onValidate}
                title="Update bed or prerequisite selection"
                type="button"
              >
                <i className="ph ph-pencil-simple" /> Re-validate Selection
              </button>
            )}
            {canConfirm && (
              <button
                className="adm-btn success"
                disabled={pending.confirmRequest}
                onClick={handleConfirmAdmissionClick}
                type="button"
              >
                <i className="ph ph-check-fat" /> Confirm & Admit Patient
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xlarge"
        title={headerTitle}
        footer={footerContent}
      >
        <div className="admission-modal-body">
          {/* 1. PATIENT INFORMATION */}
          <section className="admission-modal-section-card">
            <div className="admission-section-header">
              <h4 className="admission-section-title">
                <i className="ph ph-user" /> Patient Information
              </h4>
              {activeAdmissionForPatient ? (
                <span className="admission-status-pill CONFIRMED">
                  Currently Admitted · {activeAdmissionForPatient.admission_number}
                </span>
              ) : (
                <span className="admission-priority-pill ROUTINE">No Active Inpatient Stay</span>
              )}
            </div>
            <div className="admission-modal-grid-4">
              <div className="admission-detail-field">
                <span>Patient Name</span>
                <strong>{request.patient_name}</strong>
              </div>
              <div className="admission-detail-field">
                <span>MRN / Patient ID</span>
                <strong>{request.patient_number}</strong>
              </div>
              <div className="admission-detail-field">
                <span>Date of Birth</span>
                <strong>{patient?.date_of_birth ? formatDateOnly(patient.date_of_birth) : 'Not available'}</strong>
              </div>
              <div className="admission-detail-field">
                <span>Gender</span>
                <strong>
                  {patient?.gender
                    ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()
                    : 'Not available'}
                </strong>
              </div>
              <div className="admission-detail-field">
                <span>Contact Phone</span>
                <strong>{patient?.phone || 'Not recorded'}</strong>
              </div>
              <div className="admission-detail-field">
                <span>Department</span>
                <strong>{request.department_name}</strong>
              </div>
              <div className="admission-detail-field">
                <span>Blood Group</span>
                <strong>{patient?.blood_group || 'Not recorded'}</strong>
              </div>
              <div className="admission-detail-field">
                <span>Active Stay Status</span>
                <strong>
                  {activeAdmissionForPatient
                    ? `Admitted in ${activeAdmissionForPatient.ward_name} (${activeAdmissionForPatient.bed_number})`
                    : 'Not currently admitted'}
                </strong>
              </div>
            </div>
          </section>

          {/* 2. ADMISSION REQUEST & REQUEST STATUS (2-column layout) */}
          <div className="admission-modal-grid-2">
            <section className="admission-modal-section-card">
              <div className="admission-section-header">
                <h4 className="admission-section-title">
                  <i className="ph ph-clipboard-text" /> Admission Request
                </h4>
                <span className="admission-modal-req-number">{request.request_number}</span>
              </div>
              <div className="admission-modal-grid-2">
                <div className="admission-detail-field">
                  <span>Admission Type</span>
                  <strong>{admissionTypeLabels[request.admission_type] ?? request.admission_type}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Admission Source</span>
                  <strong>{sourceLabels[request.source_type]}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Department</span>
                  <strong>{request.department_name}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Priority</span>
                  <strong>{priority.label}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Requested By</span>
                  <strong>{request.recommending_doctor_name}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Requested Date</span>
                  <strong>{formatDateTime(request.created_at)}</strong>
                </div>
              </div>
            </section>

            <section className="admission-modal-section-card">
              <div className="admission-section-header">
                <h4 className="admission-section-title">
                  <i className="ph ph-shield-check" /> Request Status & Policy
                </h4>
                <span className={`admission-status-pill ${request.status}`}>{status.label}</span>
              </div>
              <div className="admission-modal-grid-2">
                <div className="admission-detail-field">
                  <span>Current Lifecycle Status</span>
                  <strong>{status.label}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Last Activity Date</span>
                  <strong>{formatDateTime(request.updated_at)}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Admission Consent</span>
                  <strong>
                    {request.prerequisite_snapshot?.consent_satisfied
                      ? 'Verified / Linked'
                      : policy?.admission_consent_required
                        ? 'Mandatory (Required before admission)'
                        : 'Optional for branch'}
                  </strong>
                </div>
                <div className="admission-detail-field">
                  <span>Advance Deposit</span>
                  <strong>
                    {request.prerequisite_snapshot?.deposit_satisfied
                      ? `Satisfied (${request.prerequisite_snapshot.deposit_paid_amount})`
                      : policy?.admission_advance_deposit_required
                        ? `Required (Min ${policy.admission_minimum_deposit_amount})`
                        : 'Optional for branch'}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          {/* 3. SOURCE INFORMATION (Dynamic based on Admission Source) */}
          <section className="admission-modal-section-card">
            <div className="admission-section-header">
              <h4 className="admission-section-title">
                <i className="ph ph-arrow-square-out" /> Source Information · {sourceLabels[request.source_type]}
              </h4>
              {request.source_reference ? (
                <span className="admission-modal-req-number">{request.source_reference}</span>
              ) : null}
            </div>

            {request.source_type === 'DIRECT' ? (
              <div className="admission-source-box">
                <div>
                  <span>Source Type: </span>
                  <strong>Direct Admission</strong>
                </div>
                <div>
                  <span>Reason for Direct Admission: </span>
                  <strong>{request.reason}</strong>
                </div>
                {request.notes ? (
                  <div>
                    <span>Direct Admission Notes: </span>
                    <strong>{request.notes}</strong>
                  </div>
                ) : null}
              </div>
            ) : request.source_type === 'OPD_VISIT' ? (
              <div className="admission-modal-grid-3">
                <div className="admission-detail-field highlight">
                  <span>OPD Visit / Encounter</span>
                  <strong>{request.source_reference || 'OPD Visit Record'}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Consulting Doctor</span>
                  <strong>{request.recommending_doctor_name}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Originating Department</span>
                  <strong>{request.department_name}</strong>
                </div>
              </div>
            ) : request.source_type === 'REFERRAL' ? (
              <div className="admission-modal-grid-3">
                <div className="admission-detail-field highlight">
                  <span>Referral Reference</span>
                  <strong>{request.source_reference || 'Submitted Referral'}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Referring Doctor / Clinician</span>
                  <strong>{request.recommending_doctor_name}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Receiving Department</span>
                  <strong>{request.department_name}</strong>
                </div>
              </div>
            ) : request.source_type === 'EMERGENCY_ENCOUNTER' ? (
              <div className="admission-modal-grid-3">
                <div className="admission-detail-field highlight">
                  <span>Emergency Encounter</span>
                  <strong>{request.source_reference || 'Emergency Record'}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Emergency Clinician</span>
                  <strong>{request.recommending_doctor_name}</strong>
                </div>
                <div className="admission-detail-field highlight">
                  <span>Triage & Disposition</span>
                  <strong>Admit to {request.department_name}</strong>
                </div>
              </div>
            ) : (
              <div className="admission-modal-grid-2">
                <div className="admission-detail-field">
                  <span>Source Reference</span>
                  <strong>{request.source_reference || 'External Source'}</strong>
                </div>
                <div className="admission-detail-field">
                  <span>Source Provider</span>
                  <strong>{request.recommending_doctor_name}</strong>
                </div>
              </div>
            )}
          </section>

          {/* 4. CLINICAL INFORMATION */}
          <section className="admission-modal-section-card">
            <div className="admission-section-header">
              <h4 className="admission-section-title">
                <i className="ph ph-stethoscope" /> Clinical Information
              </h4>
            </div>
            <div className="admission-modal-grid-2">
              <div className="admission-summary-box clinical">
                <div className="admission-summary-box-label">
                  <i className="ph ph-file-text" /> Clinical Summary / Admission Reason
                </div>
                <p className="admission-summary-box-content">{request.reason}</p>
              </div>

              <div className="admission-summary-box notes">
                <div className="admission-summary-box-label">
                  <i className="ph ph-note-pencil" /> Internal / Operational Notes
                </div>
                <p className="admission-summary-box-content">
                  {request.notes ? request.notes : 'No internal operational notes recorded.'}
                </p>
              </div>
            </div>
          </section>

          {/* 5. ADMISSION REQUEST LIFECYCLE */}
          <section className="admission-modal-section-card">
            <div className="admission-section-header">
              <h4 className="admission-section-title">
                <i className="ph ph-clock-counter-clockwise" /> Admission Request Lifecycle
              </h4>
              <span className="admission-priority-pill ROUTINE">Step Progression</span>
            </div>
            <div className="admission-lifecycle-wrap">
              {/* Step 1: Created */}
              <div className="admission-lifecycle-step completed">
                <div className="admission-lifecycle-step-header">
                  <h5 className="admission-lifecycle-step-title">1. Request Created</h5>
                  <span className="admission-lifecycle-badge done">
                    <i className="ph ph-check" /> Completed
                  </span>
                </div>
                <div className="admission-lifecycle-step-time">{formatDateTime(request.created_at)}</div>
                <div className="admission-lifecycle-step-actor">By {request.recommending_doctor_name}</div>
              </div>

              {/* Step 2: Validation */}
              <div
                className={`admission-lifecycle-step${isReady || isConfirmed ? ' completed' : isPending ? ' current' : isCancelled ? ' cancelled' : ''}`}
              >
                <div className="admission-lifecycle-step-header">
                  <h5 className="admission-lifecycle-step-title">2. Bed Allocation & Validation</h5>
                  {isReady || isConfirmed ? (
                    <span className="admission-lifecycle-badge done">
                      <i className="ph ph-check" /> Validated
                    </span>
                  ) : isPending ? (
                    <span className="admission-lifecycle-badge pending">
                      <i className="ph ph-hourglass-high" /> Action Required
                    </span>
                  ) : (
                    <span className="admission-lifecycle-badge cancelled">Cancelled</span>
                  )}
                </div>
                <div className="admission-lifecycle-step-time">
                  {isReady || isConfirmed ? formatDateTime(request.updated_at) : 'Awaiting bed selection'}
                </div>
                <div className="admission-lifecycle-step-actor">
                  {request.bed_id || isReady || isConfirmed
                    ? `Ward: ${selectedWardName}`
                    : 'Select ward and available bed below'}
                </div>
              </div>

              {/* Step 3: Admission Confirmation */}
              <div
                className={`admission-lifecycle-step${isConfirmed ? ' completed' : isReady ? ' current' : isCancelled ? ' cancelled' : ''}`}
              >
                <div className="admission-lifecycle-step-header">
                  <h5 className="admission-lifecycle-step-title">3. Final Inpatient Admission</h5>
                  {isConfirmed ? (
                    <span className="admission-lifecycle-badge done">
                      <i className="ph ph-check-circle" /> Admitted
                    </span>
                  ) : isReady ? (
                    <span className="admission-lifecycle-badge active">
                      <i className="ph ph-arrow-right" /> Ready To Admit
                    </span>
                  ) : isCancelled ? (
                    <span className="admission-lifecycle-badge cancelled">Closed</span>
                  ) : (
                    <span className="admission-lifecycle-badge upcoming">Pending Step 2</span>
                  )}
                </div>
                <div className="admission-lifecycle-step-time">
                  {isConfirmed
                    ? formatDateTime(linkedAdmission?.admission_date || request.updated_at)
                    : isReady
                      ? 'Ready for confirmation'
                      : 'Upcoming'}
                </div>
                <div className="admission-lifecycle-step-actor">
                  {isConfirmed
                    ? `Admission: ${linkedAdmission?.admission_number || request.admission_id}`
                    : isCancelled
                      ? `Cancelled: ${request.cancellation_reason || 'Closed'}`
                      : 'Requires validation and prerequisites'}
                </div>
              </div>
            </div>
          </section>

          {/* 6. BED / ROOM ASSIGNMENT & ACTUAL ADMISSION (2-column layout) */}
          <div className="admission-modal-grid-2">
            {/* Bed / Room Card */}
            <section className="admission-modal-section-card">
              <div className="admission-section-header">
                <h4 className="admission-section-title">
                  <i className="ph ph-bed" /> Bed / Room Assignment
                </h4>
                <span
                  className={`admission-status-pill ${request.bed_id || selectedBedId ? 'CONFIRMED' : 'PENDING_VALIDATION'}`}
                >
                  {request.bed_id || selectedBedId ? 'Bed Selected' : 'Not Assigned'}
                </span>
              </div>

              {isPending || isReady ? (
                <form className="admission-form-section" onSubmit={(event) => event.preventDefault()}>
                  {loadingConfiguration ? <p className="form-hint">Loading available beds...</p> : null}
                  <div className="modal-form-grid">
                    <label>
                      Ward <span className="required-asterisk">*</span>
                      <select {...allocationForm.register('ward_id')}>
                        <option value="">Select ward</option>
                        {wards.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Available Bed <span className="required-asterisk">*</span>
                      <select {...allocationForm.register('bed_id')}>
                        <option value="">Select bed</option>
                        {beds.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.bed_number}
                            {item.room_number ? ` (Room ${item.room_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Admission Date & Time <span className="required-asterisk">*</span>
                      <input type="datetime-local" {...allocationForm.register('admission_date')} />
                    </label>
                    <label>
                      Hold ID (Optional)
                      <input {...allocationForm.register('hold_id')} placeholder="Optional active bed hold ID" />
                    </label>
                  </div>

                  <div className="admission-section-header" style={{ marginTop: '8px' }}>
                    <h5 className="admission-section-title" style={{ fontSize: '0.76rem' }}>
                      <i className="ph ph-shield-check" /> Prerequisites
                    </h5>
                  </div>
                  <div className="modal-form-grid">
                    <label>
                      Consent Document {policy?.admission_consent_required ? <span className="required-asterisk">*</span> : null}
                      <input
                        {...allocationForm.register('consent_document_id')}
                        placeholder="Linked consent document ID"
                      />
                    </label>
                    <label>
                      Deposit Invoice {policy?.admission_advance_deposit_required ? <span className="required-asterisk">*</span> : null}
                      <input
                        {...allocationForm.register('deposit_invoice_id')}
                        placeholder="Paid deposit invoice ID"
                      />
                    </label>
                  </div>
                  <div className="adm-row-actions" style={{ marginTop: '4px' }}>
                    <button className="adm-btn compact" onClick={onConsent} type="button">
                      <i className="ph ph-upload-simple" /> Link Signed Consent
                    </button>
                    {policy?.admission_advance_deposit_required ? (
                      <span className="form-hint">
                        Minimum deposit: {policy.admission_minimum_deposit_amount}
                      </span>
                    ) : (
                      <span className="form-hint">Advance deposit is optional for this branch.</span>
                    )}
                  </div>
                </form>
              ) : (
                <div className="admission-modal-grid-2">
                  <div className="admission-detail-field">
                    <span>Ward</span>
                    <strong>{selectedWardName}</strong>
                  </div>
                  <div className="admission-detail-field">
                    <span>Room / Bed</span>
                    <strong>{selectedBedDisplay}</strong>
                  </div>
                  <div className="admission-detail-field">
                    <span>Bed Status</span>
                    <strong>{isConfirmed ? 'Occupied / In Use' : 'Not Assigned'}</strong>
                  </div>
                  <div className="admission-detail-field">
                    <span>Consent Document</span>
                    <strong>
                      {request.prerequisite_snapshot?.consent_satisfied
                        ? 'Signed & Verified'
                        : request.consent_document_id
                          ? 'Linked'
                          : 'Not required / None'}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            {/* Actual Admission Card */}
            <section className="admission-modal-section-card">
              <div className="admission-section-header">
                <h4 className="admission-section-title">
                  <i className="ph ph-hospital" /> Actual Inpatient Admission
                </h4>
                <span
                  className={`admission-status-pill ${isConfirmed && request.admission_id ? 'CONFIRMED' : 'PENDING_VALIDATION'}`}
                >
                  {isConfirmed && request.admission_id ? 'Admitted' : 'Not Yet Admitted'}
                </span>
              </div>

              {isConfirmed && request.admission_id ? (
                <div className="admission-modal-body" style={{ padding: 0 }}>
                  <div className="admission-actual-banner admitted">
                    <i className="ph ph-check-circle" />
                    <div>
                      <strong>Patient is actively admitted in inpatient care.</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
                        Linked Inpatient Record: {linkedAdmission?.admission_number || request.admission_id}
                      </p>
                    </div>
                  </div>
                  <div className="admission-modal-grid-2">
                    <div className="admission-detail-field">
                      <span>Admission Number</span>
                      <strong>{linkedAdmission?.admission_number || request.admission_id}</strong>
                    </div>
                    <div className="admission-detail-field">
                      <span>Admission Date</span>
                      <strong>
                        {linkedAdmission
                          ? formatDateTime(linkedAdmission.admission_date)
                          : formatDateTime(request.updated_at)}
                      </strong>
                    </div>
                    <div className="admission-detail-field">
                      <span>Ward & Bed</span>
                      <strong>
                        {linkedAdmission
                          ? `${linkedAdmission.ward_name} · Bed ${linkedAdmission.bed_number}`
                          : selectedBedDisplay}
                      </strong>
                    </div>
                    <div className="admission-detail-field">
                      <span>Admitting Doctor</span>
                      <strong>
                        {linkedAdmission?.admitting_doctor_name || request.recommending_doctor_name}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : isCancelled ? (
                <div className="admission-actual-banner not-admitted">
                  <i className="ph ph-x-circle" />
                  <div>
                    <strong>This admission request was cancelled.</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
                      Reason: {request.cancellation_reason || 'Request closed before admission creation.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="admission-modal-body" style={{ padding: 0 }}>
                  <div className="admission-actual-banner not-admitted">
                    <i className="ph ph-clock" />
                    <div>
                      <strong>This request has not yet been converted into an inpatient admission.</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
                        {isPending
                          ? 'Validate bed and prerequisites above to proceed with confirmation.'
                          : 'Click "Confirm & Admit Patient" below to create the inpatient admission.'}
                      </p>
                    </div>
                  </div>
                  <div className="admission-modal-grid-2">
                    <div className="admission-detail-field">
                      <span>Admission Status</span>
                      <strong>Not Yet Admitted</strong>
                    </div>
                    <div className="admission-detail-field">
                      <span>Prerequisites Status</span>
                      <strong>{isReady ? 'Ready for confirmation' : 'Validation pending'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog before admitting patient */}
      <Modal
        open={confirmAdmissionOpen}
        onClose={() => setConfirmAdmissionOpen(false)}
        title="Confirm Patient Admission?"
        layer="top"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, color: '#334155', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Are you sure you want to confirm inpatient admission for this patient? This will allocate the bed and create the official inpatient admission encounter.
          </p>
          <div className="admission-confirmation-summary">
            <div className="admission-info-item">
              <span>Patient</span>
              <strong>{request.patient_name} ({request.patient_number})</strong>
            </div>
            <div className="admission-info-item">
              <span>Admission Type</span>
              <strong>{admissionTypeLabels[request.admission_type] ?? request.admission_type}</strong>
            </div>
            <div className="admission-info-item">
              <span>Ward & Bed</span>
              <strong>{selectedWardName} · {selectedBedDisplay}</strong>
            </div>
            <div className="admission-info-item">
              <span>Admission Date</span>
              <strong>{formatDateTime(selectedAdmissionDate)}</strong>
            </div>
          </div>
          <div className="modal-footer-actions">
            <button
              className="btn-secondary"
              onClick={() => setConfirmAdmissionOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={pending.confirmRequest}
              onClick={executeConfirmedAdmission}
              type="button"
            >
              {pending.confirmRequest ? 'Admitting...' : 'Confirm Admission'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
