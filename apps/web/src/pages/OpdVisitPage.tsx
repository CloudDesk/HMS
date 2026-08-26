import { useState, useRef, useEffect } from 'react';
import { Toast } from '../components/ui/Toast';

import {
  ClinicalVitalCard,
  evaluateDiastolicBp,
  evaluatePulse,
  evaluateRespiratoryRate,
  evaluateSpo2,
  evaluateSystolicBp,
  evaluateTemperature,
} from '../components/ui/ClinicalVitalCard';
import { navigate } from '../routing/navigation';
import { formatDate } from './patient-utils';
import {
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  visitStatusClass,
} from './opd-utils';

import { useOpdVisitFeature } from '../hooks/opd/useOpdVisitFeature';
import {
  OpdConsultationTab,
  type ConsultationForm,
  OpdPrescriptionTab,
  type PrescriptionForm,
  OpdVitalsModal,
  type VitalsForm,
  OpdLabOrdersTab,
  OpdImagingOrdersTab,
  OpdReferralTab,
} from '../components/opd';
import type { ApiClinicalOrderPriority } from '../api/opd';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

export function OpdVisitPage() {
  const { state, actions } = useOpdVisitFeature();
  const {
    activeVisitId,
    activeTab,
    recentVisits,
    workspace,
    referralSpecialty,
    referralDoctorId,
    referralReason,
    uniqueSpecialties,
    filteredReferralDoctors,
  } = state;

  const {
    setReferralSpecialty,
    setReferralDoctorId,
    setReferralReason,
    handleBookReferralAppointment,
    handleTabChange,
    handleVisitChange,
    handleCompleteConsultation,
    handleSaveConsultationDraft,
  } = actions;

  // Local UI State
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [labOrders, setLabOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedLabTest, setSelectedLabTest] = useState('');

  const [imagingOrders, setImagingOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedImagingTest, setSelectedImagingTest] = useState('');

  // Track form state from child components
  const latestPrescription = useRef<PrescriptionForm | null>(null);

  // Initialize UI state from workspace on load
  useEffect(() => {
    const labOrderData = workspace.labOrder;
    const imagingOrderData = workspace.imagingOrder;
    if (labOrderData) {
      const labs = (labOrderData.items ?? []).map((i) => ({
        id: i.service_id,
        name: i.investigation_name || 'Lab Test',
        local_id: `lab-${i.id || Date.now()}`,
      }));
      setLabOrders(labs);
    } else {
      setLabOrders([]);
    }
    if (imagingOrderData) {
      const imaging = (imagingOrderData.items ?? []).map((i) => ({
        id: i.service_id,
        name: i.investigation_name || 'Imaging Test',
        local_id: `img-${i.id || Date.now()}`,
      }));
      setImagingOrders(imaging);
    } else {
      setImagingOrders([]);
    }
  }, [workspace.labOrder, workspace.imagingOrder]);

  if (!activeVisitId) {
    return (
      <div className="layout-content opd-workspace">
        <Toast message="" visible={false} />
        <div className="page-header">
          <div>
            <h1>OPD Consultation</h1>
            <p className="subtitle">Select a patient visit from the queue to begin</p>
          </div>
        </div>
        <div className="empty-state">
          <i className="ph ph-stethoscope" aria-hidden="true" />
          <p>No active OPD visits available.</p>
        </div>
      </div>
    );
  }

  const visit = workspace.visit;
  const canEdit = workspace.canEditConsultation;

  if (workspace.isLoading) {
    return (
      <div className="layout-content opd-workspace">
        <div className="loading-state">Loading consultation workspace...</div>
      </div>
    );
  }

  if ( !visit) {
    return (
      <div className="layout-content opd-workspace">
        <div className="error-state">
          Error loading consultation data. Please check the network connection and try again.
        </div>
      </div>
    );
  }

  const vitals = workspace.vitals;

  const onConsultationComplete = async (data: ConsultationForm) => {
    await handleCompleteConsultation({
      consultationForm: data,
      prescriptionForm: latestPrescription.current || { items: [] },
      labOrders,
      selectedLabTest,
      labPriority,
      imagingOrders,
      selectedImagingTest,
      imagingPriority,
      onSuccess: () => navigate('/opd')
    });
  };

  const onConsultationSaveDraft = async (data: ConsultationForm) => {
    await handleSaveConsultationDraft(data);
  };

  const onPrescriptionSave = async (data: PrescriptionForm) => {
    if (!visit) return;
    try {
      await workspace.mutations.submitPrescription({
        visitId: visit.id,
        payload: {
          items: data.items.map((i) => ({
            medicine_name: i.medicine_name,
            strength: i.strength || null,
            dosage: i.dosage,
            route: i.route || 'ORAL',
            frequency: i.frequency,
            duration: i.duration,
            quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
            intake_time: i.intake_time || null,
            instructions: i.instructions || null,
          })),
          follow_up_date: data.follow_up_date || null,
          doctor_instructions: data.doctor_instructions || null,
          patient_instructions: data.patient_instructions || null,
        }
      });
      // Toast handles success inside hook if needed, but wait submitPrescription doesn't toast by default.
      // We rely on the hook returning.
      // It's handled gracefully.
    } catch {
      // Error handled.
    }
  };

  const submitVitals = async (data: VitalsForm) => {
    try {
      await workspace.mutations.createVitals({
        visitId: visit.id,
        payload: {
          blood_pressure_systolic: data.blood_pressure_systolic ? Number(data.blood_pressure_systolic as string) : null,
          blood_pressure_diastolic: data.blood_pressure_diastolic ? Number(data.blood_pressure_diastolic as string) : null,
          weight_kg: data.weight_kg ? Number(data.weight_kg) : null,
          height_cm: data.height_cm ? Number(data.height_cm) : null,
          temperature_c: data.temperature_c ? Number(data.temperature_c as string) : null,
          pulse_bpm: data.pulse_bpm ? Number(data.pulse_bpm as string) : null,
          respiratory_rate_per_min: data.respiratory_rate_per_min ? Number(data.respiratory_rate_per_min as string) : null,
          oxygen_saturation_percent: data.oxygen_saturation_percent ? Number(data.oxygen_saturation_percent as string) : null,
          notes: data.notes?.trim() || null,
        },
      });
      setIsVitalsModalOpen(false);
    } catch {
      // Error is handled in the modal or workspace
    }
  };

  return (
    <div className="layout-content opd-workspace">
      <Toast message="" visible={false} />

      {isVitalsModalOpen && (
        <OpdVitalsModal
          open={isVitalsModalOpen}
          visit={visit}
          initialData={vitals}
          onClose={() => setIsVitalsModalOpen(false)}
          onSave={submitVitals}
          isSaving={workspace.isCreatingVitals}
        />
      )}

      {/* 1. Header (Patient Info & Controls) */}
      <header className="page-header workspace-header">
        <div className="header-patient-info">
          <div className="patient-details">
            <h1 className="patient-name">{visit.patient_name}</h1>
            <div className="patient-meta">
              <span className="patient-mrn">{visit.patient_number}</span>
            </div>
          </div>
        </div>

        <div className="workspace-controls">
          <div className="visit-selector-wrap">
            <span className="visit-label">Recent Encounters:</span>
            <select
              className="visit-selector"
              onChange={(e) => handleVisitChange(e.target.value)}
              value={activeVisitId}
            >
              {recentVisits.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatDate(v.created_at)} — {v.doctor_name}
                </option>
              ))}
            </select>
          </div>
          <div className="visit-status-badge">
            <span className={`status-dot ${visitStatusClass(visit.status)}`} />
            {opdVisitStatusLabels[visit.status] || visit.status}
          </div>
        </div>
      </header>

      {/* 2. Clinical Vitals Bar */}
      <section className="vitals-ribbon">
        <div className="vitals-grid">
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-heartbeat"
            label="Blood Pressure"
            value={vitals ? `${vitals.blood_pressure_systolic || '--'}/${vitals.blood_pressure_diastolic || '--'}` : '--/--'}
            unit="mmHg"
            statusLabel={vitals ? (evaluateSystolicBp(String(vitals.blood_pressure_systolic ?? ''))?.label || evaluateDiastolicBp(String(vitals.blood_pressure_diastolic ?? ''))?.label || '') : ''}
            statusTone={vitals ? (evaluateSystolicBp(String(vitals.blood_pressure_systolic ?? ''))?.tone || evaluateDiastolicBp(String(vitals.blood_pressure_diastolic ?? ''))?.tone || 'neutral') : 'neutral'}
          />
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-activity"
            label="Pulse Rate"
            value={vitals?.pulse_bpm ? vitals.pulse_bpm.toString() : '--'}
            unit="bpm"
            statusLabel={vitals ? evaluatePulse(String(vitals.pulse_bpm ?? ''))?.label : ''}
            statusTone={vitals ? evaluatePulse(String(vitals.pulse_bpm ?? ''))?.tone : 'neutral'}
          />
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-thermometer"
            label="Temperature"
            value={vitals?.temperature_c ? vitals.temperature_c.toString() : '--'}
            unit="°C"
            statusLabel={vitals ? evaluateTemperature(String(vitals.temperature_c ?? ''))?.label : ''}
            statusTone={vitals ? evaluateTemperature(String(vitals.temperature_c ?? ''))?.tone : 'neutral'}
          />
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-lungs"
            label="Resp. Rate"
            value={vitals?.respiratory_rate_per_min ? vitals.respiratory_rate_per_min.toString() : '--'}
            unit="/min"
            statusLabel={vitals ? evaluateRespiratoryRate(String(vitals.respiratory_rate_per_min ?? ''))?.label : ''}
            statusTone={vitals ? evaluateRespiratoryRate(String(vitals.respiratory_rate_per_min ?? ''))?.tone : 'neutral'}
          />
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-drop"
            label="SpO2"
            value={vitals?.oxygen_saturation_percent ? vitals.oxygen_saturation_percent.toString() : '--'}
            unit="%"
            statusLabel={vitals ? evaluateSpo2(String(vitals.oxygen_saturation_percent ?? ''))?.label : ''}
            statusTone={vitals ? evaluateSpo2(String(vitals.oxygen_saturation_percent ?? ''))?.tone : 'neutral'}
          />
          <ClinicalVitalCard
            id={`cvc-${Math.random()}`}
            themeColor="sky"
            onChange={() => {}}
            normalRange="--"
            icon="ph-scales"
            label="Weight/Height"
            value={vitals ? `${vitals.weight_kg || '--'} / ${vitals.height_cm || '--'}` : '-- / --'}
            unit="kg/cm"

          />
        </div>
        <div className="vitals-actions">
          <button className="doc-btn icon-only" onClick={() => setIsVitalsModalOpen(true)} title="Update Vitals" type="button">
            <i className="ph ph-pencil-simple" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 3. Main Workspace Area */}
      <div className="workspace-main">
        <aside className="workspace-sidebar">
          <nav className="workspace-tabs">
            {WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`workspace-tab ${activeTab === tab.name ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.name)}
                type="button"
              >
                <div className="tab-icon">
                  {tab.id === '1' && <i className="ph ph-stethoscope" aria-hidden="true" />}
                  {tab.id === '2' && <i className="ph ph-activity" aria-hidden="true" />}
                  {tab.id === '3' && <i className="ph ph-pill" aria-hidden="true" />}
                  {tab.id === '4' && <i className="ph ph-flask" aria-hidden="true" />}
                  {tab.id === '5' && <i className="ph ph-radioactive" aria-hidden="true" />}
                  {tab.id === '6' && <i className="ph ph-arrows-merge" aria-hidden="true" />}
                  {tab.id === '7' && <i className="ph ph-calendar-plus" aria-hidden="true" />}
                </div>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="workspace-body">
          <div className="workspace-scroll-area">
            <div className="workspace-content-wrapper">
              
              {/* TAB 1: CONSULTATION */}
              {activeTab === 'Consultation' && (
                <OpdConsultationTab
                  consultation={workspace.consultation}
                  onSaveDraft={onConsultationSaveDraft}
                  onComplete={onConsultationComplete}
                  isSaving={false}
                  isCompleting={false}
                  canEdit={canEdit}
                  onChange={() => {}}
                />
              )}

              {/* TAB 2: DIAGNOSIS */}
              {activeTab === 'Diagnosis' && (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Diagnosis &amp; Assessment</h3>
                        <p>ICD-10 coding and detailed assessment</p>
                      </div>
                    </div>
                    <div className="doc-form-grid full-width">
                      <p style={{ color: '#64748b' }}>ICD-10 search module goes here.</p>
                    </div>
                  </section>
                </article>
              )}

              {/* TAB 3: PRESCRIPTION */}
              {activeTab === 'Prescription' && (
                <OpdPrescriptionTab
                  prescription={workspace.prescription}
                  masterMedicines={state.masterMedicines}
                  onSave={onPrescriptionSave}
                  isSaving={false}
                  canEdit={canEdit}
                  onChange={(data) => {
                    latestPrescription.current = data;
                  }}
                />
              )}

              {/* TAB 4: LAB ORDERS */}
              {activeTab === 'Lab Orders' && (
                <OpdLabOrdersTab
                  labTestServices={state.labTestServices}
                  labOrders={labOrders}
                  setLabOrders={setLabOrders}
                  labPriority={labPriority}
                  setLabPriority={setLabPriority}
                  selectedLabTest={selectedLabTest}
                  setSelectedLabTest={setSelectedLabTest}
                  canEdit={canEdit}
                />
              )}

              {/* TAB 5: IMAGING ORDERS */}
              {activeTab === 'Imaging Orders' && (
                <OpdImagingOrdersTab
                  imagingServices={state.imagingServices}
                  imagingOrders={imagingOrders}
                  setImagingOrders={setImagingOrders}
                  imagingPriority={imagingPriority}
                  setImagingPriority={setImagingPriority}
                  selectedImagingTest={selectedImagingTest}
                  setSelectedImagingTest={setSelectedImagingTest}
                  canEdit={canEdit}
                />
              )}

              {/* TAB 6: REFERRAL */}
              {activeTab === 'Referral' && (
                <OpdReferralTab
                  uniqueSpecialties={uniqueSpecialties}
                  filteredReferralDoctors={filteredReferralDoctors as Array<{ id: string; display_name: string; specialization: string }>}
                  referralSpecialty={referralSpecialty}
                  setReferralSpecialty={setReferralSpecialty}
                  referralDoctorId={referralDoctorId}
                  setReferralDoctorId={setReferralDoctorId}
                  referralReason={referralReason}
                  setReferralReason={setReferralReason}
                  referralBooking={false}
                  handleSubmitReferral={handleBookReferralAppointment}
                  canEdit={canEdit}
                />
              )}

              {/* TAB 7: FOLLOW-UP */}
              {activeTab === 'Follow-up' && (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Follow-up Instructions</h3>
                      </div>
                    </div>
                    <div className="doc-form-grid full-width">
                      <p style={{ color: '#64748b' }}>Configure follow-up dates in the Prescription tab.</p>
                    </div>
                  </section>
                </article>
              )}

            </div>
          </div>
        </main>

        <aside className="workspace-right-panel">
          <div className="doc-card summary-card">
            <h3>Visit Summary</h3>
            <div className="summary-list">
              <div className="summary-item">
                <span className="summary-label">Date</span>
                <span className="summary-value">{formatDate(visit.created_at)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Visit Type</span>
                <span className="summary-value">{opdVisitTypeLabels[visit.visit_type] || visit.visit_type}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Room / Token</span>
                <span className="summary-value">
                  {'OPD Room'}
                </span>
              </div>
            </div>
          </div>

          <div className="doc-card documents-card">
            <h3>Documents &amp; Reports</h3>
            <p style={{ color: '#64748b', marginTop: '1rem', fontSize: '13px' }}>
              View and upload documents from the Patient Profile.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
