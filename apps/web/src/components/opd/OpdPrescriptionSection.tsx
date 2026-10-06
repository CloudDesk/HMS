import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';
import { isDentalMedication } from '../../pages/dental-utils';
import { MedicalSpinner } from '../ui/MedicalLoader';
import { PrintPrescriptionDocument } from '../print/PrintPrescriptionModal';
import type { OpdPrescriptionResponse, OpdVisitResponse } from '../../api/opd';
import type { PatientResponse } from '../../api/patients';

export type MedicationFormState = {
  medicine_name: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

export type PrescriptionItemFormState = MedicationFormState & { local_id: string };

export type PrescriptionFormState = {
  items: PrescriptionItemFormState[];
  follow_up_date: string;
  doctor_instructions: string;
  patient_instructions: string;
};

export type OpdPrescriptionSectionProps = {
  selectedDiagnoses: Icd10Diagnosis[];
  setActiveTab: (tab: string) => void;
  masterMedicines: Array<{
    id: string;
    name: string;
    strength?: string | null;
    available_quantity: number;
    unit?: string | null;
  }>;
  medicationForm: MedicationFormState;
  setMedicationForm: React.Dispatch<React.SetStateAction<MedicationFormState>>;
  prescriptionForm: PrescriptionFormState;
  setPrescriptionForm: React.Dispatch<React.SetStateAction<PrescriptionFormState>>;
  emptyMedicationForm: MedicationFormState;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  saveConsultationDraft: () => void;
  handleSendToPharmacy: () => Promise<void>;
  updating: string;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
  isDental?: boolean;
  prescription?: OpdPrescriptionResponse | null;
  patient?: PatientResponse | null;
  visit?: OpdVisitResponse | null;
  isSentToPharmacy?: boolean;
};

export function OpdPrescriptionSection({
  masterMedicines,
  medicationForm,
  setMedicationForm,
  prescriptionForm,
  setPrescriptionForm,
  emptyMedicationForm,
  showToast,
  saveConsultationDraft,
  handleSendToPharmacy,
  updating,
  handleNextStep,
  canEdit,
  isDental = false,
  prescription,
  patient,
  visit,
  isSentToPharmacy = false,
}: OpdPrescriptionSectionProps) {
  const displayMedicines = useMemo(() => {
    if (!isDental) return masterMedicines;
    return [...masterMedicines].sort((a, b) => {
      const aDental = isDentalMedication(a) ? 0 : 1;
      const bDental = isDentalMedication(b) ? 0 : 1;
      if (aDental !== bDental) return aDental - bDental;
      return a.name.localeCompare(b.name);
    });
  }, [masterMedicines, isDental]);

  const effectivePatient = useMemo<PatientResponse | null>(() => {
    if (patient) return patient;
    if (!visit) return null;
    const nameParts = (visit.patient_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Patient';
    const lastName = nameParts.slice(1).join(' ') || '';
    return {
      id: visit.patient_id,
      patient_number: visit.patient_number,
      first_name: firstName,
      middle_name: null,
      last_name: lastName,
      gender: 'OTHER',
      date_of_birth: '',
      parent_guardian: null,
      phone: null,
      email: null,
      status: 'ACTIVE',
      address: {},
      emergency_contact: {},
      registration_branch_id: visit.branch_id || null,
      blood_group: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: visit.created_at,
      updated_at: visit.updated_at,
    };
  }, [patient, visit]);

  const printablePrescription = useMemo<OpdPrescriptionResponse | null>(() => {
    if (!visit && !prescription) return null;
    const items = prescriptionForm.items.length > 0
      ? prescriptionForm.items.map((item, idx) => ({
          id: item.local_id || `item-${idx}`,
          medicine_name: item.medicine_name,
          strength: item.strength || null,
          dosage: item.dosage,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: Number(item.quantity) || null,
          intake_time: null,
          instructions: item.instructions || null,
        }))
      : (prescription?.items || []);

    return {
      id: prescription?.id || (visit?.id ? `RX-${visit.id.slice(0, 8).toUpperCase()}` : 'RX-NEW'),
      visit_id: visit?.id || prescription?.visit_id || '',
      consultation_id: prescription?.consultation_id || '',
      patient_id: visit?.patient_id || prescription?.patient_id || '',
      patient_number: visit?.patient_number || prescription?.patient_number || '',
      patient_name: visit?.patient_name || prescription?.patient_name || '',
      doctor_id: visit?.doctor_id || prescription?.doctor_id || '',
      doctor_name: prescription?.doctor_name || visit?.doctor_name || '-',
      status: prescription?.status || (isSentToPharmacy ? 'SUBMITTED' : 'DRAFT'),
      items,
      follow_up_date: prescriptionForm.follow_up_date || prescription?.follow_up_date || null,
      doctor_instructions: prescriptionForm.doctor_instructions || prescription?.doctor_instructions || null,
      patient_instructions: prescriptionForm.patient_instructions || prescription?.patient_instructions || null,
      submitted_at: prescription?.submitted_at || null,
      created_by: prescription?.created_by || null,
      updated_by: prescription?.updated_by || null,
      created_at: prescription?.created_at || new Date().toISOString(),
      updated_at: prescription?.updated_at || new Date().toISOString(),
    };
  }, [visit, prescription, prescriptionForm, isSentToPharmacy]);

  const handlePrintClick = () => {
    if (
      prescriptionForm.items.length === 0 &&
      (!prescription?.items || prescription.items.length === 0)
    ) {
      showToast('Add at least one medication before printing prescription.', 'error');
      return;
    }
    window.print();
  };

  const nextStep = 'Imaging';

  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Prescription Builder</h3>
            <p>Search formulary medicine and specify dosage instructions</p>
          </div>
        </div>

        {canEdit && (
          <div className="doc-form-grid three" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label className="doc-field" htmlFor="medicine-search-sel">
              <span>Medicine Search</span>
              <select
                id="medicine-search-sel"
                onChange={(e) => {
                  const selectedMedName = e.target.value;
                  const matchedOpt = displayMedicines.find((m) => m.name === selectedMedName);
                  setMedicationForm((m) => ({
                    ...m,
                    medicine_name: selectedMedName,
                    strength: matchedOpt?.strength || m.strength,
                  }));
                }}
                value={medicationForm.medicine_name}
              >
                <option value="">Search medicine from Pharmacy formulary</option>
                {displayMedicines.map((med) => {
                  const isDentalRel = isDental && isDentalMedication(med);
                  return (
                    <option key={med.id} value={med.name}>
                      {isDentalRel ? '⭐ [Dental] ' : ''}
                      {med.name} {med.strength ? `(${med.strength})` : ''} — Stock:{' '}
                      {med.available_quantity} {med.unit || 'units'}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="doc-field" htmlFor="medicine-dosage">
              <span>Dosage</span>
              <input
                id="medicine-dosage"
                onChange={(e) => setMedicationForm((m) => ({ ...m, dosage: e.target.value }))}
                placeholder="e.g. 1 tablet"
                value={medicationForm.dosage}
              />
            </label>
            <label className="doc-field" htmlFor="medicine-route">
              <span>Route</span>
              <select
                id="medicine-route"
                onChange={(e) => setMedicationForm((m) => ({ ...m, route: e.target.value }))}
                value={medicationForm.route || 'Oral'}
              >
                <option value="Oral">Oral</option>
                <option value="Intravenous (IV)">Intravenous (IV)</option>
                <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                <option value="Subcutaneous (SC)">Subcutaneous (SC)</option>
                <option value="Inhalation">Inhalation</option>
                <option value="Topical">Topical</option>
                <option value="Sublingual">Sublingual</option>
                <option value="Ophthalmic">Ophthalmic</option>
                <option value="Otic">Otic</option>
                <option value="Rectal">Rectal</option>
              </select>
            </label>

            <label className="doc-field" htmlFor="medicine-frequency">
              <span>Frequency</span>
              <select
                id="medicine-frequency"
                onChange={(e) => setMedicationForm((m) => ({ ...m, frequency: e.target.value }))}
                value={medicationForm.frequency || 'BD'}
              >
                <option value="OD">OD (Once Daily)</option>
                <option value="BD">BD (Twice Daily)</option>
                <option value="TDS">TDS (Thrice Daily)</option>
                <option value="QID">QID (Four times daily)</option>
                <option value="PRN">PRN (As needed)</option>
                <option value="STAT">STAT (Immediately)</option>
                <option value="Q4H">Q4H (Every 4 hours)</option>
                <option value="Q6H">Q6H (Every 6 hours)</option>
                <option value="Q8H">Q8H (Every 8 hours)</option>
                <option value="HS">HS (At bedtime)</option>
              </select>
            </label>

            <label className="doc-field" htmlFor="medicine-duration">
              <span>Duration</span>
              <select
                id="medicine-duration"
                onChange={(e) => {
                  const val = e.target.value;
                  setMedicationForm((m) => ({
                    ...m,
                    duration: val === 'Custom' ? '' : val,
                  }));
                }}
                value={
                  [
                    '3 Days',
                    '5 Days',
                    '7 Days',
                    '10 Days',
                    '14 Days',
                    '30 Days',
                    'Ongoing',
                  ].includes(medicationForm.duration)
                    ? medicationForm.duration
                    : 'Custom'
                }
              >
                <option value="3 Days">3 Days</option>
                <option value="5 Days">5 Days</option>
                <option value="7 Days">7 Days</option>
                <option value="10 Days">10 Days</option>
                <option value="14 Days">14 Days</option>
                <option value="30 Days">30 Days</option>
                <option value="Ongoing">Ongoing / Chronic</option>
                <option value="Custom">Custom</option>
              </select>
            </label>

            <label className="doc-field" htmlFor="medicine-instructions">
              <span>Instructions</span>
              <input
                id="medicine-instructions"
                onChange={(e) =>
                  setMedicationForm((m) => ({ ...m, instructions: e.target.value }))
                }
                placeholder="e.g. After meals"
                value={medicationForm.instructions}
              />
            </label>

            {!['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'].includes(
              medicationForm.duration
            ) && (
              <label
                className="doc-field full"
                htmlFor="custom-duration-input"
                style={{ gridColumn: '1 / -1' }}
              >
                <span>
                  Custom Duration <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input
                  id="custom-duration-input"
                  onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                  placeholder="e.g. 21 Days, 6 Weeks, 2 Months"
                  value={medicationForm.duration}
                />
              </label>
            )}
          </div>
        )}

        {canEdit && (
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              className="doc-btn primary"
              onClick={() => {
                if (!medicationForm.medicine_name.trim()) {
                  showToast('Select a medicine first.', 'error');
                  return;
                }
                const finalDuration = medicationForm.duration.trim();
                if (!finalDuration) {
                  showToast(
                    'Specify medication duration or select a custom duration.',
                    'error'
                  );
                  return;
                }
                setPrescriptionForm((prev) => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    {
                      ...medicationForm,
                      dosage: medicationForm.dosage || '1 tablet',
                      route: medicationForm.route || 'Oral',
                      frequency: medicationForm.frequency || 'BD',
                      duration: finalDuration,
                      local_id: `med-${Date.now()}`,
                    },
                  ],
                }));
                setMedicationForm(emptyMedicationForm);
                showToast('Medication added.');
              }}
              style={{ height: '42px', justifyContent: 'center' }}
              type="button"
            >
              <i aria-hidden="true" className="ph ph-plus" />
              Add Medication
            </button>
          </div>
        )}

        <div className="opd-form-section-head" style={{ marginTop: '1rem' }}>
          <div>
            <h4>Medication Table</h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Current prescription items</p>
          </div>
        </div>

        <div className="doc-table-wrap">
          <table className="doc-table opd-prescription-table">
            <thead>
              <tr>
                <th>MEDICINE</th>
                <th>DOSAGE</th>
                <th>ROUTE</th>
                <th>FREQUENCY</th>
                <th>DURATION</th>
                <th>INSTRUCTIONS</th>
                {canEdit && <th aria-label="Actions" style={{ width: '48px' }} />}
              </tr>
            </thead>
            <tbody>
              {prescriptionForm.items.length === 0 ? (
                <tr>
                  <td className="opd-prescription-empty" colSpan={canEdit ? 7 : 6}>
                    No medications prescribed yet.
                  </td>
                </tr>
              ) : (
                prescriptionForm.items.map((item, index) => (
                  <tr key={item.local_id || index}>
                    <td>
                      <strong>{item.medicine_name}</strong>
                      {item.strength ? (
                        <small style={{ color: '#64748b' }}>{item.strength}</small>
                      ) : null}
                    </td>
                    <td>{item.dosage || '1 tablet'}</td>
                    <td>{item.route || 'Oral'}</td>
                    <td>{item.frequency || 'BD'}</td>
                    <td>{item.duration || '5 Days'}</td>
                    <td>{item.instructions || '-'}</td>
                    {canEdit && (
                      <td>
                        <button
                          className="doc-action danger"
                          onClick={() =>
                            setPrescriptionForm((prev) => ({
                              ...prev,
                              items: prev.items.filter((_, i) => i !== index),
                            }))
                          }
                          title="Remove medication"
                          type="button"
                        >
                          <i className="ph ph-trash" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="doc-form-grid two" style={{ marginTop: '1.25rem', gap: '1rem' }}>
          <label className="doc-field" htmlFor="rx-doctor-instructions">
            <span>Doctor Instructions</span>
            <textarea
              id="rx-doctor-instructions"
              onChange={(e) =>
                setPrescriptionForm((prev) => ({
                  ...prev,
                  doctor_instructions: e.target.value,
                }))
              }
              placeholder="Clinical instructions for pharmacy dispensing..."
              rows={3}
              value={prescriptionForm.doctor_instructions}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="rx-patient-instructions">
            <span>Patient Instructions</span>
            <textarea
              id="rx-patient-instructions"
              onChange={(e) =>
                setPrescriptionForm((prev) => ({
                  ...prev,
                  patient_instructions: e.target.value,
                }))
              }
              placeholder="Patient counseling notes, lifestyle advice, diet restrictions..."
              rows={3}
              value={prescriptionForm.patient_instructions}
              disabled={!canEdit}
            />
          </label>
        </div>
      </section>

      <div className="opd-sticky-actions">
        <span className="opd-autosave saved">
          <i aria-hidden="true" className="ph ph-check-circle" />
          Auto-save enabled
        </span>
        <div>
          {canEdit && (
            <button className="doc-btn" onClick={saveConsultationDraft} type="button">
              <i className="ph ph-floppy-disk" aria-hidden="true" />
              Save Draft
            </button>
          )}
          <button className="doc-btn" onClick={handlePrintClick} type="button">
            <i aria-hidden="true" className="ph ph-printer" />
            Print Prescription
          </button>
          {(canEdit || isSentToPharmacy) && (
            <button
              className={isSentToPharmacy ? 'doc-btn sent-disabled' : 'doc-btn primary'}
              disabled={updating === 'prescription-submit' || isSentToPharmacy || !canEdit}
              onClick={() => {
                if (updating === 'prescription-submit' || isSentToPharmacy || !canEdit) return;
                void handleSendToPharmacy();
              }}
              type="button"
            >
              {updating === 'prescription-submit' ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Sending...</span>
                </>
              ) : isSentToPharmacy ? (
                <>
                  <i aria-hidden="true" className="ph ph-check-circle" />
                  Sent To Pharmacy
                </>
              ) : (
                <>
                  <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
                  Send To Pharmacy
                </>
              )}
            </button>
          )}
          <button
            className="doc-btn"
            onClick={() => handleNextStep(nextStep)}
            type="button"
          >
            Next: {nextStep}
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && effectivePatient && printablePrescription && createPortal(
        <div className="opd-prescription-print-container" aria-hidden="true">
          <PrintPrescriptionDocument
            patient={effectivePatient}
            prescription={printablePrescription}
          />
        </div>,
        document.body,
      )}
    </article>
  );
}
