import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { ServiceResponse } from '../api/services';
import { ICD10_DIAGNOSES } from '../data/icd10-diagnoses';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { Modal } from '../components/ui/Modal';
import { navigate } from '../routing/navigation';
import type { EmergencyStatus, EmergencyTriageLevel } from '../api/emergency';

const id = z.string().min(1, 'Required');
const optionalNumber = z.number().optional();
const numericInput = { setValueAs: (value: string) => (value === '' ? undefined : Number(value)) };

const triageSchema = z.object({
  level: z.enum([
    'LEVEL_1_CRITICAL',
    'LEVEL_2_HIGH',
    'LEVEL_3_MEDIUM',
    'LEVEL_4_LOW',
    'LEVEL_5_NON_URGENT',
  ]),
  area: z.string().min(2),
  pain_score: optionalNumber,
  systolic_bp: optionalNumber,
  diastolic_bp: optionalNumber,
  pulse: optionalNumber,
  temperature_c: optionalNumber,
  spo2: optionalNumber,
  respiratory_rate: optionalNumber,
  gcs: optionalNumber,
  airway: z.string().min(1),
  breathing: z.string().min(1),
  circulation: z.string().min(1),
  disability: z.string().min(1),
  exposure: z.string().min(1),
  notes: z.string().optional(),
});

const consultationSchema = z.object({
  doctor_id: id,
  chief_complaint: z.string().min(3),
  history: z.string().optional(),
  examination: z.string().optional(),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  plan: z.string().min(1, 'Treatment plan is required'),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  ready_for_disposition: z.boolean(),
});

const dispositionSchema = z
  .object({
    decision: z.enum(['DISCHARGE', 'ADMIT', 'TRANSFER', 'LEFT']),
    reason: z.string().optional(),
    summary: z.string().min(3, 'Summary is required'),
    instructions: z.string().optional(),
    transfer_destination: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'TRANSFER' && !value.transfer_destination?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['transfer_destination'],
        message: 'Destination is required for transfer',
      });
    }
  });

type TriageForm = z.infer<typeof triageSchema>;
type ConsultationForm = z.infer<typeof consultationSchema>;
type DispositionForm = z.infer<typeof dispositionSchema>;

const levels: EmergencyTriageLevel[] = [
  'LEVEL_1_CRITICAL',
  'LEVEL_2_HIGH',
  'LEVEL_3_MEDIUM',
  'LEVEL_4_LOW',
  'LEVEL_5_NON_URGENT',
];

const orderPriorityOf = (value: string) => {
  if (value === 'URGENT' || value === 'ROUTINE') return value;
  return 'STAT';
};

const triageLevelOf = (value: string): EmergencyTriageLevel =>
  levels.find((level) => level === value) ?? 'LEVEL_3_MEDIUM';

const TABS = [
  'Registration',
  'Triage',
  'Consultation',
  'Treatment',
  'Medication',
  'Lab Orders',
  'Imaging Orders',
  'Referral',
  'Notes',
  'Documents',
  'Disposition',
] as const;

type WorkspaceTab = (typeof TABS)[number];

const triageLabel = (value?: EmergencyTriageLevel | null) => {
  if (!value) return 'Not triaged';
  switch (value) {
    case 'LEVEL_1_CRITICAL': return 'Level 1 Critical';
    case 'LEVEL_2_HIGH': return 'Level 2 High';
    case 'LEVEL_3_MEDIUM': return 'Level 3 Medium';
    case 'LEVEL_4_LOW': return 'Level 4 Low';
    case 'LEVEL_5_NON_URGENT': return 'Level 5 Non-Urgent';
    default: return value;
  }
};

const triageSlug = (value?: EmergencyTriageLevel | null) => {
  if (!value) return 'not-triaged';
  return value.toLowerCase().replace(/_/g, '-');
};

const statusLabel = (status: EmergencyStatus) => {
  switch (status) {
    case 'REGISTERED': return 'Registered';
    case 'WAITING_FOR_TRIAGE': return 'Waiting for Triage';
    case 'TRIAGED': return 'Triaged';
    case 'WAITING_FOR_DOCTOR': return 'Waiting for Doctor';
    case 'IN_CONSULTATION': return 'In Consultation';
    case 'IN_TREATMENT': return 'In Treatment';
    case 'READY_FOR_DISPOSITION': return 'Ready for Disposition';
    case 'DISCHARGED': return 'Discharged';
    case 'TRANSFERRED': return 'Transferred';
    case 'CONVERTED_TO_IP': return 'Admitted';
    case 'LEFT': return 'Left';
    case 'NO_SHOW': return 'No Show';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
};

const statusSlug = (status: EmergencyStatus) => {
  switch (status) {
    case 'IN_TREATMENT': return 'in-treatment';
    case 'READY_FOR_DISPOSITION': return 'ready-for-admission';
    case 'IN_CONSULTATION': return 'called';
    case 'DISCHARGED':
    case 'TRANSFERRED':
    case 'CONVERTED_TO_IP': return 'discharged';
    default: return 'waiting';
  }
};

const formatTime = (timeStr?: string) => {
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  } catch {
    // fallback
  }
  return timeStr.slice(11, 16) || timeStr;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Action could not be completed.';

export function EmergencyWorkspacePage() {
  const { state, actions } = useEmergencyWorkspaceFeature();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Registration');
  const [linkPatientOpen, setLinkPatientOpen] = useState(false);
  const [linkPatientId, setLinkPatientId] = useState('');
  const [linkReason, setLinkReason] = useState('');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [priorityLevel, setPriorityLevel] = useState<EmergencyTriageLevel>('LEVEL_3_MEDIUM');
  const [priorityReason, setPriorityReason] = useState('');
  const [assignDoctorOpen, setAssignDoctorOpen] = useState(false);
  const [assignDoctorId, setAssignDoctorId] = useState('');
  // Diagnosis State (ICD-10 catalogue + custom addition)
  const diagnosesList = ICD10_DIAGNOSES;
  const [isAddingCustomDiagnosis, setIsAddingCustomDiagnosis] = useState(false);
  const [customDiagnosisTerm, setCustomDiagnosisTerm] = useState('');

  // Medication Form State
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medRoute, setMedRoute] = useState('IV');
  const [medFrequency, setMedFrequency] = useState('STAT');
  const medDuration = 'Stat';
  const [medQuantity, setMedQuantity] = useState('1');
  const [medInstructions, setMedInstructions] = useState('');
  const [medPriority, setMedPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('STAT');

  // Lab Order Form State
  const [labServiceId, setLabServiceId] = useState('');
  const [labPriority, setLabPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('STAT');
  const [labSpecimen, setLabSpecimen] = useState('Blood');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');

  // Imaging Order Form State
  const [imgServiceId, setImgServiceId] = useState('');
  const [imgPriority, setImgPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('STAT');
  const [imgModality, setImgModality] = useState('X-Ray');
  const [imgNotes, setImgNotes] = useState('');

  // Referral Form State
  const [refDeptId, setRefDeptId] = useState('');
  const [refDoctorId, setRefDoctorId] = useState('');
  const [refPriority, setRefPriority] = useState('EMERGENCY');
  const [refReason, setRefReason] = useState('Specialist Emergency Consultation');
  const [refNotes, setRefNotes] = useState('');

  // Treatment / Bedside Procedure Form State
  const [treatmentProcedure, setTreatmentProcedure] = useState('IV Cannulation');
  const [treatmentOutcome, setTreatmentOutcome] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');

  const selected = state.selected;

  const availableMedicines = state.availableMedicines;
  const labServices = state.labServices;
  const imagingServices = state.imagingServices;

  const triage = useForm<TriageForm>({
    resolver: zodResolver(triageSchema),
    defaultValues: {
      level: 'LEVEL_3_MEDIUM',
      area: 'General ER',
      airway: 'Patent',
      breathing: 'Spontaneous',
      circulation: 'Stable',
      disability: 'Alert',
      exposure: 'No immediate concern',
      notes: '',
    },
  });

  const consultation = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      doctor_id: '',
      chief_complaint: '',
      history: '',
      examination: '',
      diagnosis: '',
      plan: '',
      treatment: '',
      notes: '',
      ready_for_disposition: false,
    },
  });

  const disposition = useForm<DispositionForm>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: {
      decision: 'ADMIT',
      reason: '',
      summary: '',
      instructions: '',
      transfer_destination: '',
    },
  });

  useEffect(() => {
    if (selected) {
      consultation.reset({
        doctor_id: selected.assigned_doctor_id ?? '',
        chief_complaint: selected.consultation?.chiefComplaint ?? selected.chief_complaint,
        history: selected.consultation?.history ?? '',
        examination: selected.consultation?.examination ?? '',
        diagnosis: selected.consultation?.diagnosis ?? '',
        plan: selected.consultation?.plan ?? '',
        treatment: selected.consultation?.treatment ?? '',
        notes: selected.consultation?.notes ?? '',
        ready_for_disposition: selected.status === 'READY_FOR_DISPOSITION',
      });

      if (selected.triage) {
        triage.reset({
          level: selected.triage.effective_level ?? selected.triage.level,
          area: selected.triage.area || 'General ER',
          pain_score: selected.triage.pain_score ?? undefined,
          systolic_bp: selected.triage.vitals?.systolic_bp ?? undefined,
          diastolic_bp: selected.triage.vitals?.diastolic_bp ?? undefined,
          pulse: selected.triage.vitals?.pulse ?? undefined,
          temperature_c: selected.triage.vitals?.temperature_c ?? undefined,
          spo2: selected.triage.vitals?.spo2 ?? undefined,
          respiratory_rate: selected.triage.vitals?.respiratory_rate ?? undefined,
          gcs: selected.triage.vitals?.gcs ?? undefined,
          airway: selected.triage.abcde?.airway || 'Patent',
          breathing: selected.triage.abcde?.breathing || 'Spontaneous',
          circulation: selected.triage.abcde?.circulation || 'Stable',
          disability: selected.triage.abcde?.disability || 'Alert',
          exposure: selected.triage.abcde?.exposure || 'No immediate concern',
          notes: selected.triage.notes || '',
        });
      }
    }
  }, [selected, consultation, triage]);

  const saveTriage = triage.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await actions.saveTriage(selected.id, {
          level: value.level,
          area: value.area,
          pain_score: value.pain_score ?? null,
          vitals: {
            systolic_bp: value.systolic_bp ?? null,
            diastolic_bp: value.diastolic_bp ?? null,
            pulse: value.pulse ?? null,
            temperature_c: value.temperature_c ?? null,
            spo2: value.spo2 ?? null,
            respiratory_rate: value.respiratory_rate ?? null,
            gcs: value.gcs ?? null,
          },
          abcde: {
            airway: value.airway,
            breathing: value.breathing,
            circulation: value.circulation,
            disability: value.disability,
            exposure: value.exposure,
          },
          notes: value.notes || null,
      });
      toast.success('Emergency triage completed.');
      setActiveTab('Consultation');
    } catch (error) {
      toast.error(message(error));
    }
  });

  const saveConsultation = consultation.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await actions.saveConsultation(selected.id, {
          ...value,
          history: value.history?.trim() || 'Emergency clinical presentation evaluated.',
          examination: value.examination?.trim() || 'Bedside examination completed.',
          treatment: value.treatment || null,
          notes: value.notes || null,
      });
      toast.success('Doctor evaluation saved.');
      if (value.ready_for_disposition) setActiveTab('Disposition');
      else setActiveTab('Treatment');
    } catch (error) {
      toast.error(message(error));
    }
  });

  // Handle Adding Prescribed Medication
  const handleAddMedicationOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!medName.trim()) {
      toast.error('Please select or enter a medication name.');
      return;
    }
    if (['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)) {
      toast.error(`This emergency encounter has reached final disposition (${selected.status.toLowerCase().replace(/_/g, ' ')}). New orders cannot be placed.`);
      return;
    }

    try {
      await actions.submitOrder(selected.id, {
          order_type: 'PHARMACY',
          priority: medPriority,
          items: [
            {
              medicine_name: medName.trim(),
              name: medName.trim(),
              category: 'Emergency Pharmacy',
              dosage: medDosage.trim() || undefined,
              route: medRoute || undefined,
              frequency: medFrequency || undefined,
              duration: medDuration || undefined,
              quantity: Number(medQuantity) || 1,
            },
          ],
          instructions: medInstructions.trim() || null,
      });
      toast.success(`Medication order ${medName} submitted.`);
      setMedName('');
      setMedDosage('');
      setMedInstructions('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  // Handle Adding Lab Order
  const handleAddLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)) {
      toast.error(`This emergency encounter has reached final disposition (${selected.status.toLowerCase().replace(/_/g, ' ')}). New orders cannot be placed.`);
      return;
    }
    if (!labServiceId) {
      toast.error('Please select a laboratory test from the catalogue.');
      return;
    }

    const labService = labServices.find((s) => s.id === labServiceId);

    try {
      await actions.submitOrder(selected.id, {
          order_type: 'LABORATORY',
          priority: labPriority,
          items: [
            {
              service_id: labServiceId,
              name: labService?.name || 'Laboratory Test',
              category: labService?.category || 'Laboratory',
            },
          ],
          specimen_type: labSpecimen || null,
          clinical_notes: labClinicalNotes.trim() || null,
      });
      toast.success(`Lab order ${labService?.name || ''} placed.`);
      setLabServiceId('');
      setLabClinicalNotes('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  // Handle Adding Imaging Order
  const handleAddImagingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)) {
      toast.error(`This emergency encounter has reached final disposition (${selected.status.toLowerCase().replace(/_/g, ' ')}). New orders cannot be placed.`);
      return;
    }
    if (!imgServiceId) {
      toast.error('Please select an imaging study from the catalogue.');
      return;
    }

    const imgService = imagingServices.find((s) => s.id === imgServiceId);

    try {
      await actions.submitOrder(selected.id, {
          order_type: 'IMAGING',
          priority: imgPriority,
          items: [
            {
              service_id: imgServiceId,
              name: imgService?.name || 'Imaging Study',
              category: imgModality || imgService?.category || 'Imaging',
            },
          ],
          clinical_notes: imgNotes.trim() || null,
      });
      toast.success(`Imaging study ${imgService?.name || ''} requested.`);
      setImgServiceId('');
      setImgNotes('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  // Handle Adding Referral
  const handleAddReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!refDeptId) {
      toast.error('Please select a target referral department.');
      return;
    }

    const targetDept = state.departments.find((d) => d.id === refDeptId);
    const targetDoc = state.doctors.find((d) => d.id === refDoctorId);

    toast.success(`Referral dispatched to ${targetDept?.name || 'Department'}${targetDoc ? ` (Dr. ${targetDoc.display_name})` : ''}.`);
    setRefDeptId('');
    setRefDoctorId('');
    setRefNotes('');
  };

  const confirmDisposition = disposition.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await actions.completeDisposition(selected.id, {
          decision: value.decision,
          reason: value.reason || null,
          summary: value.summary,
          instructions: value.instructions || null,
          transfer_destination: value.transfer_destination || null,
      });
    } catch (error) {
      toast.error(message(error));
    }
  });

  const confirmLinkPatient = async () => {
    if (!selected || !linkPatientId) {
      toast.error('Select a patient record');
      return;
    }
    try {
      await actions.linkPatient(selected.id, linkPatientId, linkReason || undefined);
      toast.success('Patient record linked successfully.');
      setLinkPatientOpen(false);
      setLinkPatientId('');
      setLinkReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  const confirmPriorityOverride = async () => {
    if (!selected || !priorityReason.trim()) {
      toast.error('Reason is required for triage priority override');
      return;
    }
    try {
      await actions.overridePriority(selected.id, priorityLevel, priorityReason);
      toast.success('Triage priority updated.');
      setPriorityOpen(false);
      setPriorityReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  const confirmAssignDoctor = async () => {
    if (!selected || !assignDoctorId) {
      toast.error('Please select a doctor to assign.');
      return;
    }
    const doc = state.doctors.find((d) => d.id === assignDoctorId);
    try {
      await actions.saveConsultation(selected.id, {
          doctor_id: assignDoctorId,
          chief_complaint: selected.chief_complaint,
          history: selected.consultation?.history || 'Assigned attending emergency doctor.',
          examination: selected.consultation?.examination || 'Bedside emergency examination.',
          diagnosis: selected.consultation?.diagnosis || 'Provisional Emergency Evaluation',
          plan: selected.consultation?.plan || 'Emergency management initiated.',
          ready_for_disposition: false,
      });
      toast.success(`Assigned ${doc?.display_name || 'Doctor'} to this encounter.`);
      setAssignDoctorOpen(false);
    } catch (error) {
      toast.error(message(error));
    }
  };

  if (!selected) {
    return (
      <div className="emergency-page emergency-theme">
        <div className="doc-empty-state" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <i className="ph ph-first-aid" style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem', display: 'block' }} />
          <h3>No Emergency Case Selected</h3>
          <p>Please return to the emergency queue to select an active patient encounter.</p>
          <button
            className="btn-emergency-primary"
            onClick={actions.openQueue}
            style={{ marginTop: '1rem' }}
            type="button"
          >
            Open Emergency Queue
          </button>
        </div>
      </div>
    );
  }

  const triageLevel = selected.triage?.effective_level ?? selected.triage?.level ?? null;
  const initials = (selected.patient_name || selected.provisional_identity?.display_name || 'EP')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Recorded vitals values directly from backend
  const v = selected.triage?.vitals || {};
  const bp = v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—';
  const pulse = v.pulse ? `${v.pulse} bpm` : '—';
  const spo2 = v.spo2 ? `${v.spo2}%` : '—';
  const temp = v.temperature_c ? `${v.temperature_c} °C` : '—';
  const resp = v.respiratory_rate ? `${v.respiratory_rate}/min` : '—';
  const gcs = v.gcs ? `${v.gcs}/15` : '—';

  // Filtered lists of encounter orders
  const encounterOrders = selected.orders ?? [];
  const pharmacyOrders = encounterOrders.filter((o) => o.order_type === 'PHARMACY');
  const labOrders = encounterOrders.filter((o) => o.order_type === 'LABORATORY');
  const imagingOrders = encounterOrders.filter((o) => o.order_type === 'IMAGING');

  return (
    <div className="emergency-page emergency-theme" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
      {/* Page Header */}
      <div className="emergency-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="emergency-page-title">
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Emergency Clinical Workspace</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Complete emergency patient intake, rapid ABCDE triage, bedside EHR, and orders
          </p>
        </div>
        <div className="emergency-page-actions" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <span className="emergency-autosave" style={{ fontSize: '0.78rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="ph ph-check-circle" /> Auto-save enabled
          </span>
          <button
            className="btn-emergency-secondary"
            onClick={actions.openQueue}
            type="button"
            style={{ padding: '0.45rem 0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
          >
            <i className="ph ph-arrow-left" /> Back to Queue
          </button>
        </div>
      </div>

      {/* Patient Header Hero Card */}
      {(() => {
        const linkedPatient = state.patients.find((p) => p.id === selected.patient_id);
        const rawGender = linkedPatient?.gender || selected.provisional_identity?.gender || 'Unknown';
        const displayGender = rawGender === 'MALE' ? 'Male' : rawGender === 'FEMALE' ? 'Female' : rawGender === 'OTHER' ? 'Other' : rawGender === 'UNKNOWN' ? 'Unknown' : rawGender;

        return (
          <section className="emergency-patient-header" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  background: '#dc2626',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    {selected.patient_name || selected.provisional_identity?.display_name || 'Emergency Patient'}
                  </h2>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#1e293b', fontWeight: 700, fontSize: '0.78rem' }}>
                    {selected.patient_number || selected.emergency_identifier || selected.encounter_number}
                  </span>
                  <span className={`emergency-triage ${triageSlug(triageLevel)}`}>
                    {triageLabel(triageLevel)}
                  </span>
                  <span className={`doc-status ${statusSlug(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.76rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span>Gender: <strong style={{ color: '#1e293b' }}>{displayGender}</strong></span>
                  <span>•</span>
                  <span>Arrival: <strong style={{ color: '#1e293b' }}>{selected.arrival_mode}</strong> ({formatTime(selected.arrival_at)})</span>
                  <span>•</span>
                  <span>Doctor: <strong style={{ color: '#2563eb' }}>{selected.assigned_doctor_name || 'Unassigned'}</strong></span>
                  {selected.provisional_identity && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>Provisional Identity</span>
                    </>
                  )}
                </div>
              </div>
            </div>

        {/* Quick Header Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {selected.provisional_identity && (
            <button
              className="btn-emergency-secondary"
              onClick={() => setLinkPatientOpen(true)}
              type="button"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <i className="ph ph-link" /> Link Registered Patient
            </button>
          )}
          <button
            className="btn-emergency-secondary"
            onClick={() => {
              setAssignDoctorId(selected.assigned_doctor_id || (state.doctors[0]?.id ?? ''));
              setAssignDoctorOpen(true);
            }}
            type="button"
            style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <i className="ph ph-user-plus" /> {selected.assigned_doctor_name ? 'Change Doctor' : 'Assign Doctor'}
          </button>
          <button
            className="btn-emergency-secondary"
            onClick={() => setPriorityOpen(true)}
            type="button"
            style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <i className="ph ph-sliders" /> Override Triage
          </button>
          <button
            className="btn-emergency-primary"
            onClick={() => setActiveTab('Disposition')}
            type="button"
            style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <i className="ph ph-sign-out" /> Disposition
          </button>
        </div>
      </section>
        );
      })()}

      {/* Main Split Screen */}
      <div className="emergency-workspace-layout emergency-workspace-layout--compact">
        {/* Left Column: Tabs & Clinical Forms */}
        <main className="emergency-tabs-container">
          {/* Tab Navigation */}
          <div className="segmented-control" style={{ width: '100%', overflowX: 'auto', marginBottom: '1rem' }}>
            {TABS.map((tab) => (
              <button
                className={activeTab === tab ? 'active' : ''}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="emergency-tab-content">
            {/* Tab 1: Registration */}
            {activeTab === 'Registration' && (() => {
              const linkedPatient = state.patients.find((p) => p.id === selected.patient_id);
              const rawGender = linkedPatient?.gender || selected.provisional_identity?.gender || 'Unknown';
              const displayGender = rawGender === 'MALE' ? 'Male' : rawGender === 'FEMALE' ? 'Female' : rawGender === 'OTHER' ? 'Other' : rawGender === 'UNKNOWN' ? 'Unknown' : rawGender;

              return (
              <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Patient Identification &amp; Arrival Details</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Confirmed identity and emergency intake information
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.84rem' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Patient Name</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>
                      {selected.patient_name || selected.provisional_identity?.display_name}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>MRN / Identifier</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>
                      {selected.patient_number || selected.emergency_identifier || selected.encounter_number}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Gender</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>
                      {displayGender}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Arrival Mode</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>{selected.arrival_mode}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Arrival Time</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>{new Date(selected.arrival_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Contact / EMS</label>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>{selected.provisional_identity?.contact || '—'}</p>
                  </div>
                  <div style={{ gridColumn: 'span 3', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Chief Emergency Complaint</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#dc2626', fontSize: '0.9rem' }}>{selected.chief_complaint}</p>
                  </div>
                  {selected.arrival_notes && (
                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Paramedic / Intake Notes</label>
                      <p style={{ margin: '2px 0 0', color: '#475569' }}>{selected.arrival_notes}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button
                    className="btn-emergency-primary"
                    onClick={() => setActiveTab('Triage')}
                    type="button"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Next → Triage <i className="ph ph-arrow-right" />
                  </button>
                </div>
              </section>
              );
            })()}

            {/* Tab 2: Triage */}
            {activeTab === 'Triage' && (
              <form onSubmit={saveTriage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Emergency Severity Index (ESI) & Triage Assignment</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Assign clinical urgency and allocate emergency treatment area
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Triage Severity Level *</label>
                      <select {...triage.register('level')}>
                        {levels.map((lvl) => (
                          <option key={lvl} value={lvl}>{triageLabel(lvl)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Triage Area *</label>
                      <select {...triage.register('area')}>
                        <option value="General ER">General ER</option>
                        <option value="Resuscitation Bay">Resuscitation Bay</option>
                        <option value="Trauma Bay">Trauma Bay</option>
                        <option value="Observation Unit">Observation Unit</option>
                        <option value="Pediatric ER">Pediatric ER</option>
                      </select>
                    </div>
                  </div>

                  <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                    Pain Score (0 - 10):{' '}
                    <strong style={{ color: triage.watch('pain_score') !== undefined && triage.watch('pain_score') !== null ? '#dc2626' : '#64748b' }}>
                      {triage.watch('pain_score') !== undefined && triage.watch('pain_score') !== null
                        ? `${triage.watch('pain_score')} / 10 ${
                            triage.watch('pain_score') === 0
                              ? '(No Pain)'
                              : Number(triage.watch('pain_score')) <= 3
                              ? '(Mild)'
                              : Number(triage.watch('pain_score')) <= 6
                              ? '(Moderate)'
                              : '(Severe)'
                          }`
                        : 'Not selected'}
                    </strong>
                  </h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {Array.from({ length: 11 }, (_, i) => {
                      const isSelected = Number(triage.watch('pain_score')) === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => triage.setValue('pain_score', i, { shouldValidate: true, shouldDirty: true })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '38px',
                            height: '36px',
                            border: isSelected ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            background: isSelected ? '#dc2626' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#1e293b',
                            boxShadow: isSelected ? '0 2px 4px rgba(220, 38, 38, 0.25)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Bedside Vital Signs</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Initial emergency clinical observations</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Systolic BP (mmHg)</label>
                      <input type="number" {...triage.register('systolic_bp', numericInput)} placeholder="120" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Diastolic BP (mmHg)</label>
                      <input type="number" {...triage.register('diastolic_bp', numericInput)} placeholder="80" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Pulse (bpm)</label>
                      <input type="number" {...triage.register('pulse', numericInput)} placeholder="75" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Temp (°C)</label>
                      <input step="0.1" type="number" {...triage.register('temperature_c', numericInput)} placeholder="36.8" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>SpO₂ (%)</label>
                      <input type="number" {...triage.register('spo2', numericInput)} placeholder="98" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Resp Rate (/min)</label>
                      <input type="number" {...triage.register('respiratory_rate', numericInput)} placeholder="16" />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>GCS Score (3-15)</label>
                      <input max={15} min={3} type="number" {...triage.register('gcs', numericInput)} placeholder="15" />
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>ABCDE Primary Rapid Survey</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Emergency airway, breathing, circulation assessment</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Airway</label>
                      <select {...triage.register('airway')}>
                        <option value="Patent">Patent</option>
                        <option value="Obstructed">Obstructed</option>
                        <option value="Intubated">Intubated</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Breathing</label>
                      <select {...triage.register('breathing')}>
                        <option value="Spontaneous">Spontaneous</option>
                        <option value="Distressed">Distressed</option>
                        <option value="Assisted">Assisted</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Circulation</label>
                      <select {...triage.register('circulation')}>
                        <option value="Stable">Stable</option>
                        <option value="Shock">Shock</option>
                        <option value="Arrest">Cardiac Arrest</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Disability</label>
                      <select {...triage.register('disability')}>
                        <option value="Alert">Alert</option>
                        <option value="Voice">Voice</option>
                        <option value="Pain">Pain</option>
                        <option value="Unresponsive">Unresponsive</option>
                      </select>
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Exposure</label>
                      <select {...triage.register('exposure')}>
                        <option value="No immediate concern">Normal</option>
                        <option value="Trauma">Trauma</option>
                        <option value="Burns">Burns</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn-emergency-primary"
                    disabled={state.pending.triage}
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {state.pending.triage ? 'Saving...' : 'Complete Triage → Consultation'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Consultation */}
            {activeTab === 'Consultation' && (
              <form onSubmit={saveConsultation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Doctor Clinical Evaluation</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Emergency doctor examination and working diagnosis</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Attending Doctor <span style={{ color: '#dc2626' }}>*</span></label>
                      <select {...consultation.register('doctor_id')}>
                        <option value="">Select Doctor</option>
                        {state.doctors.map((d) => (
                          <option key={d.id} value={d.id}>{d.display_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Chief Complaint *</label>
                      <input {...consultation.register('chief_complaint')} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>History of Present Illness</label>
                      <textarea {...consultation.register('history')} placeholder="Onset, character, duration, radiation, aggravating factors..." rows={2} />
                    </div>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Physical Examination</label>
                      <textarea {...consultation.register('examination')} placeholder="Chest, CVS, Abdomen, Neurological findings..." rows={2} />
                    </div>
                  </div>

                  {/* Diagnosis Selection with ICD-10 and Custom Add */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0f172a' }}>
                        Working Diagnosis <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomDiagnosis(!isAddingCustomDiagnosis)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {isAddingCustomDiagnosis ? '← Back to standard list' : '+ Add custom diagnosis'}
                      </button>
                    </div>

                    {isAddingCustomDiagnosis ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          placeholder="Type custom diagnosis name..."
                          value={customDiagnosisTerm}
                          onChange={(e) => setCustomDiagnosisTerm(e.target.value)}
                          style={{ flex: 1, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customDiagnosisTerm.trim()) return;
                            consultation.setValue('diagnosis', customDiagnosisTerm.trim());
                            toast.success(`Custom diagnosis "${customDiagnosisTerm.trim()}" selected.`);
                            setIsAddingCustomDiagnosis(false);
                            setCustomDiagnosisTerm('');
                          }}
                          style={{ padding: '0 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Use Diagnosis
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <select
                          {...consultation.register('diagnosis')}
                          style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                        >
                          <option value="">Select ICD-10 Diagnosis</option>
                          {diagnosesList.map((d) => (
                            <option key={d.code} value={`${d.name} (${d.code})`}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="Search or enter diagnosis directly..."
                          value={consultation.watch('diagnosis') || ''}
                          onChange={(e) => consultation.setValue('diagnosis', e.target.value)}
                          style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="adm-field" style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Treatment Plan & Immediate Management *</label>
                    <textarea {...consultation.register('plan')} placeholder="Stat medications, emergency stabilization orders, continuous monitoring..." rows={2} />
                  </div>
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn-emergency-primary"
                    disabled={state.pending.consultation}
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {state.pending.consultation ? 'Saving...' : 'Save Evaluation → Treatment'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 4: Treatment */}
            {activeTab === 'Treatment' && (
              <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Bedside Interventions & Continuous Telemetry</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Log emergency resuscitation, cannulation, and nursing procedures</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Emergency Procedure</label>
                    <select value={treatmentProcedure} onChange={(e) => setTreatmentProcedure(e.target.value)}>
                      <option value="IV Cannulation">IV Cannulation (18G/20G)</option>
                      <option value="ECG 12-Lead">ECG 12-Lead</option>
                      <option value="Oxygen Therapy">Oxygen via Mask / Nasal Cannula</option>
                      <option value="Nebulization">Nebulization (Salbutamol/Ipratropium)</option>
                      <option value="CPR / Defibrillation">CPR / Defibrillation</option>
                      <option value="Wound Suturing / Dressing">Wound Suturing / Dressing</option>
                      <option value="Urinary Catheterization">Urinary Catheterization</option>
                    </select>
                  </div>
                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Procedure Outcome</label>
                    <input
                      placeholder="e.g. Successful 18G cannula in right ACF"
                      value={treatmentOutcome}
                      onChange={(e) => setTreatmentOutcome(e.target.value)}
                    />
                  </div>
                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Nursing / Telemetry Notes</label>
                    <input
                      placeholder="Continuous cardiac monitoring active..."
                      value={treatmentNotes}
                      onChange={(e) => setTreatmentNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button
                    className="btn-emergency-primary"
                    onClick={() => {
                      toast.success('Bedside procedure recorded.');
                      setActiveTab('Medication');
                    }}
                    type="button"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Next → Medication Orders <i className="ph ph-arrow-right" />
                  </button>
                </div>
              </section>
            )}

            {/* Tab 5: Medication Orders */}
            {activeTab === 'Medication' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <form onSubmit={handleAddMedicationOrder} className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Prescribe Emergency Medications</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Prescribe stat and ongoing medications from hospital pharmacy master</p>
                  </div>

                  {selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <i className="ph ph-warning-circle" style={{ fontSize: '1.2rem', color: '#dc2626' }} />
                      This emergency encounter has reached final disposition ({selected.status.toLowerCase().replace(/_/g, ' ')}). Prescriptions and orders are locked.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                    <div className="adm-field" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Medicine Name *</label>
                      <select
                        value={medName}
                        onChange={(e) => {
                          setMedName(e.target.value);
                          const med = availableMedicines.find((m) => m.name === e.target.value);
                          if (med?.strength) setMedDosage(med.strength);
                        }}
                        disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}
                        required
                      >
                        <option value="">Select medicine from catalogue ({availableMedicines.length} available)</option>
                        {availableMedicines.map((m) => (
                          <option key={m.id || m.name} value={m.name}>
                            {m.name} {m.strength ? `(${m.strength})` : ''} {m.dosage_form ? `- ${m.dosage_form}` : ''} {m.available_quantity !== undefined ? `[Stock: ${m.available_quantity}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Priority</label>
                      <select value={medPriority} onChange={(e) => setMedPriority(orderPriorityOf(e.target.value))} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="STAT">STAT (Immediate)</option>
                        <option value="URGENT">Urgent</option>
                        <option value="ROUTINE">Routine</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Dosage / Strength</label>
                      <input placeholder="e.g. 500 mg" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)} />
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Route</label>
                      <select value={medRoute} onChange={(e) => setMedRoute(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="IV">IV (Intravenous)</option>
                        <option value="Oral">Oral</option>
                        <option value="IM">IM (Intramuscular)</option>
                        <option value="SC">SC (Subcutaneous)</option>
                        <option value="Nebulization">Nebulization</option>
                        <option value="Sublingual">Sublingual</option>
                        <option value="Topical">Topical</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Frequency</label>
                      <select value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="STAT">STAT (Once immediately)</option>
                        <option value="OD">Once daily (OD)</option>
                        <option value="BD">Twice daily (BD)</option>
                        <option value="TDS">Thrice daily (TDS)</option>
                        <option value="Q4H">Every 4 hours (Q4H)</option>
                        <option value="Q6H">Every 6 hours (Q6H)</option>
                        <option value="PRN">As needed (PRN)</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Quantity</label>
                      <input type="number" value={medQuantity} onChange={(e) => setMedQuantity(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)} />
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Special Instructions</label>
                      <input placeholder="Infuse over 30 mins, with fluids..." value={medInstructions} onChange={(e) => setMedInstructions(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      className="btn-emergency-primary"
                      type="submit"
                      disabled={state.pending.order || (selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status))}
                      style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) ? 0.5 : 1 }}
                    >
                      <i className="ph ph-plus-circle" /> Submit Medication Order
                    </button>
                  </div>
                </form>

                {/* Live Prescribed Medications List */}
                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                    Encounter Prescribed Medications ({pharmacyOrders.length})
                  </h4>
                  {pharmacyOrders.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No medications prescribed yet for this emergency encounter.</p>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Medication</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pharmacyOrders.map((o, idx) => (
                            <tr key={o.downstream_id || idx}>
                              <td><strong>{(o.downstream_id || `RX-${idx + 1}`).slice(0, 10)}</strong></td>
                              <td><strong style={{ color: '#2563eb' }}>Pharmacy Prescription</strong></td>
                              <td><span className="admission-status-pill CONFIRMED">STAT</span></td>
                              <td><span className="admission-status-pill Pending">{o.status}</span></td>
                              <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{new Date(o.created_at).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 6: Lab Orders */}
            {activeTab === 'Lab Orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <form onSubmit={handleAddLabOrder} className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>STAT Laboratory Investigations</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Order emergency laboratory tests from the hospital catalogue</p>
                  </div>

                  {selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <i className="ph ph-warning-circle" style={{ fontSize: '1.2rem', color: '#dc2626' }} />
                      This emergency encounter has reached final disposition ({selected.status.toLowerCase().replace(/_/g, ' ')}). Lab orders are locked.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.85rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Lab Test Service *</label>
                      <select value={labServiceId} onChange={(e) => setLabServiceId(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)} required>
                        <option value="">Select Lab Test from catalogue ({labServices.length} available)</option>
                        {labServices.map((s: ServiceResponse) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code}) - ${s.standard_price}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Priority</label>
                      <select value={labPriority} onChange={(e) => setLabPriority(orderPriorityOf(e.target.value))} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="STAT">STAT (Immediate Emergency)</option>
                        <option value="URGENT">Urgent</option>
                        <option value="ROUTINE">Routine</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Specimen Type</label>
                      <select value={labSpecimen} onChange={(e) => setLabSpecimen(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="Blood">Whole Blood / Serum</option>
                        <option value="Arterial Blood Gas">Arterial Blood Gas (ABG)</option>
                        <option value="Urine">Urine Sample</option>
                        <option value="CSF">CSF (Cerebrospinal Fluid)</option>
                        <option value="Swab">Swab / Culture</option>
                      </select>
                    </div>
                  </div>

                  <div className="adm-field" style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Indication / Notes</label>
                    <input
                      placeholder="e.g. Acute chest pain, rule out myocardial infarction..."
                      value={labClinicalNotes}
                      onChange={(e) => setLabClinicalNotes(e.target.value)}
                      disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      className="btn-emergency-primary"
                      type="submit"
                      disabled={state.pending.order || (selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status))}
                      style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) ? 0.5 : 1 }}
                    >
                      <i className="ph ph-flask" /> Submit Lab Order
                    </button>
                  </div>
                </form>

                {/* Live Lab Orders List */}
                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                    Ordered Laboratory Tests ({labOrders.length})
                  </h4>
                  {labOrders.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No lab orders requested yet for this encounter.</p>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Test / Service</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Requested At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labOrders.map((o, idx) => (
                            <tr key={o.downstream_id || idx}>
                              <td><strong>{(o.downstream_id || `LAB-${idx + 1}`).slice(0, 10)}</strong></td>
                              <td><strong style={{ color: '#2563eb' }}>Laboratory Investigation</strong></td>
                              <td><span className="admission-status-pill CONFIRMED">STAT</span></td>
                              <td><span className="admission-status-pill Pending">{o.status}</span></td>
                              <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{new Date(o.created_at).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 7: Imaging Orders */}
            {activeTab === 'Imaging Orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <form onSubmit={handleAddImagingOrder} className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>STAT Radiology & Imaging Orders</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Order emergency X-Ray, CT, Ultrasound FAST, and MRI</p>
                  </div>

                  {selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <i className="ph ph-warning-circle" style={{ fontSize: '1.2rem', color: '#dc2626' }} />
                      This emergency encounter has reached final disposition ({selected.status.toLowerCase().replace(/_/g, ' ')}). Imaging orders are locked.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.85rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Imaging Service *</label>
                      <select value={imgServiceId} onChange={(e) => setImgServiceId(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)} required>
                        <option value="">Select Imaging Study ({imagingServices.length} available)</option>
                        {imagingServices.map((s: ServiceResponse) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code}) - ${s.standard_price}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Modality</label>
                      <select value={imgModality} onChange={(e) => setImgModality(e.target.value)} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="X-Ray">X-Ray</option>
                        <option value="CT Scan">CT Scan</option>
                        <option value="Ultrasound">Ultrasound FAST</option>
                        <option value="MRI">MRI</option>
                        <option value="ECG">ECG / Echo</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Priority</label>
                      <select value={imgPriority} onChange={(e) => setImgPriority(orderPriorityOf(e.target.value))} disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}>
                        <option value="STAT">STAT (Immediate)</option>
                        <option value="URGENT">Urgent</option>
                        <option value="ROUTINE">Routine</option>
                      </select>
                    </div>
                  </div>

                  <div className="adm-field" style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Notes / Region to Scan</label>
                    <input
                      placeholder="e.g. Chest trauma, rule out pneumothorax / rib fractures..."
                      value={imgNotes}
                      onChange={(e) => setImgNotes(e.target.value)}
                      disabled={selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      className="btn-emergency-primary"
                      type="submit"
                      disabled={state.pending.order || (selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status))}
                      style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: selected && ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(selected.status) ? 0.5 : 1 }}
                    >
                      <i className="ph ph-film-strip" /> Submit Imaging Order
                    </button>
                  </div>
                </form>

                {/* Live Imaging Orders List */}
                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                    Ordered Imaging Studies ({imagingOrders.length})
                  </h4>
                  {imagingOrders.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No imaging studies ordered yet for this encounter.</p>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Imaging Study</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Requested At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imagingOrders.map((o, idx) => (
                            <tr key={o.downstream_id || idx}>
                              <td><strong>{(o.downstream_id || `IMG-${idx + 1}`).slice(0, 10)}</strong></td>
                              <td><strong style={{ color: '#9333ea' }}>Radiology Study</strong></td>
                              <td><span className="admission-status-pill CONFIRMED">STAT</span></td>
                              <td><span className="admission-status-pill Pending">{o.status}</span></td>
                              <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{new Date(o.created_at).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 8: Referral */}
            {activeTab === 'Referral' && (
              <form onSubmit={handleAddReferral} className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Emergency Clinical Referral & Coordination</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Coordinate emergency specialist consults and department referrals</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Referring To Department *</label>
                    <select value={refDeptId} onChange={(e) => setRefDeptId(e.target.value)} required>
                      <option value="">Select Department</option>
                      {state.departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Target Specialist / Doctor (Optional)</label>
                    <select value={refDoctorId} onChange={(e) => setRefDoctorId(e.target.value)}>
                      <option value="">Select Doctor</option>
                      {state.doctors
                        .filter((doc) => !refDeptId || doc.department_id === refDeptId)
                        .map((doc) => (
                          <option key={doc.id} value={doc.id}>{doc.display_name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Referral Urgency</label>
                    <select value={refPriority} onChange={(e) => setRefPriority(e.target.value)}>
                      <option value="EMERGENCY">Immediate Emergency Transfer / Bedside Review</option>
                      <option value="URGENT">Urgent Same-Day Consult</option>
                      <option value="ROUTINE">Routine Consult</option>
                    </select>
                  </div>

                  <div className="adm-field">
                    <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Reason for Referral</label>
                    <select value={refReason} onChange={(e) => setRefReason(e.target.value)}>
                      <option value="Specialist Emergency Consultation">Specialist Emergency Consultation</option>
                      <option value="Inpatient Admission / Bed Hold">Inpatient Admission / Bed Hold</option>
                      <option value="Emergency Surgical Clearance">Emergency Surgical Clearance</option>
                      <option value="ICU / HDU Step-Up">ICU / HDU Step-Up</option>
                    </select>
                  </div>
                </div>

                <div className="adm-field" style={{ marginTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Summary & Handover Notes</label>
                  <textarea
                    placeholder="Patient summary, immediate emergency stabilization performed, pending investigations..."
                    value={refNotes}
                    onChange={(e) => setRefNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    className="btn-emergency-primary"
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <i className="ph ph-paper-plane-tilt" /> Dispatch Clinical Referral
                  </button>
                </div>
              </form>
            )}

            {/* Tab 9: Notes & Tab 10: Documents */}
            {(activeTab === 'Notes' || activeTab === 'Documents') && (
              <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{activeTab} Management</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Emergency documentation and patient medical records</p>
                </div>
                <div className="adm-field">
                  <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Documentation Notes</label>
                  <textarea placeholder="Record clinical handover observations..." rows={5} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    className="btn-emergency-primary"
                    onClick={() => toast.success(`${activeTab} updated.`)}
                    type="button"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save {activeTab}
                  </button>
                </div>
              </section>
            )}

            {/* Tab 11: Disposition */}
            {activeTab === 'Disposition' && (
              <form onSubmit={confirmDisposition} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selected?.status === 'READY_FOR_DISPOSITION' && (
                  <div style={{ padding: '14px 18px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className="ph ph-bed" style={{ fontSize: '1.5rem', color: '#2563eb' }} />
                      <div>
                        <strong style={{ color: '#1e40af', fontSize: '0.9rem', display: 'block' }}>Admission Request Active</strong>
                        <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>Patient details have been captured and the record is waiting for Ward & Bed allocation in Inpatient Bed Management.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary compact"
                      onClick={() => navigate(`/admissions/inpatients?branch_id=${state.branchId}`)}
                      style={{ padding: '6px 14px', fontSize: '0.82rem', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                    >
                      <i className="ph ph-arrow-square-out" /> Open Bed Allocation
                    </button>
                  </div>
                )}
                <section className="emergency-form-section" style={{ background: '#fff', borderRadius: '10px', padding: '18px', border: '1px solid #e2e8f0' }}>
                  <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Final Emergency Disposition</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Confirm safe transition to admission, discharge or transfer</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Disposition Decision <span style={{ color: '#dc2626' }}>*</span></label>
                      <select {...disposition.register('decision')}>
                        <option value="ADMIT">Admit to Inpatient Unit</option>
                        <option value="DISCHARGE">Discharge Home</option>
                        <option value="TRANSFER">Transfer to External Facility</option>
                        <option value="LEFT">Patient Left Against Medical Advice</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Target Unit / Bed Type</label>
                      <select defaultValue="ICU">
                        <option value="ICU">ICU (Intensive Care Unit)</option>
                        <option value="HDU">HDU (High Dependency Unit)</option>
                        <option value="General Ward">General Medical Ward</option>
                        <option value="Surgical Ward">Surgical Inpatient Ward</option>
                      </select>
                    </div>

                    <div className="adm-field">
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Transfer Destination (if transferring)</label>
                      <input {...disposition.register('transfer_destination')} placeholder="e.g. National Referral Hospital" />
                    </div>

                    <div className="adm-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Summary & Discharge / Admission Instructions *</label>
                      <textarea {...disposition.register('summary')} placeholder="Key clinical findings, treatments administered, handover summary..." rows={3} />
                    </div>
                  </div>
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn-emergency-primary"
                    disabled={state.pending.disposition}
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {state.pending.disposition ? 'Confirming...' : 'Confirm Final Disposition'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>

        {/* Right Column: Sticky Live Vital Signs Widget */}
        <aside style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Live Vital Signs</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>BP</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{bp}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Pulse</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{pulse}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>SpO₂</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{spo2}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Temp</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{temp}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Resp.</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{resp}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>GCS</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{gcs}</strong>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
            <i className="ph ph-waveform" style={{ marginRight: '4px', color: '#16a34a' }} />
            Live monitoring active
          </div>
        </aside>
      </div>

      {/* Modal: Link Registered Patient */}
      <Modal open={linkPatientOpen} onClose={() => setLinkPatientOpen(false)} title="Link Patient Record">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '420px' }}>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569' }}>
            Link this provisional emergency encounter ({selected.emergency_identifier || selected.encounter_number}) to an existing registered patient.
          </p>
          <div className="adm-field">
            <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Select Patient Record *</label>
            <select value={linkPatientId} onChange={(e) => setLinkPatientId(e.target.value)}>
              <option value="">Select registered patient</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>{p.patient_number} - {p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Reason / Verification Notes</label>
            <input
              placeholder="e.g. Identity verified via national ID presented by family"
              value={linkReason}
              onChange={(e) => setLinkReason(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setLinkPatientOpen(false)}>Cancel</button>
            <button className="btn-primary" type="button" onClick={confirmLinkPatient} disabled={state.pending.linkPatient}>
              Confirm Link
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Override Triage Priority */}
      <Modal open={priorityOpen} onClose={() => setPriorityOpen(false)} title="Override Triage Priority">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '420px' }}>
          <div className="adm-field">
            <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>New Triage Severity Level *</label>
            <select value={priorityLevel} onChange={(e) => setPriorityLevel(triageLevelOf(e.target.value))}>
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>{triageLabel(lvl)}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Reason for Triage Override *</label>
            <textarea
              placeholder="Clinical reason for elevating or lowering priority..."
              value={priorityReason}
              onChange={(e) => setPriorityReason(e.target.value)}
              rows={2}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setPriorityOpen(false)}>Cancel</button>
            <button className="btn-primary" type="button" onClick={confirmPriorityOverride} disabled={state.pending.overridePriority}>
              Update Triage Level
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Assign Doctor */}
      <Modal open={assignDoctorOpen} onClose={() => setAssignDoctorOpen(false)} title="Assign Attending Doctor" icon="ph-user-plus">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '420px' }}>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569' }}>
            Assign an attending physician from the hospital roster to manage this emergency encounter ({selected.encounter_number}).
          </p>
          <div className="adm-field">
            <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Attending Doctor *</label>
            <select value={assignDoctorId} onChange={(e) => setAssignDoctorId(e.target.value)}>
              <option value="">Select doctor from roster</option>
              {state.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name} {d.specialization ? `(${d.specialization})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn-secondary" onClick={() => setAssignDoctorOpen(false)}>Cancel</button>
            <button className="btn-primary" type="button" onClick={confirmAssignDoctor} disabled={state.pending.consultation}>
              Assign Doctor
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
