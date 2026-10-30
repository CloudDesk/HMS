import { confirmAction } from '../ui/confirm-action';
import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';
import { MedicalSpinner } from '../ui/MedicalLoader';
import { OphthalmologyOrderIcon } from '../ophthalmology/OphthalmologyOrderIcon';

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
    available_quantity: number | null;
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
  referenceLayout?: boolean;
  statusLabel?: string;
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
  referenceLayout = false,
  statusLabel = 'Draft',
}: OpdPrescriptionSectionProps) {
  return (
    <article className="opd-prescription-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Main 2-Column Desktop Grid */}
      <div
        className="opd-prescription-two-col"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Prescription Builder & Current Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. Prescription Builder Card */}
          <section
            className="doc-card opd-rx-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            {/* Card Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                paddingBottom: '14px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                  }}
                >
                  <OphthalmologyOrderIcon kind="pill" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700, color: '#0f172a' }}>
                    Prescription builder
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Add medication and instructions for this visit.
                  </p>
                </div>
              </div>

              {referenceLayout ? <span className="oph-order-status">{statusLabel}</span> : <button
                type="button"
                className="doc-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#2563eb',
                  padding: '6px 14px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onClick={() => setActiveTab('Diagnosis')}
              >
                <i className="ph ph-stethoscope" style={{ fontSize: '0.9rem' }} />
                <span>Edit Diagnosis</span>
                <i className="ph ph-arrow-right" style={{ fontSize: '0.8rem' }} />
              </button>}
            </div>

            {/* Selected Diagnoses quick glance if present */}
            {selectedDiagnoses && selectedDiagnoses.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {selectedDiagnoses.map((dx) => (
                  <span
                    key={dx.code}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '12px',
                      color: '#1e40af',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    <strong>{dx.code}</strong> • {dx.name}
                  </span>
                ))}
              </div>
            )}

            {/* Form Fields: Row 1 (Medicine Search, Dosage, Route) */}
            {canEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="doc-form-grid three" style={{ gap: '12px' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Medicine search <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <i
                        className="ph ph-magnifying-glass"
                        style={{
                          position: 'absolute',
                          left: '10px',
                          color: '#94a3b8',
                          fontSize: '0.88rem',
                          pointerEvents: 'none',
                        }}
                      />
                      <select
                        id="medicine-search-sel"
                        style={{
                          width: '100%',
                          height: '40px',
                          paddingLeft: '32px',
                          paddingRight: '28px',
                          fontSize: '0.82rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                        }}
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
                        <option value="">Search medicine from formulary...</option>
                        {masterMedicines.map((med) => (
                          <option key={med.id} value={med.name}>
                            {med.name} {med.strength ? `(${med.strength})` : ''} — Stock:{' '}
                            {med.available_quantity === null ? 'Stock unavailable' : `${med.available_quantity} ${med.unit || 'units'}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Dosage <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <input
                      id="medicine-dosage"
                      style={{
                        height: '40px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                      }}
                      onChange={(e) => setMedicationForm((m) => ({ ...m, dosage: e.target.value }))}
                      placeholder="e.g. 1 tablet"
                      value={medicationForm.dosage}
                    />
                  </label>

                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Route <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <select
                      id="medicine-route"
                      style={{
                        height: '40px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        padding: '0 10px',
                      }}
                      onChange={(e) => setMedicationForm((m) => ({ ...m, route: e.target.value }))}
                      value={medicationForm.route || 'Oral'}
                    >
                      <option value="Oral">Oral</option>
                      <option value="Ophthalmic">Ophthalmic</option>
                      <option value="Topical">Topical</option>
                      <option value="Intravenous (IV)">Intravenous (IV)</option>
                      <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                      <option value="Subcutaneous (SC)">Subcutaneous (SC)</option>
                      <option value="Inhalation">Inhalation</option>
                      <option value="Sublingual">Sublingual</option>
                      <option value="Otic">Otic</option>
                      <option value="Rectal">Rectal</option>
                    </select>
                  </label>
                </div>

                {/* Row 2 (Frequency, Duration, Custom Duration) */}
                <div className="doc-form-grid three" style={{ gap: '12px' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Frequency <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <select
                      id="medicine-frequency"
                      style={{
                        height: '40px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        padding: '0 10px',
                      }}
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

                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Duration</span>
                    <select
                      id="medicine-duration"
                      style={{
                        height: '40px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        padding: '0 10px',
                      }}
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

                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Custom duration {!referenceLayout && <span style={{ color: '#ef4444' }}>*</span>}
                    </span>
                    <input
                      id="custom-duration-input"
                      style={{
                        height: '40px',
                        fontSize: '0.82rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                      }}
                      onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                      placeholder={referenceLayout ? 'e.g. 21 days' : 'e.g. 21 Days, 6 Weeks, 2 Months'}
                      value={medicationForm.duration}
                      disabled={['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'].includes(medicationForm.duration)}
                    />
                  </label>
                </div>

                {/* Row 3: Instructions (to Patient) */}
                <div>
                  <label className="doc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Instructions to patient
                    </span>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        id="medicine-instructions"
                        maxLength={500}
                        onChange={(e) =>
                          setMedicationForm((m) => ({ ...m, instructions: e.target.value }))
                        }
                        placeholder={referenceLayout ? 'Directions, timing, and safety advice...' : 'e.g. After meals, for 7 days, shake well before use...'}
                        rows={2}
                        value={medicationForm.instructions}
                        style={{
                          width: '100%',
                          minHeight: '65px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          padding: '8px 12px 24px',
                          fontSize: '0.84rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: '10px',
                          bottom: '8px',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      >
                        {medicationForm.instructions.length}/500
                      </span>
                    </div>
                  </label>
                </div>

                {/* Add Medication Button */}
                <div>
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
                    style={{
                      height: '38px',
                      padding: '0 18px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#2563eb',
                      borderColor: '#1d4ed8',
                    }}
                    type="button"
                  >
                    <OphthalmologyOrderIcon kind="plus" />
                    <span>Add medication</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 2. Current Prescription Items Card */}
          <section
            className={`doc-card opd-rx-card${referenceLayout ? ' oph-rx-items-table' : ''}`}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Current Prescription Items
              </h4>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                }}
              >
                {prescriptionForm.items.length} items
              </span>
            </div>

            <div className="doc-table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="doc-table opd-prescription-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>#</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Medicine</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Dosage</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Route</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Frequency</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Duration</th>
                    <th style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Instructions</th>
                    {canEdit && <th aria-label="Actions" style={{ width: '48px', padding: '8px 10px', fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {prescriptionForm.items.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 8 : 7} style={{ padding: '36px 16px', textAlign: 'center', background: '#ffffff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem',
                              color: '#cbd5e1',
                            }}
                          >
                            <i className="ph ph-pill" />
                          </div>
                          <strong style={{ fontSize: '0.88rem', color: '#475569' }}>
                            No medications prescribed yet
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Search and add medications using the form above.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    prescriptionForm.items.map((item, index) => (
                      <tr key={item.local_id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#64748b' }}>{index + 1}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                          <strong style={{ color: '#0f172a' }}>{item.medicine_name}</strong>
                          {item.strength ? (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.strength}</div>
                          ) : null}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#334155' }}>{item.dosage || '1 tablet'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#334155' }}>{item.route || 'Oral'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#334155' }}>{item.frequency || 'BD'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#334155' }}>{item.duration || '5 Days'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#334155' }}>{item.instructions || '-'}</td>
                        {canEdit && (
                          <td style={{ padding: '8px 10px' }}>
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
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#ef4444',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                              }}
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
          </section>
        </div>

        {/* RIGHT COLUMN: Prescription Summary & Follow-up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 1. Prescription Summary Card */}
          <section
            className="doc-card opd-rx-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '12px',
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
                  <i className="ph ph-target-bold" />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Prescription summary
                </h4>
              </div>

              {referenceLayout ? <span className="oph-order-status">{prescriptionForm.items.length} added</span> : canEdit && (
                <button
                  type="button"
                  className="doc-btn doc-btn-danger"
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#ffffff',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    cursor: 'pointer',
                  }}
                  onClick={async () => {
                    if (prescriptionForm.items.length === 0) return;
                    if (await confirmAction('Clear all prescribed medications from this draft?')) {
                      setPrescriptionForm((prev) => ({ ...prev, items: [] }));
                      showToast('Prescription items cleared.');
                    }
                  }}
                >
                  <i className="ph ph-trash" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Content */}
            {prescriptionForm.items.length === 0 ? (
              <div className="oph-rx-summary-empty" style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: '#cbd5e1',
                  }}
                >
                  <i className="ph ph-pill" />
                </div>
                <strong style={{ fontSize: '0.84rem', color: '#475569' }}>
                  No medications added yet
                </strong>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Added medications will appear here.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prescriptionForm.items.map((item, idx) => (
                  <div
                    key={item.local_id || idx}
                    className="oph-rx-summary-item"
                    style={{
                      padding: '8px 10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{item.medicine_name}</strong>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {item.dosage} · {referenceLayout ? `${item.frequency} · ${item.duration}` : `${item.route} · ${item.frequency}`}
                      </div>
                    </div>
                    <span
                      className={referenceLayout ? 'oph-rx-duration-duplicate' : undefined}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#eff6ff',
                        color: '#2563eb',
                      }}
                    >
                      {item.duration}
                    </span>
                    {referenceLayout && canEdit && <button type="button" className="oph-summary-remove-btn" aria-label={`Remove ${item.medicine_name}`} onClick={() => setPrescriptionForm((prev) => ({ ...prev, items: prev.items.filter((_, index) => index !== idx) }))}>×</button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Follow-up & Instructions Card */}
          {!referenceLayout && <section
            className="doc-card opd-rx-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div
              className={referenceLayout ? 'oph-rx-followup-heading' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '12px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '14px',
              }}
            >
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
                <i className="ph ph-calendar-bold" />
              </div>
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                Follow-up &amp; instructions
              </h4>
              {referenceLayout && <p>Complete before sending.</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="doc-field">
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Follow-up date</span>
                <input
                  id="rx-follow-up-date"
                  style={{
                    height: '38px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    padding: '0 10px',
                  }}
                  onChange={(e) =>
                    setPrescriptionForm((prev) => ({ ...prev, follow_up_date: e.target.value }))
                  }
                  type="date"
                  value={prescriptionForm.follow_up_date}
                  disabled={!canEdit}
                />
              </label>

              <label className="doc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Doctor instructions
                </span>
                <div style={{ position: 'relative' }}>
                  <textarea
                    id="rx-doctor-instructions"
                    maxLength={500}
                    style={{
                      width: '100%',
                      minHeight: '65px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '8px 10px 22px',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                    }}
                    onChange={(e) =>
                      setPrescriptionForm((prev) => ({
                        ...prev,
                        doctor_instructions: e.target.value,
                      }))
                    }
                    placeholder={referenceLayout ? 'Clinical instructions for pharmacy...' : 'Clinical instructions for pharmacy dispensing...'}
                    rows={2}
                    value={prescriptionForm.doctor_instructions}
                    disabled={!canEdit}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '8px',
                      bottom: '6px',
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  >
                    {prescriptionForm.doctor_instructions.length}/500
                  </span>
                </div>
              </label>

              <label className="doc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Patient instructions</span>
                <div style={{ position: 'relative' }}>
                  <textarea
                    id="rx-patient-instructions"
                    maxLength={500}
                    style={{
                      width: '100%',
                      minHeight: '65px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '8px 10px 22px',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                    }}
                    onChange={(e) =>
                      setPrescriptionForm((prev) => ({
                        ...prev,
                        patient_instructions: e.target.value,
                      }))
                    }
                    placeholder={referenceLayout ? 'Counselling notes and lifestyle advice...' : 'Patient counselling notes, lifestyle advice, diet restrictions...'}
                    rows={2}
                    value={prescriptionForm.patient_instructions}
                    disabled={!canEdit}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '8px',
                      bottom: '6px',
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  >
                    {prescriptionForm.patient_instructions.length}/500
                  </span>
                </div>
              </label>

              {/* Blue Info Banner */}
              <div
                className={referenceLayout ? 'oph-rx-review-note' : undefined}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {referenceLayout ? <OphthalmologyOrderIcon kind="check" /> : 'i'}
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.78rem', color: '#1e40af', lineHeight: '1.3' }}>
                    {referenceLayout ? 'Review medication and instructions before sending to pharmacy.' : 'Prescription will be sent to the pharmacy after saving.'}
                  </strong>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#3b82f6', marginTop: '2px', lineHeight: '1.3' }}>
                    Please review diagnosis, dosage and instructions before proceeding.
                  </span>
                </div>
              </div>
            </div>
          </section>}
        </div>
      </div>

      {/* Full-Width Bottom Action Bar */}
      <div
        className="opd-sticky-actions"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ph ph-check-circle-fill" style={{ color: '#16a34a', fontSize: '1.25rem' }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
            Save changes before leaving
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canEdit && !referenceLayout && (
            <button
              className="doc-btn"
              onClick={saveConsultationDraft}
              type="button"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '7px 14px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="ph ph-file-text" style={{ fontSize: '0.9rem', color: '#2563eb' }} />
              <span>Save Draft</span>
            </button>
          )}

          <button
            className="doc-btn"
            onClick={() => window.print()}
            type="button"
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '7px 14px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="ph ph-printer" style={{ fontSize: '0.9rem', color: '#2563eb' }} />
            <span>Print Prescription</span>
          </button>

          {canEdit && (
            <button
              className="doc-btn primary"
              disabled={updating === 'prescription-submit'}
              onClick={() => void handleSendToPharmacy()}
              type="button"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                background: '#2563eb',
                borderColor: '#1d4ed8',
                color: '#ffffff',
                padding: '7px 18px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {updating === 'prescription-submit' ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <i className="ph ph-paper-plane-tilt" style={{ fontSize: '0.9rem' }} />
                  <span>Send To Pharmacy</span>
                </>
              )}
            </button>
          )}

          <button
            className="doc-btn"
            onClick={() => handleNextStep('Lab Orders')}
            hidden={referenceLayout}
            type="button"
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '7px 14px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Next: Lab Orders</span>
            <i className="ph ph-arrow-right" style={{ fontSize: '0.85rem' }} />
          </button>
        </div>
      </div>
    </article>
  );
}
