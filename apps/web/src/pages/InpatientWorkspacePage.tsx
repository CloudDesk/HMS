import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../components/ui/Modal';
import { InpatientPatientDetailModal } from '../components/admissions/InpatientPatientDetailModal';
import { NewProcedureRecommendationModal } from '../components/surgery/NewProcedureRecommendationModal';
import { useInpatientWorkspaceFeature } from '../hooks/admissions/useInpatientWorkspaceFeature';
import { removeLegacyInpatientClinicalStorage } from '../utils/inpatient-clinical-storage';

export function InpatientWorkspacePage() {
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedCareLevel, setSelectedCareLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'rounds' | 'vitals' | 'surgeries' | 'discharge'>('orders');

  // Modals
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Round Note Form State
  const [roundSubjective, setRoundSubjective] = useState('');
  const [roundObjective, setRoundObjective] = useState('');
  const [roundAssessment, setRoundAssessment] = useState('');
  const [roundPlan, setRoundPlan] = useState('');

  // Bedside Vitals Form State
  const [vitalBpSys, setVitalBpSys] = useState('120');
  const [vitalBpDia, setVitalBpDia] = useState('80');
  const [vitalHr, setVitalHr] = useState('75');
  const [vitalTemp, setVitalTemp] = useState('36.8');
  const [vitalSpo2, setVitalSpo2] = useState('98');
  const [vitalResp, setVitalResp] = useState('16');
  const [vitalPain, setVitalPain] = useState('0');

  // Diagnostic Order Form State
  const [orderType, setOrderType] = useState<'LAB' | 'IMAGING'>('LAB');
  const [orderServiceId, setOrderServiceId] = useState('');
  const [orderSpecimenType, setOrderSpecimenType] = useState('');
  const [orderInstructions, setOrderInstructions] = useState('');

  useEffect(() => removeLegacyInpatientClinicalStorage(window.localStorage), []);

  const feature = useInpatientWorkspaceFeature({ selectedWard, selectedCareLevel, searchQuery });
  const {
    branchId, selectedAdmission, branches, departments, wards, doctors, procedureServices,
    admittedList, filteredInpatients, recommendations: currentPatientRecommendations,
    bookings: currentPatientBookings, roundNotes: currentPatientRounds,
    vitals: currentPatientVitals, diagnosticOrders: currentPatientOrders,
    laboratoryServices, imagingServices, isDischarging, loading, errors, pending,
  } = feature.state;
  const {
    setBranchId, selectAdmission: setSelectedAdmission, refreshAdmissions,
    createRoundNote, createVital, submitClinicalOrder, saveDischargeSummary, finalizeDischarge,
  } = feature.actions;

  const procedureInitialContext = useMemo(() => {
    if (!selectedAdmission) return null;
    return {
      patient: {
        id: selectedAdmission.patient_id,
        patient_number: selectedAdmission.patient_number,
        name: selectedAdmission.patient_name,
      },
      department_id: selectedAdmission.department_id || undefined,
      recommending_doctor_id: selectedAdmission.admitting_doctor_id || undefined,
      encounter_id:
        selectedAdmission.admission_source === 'OPD' &&
        selectedAdmission.source_reference_id &&
        /^[a-f\d]{24}$/i.test(selectedAdmission.source_reference_id)
          ? selectedAdmission.source_reference_id
          : undefined,
      clinical_reason: selectedAdmission.reason?.trim() || undefined,
      sourceContext: 'Inpatient Admission',
    };
  }, [selectedAdmission]);

  const handleAddRoundNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    if (!roundSubjective.trim() && !roundObjective.trim() && !roundAssessment.trim() && !roundPlan.trim()) {
      toast.error('Please enter clinical round findings or plan.');
      return;
    }

    try {
      await createRoundNote({
      subjective: roundSubjective.trim() || 'Patient reports stable comfort without acute distress.',
      objective: roundObjective.trim() || 'Vitals stable. Bedside physical examination within expected post-admission limits.',
      assessment: roundAssessment.trim() || selectedAdmission.reason || 'Ongoing inpatient management.',
      plan: roundPlan.trim() || 'Continue current inpatient medication and nursing observation protocol.',
      });
      toast.success('Ward round progress note recorded.');
      setRoundModalOpen(false);
      setRoundSubjective(''); setRoundObjective(''); setRoundAssessment(''); setRoundPlan('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to save ward round note.'); }
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;

    try {
      await createVital({ bp_systolic: Number(vitalBpSys), bp_diastolic: Number(vitalBpDia), heart_rate: Number(vitalHr), temperature: Number(vitalTemp), spo2: Number(vitalSpo2), respiratory_rate: Number(vitalResp), pain_score: Number(vitalPain) });
      toast.success('Bedside vital signs recorded.'); setVitalsModalOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to save bedside vitals.'); }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    const availableServices = orderType === 'LAB' ? laboratoryServices : imagingServices;
    const selectedService = availableServices.find((service) => service.id === orderServiceId);
    if (!selectedService) {
      toast.error('Please select an active diagnostic service.');
      return;
    }
    if (orderType === 'LAB' && !orderSpecimenType.trim() && !selectedService.sample_type?.trim()) { toast.error('Specimen type is required for laboratory orders.'); return; }
    try {
      await submitClinicalOrder({ type: orderType === 'LAB' ? 'LABORATORY' : 'IMAGING', payload: { priority: 'ROUTINE', specimen_type: orderType === 'LAB' ? (orderSpecimenType.trim() || selectedService.sample_type || null) : null, items: [{ service_id: selectedService.id, investigation_name: selectedService.name, category: selectedService.category || (orderType === 'LAB' ? 'Laboratory' : 'Radiology') }], clinical_notes: orderInstructions.trim() || null, instructions: orderInstructions.trim() || null } });
      toast.success(`${orderType} order placed for admitted patient.`); setOrderModalOpen(false); setOrderServiceId(''); setOrderSpecimenType(''); setOrderInstructions('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to place diagnostic order.'); }
  };

  // Metrics
  const kpis = useMemo(() => {
    const total = admittedList.length;
    const icuCount = admittedList.filter((a) => a.admission_type === 'ICU' || a.admission_type === 'HDU').length;
    const surgicalCount = admittedList.filter((a) => a.admission_type === 'SURGICAL').length;
    return { total, icuCount, surgicalCount };
  }, [admittedList]);

  const calculateLOS = (admitDateStr?: string | null) => {
    if (!admitDateStr) return '< 1 day';
    const time = new Date(admitDateStr).getTime();
    if (isNaN(time)) return '< 1 day';
    const diff = Date.now() - time;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return '< 1 day';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <div className="inpatient-workspace-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Inpatient Clinical Workspace</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.86rem', color: '#64748b' }}>
            Ward doctor rounds, inpatient EHR, bedside vitals, diagnostic orders &amp; surgery scheduling
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {branches.length > 1 && (
            <select
              aria-label="Select Branch"
              value={branchId}
              onChange={(e) => {
                const nextBranch = e.target.value;
                setSelectedWard('');
                setSelectedCareLevel('');
                setSearchQuery('');
                setBranchId(nextBranch);
              }}
              className="um-filter"
              style={{ minWidth: '170px', fontWeight: 500 }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            className="btn-secondary"
            onClick={() => void refreshAdmissions()}
            type="button"
            style={{ height: '38px' }}
          >
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <section className="adm-kpis inpatient-workspace-kpis">
        <div className="adm-kpi">
          <div className="adm-kpi-icon blue">
            <i className="ph ph-bed" />
          </div>
          <div className="adm-kpi-copy">
            <span>Admitted Inpatients</span>
            <strong>{kpis.total}</strong>
            <small>Active inpatient stays</small>
          </div>
        </div>

        <div className="adm-kpi">
          <div className="adm-kpi-icon red">
            <i className="ph ph-heartbeat" />
          </div>
          <div className="adm-kpi-copy">
            <span>Critical / ICU / HDU</span>
            <strong>{kpis.icuCount}</strong>
            <small>Intensive care monitoring</small>
          </div>
        </div>

        <div className="adm-kpi">
          <div className="adm-kpi-icon purple">
            <i className="ph ph-scissors" />
          </div>
          <div className="adm-kpi-copy">
            <span>Surgical Inpatients</span>
            <strong>{kpis.surgicalCount}</strong>
            <small>Pre/Post-op care</small>
          </div>
        </div>

        <div className="adm-kpi">
          <div className="adm-kpi-icon green">
            <i className="ph ph-sign-out" />
          </div>
          <div className="adm-kpi-copy">
            <span>Stable for Discharge</span>
            <strong>{Math.max(0, kpis.total - kpis.icuCount)}</strong>
            <small>Routine ward recovery</small>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="adm-filters inpatient-workspace-filters">
        <div className="adm-field">
          <label>Ward Filter</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="">All Wards</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="adm-field">
          <label>Care Level</label>
          <select value={selectedCareLevel} onChange={(e) => setSelectedCareLevel(e.target.value)}>
            <option value="">All Care Levels</option>
            <option value="MEDICAL">Medical</option>
            <option value="SURGICAL">Surgical</option>
            <option value="ICU">ICU</option>
            <option value="HDU">HDU</option>
            <option value="OBSERVATION">Observation</option>
            <option value="MATERNITY">Maternity</option>
            <option value="PAEDIATRIC">Paediatric</option>
          </select>
        </div>

        <div className="adm-field inpatient-workspace-search">
          <label>Search Admitted Patients</label>
          <input
            placeholder="Search by Patient Name, MRN, Bed #, or Doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Ward Patient Board */}
      <div className="adm-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="adm-card-head">
          <div>
            <h3>Ward Patient Board</h3>
            <p>{filteredInpatients.length} admitted patients found · Click any patient card to open clinical workspace</p>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {loading.admissions ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading admitted patients...</div>
          ) : filteredInpatients.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <i className="ph ph-bed" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No admitted inpatients found in this ward or care level.</p>
            </div>
          ) : (
            <div className="inpatient-board-grid">
              {filteredInpatients.map((item) => {
                const initials = (item.patient_name || 'PT')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const los = calculateLOS(item.admission_date);

                return (
                  <div
                    key={item.id}
                    className={`inpatient-patient-card ${selectedAdmission?.id === item.id && detailModalOpen ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedAdmission(item);
                      setDetailModalOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedAdmission(item);
                        setDetailModalOpen(true);
                      }
                    }}
                  >
                    <div className="inpatient-card-top">
                      <div className="inpatient-card-person">
                        <div className="inpatient-card-avatar">{initials}</div>
                        <div className="inpatient-card-meta-name">
                          <strong>{item.patient_name}</strong>
                          <span>{item.patient_number}</span>
                        </div>
                      </div>
                      <span className="inpatient-card-bed">
                        Bed {item.bed_number}
                      </span>
                    </div>

                    <div className="inpatient-card-details">
                      <span>
                        <i className="ph ph-buildings" /> {item.ward_name}
                      </span>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>
                        LOS: {los}
                      </span>
                    </div>

                    <div className="inpatient-card-footer">
                      <span style={{ color: '#475569' }}>
                        <i className="ph ph-user-md" /> {item.admitting_doctor_name}
                      </span>
                      <span className={`admission-priority-pill ${item.admission_type === 'ICU' || item.admission_type === 'HDU' ? 'EMERGENCY' : 'ROUTINE'}`}>
                        {item.admission_type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Centered Patient Inpatient Clinical Workspace Modal */}
      <InpatientPatientDetailModal
        open={detailModalOpen && Boolean(selectedAdmission)}
        onClose={() => setDetailModalOpen(false)}
        admission={selectedAdmission}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        calculateLOS={calculateLOS}
        loading={loading}
        errors={errors}
        recommendations={currentPatientRecommendations}
        bookings={currentPatientBookings}
        roundNotes={currentPatientRounds}
        vitals={currentPatientVitals}
        diagnosticOrders={currentPatientOrders}
        onOpenScheduleSurgery={() => {
          if (selectedAdmission) {
            setProcedureModalOpen(true);
          }
        }}
        onOpenAddRoundNote={() => setRoundModalOpen(true)}
        onOpenRecordVitals={() => setVitalsModalOpen(true)}
        onOpenAddOrder={() => setOrderModalOpen(true)}
        onSaveDischargeSummary={saveDischargeSummary}
        onFinalizeDischarge={finalizeDischarge}
        isDischarging={isDischarging}
      />

      {/* Modal: New Procedure Recommendation (Shared Surgery Modal) */}
      <NewProcedureRecommendationModal
        open={procedureModalOpen}
        onClose={() => setProcedureModalOpen(false)}
        branchId={branchId}
        departments={departments}
        doctors={doctors}
        services={procedureServices}
        initialContext={procedureInitialContext}
        onCreateSuccess={() => {
          void refreshAdmissions();
        }}
      />

      {/* Modal: Daily Doctor Round Note */}
      <Modal open={roundModalOpen} onClose={() => setRoundModalOpen(false)} title="Record Doctor Ward Round Note (SOAP)">
        <form onSubmit={handleAddRoundNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: '460px' }}>
          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Subjective (Patient symptoms & complaints)</span>
            <textarea
              value={roundSubjective}
              onChange={(e) => setRoundSubjective(e.target.value)}
              placeholder="Patient reports pain reduction, tolerating oral fluids, no nausea..."
              rows={2}
            />
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Objective (Physical examination & vitals)</span>
            <textarea
              value={roundObjective}
              onChange={(e) => setRoundObjective(e.target.value)}
              placeholder="Vitals stable, chest clear, surgical wound clean and dry, abdomen soft non-tender..."
              rows={2}
            />
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Assessment (Clinical evolution & status)</span>
            <textarea
              value={roundAssessment}
              onChange={(e) => setRoundAssessment(e.target.value)}
              placeholder="Day 2 post-op recovery progressing favorably without complications..."
              rows={2}
            />
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#2563eb' }}>Plan (Treatment, orders & next steps) *</span>
            <textarea
              value={roundPlan}
              onChange={(e) => setRoundPlan(e.target.value)}
              placeholder="Step down IV antibiotics to oral, encourage ambulation, recheck CBC in morning..."
              rows={2}
              required
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setRoundModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={pending.createRoundNote}>
              <i className="ph ph-check" /> Save Progress Note
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Bedside Vitals */}
      <Modal open={vitalsModalOpen} onClose={() => setVitalsModalOpen(false)} title="Record Inpatient Bedside Vitals">
        <form onSubmit={handleRecordVitals} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: '420px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>BP Systolic (mmHg) *</span>
              <input type="number" value={vitalBpSys} onChange={(e) => setVitalBpSys(e.target.value)} required />
            </label>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>BP Diastolic (mmHg) *</span>
              <input type="number" value={vitalBpDia} onChange={(e) => setVitalBpDia(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Heart Rate (bpm) *</span>
              <input type="number" value={vitalHr} onChange={(e) => setVitalHr(e.target.value)} required />
            </label>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Temperature (°C) *</span>
              <input type="number" step="0.1" value={vitalTemp} onChange={(e) => setVitalTemp(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>SpO2 (%) *</span>
              <input type="number" value={vitalSpo2} onChange={(e) => setVitalSpo2(e.target.value)} required />
            </label>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Resp Rate (/min)</span>
              <input type="number" value={vitalResp} onChange={(e) => setVitalResp(e.target.value)} />
            </label>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Pain (0-10)</span>
              <input type="number" min="0" max="10" value={vitalPain} onChange={(e) => setVitalPain(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setVitalsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={pending.createVital}>
              <i className="ph ph-heartbeat" /> Save Vitals Entry
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Diagnostic Order */}
      <Modal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} title="Place Inpatient Diagnostic Order">
        <form onSubmit={handleAddOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: '420px' }}>
          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Order Category *</span>
            <select value={orderType} onChange={(e) => { setOrderType(e.target.value as 'LAB' | 'IMAGING'); setOrderServiceId(''); setOrderSpecimenType(''); }}>
              <option value="LAB">Laboratory Investigation (CBC, Electrolytes, LFT, etc.)</option>
              <option value="IMAGING">Radiology & Imaging (X-Ray, Ultrasound, CT, MRI)</option>
            </select>
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Active Diagnostic Service *</span>
            <select value={orderServiceId} onChange={(e) => { const serviceId = e.target.value; setOrderServiceId(serviceId); const service = (orderType === 'LAB' ? laboratoryServices : imagingServices).find((item) => item.id === serviceId); setOrderSpecimenType(service?.sample_type ?? ''); }} required>
              <option value="">Select a service</option>
              {(orderType === 'LAB' ? laboratoryServices : imagingServices).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>

          {orderType === 'LAB' && <label className="adm-field"><span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Specimen Type *</span><input value={orderSpecimenType} onChange={(e) => setOrderSpecimenType(e.target.value)} placeholder="e.g. Blood, urine" required /></label>}

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Instructions / Frequency</span>
            <textarea
              value={orderInstructions}
              onChange={(e) => setOrderInstructions(e.target.value)}
              placeholder="Stat / Daily morning / Urgent pre-op clearance..."
              rows={2}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setOrderModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={pending.submitClinicalOrder}>
              <i className="ph ph-check" /> Place Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
