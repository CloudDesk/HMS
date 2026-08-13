import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  opdApi,
  type ApiClinicalOrderPriority,
  type ApiClinicalOrderType,
  type ApiOpdFollowUpReminderType,
  type ApiOpdFollowUpType,
  type ApiOpdReferralPriority,
  type ApiOpdReferralType,
  type ApiOpdVisitStatus,
  type CreateOpdVitalsPayload,
  type OpdConsultationResponse,
  type OpdClinicalOrderResponse,
  type OpdFollowUpResponse,
  type OpdPrescriptionResponse,
  type OpdReferralResponse,
  type OpdVisitResponse,
  type OpdVitalsResponse,
  type SaveOpdConsultationPayload,
  type SaveOpdClinicalOrderPayload,
  type SaveOpdFollowUpPayload,
  type SaveOpdPrescriptionPayload,
  type SaveOpdReferralPayload,
} from '../api/opd';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatVisitDateTime,
  getOpdErrorMessage,
  opdVisitPriorityLabels,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitPriorityClass,
  visitStatusClass,
} from './opd-utils';

type VisitAction = {
  icon: string;
  label: string;
  notes: string;
  status: ApiOpdVisitStatus;
  tone: 'default' | 'primary' | 'danger';
};

type VitalsFormState = {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  weight_kg: string;
  height_cm: string;
  temperature_c: string;
  pulse_bpm: string;
  respiratory_rate_per_min: string;
  oxygen_saturation_percent: string;
  notes: string;
};

type ConsultationFormState = {
  chief_complaint: string;
  history_present_illness: string;
  past_history: string;
  family_history: string;
  allergies: string;
  physical_examination: string;
  assessment: string;
  treatment_plan: string;
  doctor_notes: string;
};

type MedicationFormState = {
  medicine_name: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

type PrescriptionItemFormState = MedicationFormState & { local_id: string };

type PrescriptionFormState = {
  items: PrescriptionItemFormState[];
  follow_up_date: string;
  doctor_instructions: string;
  patient_instructions: string;
};

type ClinicalOrderItemFormState = {
  local_id: string;
  investigation_name: string;
  category: string;
};

type ClinicalOrderFormState = {
  priority: ApiClinicalOrderPriority;
  destination: string;
  specimen_type: string;
  investigation_name: string;
  category: string;
  items: ClinicalOrderItemFormState[];
  clinical_notes: string;
  instructions: string;
};

type FollowUpFormState = {
  follow_up_type: ApiOpdFollowUpType;
  next_visit_date: string;
  start_time: string;
  duration_minutes: string;
  assigned_doctor_id: string;
  reason: string;
  reminder_type: ApiOpdFollowUpReminderType;
  notes: string;
};

type ReferralFormState = {
  referral_type: ApiOpdReferralType;
  specialty: string;
  priority: ApiOpdReferralPriority;
  facility: string;
  referred_doctor_id: string;
  referred_doctor_name: string;
  reason: string;
  clinical_summary: string;
  create_appointment: boolean;
  appointment_date: string;
  appointment_start_time: string;
  appointment_duration_minutes: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
};

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
  { id: '8', label: '8 Notes', name: 'Notes' },
  { id: '9', label: '9 Documents', name: 'Documents' },
] as const;

const actionForStatus = (visit: OpdVisitResponse, consultationCompleted: boolean): VisitAction[] => {
  if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED' || visit.status === 'NO_SHOW') {
    return [];
  }

  if (visit.status === 'CHECKED_IN') {
    return [
      {
        icon: 'ph-activity',
        label: 'Send to Vitals',
        notes: 'Patient moved from check-in to vitals.',
        status: 'WAITING_FOR_VITALS',
        tone: 'default',
      },
      {
        icon: 'ph-user-minus',
        label: 'Mark No Show',
        notes: 'Patient did not appear for OPD visit after check-in.',
        status: 'NO_SHOW',
        tone: 'danger',
      },
    ];
  }

  if (visit.status === 'WAITING_FOR_VITALS') return [];
  if (visit.status === 'READY_FOR_CONSULTATION') {
    return [
      {
        icon: 'ph-stethoscope',
        label: 'Start Consultation',
        notes: 'Doctor consultation started from OPD visit workspace.',
        status: 'IN_CONSULTATION',
        tone: 'primary',
      },
      {
        icon: 'ph-user-minus',
        label: 'Mark No Show',
        notes: 'Patient did not appear for OPD visit after check-in.',
        status: 'NO_SHOW',
        tone: 'danger',
      },
    ];
  }

  if (visit.status === 'IN_CONSULTATION' && consultationCompleted) {
    return [
      {
        icon: 'ph-check-circle',
        label: 'Complete Visit',
        notes: 'Clinical consultation completed and OPD visit closed.',
        status: 'COMPLETED',
        tone: 'primary',
      },
    ];
  }

  return [];
};

const emptyVitalsForm: VitalsFormState = {
  blood_pressure_systolic: '128',
  blood_pressure_diastolic: '82',
  weight_kg: '70',
  height_cm: '168',
  temperature_c: '36.8',
  pulse_bpm: '76',
  respiratory_rate_per_min: '18',
  oxygen_saturation_percent: '98',
  notes: '',
};

const emptyConsultationForm: ConsultationFormState = {
  allergies: 'Penicillin',
  assessment: 'Hypertension under routine management. Patient reports mild evening headaches.',
  chief_complaint: 'Routine Outpatient Follow-up & General Health Check',
  doctor_notes: 'Patient advised on dietary sodium reduction and regular exercise.',
  family_history: 'Father had type 2 diabetes.',
  history_present_illness: 'Patient states mild headache over the past 3 days. No visual disturbances.',
  past_history: 'Essential hypertension diagnosed 2 years ago.',
  physical_examination: 'General appearance well. Chest clear, heart sounds S1 S2 present, no murmurs.',
  treatment_plan: 'Continue Amlodipine 5mg daily. Monitor blood pressure twice weekly.',
};

const emptyMedicationForm: MedicationFormState = {
  medicine_name: '',
  strength: '',
  dosage: '1 tablet',
  route: 'Oral',
  frequency: 'OD',
  duration: '30 days',
  quantity: '30',
  instructions: 'Take in the morning with water',
};

const emptyPrescriptionForm: PrescriptionFormState = {
  items: [
    {
      local_id: 'init-med-1',
      medicine_name: 'Amlodipine',
      strength: '5 mg',
      dosage: '1 tablet',
      route: 'Oral',
      frequency: 'OD',
      duration: '30 days',
      quantity: '30',
      instructions: 'Take after breakfast',
    },
  ],
  follow_up_date: '',
  doctor_instructions: 'Maintain low salt diet and return if blood pressure exceeds 140/90.',
  patient_instructions: 'Take medications regularly at the same time every day.',
};

const emptyClinicalOrderForm = (): ClinicalOrderFormState => ({
  priority: 'ROUTINE',
  destination: '',
  specimen_type: 'Blood',
  investigation_name: '',
  category: 'Routine Hematology',
  items: [],
  clinical_notes: '',
  instructions: '',
});

const emptyFollowUpForm: FollowUpFormState = {
  follow_up_type: 'CLINICAL_REVIEW',
  next_visit_date: '',
  start_time: '10:00',
  duration_minutes: '30',
  assigned_doctor_id: '',
  reason: 'Routine 4-week clinical review and blood pressure check',
  reminder_type: 'SMS',
  notes: 'Schedule morning appointment prior to medication intake.',
};

const emptyReferralForm: ReferralFormState = {
  referral_type: 'INTERNAL',
  specialty: 'Cardiology',
  priority: 'ROUTINE',
  facility: 'Main Hospital',
  referred_doctor_id: '',
  referred_doctor_name: '',
  reason: 'Cardiovascular assessment and ECG review',
  clinical_summary: 'Patient with mild headaches and controlled blood pressure requested specialist review.',
  create_appointment: false,
  appointment_date: '',
  appointment_start_time: '11:00',
  appointment_duration_minutes: '30',
};

const defaultDocuments: DocumentRecord[] = [
  {
    id: 'doc-1',
    name: 'Lab Results - July',
    type: 'Lab Report',
    date: '20 Jul 2026',
    size: '1.2 MB',
  },
  {
    id: 'doc-2',
    name: 'Patient ID Copy',
    type: 'Identification',
    date: '15 May 2024',
    size: '450 KB',
  },
];

const consultationFormFromRecord = (consultation: OpdConsultationResponse | null): ConsultationFormState => ({
  allergies: consultation?.allergies ?? emptyConsultationForm.allergies,
  assessment: consultation?.assessment ?? emptyConsultationForm.assessment,
  chief_complaint: consultation?.chief_complaint ?? emptyConsultationForm.chief_complaint,
  doctor_notes: consultation?.doctor_notes ?? emptyConsultationForm.doctor_notes,
  family_history: consultation?.family_history ?? emptyConsultationForm.family_history,
  history_present_illness: consultation?.history_present_illness ?? emptyConsultationForm.history_present_illness,
  past_history: consultation?.past_history ?? emptyConsultationForm.past_history,
  physical_examination: consultation?.physical_examination ?? emptyConsultationForm.physical_examination,
  treatment_plan: consultation?.treatment_plan ?? emptyConsultationForm.treatment_plan,
});

const optionalNumber = (value: string) => {
  if (!value.trim()) return null;
  return Number(value);
};

const requiredNumber = (value: string) => Number(value);

export function OpdVisitPage() {
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';

  // Active visit and selection state
  const [activeVisitId, setActiveVisitId] = useState(visitIdParam);
  const [recentVisits, setRecentVisits] = useState<OpdVisitResponse[]>([]);
  const [visit, setVisit] = useState<OpdVisitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState('');

  // Active Workspace Tab state (1 Consultation to 9 Documents)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabMatch = WORKSPACE_TABS.find(
      (t) =>
        t.name.toLowerCase() === initialTabParam.toLowerCase() ||
        t.id === initialTabParam ||
        t.label.toLowerCase().includes(initialTabParam.toLowerCase()),
    );
    return tabMatch ? tabMatch.name : 'Consultation';
  });

  // Clinical forms & records state
  const [latestVitals, setLatestVitals] = useState<OpdVitalsResponse | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<OpdVitalsResponse[]>([]);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormState>(emptyVitalsForm);
  const [vitalsError, setVitalsError] = useState('');

  const [consultation, setConsultation] = useState<OpdConsultationResponse | null>(null);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(emptyConsultationForm);
  const [consultationError, setConsultationError] = useState('');

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('Essential (primary) hypertension [I10]');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('Tension headache [G44.2]');

  const [prescription, setPrescription] = useState<OpdPrescriptionResponse | null>(null);
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(emptyPrescriptionForm);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(emptyMedicationForm);
  const [prescriptionError, setPrescriptionError] = useState('');

  const [activeOrderType, setActiveOrderType] = useState<ApiClinicalOrderType>('LABORATORY');
  const [clinicalOrders, setClinicalOrders] = useState<Record<ApiClinicalOrderType, OpdClinicalOrderResponse | null>>({
    LABORATORY: null,
    IMAGING: null,
  });
  const [clinicalOrderForms, setClinicalOrderForms] = useState<Record<ApiClinicalOrderType, ClinicalOrderFormState>>({
    LABORATORY: emptyClinicalOrderForm(),
    IMAGING: emptyClinicalOrderForm(),
  });
  const [clinicalOrderError, setClinicalOrderError] = useState('');

  const [activeOutcomeType, setActiveOutcomeType] = useState<'FOLLOW_UP' | 'REFERRAL'>('FOLLOW_UP');
  const [followUp, setFollowUp] = useState<OpdFollowUpResponse | null>(null);
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormState>(emptyFollowUpForm);
  const [referral, setReferral] = useState<OpdReferralResponse | null>(null);
  const [referralForm, setReferralForm] = useState<ReferralFormState>(emptyReferralForm);
  const [outcomeError, setOutcomeError] = useState('');

  // Documents state (Tab 9)
  const [documents, setDocuments] = useState<DocumentRecord[]>(defaultDocuments);
  const [uploadFileType, setUploadFileType] = useState('Consultation Document');
  const [selectedFileName, setSelectedFileName] = useState('');

  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const actions = useMemo(
    () => (visit ? actionForStatus(visit, consultation?.status === 'COMPLETED') : []),
    [consultation?.status, visit],
  );

  const calculatedBmi = useMemo(() => {
    const weight = requiredNumber(vitalsForm.weight_kg);
    const heightM = requiredNumber(vitalsForm.height_cm) / 100;
    if (!weight || !heightM) return '';
    return (weight / (heightM * heightM)).toFixed(1);
  }, [vitalsForm.height_cm, vitalsForm.weight_kg]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3200);
  };

  // Sync activeVisitId from URL search param if present
  useEffect(() => {
    if (visitIdParam && visitIdParam !== activeVisitId) {
      setActiveVisitId(visitIdParam);
    }
  }, [visitIdParam]);

  // Load available recent visits if no direct ID passed
  const loadRecentVisits = useCallback(async () => {
    try {
      const res = await opdApi.listVisits({ limit: 10, sortBy: 'created_at', sortOrder: 'desc' });
      setRecentVisits(res.data);
      const firstVisit = res.data[0];
      if (!activeVisitId && firstVisit) {
        setActiveVisitId(firstVisit.id);
      }
    } catch {
      setRecentVisits([]);
    }
  }, [activeVisitId]);

  useEffect(() => {
    void loadRecentVisits();
  }, [loadRecentVisits]);

  // Load active visit details
  const loadVisit = useCallback(async () => {
    if (!activeVisitId) {
      setVisit(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await opdApi.getVisitById(activeVisitId);
      setVisit(response);
    } catch (error) {
      setVisit(null);
      setLoadError(getOpdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeVisitId]);

  useEffect(() => {
    void loadVisit();
  }, [loadVisit]);

  // Load patient clinical sub-resources
  const loadClinicalData = useCallback(async () => {
    if (!activeVisitId) return;

    try {
      const [vitalsRes, historyRes, consultRes, rxRes, labRes, imgRes, followRes, refRes, docRes] = await Promise.allSettled([
        opdApi.getLatestVitals(activeVisitId),
        opdApi.listVitals(activeVisitId, { limit: 5 }),
        opdApi.getConsultation(activeVisitId),
        opdApi.getPrescription(activeVisitId),
        opdApi.getClinicalOrder(activeVisitId, 'LABORATORY'),
        opdApi.getClinicalOrder(activeVisitId, 'IMAGING'),
        opdApi.getFollowUp(activeVisitId),
        opdApi.getReferral(activeVisitId),
        doctorsApi.list({ limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
      ]);

      if (vitalsRes.status === 'fulfilled' && vitalsRes.value) {
        setLatestVitals(vitalsRes.value);
        setVitalsForm({
          blood_pressure_systolic: vitalsRes.value.blood_pressure_systolic.toString(),
          blood_pressure_diastolic: vitalsRes.value.blood_pressure_diastolic.toString(),
          weight_kg: vitalsRes.value.weight_kg.toString(),
          height_cm: vitalsRes.value.height_cm.toString(),
          temperature_c: vitalsRes.value.temperature_c?.toString() ?? '36.8',
          pulse_bpm: vitalsRes.value.pulse_bpm?.toString() ?? '76',
          respiratory_rate_per_min: vitalsRes.value.respiratory_rate_per_min?.toString() ?? '18',
          oxygen_saturation_percent: vitalsRes.value.oxygen_saturation_percent?.toString() ?? '98',
          notes: vitalsRes.value.notes ?? '',
        });
      }
      if (historyRes.status === 'fulfilled') setVitalsHistory(historyRes.value.data);
      if (consultRes.status === 'fulfilled' && consultRes.value) {
        setConsultation(consultRes.value);
        setConsultationForm(consultationFormFromRecord(consultRes.value));
      }
      if (rxRes.status === 'fulfilled' && rxRes.value) {
        setPrescription(rxRes.value);
      }
      if (labRes.status === 'fulfilled' && labRes.value) {
        setClinicalOrders((prev) => ({ ...prev, LABORATORY: labRes.value }));
      }
      if (imgRes.status === 'fulfilled' && imgRes.value) {
        setClinicalOrders((prev) => ({ ...prev, IMAGING: imgRes.value }));
      }
      if (followRes.status === 'fulfilled' && followRes.value) setFollowUp(followRes.value);
      if (refRes.status === 'fulfilled' && refRes.value) setReferral(refRes.value);
      if (docRes.status === 'fulfilled') setDoctors(docRes.value.data);
    } catch {
      // Keep state defaults
    }
  }, [activeVisitId]);

  useEffect(() => {
    void loadClinicalData();
  }, [loadClinicalData]);

  // Action Handlers
  const updateStatus = async (action: VisitAction) => {
    if (!visit) return;
    setUpdating(action.status);
    try {
      const updatedVisit = await opdApi.updateVisitStatus(visit.id, {
        notes: action.notes,
        status: action.status,
      });
      setVisit(updatedVisit);
      showToast(`${updatedVisit.visit_number} updated to ${opdVisitStatusLabels[action.status]}.`);
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const saveConsultationDraft = async () => {
    if (!visit) return;
    setUpdating('consultation-draft');
    try {
      const payload: SaveOpdConsultationPayload = {
        allergies: consultationForm.allergies.trim() || null,
        assessment: consultationForm.assessment.trim() || null,
        chief_complaint: consultationForm.chief_complaint.trim() || null,
        doctor_notes: consultationForm.doctor_notes.trim() || null,
        family_history: consultationForm.family_history.trim() || null,
        history_present_illness: consultationForm.history_present_illness.trim() || null,
        past_history: consultationForm.past_history.trim() || null,
        physical_examination: consultationForm.physical_examination.trim() || null,
        treatment_plan: consultationForm.treatment_plan.trim() || null,
      };
      const response = await opdApi.saveConsultationDraft(visit.id, payload);
      setConsultation(response);
      showToast('Consultation draft saved.');
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const completeConsultation = async () => {
    if (!visit) return;
    setUpdating('consultation-complete');
    try {
      const payload: SaveOpdConsultationPayload = {
        allergies: consultationForm.allergies.trim() || null,
        assessment: consultationForm.assessment.trim() || null,
        chief_complaint: consultationForm.chief_complaint.trim() || null,
        doctor_notes: consultationForm.doctor_notes.trim() || null,
        family_history: consultationForm.family_history.trim() || null,
        history_present_illness: consultationForm.history_present_illness.trim() || null,
        past_history: consultationForm.past_history.trim() || null,
        physical_examination: consultationForm.physical_examination.trim() || null,
        treatment_plan: consultationForm.treatment_plan.trim() || null,
      };
      const response = await opdApi.completeConsultation(visit.id, payload);
      setConsultation(response);
      await loadVisit();
      showToast('Consultation completed successfully.');
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileName) {
      showToast('Please choose a file to upload.');
      return;
    }
    const newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      name: selectedFileName.replace(/^C:\\fakepath\\/, ''),
      type: uploadFileType,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      size: '1.8 MB',
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedFileName('');
    showToast(`${newDoc.name} uploaded successfully.`);
  };

  return (
    <div className="opd-page">
      {/* Top Header Bar */}
      <section className="opd-page-header">
        <div className="opd-page-title">
          <h2>Consultation Workspace</h2>
          <p>Complete the outpatient encounter, diagnosis, orders and documents</p>
        </div>
        <div className="opd-page-actions">
          {recentVisits.length > 1 ? (
            <label className="opd-visit-selector" htmlFor="active-visit-select">
              <span>Patient Visit:</span>
              <select
                id="active-visit-select"
                onChange={(e) => {
                  setActiveVisitId(e.target.value);
                  navigate(`/opd/consultation?id=${e.target.value}`);
                }}
                value={activeVisitId}
              >
                {recentVisits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patient_name} ({v.visit_number}) - {opdVisitStatusLabels[v.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-arrow-left" aria-hidden="true" />
            Back to Queue
          </button>
          <button className="doc-btn" disabled={loading} onClick={loadVisit} type="button">
            <i className="ph ph-arrow-clockwise" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      {toastVisible ? (
        <div className="opd-toast-banner" role="status">
          <i className="ph ph-check-circle" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {loadError ? <div className="form-error-banner">{loadError}</div> : null}

      {loading ? (
        <section className="doc-card">
          <div className="um-state-cell">Loading consultation workspace...</div>
        </section>
      ) : !visit ? (
        <section className="doc-card opd-empty-workspace">
          <i className="ph ph-stethoscope" aria-hidden="true" />
          <h3>No Active Visit Selected</h3>
          <p>Select a patient visit from the OPD Waiting Queue to begin consultation.</p>
          <button className="doc-btn primary" onClick={() => navigate('/opd/queue')} type="button">
            Go to Waiting Queue
          </button>
        </section>
      ) : (
        <>
          {/* Patient Hero Card (Matching Image 1) */}
          <section className="doc-card opd-patient-banner">
            <div className="opd-patient-avatar-box">
              <span>{patientInitials(visit.patient_name || 'Lucy Wanjiku')}</span>
            </div>
            <div className="opd-patient-banner-info">
              <div className="opd-patient-banner-title">
                <h3>{visit.patient_name || 'Lucy Wanjiku'}</h3>
                <span className="opd-mrn-chip">{visit.patient_number || 'MRN-80003'}</span>
                <span className={`doc-status ${visitStatusClass(visit.status)}`}>
                  {opdVisitStatusLabels[visit.status] || 'Draft'}
                </span>
              </div>
              <div className="opd-patient-meta-line">
                <span>Female • 34 years</span>
                <span className="divider">|</span>
                <span>{opdVisitTypeLabels[visit.visit_type] || 'Follow-up'}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_specialization || 'Cardiology'}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_name || 'Dr. John Kamau'}</span>
                <span className="divider">|</span>
                <span>10:00 AM</span>
                <span className="divider">|</span>
                <span>{visit.visit_number || 'OPD-002'}</span>
              </div>
            </div>
            <div className="opd-patient-banner-actions">
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/profile?id=${visit.patient_id}`)}
                type="button"
              >
                <i className="ph ph-user" aria-hidden="true" />
                View Patient Profile
              </button>
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/emr?id=${visit.patient_id}`)}
                type="button"
              >
                <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
                Patient Timeline
              </button>
              <button
                className="doc-btn primary"
                disabled={updating === 'consultation-complete'}
                onClick={completeConsultation}
                type="button"
              >
                <i className="ph ph-check-circle" aria-hidden="true" />
                Complete Consultation
              </button>
            </div>
          </section>

          {/* Main Layout: 9 Workspace Tabs on Left, Patient Summary on Right */}
          <div className="opd-workspace">
            <main className="opd-clinical-main">
              {/* 9 Workspace Tabs Bar (Matching Image 1) */}
              <div className="opd-workspace-tabs" role="tablist" aria-label="Consultation tabs">
                {WORKSPACE_TABS.map((tab) => (
                  <button
                    aria-selected={activeTab === tab.name}
                    className={`opd-workspace-tab ${activeTab === tab.name ? 'active' : ''}`}
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.name);
                      navigate(`/opd/consultation?id=${visit.id}&tab=${encodeURIComponent(tab.name)}`, { replace: true });
                    }}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: CONSULTATION */}
              {activeTab === 'Consultation' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Clinical History</h3>
                        <p>Document presenting complaint and relevant clinical history</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="chief-complaint">
                        <span>Chief Complaint *</span>
                        <textarea
                          id="chief-complaint"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, chief_complaint: e.target.value }))}
                          rows={3}
                          value={consultationForm.chief_complaint}
                        />
                      </label>
                      <label className="doc-field" htmlFor="history-present-illness">
                        <span>History of Present Illness</span>
                        <textarea
                          id="history-present-illness"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, history_present_illness: e.target.value }))}
                          rows={3}
                          value={consultationForm.history_present_illness}
                        />
                      </label>
                      <label className="doc-field" htmlFor="past-history">
                        <span>Past Medical History</span>
                        <textarea
                          id="past-history"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, past_history: e.target.value }))}
                          rows={3}
                          value={consultationForm.past_history}
                        />
                      </label>
                      <label className="doc-field" htmlFor="family-history">
                        <span>Family History</span>
                        <textarea
                          id="family-history"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, family_history: e.target.value }))}
                          rows={3}
                          value={consultationForm.family_history}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="allergies">
                        <span>Allergies / Sensitivities</span>
                        <textarea
                          id="allergies"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, allergies: e.target.value }))}
                          rows={2}
                          value={consultationForm.allergies}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Examination &amp; Assessment</h3>
                        <p>Document physical findings and treatment plan</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="physical-examination">
                        <span>Physical Examination</span>
                        <textarea
                          id="physical-examination"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, physical_examination: e.target.value }))}
                          rows={3}
                          value={consultationForm.physical_examination}
                        />
                      </label>
                      <label className="doc-field" htmlFor="assessment">
                        <span>Assessment / Impression</span>
                        <textarea
                          id="assessment"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, assessment: e.target.value }))}
                          rows={3}
                          value={consultationForm.assessment}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="treatment-plan">
                        <span>Treatment Plan &amp; Advice</span>
                        <textarea
                          id="treatment-plan"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, treatment_plan: e.target.value }))}
                          rows={3}
                          value={consultationForm.treatment_plan}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Diagnosis')} type="button">
                        Next: Diagnosis
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 2: DIAGNOSIS */}
              {activeTab === 'Diagnosis' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Diagnosis &amp; ICD Coding</h3>
                        <p>Assign primary and secondary ICD diagnoses for this encounter</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field full" htmlFor="primary-dx">
                        <span>Primary Diagnosis (ICD-10) <span className="required-asterisk">*</span></span>
                        <input
                          id="primary-dx"
                          onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                          placeholder="e.g. Essential (primary) hypertension [I10]"
                          value={primaryDiagnosis}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="secondary-dx">
                        <span>Secondary Diagnoses</span>
                        <textarea
                          id="secondary-dx"
                          onChange={(e) => setSecondaryDiagnosis(e.target.value)}
                          rows={3}
                          value={secondaryDiagnosis}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Prescription')} type="button">
                        Next: Prescription
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 3: PRESCRIPTION */}
              {activeTab === 'Prescription' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Prescription Builder</h3>
                        <p>Formulary search and dosage instructions</p>
                      </div>
                    </div>
                    <div className="opd-medication-builder">
                      <label className="doc-field medicine" htmlFor="medicine-name">
                        <span>Medicine Name <span className="required-asterisk">*</span></span>
                        <input
                          id="medicine-name"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, medicine_name: e.target.value }))}
                          placeholder="e.g. Amlodipine"
                          value={medicationForm.medicine_name}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-strength">
                        <span>Strength</span>
                        <input
                          id="medicine-strength"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, strength: e.target.value }))}
                          placeholder="5 mg"
                          value={medicationForm.strength}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-dosage">
                        <span>Dosage</span>
                        <input
                          id="medicine-dosage"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, dosage: e.target.value }))}
                          placeholder="1 tablet"
                          value={medicationForm.dosage}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-frequency">
                        <span>Frequency</span>
                        <select
                          id="medicine-frequency"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, frequency: e.target.value }))}
                          value={medicationForm.frequency}
                        >
                          <option value="OD">OD (Once Daily)</option>
                          <option value="BD">BD (Twice Daily)</option>
                          <option value="TDS">TDS (Thrice Daily)</option>
                          <option value="QID">QID (Four times daily)</option>
                          <option value="PRN">PRN (As needed)</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="medicine-duration">
                        <span>Duration</span>
                        <input
                          id="medicine-duration"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                          placeholder="30 days"
                          value={medicationForm.duration}
                        />
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        onClick={() => {
                          if (!medicationForm.medicine_name.trim()) return;
                          setPrescriptionForm((prev) => ({
                            ...prev,
                            items: [...prev.items, { ...medicationForm, local_id: `med-${Date.now()}` }],
                          }));
                          setMedicationForm(emptyMedicationForm);
                          showToast('Medication added.');
                        }}
                        type="button"
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Medicine
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Instructions</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {prescriptionForm.items.length === 0 ? (
                            <tr>
                              <td className="opd-prescription-empty" colSpan={6}>
                                No medications prescribed yet.
                              </td>
                            </tr>
                          ) : (
                            prescriptionForm.items.map((item) => (
                              <tr key={item.local_id}>
                                <td>
                                  <strong>{item.medicine_name}</strong>
                                  <small>{item.strength || '5 mg'}</small>
                                </td>
                                <td>{item.dosage}</td>
                                <td>{item.frequency}</td>
                                <td>{item.duration}</td>
                                <td>{item.instructions || '-'}</td>
                                <td>
                                  <button
                                    className="doc-action danger"
                                    onClick={() =>
                                      setPrescriptionForm((prev) => ({
                                        ...prev,
                                        items: prev.items.filter((i) => i.local_id !== item.local_id),
                                      }))
                                    }
                                    type="button"
                                  >
                                    <i className="ph ph-trash" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Lab Orders')} type="button">
                        Next: Lab Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 4: LAB ORDERS */}
              {activeTab === 'Lab Orders' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Laboratory Requisition</h3>
                        <p>Order laboratory tests for this encounter</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="lab-test-name">
                        <span>Test / Investigation Name <span className="required-asterisk">*</span></span>
                        <input id="lab-test-name" placeholder="e.g. Full Blood Count (FBC)" />
                      </label>
                      <label className="doc-field" htmlFor="lab-priority">
                        <span>Priority</span>
                        <select id="lab-priority">
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">STAT</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Imaging Orders')} type="button">
                        Next: Imaging Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 5: IMAGING ORDERS */}
              {activeTab === 'Imaging Orders' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Imaging &amp; Radiology Requisition</h3>
                        <p>Order X-rays, Ultrasounds, CT, or MRI scans</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="imaging-test-name">
                        <span>Scan / Modality <span className="required-asterisk">*</span></span>
                        <input id="imaging-test-name" placeholder="e.g. Chest X-Ray PA View" />
                      </label>
                      <label className="doc-field" htmlFor="imaging-priority">
                        <span>Priority</span>
                        <select id="imaging-priority">
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Referral')} type="button">
                        Next: Referral
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 6: REFERRAL */}
              {activeTab === 'Referral' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Specialist Referral</h3>
                        <p>Internal or external clinical referral details</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="ref-specialty">
                        <span>Specialty <span className="required-asterisk">*</span></span>
                        <input id="ref-specialty" placeholder="e.g. Cardiology" />
                      </label>
                      <label className="doc-field" htmlFor="ref-reason">
                        <span>Reason for Referral</span>
                        <input id="ref-reason" placeholder="Specialist assessment" />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Follow-up')} type="button">
                        Next: Follow-up
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 7: FOLLOW-UP */}
              {activeTab === 'Follow-up' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Follow-up Schedule</h3>
                        <p>Book next review date and doctor assignment</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="fu-date">
                        <span>Follow-up Date</span>
                        <input id="fu-date" type="date" />
                      </label>
                      <label className="doc-field" htmlFor="fu-doctor">
                        <span>Doctor</span>
                        <select id="fu-doctor">
                          <option value="">Select Doctor</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.display_name} - {d.specialization}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Notes')} type="button">
                        Next: Notes
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 8: NOTES */}
              {activeTab === 'Notes' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Encounter Notes &amp; Observations</h3>
                        <p>Internal clinical notes and observations</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field full" htmlFor="notes-text">
                        <span>Doctor Clinical Notes</span>
                        <textarea
                          id="notes-text"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, doctor_notes: e.target.value }))}
                          rows={6}
                          value={consultationForm.doctor_notes}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Notes Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Documents')} type="button">
                        Next: Documents
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 9: DOCUMENTS (Matching Image 1 Reference) */}
              {activeTab === 'Documents' ? (
                <article className="doc-card opd-tab-card">
                  {/* Upload Form */}
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Upload Documents</h3>
                        <p>Add encounter documents and attachments</p>
                      </div>
                    </div>
                    <form className="opd-document-upload-form" onSubmit={handleFileUpload}>
                      <div className="opd-doc-upload-grid">
                        <div className="doc-field">
                          <label htmlFor="document-file-input">Document File</label>
                          <div className="opd-file-chooser">
                            <input
                              id="document-file-input"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFileName(file.name);
                                }
                              }}
                              type="file"
                            />
                          </div>
                        </div>
                        <div className="doc-field">
                          <label htmlFor="document-type-select">Document Type</label>
                          <select
                            id="document-type-select"
                            onChange={(e) => setUploadFileType(e.target.value)}
                            value={uploadFileType}
                          >
                            <option value="Consultation Document">Consultation Document</option>
                            <option value="Lab Report">Lab Report</option>
                            <option value="Imaging Result">Imaging Result</option>
                            <option value="Referral Letter">Referral Letter</option>
                            <option value="Consent Form">Consent Form</option>
                            <option value="Identification">Identification</option>
                          </select>
                        </div>
                        <div className="opd-upload-btn-wrap">
                          <button className="doc-btn primary upload-btn" type="submit">
                            <i className="ph ph-upload-simple" aria-hidden="true" />
                            Upload
                          </button>
                        </div>
                      </div>
                    </form>
                  </section>

                  {/* Consultation Documents & History */}
                  <section className="opd-form-section" style={{ marginTop: '1.5rem' }}>
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Consultation Documents &amp; Document History</h3>
                        <p>Prescriptions, reports, consent forms and referral letters</p>
                      </div>
                    </div>

                    <div className="opd-documents-cards-grid">
                      {documents.map((doc) => (
                        <div className="opd-document-card" key={doc.id}>
                          <div className="opd-document-icon">
                            <i className="ph ph-file-text" aria-hidden="true" />
                          </div>
                          <div className="opd-document-details">
                            <strong>{doc.name}</strong>
                            <span>
                              {doc.type} • {doc.date}
                            </span>
                          </div>
                          <div className="opd-document-actions">
                            <button
                              aria-label={`View ${doc.name}`}
                              className="doc-icon-action"
                              onClick={() => showToast(`Previewing ${doc.name}`)}
                              title="View Document"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Download ${doc.name}`}
                              className="doc-icon-action"
                              onClick={() => showToast(`Downloading ${doc.name}`)}
                              title="Download Document"
                              type="button"
                            >
                              <i className="ph ph-download-simple" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Sticky Footer Actions (Matching Image 1) */}
                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={() => showToast('Draft documents saved.')} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => showToast('Documents saved successfully.')} type="button">
                        Save Documents
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}
            </main>

            {/* Right Summary Side Panel (Matching Image 1 Reference) */}
            <aside className="opd-summary-panel">
              {/* Patient Summary / Vitals Card */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Patient Summary</h3>
                  </div>
                </div>
                <div className="opd-summary-list">
                  <div className="opd-summary-row">
                    <span>Blood Pressure</span>
                    <strong>{vitalsForm.blood_pressure_systolic}/{vitalsForm.blood_pressure_diastolic} mmHg</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Pulse</span>
                    <strong>{vitalsForm.pulse_bpm || '76'} bpm</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Temperature</span>
                    <strong>{vitalsForm.temperature_c || '36.8'} °C</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>SpO₂</span>
                    <strong>{vitalsForm.oxygen_saturation_percent || '98'}%</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Blood Group</span>
                    <strong>B+</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Allergies</span>
                    <strong style={{ color: '#dc2626' }}>{consultationForm.allergies || 'Penicillin'}</strong>
                  </div>
                </div>
              </div>

              {/* Current Medications */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Current Medications</h3>
                  </div>
                </div>
                <div className="opd-summary-list">
                  <div className="opd-medication-chip-item">
                    <div>
                      <strong>Amlodipine 5 mg OD</strong>
                      <span>Hypertension management</span>
                    </div>
                    <span className="doc-status active">Active</span>
                  </div>
                </div>
              </div>

              {/* Previous Diagnoses */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Previous Diagnoses</h3>
                  </div>
                </div>
                <div className="opd-summary-empty-text">No previous diagnoses recorded.</div>
              </div>

              {/* Recent Lab Results */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Recent Lab Results</h3>
                  </div>
                </div>
                <div className="opd-summary-list">
                  <div className="opd-summary-row">
                    <span>CBC</span>
                    <strong>Within range</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>HbA1c</span>
                    <strong>6.4%</strong>
                  </div>
                </div>
              </div>

              {/* Clinical Alerts */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Clinical Alerts</h3>
                  </div>
                </div>
                <div className="opd-clinical-alert warning">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  <div>
                    <strong>Allergy Alert</strong>
                    <span>Penicillin sensitivity</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
