import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';
import { MedicalSpinner } from '../ui/MedicalLoader';

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
};

export function OpdPrescriptionSection({
  selectedDiagnoses,
  setActiveTab,
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
}: OpdPrescriptionSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Prescription Builder</h3>
            <p>Search formulary medicine and specify dosage instructions</p>
          </div>
        </div>

        {/* Diagnosis Summary Section */}
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: selectedDiagnoses.length > 0 ? '0.5rem' : '0',
            }}
          >
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <i className="ph ph-stethoscope" style={{ color: '#2563eb' }} />
              Diagnosis Summary
            </span>
            <button
              onClick={() => setActiveTab('Diagnosis')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              type="button"
            >
              Edit Diagnosis <i className="ph ph-arrow-right" />
            </button>
          </div>
          {selectedDiagnoses.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
              No diagnosis selected yet. You can add ICD-10 diagnoses in the Diagnosis tab.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {selectedDiagnoses.map((dx) => (
                <span
                  key={dx.code}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '16px',
                    color: '#1e40af',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                  }}
                >
                  <strong>{dx.code}</strong> • {dx.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="doc-form-grid three" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label className="doc-field" htmlFor="medicine-search-sel">
              <span>Medicine Search</span>
              <select
                id="medicine-search-sel"
                onChange={(e) => {
                  const selectedMedName = e.target.value;
                  const matchedOpt = masterMedicines.find((m) => m.name === selectedMedName);
                  setMedicationForm((m) => ({
                    ...m,
                    medicine_name: selectedMedName,
                    strength: matchedOpt?.strength || m.strength,
                  }));
                }}
                value={medicationForm.medicine_name}
              >
                <option value="">Search medicine from Pharmacy formulary</option>
                {masterMedicines.map((med) => (
                  <option key={med.id} value={med.name}>
                    {med.name} {med.strength ? `(${med.strength})` : ''} — Stock:{' '}
                    {med.available_quantity} {med.unit || 'units'}
                  </option>
                ))}
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
              <>
                <div />
                <label className="doc-field" htmlFor="custom-duration-input">
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
                <div />
              </>
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

        <div className="doc-form-grid two" style={{ marginTop: '1.25rem' }}>
          <label className="doc-field" htmlFor="rx-follow-up-date">
            <span>Follow-up Date</span>
            <input
              id="rx-follow-up-date"
              onChange={(e) =>
                setPrescriptionForm((prev) => ({ ...prev, follow_up_date: e.target.value }))
              }
              type="date"
              value={prescriptionForm.follow_up_date}
              disabled={!canEdit}
            />
          </label>
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
              rows={2}
              value={prescriptionForm.doctor_instructions}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field full" htmlFor="rx-patient-instructions">
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
              rows={2}
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
          <button className="doc-btn" onClick={() => window.print()} type="button">
            <i aria-hidden="true" className="ph ph-printer" />
            Print Prescription
          </button>
          {canEdit && (
            <button
              className="doc-btn primary"
              disabled={updating === 'prescription-submit'}
              onClick={() => void handleSendToPharmacy()}
              type="button"
            >
              {updating === 'prescription-submit' ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Sending...</span>
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
            onClick={() => handleNextStep('Lab Orders')}
            type="button"
          >
            Next: Lab Orders
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
