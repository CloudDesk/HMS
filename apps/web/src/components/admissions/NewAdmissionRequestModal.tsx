import type React from 'react';
import type { useForm } from 'react-hook-form';
import type {
  AdmissionRequest,
  AdmissionSourceType,
  AdmissionType,
  InpatientAdmission,
} from '../../api/inpatient-admissions';
import type { AdmissionPatientOption } from '../../hooks/admissions/useInpatientAdmissionFeature';
import { Modal } from '../ui/Modal';

export type CreateAdmissionFormValues = {
  patient_id: string;
  department_id: string;
  recommending_doctor_id: string;
  source_type: 'DIRECT' | 'OPD_VISIT' | 'EMERGENCY_ENCOUNTER' | 'REFERRAL';
  source_id?: string;
  admission_type: 'INPATIENT' | 'OBSERVATION' | 'DAY_CARE';
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  reason: string;
  notes?: string;
};

const admissionTypeOptions: Array<{ value: AdmissionType; label: string; description: string }> = [
  { value: 'INPATIENT', label: 'Inpatient', description: 'Standard admission for 24+ hours' },
  { value: 'OBSERVATION', label: 'Observation', description: 'Short stay monitoring (under 24h)' },
  { value: 'DAY_CARE', label: 'Day Care', description: 'Same-day clinical or surgical procedure' },
];

const priorityOptions = [
  { value: 'ROUTINE', label: 'Routine', tone: 'routine' },
  { value: 'URGENT', label: 'Urgent', tone: 'urgent' },
  { value: 'EMERGENCY', label: 'Emergency', tone: 'emergency' },
] as const;

const sourceLabels: Record<AdmissionSourceType, string> = {
  DIRECT: 'Direct Admission',
  OPD_VISIT: 'OPD',
  EMERGENCY_ENCOUNTER: 'Emergency',
  REFERRAL: 'Referral',
  TRANSFER: 'Transfer',
  PROCEDURE_BOOKING: 'Procedure Booking',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

type NewAdmissionRequestModalProps = {
  open: boolean;
  onClose: () => void;
  createForm: ReturnType<typeof useForm<CreateAdmissionFormValues>>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  patientSearch: string;
  setPatientSearch: (val: string) => void;
  selectedSourceType: AdmissionSourceType;
  onSourceChange: (source: AdmissionSourceType) => void;
  selectedSourceValue: string;
  onPatientSelect: (val: string) => void;
  availablePatients: AdmissionPatientOption[];
  selectedPatientOption: AdmissionPatientOption | null;
  departmentOptions: Array<{ id: string; name: string }>;
  doctorOptions: Array<{ id: string; display_name: string }>;
  selectedDepartment?: { id: string; name: string };
  selectedDoctor?: { id: string; display_name: string };
  activeAdmissionForPatient?: InpatientAdmission | null;
  pendingRequestForPatient?: AdmissionRequest | null;
  showDuplicateWarning: boolean;
  loadingModalPatients: boolean;
  pendingCreate: boolean;
  branchId: string;
};

export function NewAdmissionRequestModal({
  open,
  onClose,
  createForm,
  onSubmit,
  patientSearch,
  setPatientSearch,
  selectedSourceType,
  onSourceChange,
  selectedSourceValue,
  onPatientSelect,
  availablePatients,
  selectedPatientOption,
  departmentOptions,
  doctorOptions,
  selectedDepartment,
  selectedDoctor,
  activeAdmissionForPatient,
  pendingRequestForPatient,
  showDuplicateWarning,
  loadingModalPatients,
  pendingCreate,
  branchId,
}: NewAdmissionRequestModalProps) {
  const values = createForm.watch();
  const errors = createForm.formState.errors;

  const headerTitle = (
    <div className="new-admission-modal-header">
      <h3 className="new-admission-modal-title">New Admission Request</h3>
      <p className="new-admission-modal-subtitle">
        Create a request for inpatient admission, observation, or day care
      </p>
    </div>
  );

  const footerContent = (
    <div className="new-admission-modal-footer">
      <button className="adm-btn" onClick={onClose} type="button">
        Cancel
      </button>
      <button
        className="adm-btn primary"
        disabled={pendingCreate || !branchId || showDuplicateWarning}
        onClick={onSubmit}
        type="button"
      >
        {pendingCreate ? (
          <>
            <i className="ph ph-spinner animate-spin" /> Creating Admission Request...
          </>
        ) : (
          <>
            <i className="ph ph-plus-circle" /> Create Admission Request
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      title={headerTitle}
      footer={footerContent}
      className="new-admission-modal"
    >
      <form className="new-admission-form" onSubmit={onSubmit}>
        {/* SECTION 1: ADMISSION SOURCE (FIRST) */}
        <section className="new-adm-section">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">1</div>
            <div>
              <h4 className="new-adm-section-title">Admission Source</h4>
              <p className="new-adm-section-sub">Select how this admission request originated.</p>
            </div>
          </div>

          <div className="new-adm-source-grid">
            {/* OPD Card */}
            <div
              className={`new-adm-source-card${selectedSourceType === 'OPD_VISIT' ? ' selected' : ''}`}
              onClick={() => onSourceChange('OPD_VISIT')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSourceChange('OPD_VISIT');
              }}
            >
              <div className="source-card-radio">
                <input
                  type="radio"
                  name="source_selection"
                  checked={selectedSourceType === 'OPD_VISIT'}
                  onChange={() => onSourceChange('OPD_VISIT')}
                  tabIndex={-1}
                />
              </div>
              <div className="source-card-icon blue">
                <i className="ph ph-stethoscope" />
              </div>
              <div className="source-card-content">
                <strong>OPD</strong>
                <span>Admission recommended following an OPD consultation.</span>
              </div>
            </div>

            {/* Referral Card */}
            <div
              className={`new-adm-source-card${selectedSourceType === 'REFERRAL' ? ' selected' : ''}`}
              onClick={() => onSourceChange('REFERRAL')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSourceChange('REFERRAL');
              }}
            >
              <div className="source-card-radio">
                <input
                  type="radio"
                  name="source_selection"
                  checked={selectedSourceType === 'REFERRAL'}
                  onChange={() => onSourceChange('REFERRAL')}
                  tabIndex={-1}
                />
              </div>
              <div className="source-card-icon purple">
                <i className="ph ph-share-network" />
              </div>
              <div className="source-card-content">
                <strong>Referral</strong>
                <span>Patient referred by another doctor, hospital, or department.</span>
              </div>
            </div>

            {/* Direct Admission Card */}
            <div
              className={`new-adm-source-card${selectedSourceType === 'DIRECT' ? ' selected' : ''}`}
              onClick={() => onSourceChange('DIRECT')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSourceChange('DIRECT');
              }}
            >
              <div className="source-card-radio">
                <input
                  type="radio"
                  name="source_selection"
                  checked={selectedSourceType === 'DIRECT'}
                  onChange={() => onSourceChange('DIRECT')}
                  tabIndex={-1}
                />
              </div>
              <div className="source-card-icon green">
                <i className="ph ph-hospital" />
              </div>
              <div className="source-card-content">
                <strong>Direct Admission</strong>
                <span>Patient requires admission without an OPD or referral source.</span>
              </div>
            </div>

            {/* Emergency Encounter Card (if present) */}
            {selectedSourceType === 'EMERGENCY_ENCOUNTER' ? (
              <div
                className="new-adm-source-card selected"
                onClick={() => onSourceChange('EMERGENCY_ENCOUNTER')}
                role="button"
                tabIndex={0}
              >
                <div className="source-card-radio">
                  <input type="radio" checked readOnly tabIndex={-1} />
                </div>
                <div className="source-card-icon red">
                  <i className="ph ph-first-aid" />
                </div>
                <div className="source-card-content">
                  <strong>Emergency</strong>
                  <span>Admission originating from emergency encounter triage.</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* SECTION 2: PATIENT (SECOND) */}
        <section className="new-adm-section">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">2</div>
            <div>
              <h4 className="new-adm-section-title">Patient Selection</h4>
              <p className="new-adm-section-sub">
                {selectedSourceType === 'OPD_VISIT'
                  ? 'Select an existing OPD encounter record for this admission request.'
                  : selectedSourceType === 'REFERRAL'
                    ? 'Select a submitted referral to convert into an admission request.'
                    : selectedSourceType === 'EMERGENCY_ENCOUNTER'
                      ? 'Select the active emergency encounter.'
                      : 'Search and select registered patient for direct admission.'}
              </p>
            </div>
          </div>

          <div className="new-adm-form-grid">
            {selectedSourceType === 'DIRECT' ? (
              <div className="new-adm-field span-2">
                <label>
                  Search Registered Patients
                  <input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by patient name, MRN, phone..."
                    className="new-adm-input"
                  />
                </label>
              </div>
            ) : null}

            <div className="new-adm-field span-2">
              <label>
                {selectedSourceType === 'OPD_VISIT'
                  ? 'Patient / OPD Visit Record'
                  : selectedSourceType === 'REFERRAL'
                    ? 'Patient / Submitted Referral'
                    : selectedSourceType === 'EMERGENCY_ENCOUNTER'
                      ? 'Patient / Emergency Encounter'
                      : 'Select Patient'}{' '}
                <span className="required-asterisk">*</span>
              </label>
              <select
                value={selectedSourceValue}
                onChange={(e) => onPatientSelect(e.target.value)}
                disabled={loadingModalPatients}
                className={`new-adm-select${errors.patient_id || errors.source_id ? ' has-error' : ''}`}
              >
                <option value="">
                  {loadingModalPatients
                    ? 'Loading source records...'
                    : selectedSourceType === 'OPD_VISIT'
                      ? 'Select an OPD encounter...'
                      : selectedSourceType === 'REFERRAL'
                        ? 'Select a submitted referral...'
                        : selectedSourceType === 'EMERGENCY_ENCOUNTER'
                          ? 'Select an emergency encounter...'
                          : 'Select patient from register...'}
                </option>
                {availablePatients.map((item) => (
                  <option
                    key={`${item.patientId}:${item.sourceId || item.patientId}`}
                    value={item.sourceId || item.patientId}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
              {errors.patient_id?.message || errors.source_id?.message ? (
                <small className="field-error">
                  {errors.patient_id?.message ?? errors.source_id?.message}
                </small>
              ) : null}
            </div>
          </div>

          {/* Active Admission or Duplicate Request Warning */}
          {showDuplicateWarning ? (
            <div className="new-adm-alert warning">
              <i className="ph ph-warning-circle" />
              <div>
                <strong>Existing Admission Conflict Detected</strong>
                <p>
                  {activeAdmissionForPatient
                    ? `This patient is already admitted under ${activeAdmissionForPatient.admission_number} (${activeAdmissionForPatient.ward_name} · ${activeAdmissionForPatient.bed_number}).`
                    : `This patient already has a pending admission request: ${pendingRequestForPatient?.request_number}.`}
                </p>
              </div>
            </div>
          ) : null}

          {/* Selected Patient Preview Card */}
          {selectedPatientOption ? (
            <div className="new-adm-patient-preview">
              <div className="preview-avatar">
                <i className="ph ph-user" />
              </div>
              <div className="preview-info">
                <strong>{selectedPatientOption.label}</strong>
                <span>
                  {selectedPatientOption.sourceReference
                    ? `Linked Ref: ${selectedPatientOption.sourceReference} · `
                    : ''}
                  Requester: {selectedPatientOption.doctorName || 'Not specified'}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {/* SECTION 3: ADMISSION DETAILS (THIRD) */}
        <section className="new-adm-section">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">3</div>
            <div>
              <h4 className="new-adm-section-title">Admission Details</h4>
              <p className="new-adm-section-sub">
                Specify admission type, clinical department, priority, and requesting clinician.
              </p>
            </div>
          </div>

          <div className="new-adm-form-grid">
            <div className="new-adm-field">
              <label>
                Admission Type <span className="required-asterisk">*</span>
              </label>
              <select {...createForm.register('admission_type')} className="new-adm-select">
                {admissionTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="new-adm-field">
              <label>
                Department <span className="required-asterisk">*</span>
              </label>
              <select
                {...createForm.register('department_id')}
                className={`new-adm-select${errors.department_id ? ' has-error' : ''}`}
              >
                <option value="">Select department</option>
                {departmentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {errors.department_id?.message ? (
                <small className="field-error">{errors.department_id.message}</small>
              ) : null}
            </div>

            <div className="new-adm-field">
              <label>
                Priority <span className="required-asterisk">*</span>
              </label>
              <select {...createForm.register('priority')} className="new-adm-select">
                {priorityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="new-adm-field">
              <label>
                Requested By <span className="required-asterisk">*</span>
              </label>
              <select
                {...createForm.register('recommending_doctor_id')}
                className={`new-adm-select${errors.recommending_doctor_id ? ' has-error' : ''}`}
              >
                <option value="">Select doctor or staff</option>
                {doctorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
              {errors.recommending_doctor_id?.message ? (
                <small className="field-error">{errors.recommending_doctor_id.message}</small>
              ) : null}
            </div>
          </div>
        </section>

        {/* SECTION 4: SOURCE INFORMATION (FOURTH) */}
        <section className="new-adm-section">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">4</div>
            <div>
              <h4 className="new-adm-section-title">Source Information</h4>
              <p className="new-adm-section-sub">
                Context details originating from the selected source.
              </p>
            </div>
          </div>

          {selectedSourceType === 'DIRECT' ? (
            <div className="new-adm-source-info-box direct">
              <div className="source-info-tag">Direct Admission</div>
              <p>
                No OPD or referral source is associated with this request. Capture the direct-admission reason and indications in the clinical summary below.
              </p>
            </div>
          ) : selectedPatientOption ? (
            <div className="new-adm-source-info-box linked">
              <div className="source-info-grid">
                <div>
                  <span>Source Record</span>
                  <strong>{selectedPatientOption.sourceReference || sourceLabels[selectedSourceType]}</strong>
                </div>
                <div>
                  <span>Origin Date</span>
                  <strong>{formatDateTime(selectedPatientOption.sourceDate)}</strong>
                </div>
                <div>
                  <span>Originating Requester</span>
                  <strong>
                    {selectedPatientOption.doctorName || selectedDoctor?.display_name || 'Not recorded'}
                  </strong>
                </div>
                {selectedPatientOption.sourceReason ? (
                  <div className="span-3">
                    <span>Source Clinical Reason</span>
                    <strong>{selectedPatientOption.sourceReason}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="new-adm-source-info-box empty">
              <i className="ph ph-arrow-bend-left-up" />
              <span>Select a {sourceLabels[selectedSourceType].toLowerCase()} record in Section 2 above to view source details.</span>
            </div>
          )}
        </section>

        {/* SECTION 5: REQUEST INFORMATION (FIFTH) */}
        <section className="new-adm-section">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">5</div>
            <div>
              <h4 className="new-adm-section-title">Request Information</h4>
              <p className="new-adm-section-sub">
                Clinical summary for admission and optional internal notes.
              </p>
            </div>
          </div>

          <div className="new-adm-form-grid">
            <div className="new-adm-field span-2">
              <label>
                Clinical Summary / Admission Reason <span className="required-asterisk">*</span>
              </label>
              <textarea
                {...createForm.register('reason')}
                rows={3}
                placeholder="Describe the clinical reason and indications for inpatient care, observation, or day care..."
                className={`new-adm-textarea${errors.reason ? ' has-error' : ''}`}
              />
              {errors.reason?.message ? (
                <small className="field-error">{errors.reason.message}</small>
              ) : null}
            </div>

            <div className="new-adm-field span-2">
              <label>
                Internal Notes <span className="optional-tag">(Optional)</span>
              </label>
              <textarea
                {...createForm.register('notes')}
                rows={2}
                placeholder="Optional operational notes (e.g. bed preferences, escort/guardian notes)..."
                className="new-adm-textarea secondary"
              />
            </div>
          </div>
        </section>

        {/* SECTION 6: CONFIRMATION / SUMMARY (SIXTH) */}
        <section className="new-adm-section confirmation">
          <div className="new-adm-section-head">
            <div className="new-adm-section-badge">6</div>
            <div>
              <h4 className="new-adm-section-title">Confirmation & Review</h4>
              <p className="new-adm-section-sub">Verify request details before submission.</p>
            </div>
          </div>

          <div className="new-adm-summary-grid">
            <div className="summary-item">
              <span>Patient</span>
              <strong>{selectedPatientOption?.label ?? 'Not selected'}</strong>
            </div>
            <div className="summary-item">
              <span>Source</span>
              <strong>{sourceLabels[selectedSourceType]}</strong>
            </div>
            <div className="summary-item">
              <span>Admission Type</span>
              <strong>
                {admissionTypeOptions.find((item) => item.value === values.admission_type)?.label ??
                  'Not selected'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Department</span>
              <strong>{selectedDepartment?.name ?? 'Not selected'}</strong>
            </div>
            <div className="summary-item">
              <span>Priority</span>
              <strong>
                {priorityOptions.find((item) => item.value === values.priority)?.label ?? 'Routine'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Requested By</span>
              <strong>
                {selectedDoctor?.display_name ??
                  selectedPatientOption?.doctorName ??
                  'Not selected'}
              </strong>
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
