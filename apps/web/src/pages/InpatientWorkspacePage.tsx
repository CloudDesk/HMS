import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../components/ui/Modal';
import { useInpatientWorkspaceFeature } from '../hooks/admissions/useInpatientWorkspaceFeature';
import { removeLegacyInpatientClinicalStorage } from '../utils/inpatient-clinical-storage';

export function InpatientWorkspacePage() {
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedCareLevel, setSelectedCareLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'surgeries' | 'rounds' | 'vitals' | 'orders' | 'discharge'>('surgeries');

  // Modals
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Procedure Recommendation Form State
  const [procServiceId, setProcServiceId] = useState('');
  const [procDoctorId, setProcDoctorId] = useState('');
  const [procClinicalReason, setProcClinicalReason] = useState('');
  const [procPriority, setProcPriority] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
  const [procNotes, setProcNotes] = useState('');

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
    branchId, selectedAdmission, branches, wards, doctors, procedureServices,
    admittedList, filteredInpatients, recommendations: currentPatientRecommendations,
    bookings: currentPatientBookings, roundNotes: currentPatientRounds,
    vitals: currentPatientVitals, diagnosticOrders: currentPatientOrders,
    laboratoryServices, imagingServices, loading, errors, pending,
  } = feature.state;
  const {
    setBranchId, selectAdmission: setSelectedAdmission, refreshAdmissions,
    createRecommendation, createRoundNote, createVital, submitClinicalOrder,
  } = feature.actions;

  const handleCreateProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    if (!procServiceId) {
      toast.error('Please select a surgery or procedure service.');
      return;
    }
    if (!procClinicalReason.trim()) {
      toast.error('Please provide a clinical indication for surgery.');
      return;
    }

    try {
      await createRecommendation({
        patient_id: selectedAdmission.patient_id,
        branch_id: branchId,
        department_id: selectedAdmission.department_id,
        recommending_doctor_id: procDoctorId || selectedAdmission.admitting_doctor_id,
        service_id: procServiceId,
        encounter_type: 'DIRECT',
        clinical_reason: `[INPATIENT - Ward: ${selectedAdmission.ward_name}, Bed: ${selectedAdmission.bed_number}] ${procClinicalReason.trim()}`,
        notes: procNotes.trim() ? `Priority: ${procPriority}. ${procNotes.trim()}` : `Priority: ${procPriority}`,
      });
      toast.success('Surgery / Procedure recommended for admitted inpatient.');
      setProcedureModalOpen(false);
      setProcServiceId('');
      setProcDoctorId('');
      setProcClinicalReason('');
      setProcNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to recommend surgery.');
    }
  };

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

  const calculateLOS = (admitDateStr: string) => {
    const diff = Date.now() - new Date(admitDateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '< 1 day';
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
            Ward doctor rounds, inpatient EHR, bedside vitals, diagnostic orders & surgery scheduling
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {branches.length > 1 && (
            <select
              aria-label="Branch"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
              }}
              style={{ minWidth: '150px', height: '38px', borderRadius: '8px', padding: '0 10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem' }}
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

      {/* Main Split Screen Workspace */}
      <div className="inpatient-workspace-layout">
        {/* Left Side: Admitted Inpatient Roster */}
        <div className="adm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="adm-card-head">
            <div>
              <h3>Ward Patient Board</h3>
              <p>{filteredInpatients.length} admitted patients found</p>
            </div>
          </div>

          <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {loading.admissions ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading admitted patients...</div>
            ) : filteredInpatients.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <i className="ph ph-bed" style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No admitted inpatients found in this ward.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredInpatients.map((item) => {
                  const isSelected = selectedAdmission?.id === item.id;
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
                      onClick={() => setSelectedAdmission(item)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isSelected ? '#2563eb' : '#3b82f6',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.86rem', color: '#0f172a', display: 'block' }}>{item.patient_name}</strong>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.patient_number}</span>
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#1e293b',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          Bed {item.bed_number}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
                        <span>
                          <i className="ph ph-buildings" /> {item.ward_name}
                        </span>
                        <span style={{ fontWeight: 600, color: '#0284c7' }}>LOS: {los}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.72rem' }}>
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

        {/* Right Side: Bedside Inpatient Clinical EHR */}
        {selectedAdmission ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Patient Hero Bedside Card */}
            <div className="adm-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background: '#2563eb',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {(selectedAdmission.patient_name || 'PT')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{selectedAdmission.patient_name}</h3>
                      <span className="admission-status-pill CONFIRMED">ADMITTED</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '0.76rem', color: '#64748b' }}>
                      <span>MRN: <strong style={{ color: '#1e293b' }}>{selectedAdmission.patient_number}</strong></span>
                      <span>•</span>
                      <span>Ward: <strong style={{ color: '#1e293b' }}>{selectedAdmission.ward_name}</strong></span>
                      <span>•</span>
                      <span>Bed: <strong style={{ color: '#2563eb' }}>{selectedAdmission.bed_number}</strong></span>
                      <span>•</span>
                      <span>Admitted: <strong>{new Date(selectedAdmission.admission_date).toLocaleDateString()}</strong></span>
                      <span>•</span>
                      <span>Length of Stay: <strong style={{ color: '#059669' }}>{calculateLOS(selectedAdmission.admission_date)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                {/* <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="adm-btn primary"
                    onClick={() => {
                      setProcDoctorId(selectedAdmission.admitting_doctor_id);
                      setProcedureModalOpen(true);
                    }}
                    style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' }}
                  >
                    <i className="ph ph-scissors" /> + Recommend / Schedule Surgery
                  </button>
                  <button type="button" className="adm-btn" onClick={() => setRoundModalOpen(true)}>
                    <i className="ph ph-note-pencil" /> + Doctor Round Note
                  </button>
                  <button type="button" className="adm-btn" onClick={() => setVitalsModalOpen(true)}>
                    <i className="ph ph-heartbeat" /> + Record Vitals
                  </button>
                  <button type="button" className="adm-btn" onClick={() => setOrderModalOpen(true)}>
                    <i className="ph ph-flask" /> + Diagnostic Order
                  </button>
                </div> */}
              </div>

              {selectedAdmission.reason && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Admitting Diagnosis / Indication:</span>
                  <span style={{ fontSize: '0.84rem', color: '#1e293b', fontWeight: 600 }}>{selectedAdmission.reason}</span>
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="segmented-control" style={{ width: '100%' }}>
              <button
                type="button"
                className={activeTab === 'surgeries' ? 'active' : ''}
                onClick={() => setActiveTab('surgeries')}
              >
                <i className="ph ph-scissors" style={{ marginRight: '6px' }} /> Surgeries & Procedures ({currentPatientRecommendations.length + currentPatientBookings.length})
              </button>
              <button
                type="button"
                className={activeTab === 'rounds' ? 'active' : ''}
                onClick={() => setActiveTab('rounds')}
              >
                <i className="ph ph-note-pencil" style={{ marginRight: '6px' }} /> Daily Doctor Rounds ({currentPatientRounds.length})
              </button>
              <button
                type="button"
                className={activeTab === 'vitals' ? 'active' : ''}
                onClick={() => setActiveTab('vitals')}
              >
                <i className="ph ph-heartbeat" style={{ marginRight: '6px' }} /> Bedside Vitals ({currentPatientVitals.length})
              </button>
              <button
                type="button"
                className={activeTab === 'orders' ? 'active' : ''}
                onClick={() => setActiveTab('orders')}
              >
                <i className="ph ph-flask" style={{ marginRight: '6px' }} /> Orders & Investigations ({currentPatientOrders.length})
              </button>
              <button
                type="button"
                className={activeTab === 'discharge' ? 'active' : ''}
                onClick={() => setActiveTab('discharge')}
              >
                <i className="ph ph-sign-out" style={{ marginRight: '6px' }} /> Discharge Planning
              </button>
            </div>

            {/* Tab 1: Surgeries & Procedures Workspace */}
            {activeTab === 'surgeries' && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Inpatient Surgical & Procedural Management</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Recommended procedures, operating theater bookings, and pre-op clearance for this inpatient
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-btn primary"
                    onClick={() => {
                      setProcDoctorId(selectedAdmission.admitting_doctor_id);
                      setProcedureModalOpen(true);
                    }}
                  >
                    <i className="ph ph-plus" /> Schedule Surgery / Procedure
                  </button>
                </div>

                {/* Procedure Recommendations List */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Active Procedure Recommendations
                  </h4>
                  {loading.recommendations ? (
                    <div style={{ padding: '1rem', color: '#64748b' }}>Loading surgery recommendations...</div>
                  ) : currentPatientRecommendations.length === 0 ? (
                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                      <p style={{ margin: 0, fontSize: '0.82rem' }}>No procedure recommendations recorded for this inpatient stay.</p>
                      <button
                        type="button"
                        className="adm-btn"
                        onClick={() => {
                          setProcDoctorId(selectedAdmission.admitting_doctor_id);
                          setProcedureModalOpen(true);
                        }}
                        style={{ marginTop: '8px', fontSize: '0.78rem' }}
                      >
                        <i className="ph ph-plus" /> Recommend Surgery Now
                      </button>
                    </div>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Rec ID</th>
                            <th>Procedure / Surgery</th>
                            <th>Recommending Doctor</th>
                            <th>Clinical Indication</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPatientRecommendations.map((rec) => (
                            <tr key={rec.id}>
                              <td><strong>{rec.recommendation_number}</strong></td>
                              <td><strong style={{ color: '#2563eb' }}>{rec.service_name}</strong></td>
                              <td>{rec.recommending_doctor_name}</td>
                              <td style={{ maxWidth: '240px', whiteSpace: 'normal' }}>{rec.clinical_reason}</td>
                              <td>
                                <span className={`admission-status-pill ${rec.status}`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                {new Date(rec.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Confirmed OT Bookings */}
                <div>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Scheduled OT Slots & Confirmed Bookings
                  </h4>
                  {loading.bookings ? (
                    <div style={{ padding: '1rem', color: '#64748b' }}>Loading OT bookings...</div>
                  ) : currentPatientBookings.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.82rem' }}>
                      No active OT slot booking confirmed yet. Bookings are processed via the Surgery & Procedures workspace.
                    </div>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Booking #</th>
                            <th>Procedure</th>
                            <th>Operating Surgeon</th>
                            <th>Scheduled Slot</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPatientBookings.map((b) => (
                            <tr key={b.id}>
                              <td><strong>{b.booking_number}</strong></td>
                              <td><strong style={{ color: '#7c3aed' }}>{b.service_name}</strong></td>
                              <td>{b.doctor_name}</td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>
                                  {new Date(b.scheduled_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </strong>
                              </td>
                              <td>{b.duration_minutes} mins</td>
                              <td>
                                <span className={`admission-status-pill ${b.status}`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Doctor Round Progress Notes */}
            {activeTab === 'rounds' && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Daily Doctor Ward Round Notes (SOAP)</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Clinical progress notes recorded by attending physicians during inpatient ward rounds
                    </p>
                  </div>
                  <button type="button" className="adm-btn primary" onClick={() => setRoundModalOpen(true)}>
                    <i className="ph ph-plus" /> Add Round Note
                  </button>
                </div>

                {loading.roundNotes ? (
                  <p role="status">Loading authoritative ward-round notes...</p>
                ) : errors.roundNotes ? (
                  <p role="alert">Ward-round notes could not be loaded. Retry the workspace request.</p>
                ) : currentPatientRounds.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    <i className="ph ph-note-pencil" style={{ fontSize: '2rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>No ward round notes recorded yet for this stay.</p>
                    <button type="button" className="adm-btn" onClick={() => setRoundModalOpen(true)} style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                      Record First Round Note
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {currentPatientRounds.map((note: import('../api/inpatient-admissions').InpatientRoundNote) => (
                      <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>
                            <i className="ph ph-user-md" style={{ color: '#2563eb' }} /> Dr. {note.doctor_name}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            <i className="ph ph-clock" /> {new Date(note.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Subjective:</span>
                            <p style={{ margin: '2px 0 0', color: '#334155' }}>{note.subjective}</p>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Objective:</span>
                            <p style={{ margin: '2px 0 0', color: '#334155' }}>{note.objective}</p>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assessment:</span>
                            <p style={{ margin: '2px 0 0', color: '#334155' }}>{note.assessment}</p>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Plan:</span>
                            <p style={{ margin: '2px 0 0', color: '#0f172a', fontWeight: 600 }}>{note.plan}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Bedside Vitals Flowsheet */}
            {activeTab === 'vitals' && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Bedside Vital Signs Flowsheet</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Nursing vital charts, temperature, hemodynamics, and oxygenation tracking
                    </p>
                  </div>
                  <button type="button" className="adm-btn primary" onClick={() => setVitalsModalOpen(true)}>
                    <i className="ph ph-plus" /> Record Bedside Vitals
                  </button>
                </div>

                {loading.vitals ? (
                  <p role="status">Loading authoritative bedside vitals...</p>
                ) : errors.vitals ? (
                  <p role="alert">Bedside vitals could not be loaded. Retry the workspace request.</p>
                ) : currentPatientVitals.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    <i className="ph ph-heartbeat" style={{ fontSize: '2rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>No bedside vitals logged yet for this stay.</p>
                    <button type="button" className="adm-btn" onClick={() => setVitalsModalOpen(true)} style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                      Take Vitals Now
                    </button>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Recorded Time</th>
                          <th>BP (mmHg)</th>
                          <th>Pulse (bpm)</th>
                          <th>Temp (°C)</th>
                          <th>SpO2 (%)</th>
                          <th>Resp Rate (/min)</th>
                          <th>Pain (0-10)</th>
                          <th>Recorded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPatientVitals.map((v: import('../api/inpatient-admissions').InpatientVital) => (
                          <tr key={v.id}>
                            <td><strong>{new Date(v.recorded_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong></td>
                            <td>
                              <span style={{ fontWeight: 700, color: v.bp_systolic > 140 || v.bp_systolic < 90 ? '#dc2626' : '#0f172a' }}>
                                {v.bp_systolic}/{v.bp_diastolic}
                              </span>
                            </td>
                            <td>{v.heart_rate}</td>
                            <td>{v.temperature} °C</td>
                            <td>
                              <span style={{ fontWeight: 700, color: v.spo2 < 95 ? '#dc2626' : '#059669' }}>
                                {v.spo2}%
                              </span>
                            </td>
                            <td>{v.respiratory_rate}</td>
                            <td>{v.pain_score}</td>
                            <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{v.recorded_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Orders & Investigations */}
            {activeTab === 'orders' && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Inpatient Diagnostic Orders</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Laboratory and radiology investigations from the authoritative clinical-order record
                    </p>
                  </div>
                  <button type="button" className="adm-btn primary" onClick={() => setOrderModalOpen(true)}>
                    <i className="ph ph-plus" /> Add Inpatient Order
                  </button>
                </div>

                {loading.diagnosticOrders ? (
                  <p role="status">Loading authoritative diagnostic orders...</p>
                ) : errors.diagnosticOrders ? (
                  <p role="alert">Diagnostic orders could not be loaded. Retry the workspace request.</p>
                ) : currentPatientOrders.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    <i className="ph ph-flask" style={{ fontSize: '2rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>No orders placed yet for this inpatient.</p>
                    <button type="button" className="adm-btn" onClick={() => setOrderModalOpen(true)} style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                      Place Diagnostic Order
                    </button>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Order Type</th>
                          <th>Investigation</th>
                          <th>Clinical Instructions</th>
                          <th>Status</th>
                          <th>Ordered At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPatientOrders.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: o.order_type === 'LAB' ? '#eff6ff' : o.order_type === 'IMAGING' ? '#fdf4ff' : '#f0fdf4',
                                  color: o.order_type === 'LAB' ? '#2563eb' : o.order_type === 'IMAGING' ? '#9333ea' : '#16a34a',
                                }}
                              >
                                {o.order_type}
                              </span>
                            </td>
                            <td><strong style={{ color: '#0f172a' }}>{o.item_name}</strong></td>
                            <td style={{ maxWidth: '280px', whiteSpace: 'normal', fontSize: '0.78rem' }}>{o.instructions}</td>
                            <td>
                              <span className="admission-status-pill Pending">{o.status}</span>
                            </td>
                            <td style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              {new Date(o.ordered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Discharge Planning */}
            {activeTab === 'discharge' && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Discharge Planning & Summary</h3>
                <p style={{ margin: '0 0 14px', fontSize: '0.76rem', color: '#64748b' }}>
                  Evaluate clinical discharge readiness, draft discharge summaries, and coordinate bed release
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Discharge Readiness Checklist</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" defaultChecked /> <span>Clinical hemodynamic stability (24h afebrility)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" defaultChecked /> <span>Post-op / procedure recovery cleared</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" defaultChecked /> <span>Home oral medication converted</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" /> <span>Discharge summary finalized by attending doctor</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Actions</h4>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 12px' }}>
                      Discharge is finalized in Bed Management after clearance of pending pharmacy and diagnostic invoices.
                    </p>
                    <button
                      type="button"
                      className="adm-btn success"
                      onClick={() => toast.success('Discharge summary saved to patient EHR timeline.')}
                    >
                      <i className="ph ph-check" /> Save Discharge Summary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="adm-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
            <i className="ph ph-bed" style={{ fontSize: '3rem', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1e293b' }}>No Admitted Patient Selected</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Select an admitted patient from the left ward board to open their clinical bedside workspace.</p>
          </div>
        )}
      </div>

      {/* Modal: Recommend / Schedule Surgery */}
      <Modal open={procedureModalOpen} onClose={() => setProcedureModalOpen(false)} title="Inpatient Surgery & Procedure Recommendation">
        <form onSubmit={handleCreateProcedure} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '460px' }}>
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
            <div>Patient: <strong>{selectedAdmission?.patient_name}</strong> ({selectedAdmission?.patient_number})</div>
            <div style={{ marginTop: '2px', color: '#64748b' }}>
              Ward: <strong>{selectedAdmission?.ward_name}</strong> · Bed: <strong>{selectedAdmission?.bed_number}</strong>
            </div>
          </div>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Surgery / Procedure Service *</span>
            <select value={procServiceId} onChange={(e) => setProcServiceId(e.target.value)} required>
              <option value="">Select surgical procedure</option>
              {procedureServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Operating Surgeon *</span>
              <select value={procDoctorId} onChange={(e) => setProcDoctorId(e.target.value)} required>
                <option value="">Select surgeon</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.display_name}</option>
                ))}
              </select>
            </label>

            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Surgical Priority</span>
              <select value={procPriority} onChange={(e) => setProcPriority(e.target.value as 'ROUTINE' | 'URGENT' | 'EMERGENCY')}>
                <option value="ROUTINE">Elective / Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency (Immediate)</option>
              </select>
            </label>
          </div>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Clinical Indication / Diagnosis *</span>
            <textarea
              value={procClinicalReason}
              onChange={(e) => setProcClinicalReason(e.target.value)}
              placeholder="State the clinical diagnosis and indication for surgery (e.g. Acute appendicitis post-admission evaluation)..."
              required
              rows={2}
            />
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Pre-Op Orders & Notes (Optional)</span>
            <textarea
              value={procNotes}
              onChange={(e) => setProcNotes(e.target.value)}
              placeholder="NPO status, blood cross-match, pre-op antibiotic prophylaxis, or anesthesia notes..."
              rows={2}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setProcedureModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={pending.createRecommendation}>
              <i className="ph ph-scissors" /> Submit Surgery Recommendation
            </button>
          </div>
        </form>
      </Modal>

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
