import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { branchesApi } from '../api/branches';
import { doctorsApi } from '../api/doctors';
import { inpatientAdmissionsApi, InpatientAdmission } from '../api/inpatient-admissions';
import { admissionsConfigurationApi, Ward } from '../api/admissions-configuration';
import { surgeryApi } from '../api/surgery';
import { servicesApi, ServiceResponse } from '../api/services';
import { Modal } from '../components/ui/Modal';
import { useAppLocation } from '../routing/navigation';

type RoundNote = {
  id: string;
  admission_id: string;
  doctor_name: string;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type BedsideVital = {
  id: string;
  admission_id: string;
  recorded_at: string;
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature: number;
  spo2: number;
  respiratory_rate: number;
  pain_score: number;
  recorded_by: string;
};

type InpatientOrder = {
  id: string;
  admission_id: string;
  order_type: 'LAB' | 'IMAGING' | 'MEDICATION';
  item_name: string;
  instructions: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  ordered_at: string;
};

export function InpatientWorkspacePage() {
  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState(handoff.get('branch_id') ?? '');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedCareLevel, setSelectedCareLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<InpatientAdmission | null>(null);
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
  const [orderType, setOrderType] = useState<'LAB' | 'IMAGING' | 'MEDICATION'>('LAB');
  const [orderItemName, setOrderItemName] = useState('');
  const [orderInstructions, setOrderInstructions] = useState('');

  // Inpatient mock clinical state stores (persisted per admission in local storage for demonstration)
  const [roundNotes, setRoundNotes] = useState<RoundNote[]>(() => {
    try {
      const saved = localStorage.getItem('hms_inpatient_round_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [vitalsList, setVitalsList] = useState<BedsideVital[]>(() => {
    try {
      const saved = localStorage.getItem('hms_inpatient_vitals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [ordersList, setOrdersList] = useState<InpatientOrder[]>(() => {
    try {
      const saved = localStorage.getItem('hms_inpatient_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRoundNotes = (notes: RoundNote[]) => {
    setRoundNotes(notes);
    localStorage.setItem('hms_inpatient_round_notes', JSON.stringify(notes));
  };

  const saveVitals = (vitals: BedsideVital[]) => {
    setVitalsList(vitals);
    localStorage.setItem('hms_inpatient_vitals', JSON.stringify(vitals));
  };

  const saveOrders = (orders: InpatientOrder[]) => {
    setOrdersList(orders);
    localStorage.setItem('hms_inpatient_orders', JSON.stringify(orders));
  };

  // Queries
  const branchesQuery = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: () => branchesApi.list(),
  });

  useEffect(() => {
    const first = branchesQuery.data?.data[0]?.id;
    if (!branchId && first) setBranchId(first);
  }, [branchId, branchesQuery.data]);

  const wardsQuery = useQuery({
    queryKey: ['wards', branchId],
    queryFn: () => admissionsConfigurationApi.wards({ branch_id: branchId }),
    enabled: Boolean(branchId),
  });

  const doctorsQuery = useQuery({
    queryKey: ['doctors', branchId],
    queryFn: () => doctorsApi.list({ branch_id: branchId }),
    enabled: Boolean(branchId),
  });

  const servicesQuery = useQuery({
    queryKey: ['services', 'procedures'],
    queryFn: () => servicesApi.list({ service_type: 'PROCEDURE' }),
  });

  const admissionsQuery = useQuery({
    queryKey: ['inpatient-admissions', branchId],
    queryFn: () => inpatientAdmissionsApi.list({ branch_id: branchId, status: 'ADMITTED' }),
    enabled: Boolean(branchId),
  });

  // Query patient surgery recommendations for selected patient
  const patientRecommendationsQuery = useQuery({
    queryKey: ['surgery-recommendations', branchId, selectedAdmission?.patient_id],
    queryFn: () => surgeryApi.recommendations({ branch_id: branchId, patient_id: selectedAdmission?.patient_id }),
    enabled: Boolean(branchId) && Boolean(selectedAdmission?.patient_id),
  });

  // Query patient surgery bookings for selected patient
  const patientBookingsQuery = useQuery({
    queryKey: ['surgery-bookings', branchId, selectedAdmission?.patient_id],
    queryFn: () => surgeryApi.bookings({ branch_id: branchId, patient_id: selectedAdmission?.patient_id }),
    enabled: Boolean(branchId) && Boolean(selectedAdmission?.patient_id),
  });

  const admittedList = admissionsQuery.data?.data ?? [];

  // Filtered Inpatients
  const filteredInpatients = useMemo(() => {
    return admittedList.filter((item) => {
      if (selectedWard && item.ward_id !== selectedWard) return false;
      if (selectedCareLevel && item.admission_type !== selectedCareLevel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPatient = item.patient_name?.toLowerCase().includes(q);
        const matchesMrn = item.patient_number?.toLowerCase().includes(q);
        const matchesBed = item.bed_number?.toLowerCase().includes(q);
        const matchesDoc = item.admitting_doctor_name?.toLowerCase().includes(q);
        if (!matchesPatient && !matchesMrn && !matchesBed && !matchesDoc) return false;
      }
      return true;
    });
  }, [admittedList, selectedWard, selectedCareLevel, searchQuery]);

  // Auto-select first inpatient if none selected
  useEffect(() => {
    if (!selectedAdmission && filteredInpatients.length > 0) {
      setSelectedAdmission(filteredInpatients[0] ?? null);
    }
  }, [filteredInpatients, selectedAdmission]);

  // Create Surgery Recommendation Mutation
  const createRecommendationMutation = useMutation({
    mutationFn: (payload: {
      patient_id: string;
      branch_id: string;
      department_id: string;
      recommending_doctor_id: string;
      service_id: string;
      encounter_type: 'DIRECT';
      clinical_reason: string;
      notes?: string | null;
    }) => surgeryApi.createRecommendation(payload),
    onSuccess: () => {
      toast.success('Surgery / Procedure recommended for admitted inpatient.');
      queryClient.invalidateQueries({ queryKey: ['surgery-recommendations'] });
      setProcedureModalOpen(false);
      setProcServiceId('');
      setProcDoctorId('');
      setProcClinicalReason('');
      setProcNotes('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to recommend surgery.');
    },
  });

  const handleCreateProcedure = (e: React.FormEvent) => {
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

    createRecommendationMutation.mutate({
      patient_id: selectedAdmission.patient_id,
      branch_id: branchId,
      department_id: selectedAdmission.department_id,
      recommending_doctor_id: procDoctorId || selectedAdmission.admitting_doctor_id,
      service_id: procServiceId,
      encounter_type: 'DIRECT',
      clinical_reason: `[INPATIENT - Ward: ${selectedAdmission.ward_name}, Bed: ${selectedAdmission.bed_number}] ${procClinicalReason.trim()}`,
      notes: procNotes.trim() ? `Priority: ${procPriority}. ${procNotes.trim()}` : `Priority: ${procPriority}`,
    });
  };

  const handleAddRoundNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    if (!roundSubjective.trim() && !roundObjective.trim() && !roundAssessment.trim() && !roundPlan.trim()) {
      toast.error('Please enter clinical round findings or plan.');
      return;
    }

    const newNote: RoundNote = {
      id: 'NOTE-' + Date.now(),
      admission_id: selectedAdmission.id,
      doctor_name: selectedAdmission.admitting_doctor_name,
      date: new Date().toISOString(),
      subjective: roundSubjective.trim() || 'Patient reports stable comfort without acute distress.',
      objective: roundObjective.trim() || 'Vitals stable. Bedside physical examination within expected post-admission limits.',
      assessment: roundAssessment.trim() || selectedAdmission.reason || 'Ongoing inpatient management.',
      plan: roundPlan.trim() || 'Continue current inpatient medication and nursing observation protocol.',
    };

    saveRoundNotes([newNote, ...roundNotes]);
    toast.success('Ward round progress note recorded.');
    setRoundModalOpen(false);
    setRoundSubjective('');
    setRoundObjective('');
    setRoundAssessment('');
    setRoundPlan('');
  };

  const handleRecordVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;

    const newVital: BedsideVital = {
      id: 'VIT-' + Date.now(),
      admission_id: selectedAdmission.id,
      recorded_at: new Date().toISOString(),
      bp_systolic: Number(vitalBpSys) || 120,
      bp_diastolic: Number(vitalBpDia) || 80,
      heart_rate: Number(vitalHr) || 72,
      temperature: Number(vitalTemp) || 36.8,
      spo2: Number(vitalSpo2) || 98,
      respiratory_rate: Number(vitalResp) || 16,
      pain_score: Number(vitalPain) || 0,
      recorded_by: 'Staff Nurse on Duty',
    };

    saveVitals([newVital, ...vitalsList]);
    toast.success('Bedside vital signs recorded.');
    setVitalsModalOpen(false);
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    if (!orderItemName.trim()) {
      toast.error('Please enter the investigation or medication name.');
      return;
    }

    const newOrder: InpatientOrder = {
      id: 'ORD-' + Date.now(),
      admission_id: selectedAdmission.id,
      order_type: orderType,
      item_name: orderItemName.trim(),
      instructions: orderInstructions.trim() || 'Routine inpatient order',
      status: 'PENDING',
      ordered_at: new Date().toISOString(),
    };

    saveOrders([newOrder, ...ordersList]);
    toast.success(`${orderType} order placed for admitted patient.`);
    setOrderModalOpen(false);
    setOrderItemName('');
    setOrderInstructions('');
  };

  // Active patient filtered clinical data
  const currentPatientRounds = useMemo(() => {
    if (!selectedAdmission) return [];
    return roundNotes.filter((n) => n.admission_id === selectedAdmission.id);
  }, [roundNotes, selectedAdmission]);

  const currentPatientVitals = useMemo(() => {
    if (!selectedAdmission) return [];
    return vitalsList.filter((v) => v.admission_id === selectedAdmission.id);
  }, [vitalsList, selectedAdmission]);

  const currentPatientOrders = useMemo(() => {
    if (!selectedAdmission) return [];
    return ordersList.filter((o) => o.admission_id === selectedAdmission.id);
  }, [ordersList, selectedAdmission]);

  const currentPatientRecommendations = patientRecommendationsQuery.data?.data ?? [];
  const currentPatientBookings = patientBookingsQuery.data?.data ?? [];

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
          {branchesQuery.data?.data && branchesQuery.data.data.length > 1 && (
            <select
              aria-label="Branch"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelectedAdmission(null);
              }}
              style={{ minWidth: '150px', height: '38px', borderRadius: '8px', padding: '0 10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem' }}
            >
              {branchesQuery.data.data.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            className="btn-secondary"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['inpatient-admissions'] })}
            type="button"
            style={{ height: '38px' }}
          >
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
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
      <div className="adm-filters" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="adm-field">
          <label>Ward Filter</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="">All Wards</option>
            {(wardsQuery.data?.data ?? []).map((w: Ward) => (
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

        <div className="adm-field" style={{ gridColumn: 'span 2' }}>
          <label>Search Admitted Patients</label>
          <input
            placeholder="Search by Patient Name, MRN, Bed #, or Doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Split Screen Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Side: Admitted Inpatient Roster */}
        <div className="adm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="adm-card-head">
            <div>
              <h3>Ward Patient Board</h3>
              <p>{filteredInpatients.length} admitted patients found</p>
            </div>
          </div>

          <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {admissionsQuery.isLoading ? (
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
                  {patientRecommendationsQuery.isLoading ? (
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
                  {patientBookingsQuery.isLoading ? (
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

                {currentPatientRounds.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    <i className="ph ph-note-pencil" style={{ fontSize: '2rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>No ward round notes recorded yet for this stay.</p>
                    <button type="button" className="adm-btn" onClick={() => setRoundModalOpen(true)} style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                      Record First Round Note
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {currentPatientRounds.map((note) => (
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

                {currentPatientVitals.length === 0 ? (
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
                        {currentPatientVitals.map((v) => (
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
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Inpatient Diagnostic Orders & Medications</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Laboratory, Radiology, and Inpatient medication administration orders
                    </p>
                  </div>
                  <button type="button" className="adm-btn primary" onClick={() => setOrderModalOpen(true)}>
                    <i className="ph ph-plus" /> Add Inpatient Order
                  </button>
                </div>

                {currentPatientOrders.length === 0 ? (
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
                          <th>Test / Medication</th>
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
              {(servicesQuery.data?.data ?? []).map((s: ServiceResponse) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Operating Surgeon *</span>
              <select value={procDoctorId} onChange={(e) => setProcDoctorId(e.target.value)} required>
                <option value="">Select surgeon</option>
                {(doctorsQuery.data?.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.display_name}</option>
                ))}
              </select>
            </label>

            <label className="adm-field">
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>Surgical Priority</span>
              <select value={procPriority} onChange={(e) => setProcPriority(e.target.value as any)}>
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
            <button className="btn-primary" type="submit" disabled={createRecommendationMutation.isPending}>
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
            <button className="btn-primary" type="submit">
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
            <button className="btn-primary" type="submit">
              <i className="ph ph-heartbeat" /> Save Vitals Entry
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Diagnostic Order */}
      <Modal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} title="Place Inpatient Diagnostic / Medication Order">
        <form onSubmit={handleAddOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: '420px' }}>
          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Order Category *</span>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value as any)}>
              <option value="LAB">Laboratory Investigation (CBC, Electrolytes, LFT, etc.)</option>
              <option value="IMAGING">Radiology & Imaging (X-Ray, Ultrasound, CT, MRI)</option>
              <option value="MEDICATION">Inpatient Medication / IV Infusion</option>
            </select>
          </label>

          <label className="adm-field">
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Investigation / Medicine Name *</span>
            <input
              value={orderItemName}
              onChange={(e) => setOrderItemName(e.target.value)}
              placeholder="e.g. Full Blood Count / Chest X-Ray / IV Paracetamol 1g..."
              required
            />
          </label>

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
            <button className="btn-primary" type="submit">
              <i className="ph ph-check" /> Place Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
