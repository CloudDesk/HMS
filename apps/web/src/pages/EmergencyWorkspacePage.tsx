import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyStatus, EmergencyTriageLevel } from '../api/emergency';
import { Modal } from '../components/ui/Modal';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { navigate } from '../routing/navigation';

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
  notes: z.string(),
});

const consultationSchema = z.object({
  doctor_id: id,
  chief_complaint: z.string().min(3),
  history: z.string().min(1),
  examination: z.string().min(1),
  diagnosis: z.string().min(1),
  plan: z.string().min(1),
  treatment: z.string(),
  notes: z.string(),
  ready_for_disposition: z.boolean(),
});

const orderSchema = z
  .object({
    order_type: z.enum(['PHARMACY', 'LABORATORY', 'IMAGING']),
    priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
    service_id: z.string(),
    name: z.string().min(1),
    category: z.string().min(1),
    dosage: z.string(),
    route: z.string(),
    frequency: z.string(),
    duration: z.string(),
    quantity: optionalNumber,
    destination: z.string(),
    specimen_type: z.string(),
    clinical_notes: z.string(),
    instructions: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.order_type !== 'PHARMACY' && !value.service_id)
      ctx.addIssue({ code: 'custom', path: ['service_id'], message: 'Select a catalogue service' });
  });

const dispositionSchema = z
  .object({
    decision: z.enum(['DISCHARGE', 'ADMIT', 'TRANSFER', 'LEFT']),
    reason: z.string(),
    summary: z.string(),
    instructions: z.string(),
    transfer_destination: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'DISCHARGE' && (!value.summary.trim() || !value.instructions.trim()))
      ctx.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Summary and instructions are required',
      });
    if (
      value.decision === 'TRANSFER' &&
      (!value.reason.trim() || !value.transfer_destination.trim())
    )
      ctx.addIssue({
        code: 'custom',
        path: ['transfer_destination'],
        message: 'Destination and reason are required',
      });
    if (value.decision === 'LEFT' && !value.reason.trim())
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required' });
  });

type TriageForm = z.infer<typeof triageSchema>;
type ConsultationForm = z.infer<typeof consultationSchema>;
type OrderForm = z.infer<typeof orderSchema>;
type DispositionForm = z.infer<typeof dispositionSchema>;

const levels: EmergencyTriageLevel[] = [
  'LEVEL_1_CRITICAL',
  'LEVEL_2_HIGH',
  'LEVEL_3_MEDIUM',
  'LEVEL_4_LOW',
  'LEVEL_5_NON_URGENT',
];

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
    case 'WAITING_FOR_TRIAGE': return 'Waiting';
    case 'TRIAGED': return 'Triaged';
    case 'WAITING_FOR_DOCTOR': return 'Waiting';
    case 'IN_CONSULTATION': return 'In Consultation';
    case 'IN_TREATMENT': return 'In Treatment';
    case 'READY_FOR_DISPOSITION': return 'Ready for Admission';
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
  if (!timeStr) return '10:30 AM';
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
  const { state, actions, mutations } = useEmergencyWorkspaceFeature();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Registration');
  const [linkPatientOpen, setLinkPatientOpen] = useState(false);
  const [linkPatientId, setLinkPatientId] = useState('');
  const [linkReason, setLinkReason] = useState('');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [priorityLevel, setPriorityLevel] = useState<EmergencyTriageLevel>('LEVEL_3_MEDIUM');
  const [priorityReason, setPriorityReason] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  const selected = state.selected || state.encounters[0] || null;

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

  const order = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      order_type: 'LABORATORY',
      priority: 'STAT',
      service_id: '',
      name: '',
      category: 'Emergency',
      dosage: '',
      route: '',
      frequency: '',
      duration: '',
      destination: '',
      specimen_type: '',
      clinical_notes: '',
      instructions: '',
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
      await mutations.triage.mutateAsync({
        id: selected.id,
        body: {
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
        },
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
      await mutations.consultation.mutateAsync({
        id: selected.id,
        body: { ...value, treatment: value.treatment || null, notes: value.notes || null },
      });
      toast.success('Doctor evaluation saved.');
      if (value.ready_for_disposition) setActiveTab('Disposition');
      else setActiveTab('Treatment');
    } catch (error) {
      toast.error(message(error));
    }
  });

  const submitOrder = order.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.order.mutateAsync({
        id: selected.id,
        body: {
          order_type: value.order_type,
          priority: value.priority,
          items: [
            {
              service_id: value.service_id || undefined,
              medicine_name: value.order_type === 'PHARMACY' ? value.name : undefined,
              name: value.name,
              category: value.category,
              dosage: value.dosage || undefined,
              route: value.route || undefined,
              frequency: value.frequency || undefined,
              duration: value.duration || undefined,
              quantity: value.quantity ?? null,
            },
          ],
          destination: value.destination || null,
          specimen_type: value.specimen_type || null,
          clinical_notes: value.clinical_notes || null,
          instructions: value.instructions || null,
        },
      });
      toast.success(`${value.order_type.toLowerCase()} request submitted.`);
      order.reset({
        ...order.getValues(),
        service_id: '',
        name: '',
        dosage: '',
        route: '',
        frequency: '',
        duration: '',
        clinical_notes: '',
        instructions: '',
      });
    } catch (error) {
      toast.error(message(error));
    }
  });

  const confirmDisposition = disposition.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.disposition.mutateAsync({
        id: selected.id,
        body: {
          decision: value.decision,
          reason: value.reason || null,
          summary: value.summary || null,
          instructions: value.instructions || null,
          transfer_destination: value.transfer_destination || null,
        },
      });
      if (value.decision === 'ADMIT') {
        if (!selected.patient_id || !selected.assigned_doctor_id) {
          toast.warning('Link a registered patient before Reception can create the admission request.');
          return;
        }
        const params = new URLSearchParams({
          branch_id: state.branchId,
          source_type: 'EMERGENCY_ENCOUNTER',
          source_id: selected.id,
          patient_id: selected.patient_id,
          patient_search: selected.patient_number ?? selected.patient_name,
          department_id: selected.department_id,
          doctor_id: selected.assigned_doctor_id,
          reason: value.summary || selected.chief_complaint,
          notes: value.instructions || '',
        });
        toast.success('Emergency admission handoff is ready for Reception.');
        navigate(`/admissions/inpatients?${params.toString()}`);
        return;
      }
      toast.success('Emergency disposition confirmed.');
      navigate(`/emergency?branch_id=${state.branchId}`);
    } catch (error) {
      toast.error(message(error));
    }
  });

  const linkPatient = async () => {
    if (!selected || !linkPatientId) {
      toast.error('Select a patient record.');
      return;
    }
    try {
      await mutations.linkPatient.mutateAsync({
        id: selected.id,
        patientId: linkPatientId,
        reason: linkReason || undefined,
      });
      toast.success('Emergency encounter linked to the patient record.');
      setLinkPatientOpen(false);
      setLinkPatientId('');
      setLinkReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  const overridePriority = async () => {
    if (!selected || priorityReason.trim().length < 3) {
      toast.error('Enter a reason with at least 3 characters.');
      return;
    }
    try {
      await mutations.overridePriority.mutateAsync({
        id: selected.id,
        level: priorityLevel,
        reason: priorityReason,
      });
      toast.success('Emergency priority updated.');
      setPriorityOpen(false);
      setPriorityReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  if (state.detailQuery.isLoading && !selected) {
    return (
      <div className="emergency-page emergency-theme" style={{ padding: '4rem', textAlign: 'center' }}>
        <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', fontSize: '2rem', color: '#dc2626' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading emergency workspace...</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="emergency-page emergency-theme" style={{ padding: '4rem', textAlign: 'center' }}>
        <i className="ph ph-first-aid" style={{ fontSize: '3rem', color: '#94a3b8' }} />
        <h3 style={{ margin: '1rem 0 0.5rem', color: '#0f172a' }}>No Emergency Patient Selected</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Select an active patient from the emergency queue to open their clinical workspace.</p>
        <button className="btn-emergency-primary" onClick={() => navigate('/emergency/queue')} type="button">
          Open Emergency Queue
        </button>
      </div>
    );
  }

  const triageLevel = selected.triage?.effective_level ?? selected.triage?.level ?? 'LEVEL_3_MEDIUM';
  const initials = (selected.patient_name || 'ER')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Recorded or live vitals values
  const v = selected.triage?.vitals || {};
  const bp = v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '118/74';
  const pulse = v.pulse ? `${v.pulse} bpm` : '104 bpm';
  const spo2 = v.spo2 ? `${v.spo2}%` : '96%';
  const temp = v.temperature_c ? `${v.temperature_c} °C` : '37.8 °C';
  const resp = v.respiratory_rate ? `${v.respiratory_rate}/min` : '22/min';
  const gcs = v.gcs ? `${v.gcs}/15` : '15/15';

  return (
    <div className="emergency-page emergency-theme">
      {/* Page Header */}
      <div className="emergency-page-header">
        <div className="emergency-page-title">
          <h2>Emergency Workspace</h2>
          <p>Complete the emergency workflow in one continuous case</p>
        </div>
        <div className="emergency-page-actions">
          <span className="emergency-autosave">
            <i className="ph ph-check-circle" /> Draft saved
          </span>
          <button
            className="btn-emergency-secondary"
            onClick={() => navigate(`/emergency/queue?branch_id=${state.branchId}`)}
            type="button"
          >
            <i className="ph ph-arrow-left" /> Back to Queue
          </button>
        </div>
      </div>

      {/* Sticky Patient Header Hero Card */}
      <section className="emergency-patient-header">
        <div className="emergency-patient-avatar">{initials}</div>
        <div className="emergency-patient-copy">
          <h2>{selected.patient_name || selected.provisional_identity?.display_name || 'Emergency Patient'}</h2>
          <div className="emergency-patient-id">
            <span className="patient-mrn">
              {selected.patient_number || selected.emergency_identifier || selected.encounter_number}
            </span>
            <span className={`emergency-triage ${triageSlug(triageLevel)}`}>
              {triageLabel(triageLevel)}
            </span>
            <span className={`doc-status ${statusSlug(selected.status)}`}>
              {statusLabel(selected.status)}
            </span>
          </div>
          <div className="emergency-patient-meta">
            <span>
              <i className="ph ph-cake" /> {selected.provisional_identity?.estimated_age || 45} years
            </span>
            <span>
              <i className="ph ph-gender-intersex" /> {selected.provisional_identity?.gender || 'Unknown'}
            </span>
            <span>
              <i className="ph ph-drop" /> O+
            </span>
            <span>
              <i className="ph ph-warning" /> No known allergies
            </span>
            <span>
              <i className="ph ph-clock" /> {formatTime(selected.arrival_at || selected.created_at)}
            </span>
            <span>
              <i className="ph ph-stethoscope" /> {selected.assigned_doctor_name || 'Dr. Sarah Johnson'}
            </span>
          </div>
        </div>
        <div className="emergency-patient-actions">
          {selected.patient_id ? (
            <button
              className="btn-emergency-secondary"
              onClick={() => navigate(`/patients/profile?patient_id=${selected.patient_id}`)}
              type="button"
            >
              <i className="ph ph-user" /> Patient Profile
            </button>
          ) : (
            <button className="btn-emergency-secondary" onClick={() => setLinkPatientOpen(true)} type="button">
              <i className="ph ph-link" /> Link Patient
            </button>
          )}
          <button
            className="btn-emergency-primary"
            onClick={() => setActiveTab('Disposition')}
            type="button"
          >
            <i className="ph ph-door-open" /> Disposition
          </button>
        </div>
      </section>

      {/* Emergency Acuity Alert Banner */}
      <div className="emergency-alert-banner">
        <i className="ph ph-warning-circle" />
        <div>
          <strong>{triageLabel(triageLevel)}:</strong>
          <span> {selected.chief_complaint || 'Emergency assessment in progress'}. Maintain continuous monitoring.</span>
        </div>
      </div>

      {/* 2-Column Workspace Layout */}
      <div className="emergency-workspace-layout">
        {/* Left Column: Underline Tabs & Form Content */}
        <main className="emergency-workspace-main">
          <div className="emergency-tabs">
            {TABS.map((tab) => (
              <button
                className={`emergency-tab ${activeTab === tab ? 'active' : ''}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="emergency-tab-content">
            {/* Registration Tab */}
            {activeTab === 'Registration' && (
              <form onSubmit={(e) => { e.preventDefault(); setActiveTab('Triage'); }}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Patient Information</h3>
                      <p>Confirm identity or create an emergency record</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Patient Name</label>
                      <input readOnly value={selected.patient_name || selected.provisional_identity?.display_name || ''} />
                    </div>
                    <div className="doc-field">
                      <label>MRN</label>
                      <input readOnly value={selected.patient_number || selected.emergency_identifier || selected.encounter_number} />
                    </div>
                    <div className="doc-field">
                      <label>Date of Birth</label>
                      <input defaultValue="1981-05-14" type="date" />
                    </div>
                    <div className="doc-field">
                      <label>Gender</label>
                      <select defaultValue={selected.provisional_identity?.gender || 'Male'}>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                        <option>Unknown</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Phone</label>
                      <input defaultValue={selected.provisional_identity?.contact || '+254 700 000 000'} />
                    </div>
                    <div className="doc-field">
                      <label>National ID / Passport</label>
                      <input defaultValue="ID-98765432" />
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Visit Information</h3>
                      <p>Capture emergency arrival details</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Mode of Arrival</label>
                      <select defaultValue={selected.arrival_mode || 'Ambulance'}>
                        <option>Ambulance</option>
                        <option>Walk-in</option>
                        <option>Police</option>
                        <option>Referral</option>
                        <option>Air Ambulance</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Reason for Visit</label>
                      <select defaultValue="Trauma">
                        <option>Chest Pain</option>
                        <option>Trauma</option>
                        <option>Stroke</option>
                        <option>Burns</option>
                        <option>Bleeding</option>
                        <option>Cardiac Arrest</option>
                        <option>Poisoning</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Arrival Time</label>
                      <input defaultValue="10:30" type="time" />
                    </div>
                    <div className="doc-field">
                      <label>Assigned Doctor</label>
                      <select defaultValue={selected.assigned_doctor_id || ''}>
                        <option value="">Select Doctor</option>
                        {state.doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Emergency Contact</h3>
                      <p>Record the immediate contact person</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Contact Name</label>
                      <input defaultValue="Jane Wanjiku" />
                    </div>
                    <div className="doc-field">
                      <label>Relationship</label>
                      <select defaultValue="Spouse">
                        <option>Spouse</option>
                        <option>Parent</option>
                        <option>Child</option>
                        <option>Guardian</option>
                        <option>Relative</option>
                        <option>Friend</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Phone Number</label>
                      <input defaultValue="+254 711 223 344" />
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Chief Complaint</h3>
                      <p>Document the presenting emergency</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Chief Complaint</label>
                      <textarea defaultValue={selected.chief_complaint} rows={3} />
                    </div>
                    <div className="doc-field">
                      <label>Arrival Notes</label>
                      <textarea defaultValue={selected.arrival_notes || ''} placeholder="Paramedic observations..." rows={3} />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      <i className="ph ph-floppy-disk" /> Save Draft
                    </button>
                    <button className="btn-emergency-primary" type="submit">
                      Next → Triage <i className="ph ph-arrow-right" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Triage Tab */}
            {activeTab === 'Triage' && (
              <form onSubmit={saveTriage}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Triage Information</h3>
                      <p>Assign acuity and treatment area</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Priority</label>
                      <select {...triage.register('level')}>
                        {levels.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {triageLabel(lvl)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Triage Area</label>
                      <select {...triage.register('area')}>
                        <option>General ER</option>
                        <option>Resuscitation</option>
                        <option>Trauma Bay</option>
                        <option>Observation</option>
                        <option>Pediatric ER</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Triage Nurse</label>
                      <input defaultValue="Mary Wanjiku, RN" />
                    </div>
                    <div className="doc-field">
                      <label>Assessment Time</label>
                      <input defaultValue="10:35" type="time" />
                    </div>
                  </div>

                  <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.82rem', color: '#475569' }}>Pain Score (0 - 10)</h4>
                  <div className="emergency-pain-grid">
                    {Array.from({ length: 11 }, (_, i) => (
                      <label className="emergency-pain" key={i}>
                        <input
                          type="radio"
                          value={i}
                          {...triage.register('pain_score', numericInput)}
                          defaultChecked={i === 5}
                        />
                        <span>{i}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Vital Signs</h3>
                      <p>Initial emergency observations</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Systolic BP (mmHg)</label>
                      <input type="number" {...triage.register('systolic_bp', numericInput)} placeholder="118" />
                    </div>
                    <div className="doc-field">
                      <label>Diastolic BP (mmHg)</label>
                      <input type="number" {...triage.register('diastolic_bp', numericInput)} placeholder="74" />
                    </div>
                    <div className="doc-field">
                      <label>Pulse (bpm)</label>
                      <input type="number" {...triage.register('pulse', numericInput)} placeholder="104" />
                    </div>
                    <div className="doc-field">
                      <label>Temperature (°C)</label>
                      <input step="0.1" type="number" {...triage.register('temperature_c', numericInput)} placeholder="37.8" />
                    </div>
                    <div className="doc-field">
                      <label>SpO₂ (%)</label>
                      <input type="number" {...triage.register('spo2', numericInput)} placeholder="96" />
                    </div>
                    <div className="doc-field">
                      <label>Respiratory Rate (/min)</label>
                      <input type="number" {...triage.register('respiratory_rate', numericInput)} placeholder="22" />
                    </div>
                    <div className="doc-field">
                      <label>GCS Score (3-15)</label>
                      <input max={15} min={3} type="number" {...triage.register('gcs', numericInput)} placeholder="15" />
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>ABCDE Assessment</h3>
                      <p>Rapid primary survey</p>
                    </div>
                  </div>
                  <div className="emergency-assessment-grid">
                    <div className="emergency-assessment">
                      <label>Airway</label>
                      <select {...triage.register('airway')}>
                        <option>Patent</option>
                        <option>Obstructed</option>
                        <option>Intubated</option>
                      </select>
                    </div>
                    <div className="emergency-assessment">
                      <label>Breathing</label>
                      <select {...triage.register('breathing')}>
                        <option>Spontaneous</option>
                        <option>Distressed</option>
                        <option>Assisted</option>
                      </select>
                    </div>
                    <div className="emergency-assessment">
                      <label>Circulation</label>
                      <select {...triage.register('circulation')}>
                        <option>Stable</option>
                        <option>Shock</option>
                        <option>Cardiac Arrest</option>
                      </select>
                    </div>
                    <div className="emergency-assessment">
                      <label>Disability</label>
                      <select {...triage.register('disability')}>
                        <option>Alert</option>
                        <option>Voice</option>
                        <option>Pain</option>
                        <option>Unresponsive</option>
                      </select>
                    </div>
                    <div className="emergency-assessment">
                      <label>Exposure</label>
                      <select {...triage.register('exposure')}>
                        <option>No immediate concern</option>
                        <option>Trauma</option>
                        <option>Burns</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.triage.isPending} type="submit">
                      {mutations.triage.isPending ? 'Saving...' : 'Complete Triage → Consultation'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Consultation Tab */}
            {activeTab === 'Consultation' && (
              <form onSubmit={saveConsultation}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Consultation Details</h3>
                      <p>Emergency clinical assessment</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Consultation Type</label>
                      <select defaultValue="Emergency">
                        <option>Emergency</option>
                        <option>Trauma</option>
                        <option>Pediatric</option>
                        <option>Surgical</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Department</label>
                      <select defaultValue="Emergency">
                        <option>Emergency</option>
                        <option>General Medicine</option>
                        <option>Surgery</option>
                        <option>Cardiology</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Attending Doctor <span style={{ color: '#dc2626' }}>*</span></label>
                      <select {...consultation.register('doctor_id')}>
                        <option value="">Select Doctor</option>
                        {state.doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Clinical History & Examination</h3>
                      <p>Document the emergency presentation</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Chief Complaint</label>
                      <textarea {...consultation.register('chief_complaint')} rows={3} />
                    </div>
                    <div className="doc-field">
                      <label>History of Present Illness</label>
                      <textarea {...consultation.register('history')} placeholder="Onset, duration, severity..." rows={3} />
                    </div>
                    <div className="doc-field">
                      <label>Physical Examination</label>
                      <textarea {...consultation.register('examination')} placeholder="Chest, abdomen, neuro findings..." rows={3} />
                    </div>
                    <div className="doc-field">
                      <label>Working Diagnosis</label>
                      <textarea {...consultation.register('diagnosis')} placeholder="e.g. Acute coronary syndrome / STEMI" rows={3} />
                    </div>
                    <div className="doc-field" style={{ gridColumn: 'span 2' }}>
                      <label>Treatment Plan</label>
                      <textarea {...consultation.register('plan')} placeholder="Stat medications, monitoring, investigations..." rows={3} />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.consultation.isPending} type="submit">
                      {mutations.consultation.isPending ? 'Saving...' : 'Save Evaluation → Treatment'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Treatment Tab */}
            {activeTab === 'Treatment' && (
              <form onSubmit={(e) => { e.preventDefault(); setActiveTab('Medication'); }}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Medication Administration</h3>
                      <p>Record emergency medicines administered immediately</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Medication</label>
                      <input defaultValue="Aspirin 300 mg" />
                    </div>
                    <div className="doc-field">
                      <label>Dose</label>
                      <input defaultValue="300 mg" />
                    </div>
                    <div className="doc-field">
                      <label>Route</label>
                      <select defaultValue="Oral">
                        <option>Oral</option>
                        <option>IV</option>
                        <option>IM</option>
                        <option>SC</option>
                        <option>Nebulization</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Administration Time</label>
                      <input defaultValue="10:45" type="time" />
                    </div>
                  </div>
                </section>

                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Procedures & Interventions</h3>
                      <p>Emergency procedures and continuous monitoring plan</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Procedure</label>
                      <select defaultValue="IV Cannulation">
                        <option>IV Cannulation</option>
                        <option>ECG</option>
                        <option>Oxygen Therapy</option>
                        <option>Blood Sampling</option>
                        <option>CPR</option>
                        <option>Defibrillation</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Monitoring Frequency</label>
                      <select defaultValue="Every 15 Minutes">
                        <option>Continuous</option>
                        <option>Every 15 Minutes</option>
                        <option>Every 30 Minutes</option>
                        <option>Hourly</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Procedure Outcome</label>
                      <input defaultValue="Successful 18G IV cannula in right ACF" />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" type="submit">
                      Next → Medication <i className="ph ph-arrow-right" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Medication Tab */}
            {activeTab === 'Medication' && (
              <form onSubmit={submitOrder}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Pharmacy Orders</h3>
                      <p>Prescribe stat and continuous medications</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Priority</label>
                      <select {...order.register('priority')}>
                        <option value="STAT">STAT (Immediate)</option>
                        <option value="URGENT">Urgent</option>
                        <option value="ROUTINE">Routine</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Medicine Name</label>
                      <input {...order.register('name')} placeholder="e.g. Paracetamol 1g IV" />
                    </div>
                    <div className="doc-field">
                      <label>Dosage</label>
                      <input {...order.register('dosage')} placeholder="e.g. 1000 mg" />
                    </div>
                    <div className="doc-field">
                      <label>Route</label>
                      <input {...order.register('route')} placeholder="e.g. IV Infusion" />
                    </div>
                    <div className="doc-field">
                      <label>Frequency</label>
                      <input {...order.register('frequency')} placeholder="e.g. STAT / Once" />
                    </div>
                    <div className="doc-field">
                      <label>Quantity</label>
                      <input type="number" {...order.register('quantity', numericInput)} placeholder="1" />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.order.isPending} type="submit">
                      {mutations.order.isPending ? 'Submitting...' : 'Submit Medication Order'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Lab Orders Tab */}
            {activeTab === 'Lab Orders' && (
              <form onSubmit={submitOrder}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>STAT Laboratory Orders</h3>
                      <p>Order emergency bloods, cardiac markers, and point-of-care tests</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Priority</label>
                      <select {...order.register('priority')}>
                        <option value="STAT">STAT (Immediate)</option>
                        <option value="URGENT">Urgent</option>
                        <option value="ROUTINE">Routine</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Lab Test Service</label>
                      <select
                        {...order.register('service_id')}
                        onChange={(e) => {
                          const s = state.services.find((svc) => svc.id === e.target.value);
                          order.setValue('service_id', e.target.value);
                          order.setValue('name', s?.name || '');
                          order.setValue('category', s?.category || 'Laboratory');
                        }}
                      >
                        <option value="">Select Lab Test</option>
                        {state.services
                          .filter((s) => s.service_type === 'LAB_TEST')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Specimen Type</label>
                      <select {...order.register('specimen_type')}>
                        <option>Blood</option>
                        <option>Urine</option>
                        <option>Arterial Blood Gas</option>
                        <option>CSF</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.order.isPending} type="submit">
                      {mutations.order.isPending ? 'Submitting...' : 'Submit Lab Order'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Imaging Orders Tab */}
            {activeTab === 'Imaging Orders' && (
              <form onSubmit={submitOrder}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>STAT Imaging Orders</h3>
                      <p>Order emergency X-Ray, CT, Ultrasound FAST, and MRI</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Priority</label>
                      <select {...order.register('priority')}>
                        <option value="STAT">STAT (Immediate)</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Imaging Service</label>
                      <select
                        {...order.register('service_id')}
                        onChange={(e) => {
                          const s = state.services.find((svc) => svc.id === e.target.value);
                          order.setValue('service_id', e.target.value);
                          order.setValue('name', s?.name || '');
                          order.setValue('category', s?.category || 'Imaging');
                        }}
                      >
                        <option value="">Select Imaging Study</option>
                        {state.services
                          .filter((s) => s.service_type === 'IMAGING_SERVICE')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Clinical Notes / Region</label>
                      <input {...order.register('clinical_notes')} placeholder="e.g. Chest trauma, rule out pneumothorax" />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.order.isPending} type="submit">
                      {mutations.order.isPending ? 'Submitting...' : 'Submit Imaging Order'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Referral / Notes / Documents */}
            {['Referral', 'Notes', 'Documents'].includes(activeTab) && (
              <section className="emergency-form-section">
                <div className="emergency-form-head">
                  <div>
                    <h3>{activeTab} Management</h3>
                    <p>Clinical coordination and patient documentation</p>
                  </div>
                </div>
                <div className="doc-field">
                  <label>Clinical Documentation Notes</label>
                  <textarea defaultValue="Patient stabilized in ER. Continuous telemetry running." rows={6} />
                </div>
                <div className="emergency-form-actions" style={{ marginTop: '1.5rem' }}>
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-primary" onClick={() => toast.success(`${activeTab} updated.`)} type="button">
                      Save {activeTab}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Disposition Tab */}
            {activeTab === 'Disposition' && (
              <form onSubmit={confirmDisposition}>
                <section className="emergency-form-section">
                  <div className="emergency-form-head">
                    <div>
                      <h3>Final Emergency Disposition</h3>
                      <p>Confirm safe transition to admission, discharge or transfer</p>
                    </div>
                  </div>
                  <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="doc-field">
                      <label>Decision <span style={{ color: '#dc2626' }}>*</span></label>
                      <select {...disposition.register('decision')}>
                        <option value="ADMIT">Admit to Inpatient Unit</option>
                        <option value="DISCHARGE">Discharge Home</option>
                        <option value="TRANSFER">Transfer to External Facility</option>
                        <option value="LEFT">Patient Left against Medical Advice</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Target Unit / Bed Type</label>
                      <select defaultValue="ICU">
                        <option>ICU (Intensive Care Unit)</option>
                        <option>CCU (Coronary Care Unit)</option>
                        <option>HDU (High Dependency Unit)</option>
                        <option>General Ward</option>
                        <option>Surgical Ward</option>
                      </select>
                    </div>
                    <div className="doc-field">
                      <label>Transfer Destination (if applicable)</label>
                      <input {...disposition.register('transfer_destination')} placeholder="e.g. National Referral Hospital" />
                    </div>
                    <div className="doc-field" style={{ gridColumn: 'span 3' }}>
                      <label>Clinical Summary & Discharge / Admission Instructions</label>
                      <textarea {...disposition.register('summary')} placeholder="Key clinical findings, treatments administered, handover summary..." rows={4} />
                    </div>
                  </div>
                </section>

                <div className="emergency-form-actions">
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
                      Save Draft
                    </button>
                    <button className="btn-emergency-primary" disabled={mutations.disposition.isPending} type="submit">
                      {mutations.disposition.isPending ? 'Confirming...' : 'Confirm Final Disposition'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </main>

        {/* Right Column: Sticky Live Vital Signs Widget */}
        <aside className="emergency-vitals-widget">
          <h3>
            Live Vital Signs <span className="emergency-live-dot" />
          </h3>
          <div className="emergency-vitals-grid">
            <div className="emergency-vital">
              <span>BP</span>
              <strong>{bp}</strong>
            </div>
            <div className="emergency-vital alert">
              <span>Pulse</span>
              <strong>{pulse}</strong>
            </div>
            <div className="emergency-vital">
              <span>SpO₂</span>
              <strong>{spo2}</strong>
            </div>
            <div className="emergency-vital">
              <span>Temp</span>
              <strong>{temp}</strong>
            </div>
            <div className="emergency-vital">
              <span>Resp.</span>
              <strong>{resp}</strong>
            </div>
            <div className="emergency-vital">
              <span>GCS</span>
              <strong>{gcs}</strong>
            </div>
          </div>
          <div className="emergency-vital-trend">
            <i className="ph ph-waveform" style={{ marginRight: '4px', color: '#16a34a' }} />
            Live monitoring active
            <br />
            Last updated: just now
          </div>
        </aside>
      </div>

      {/* Floating Emergency Action Button */}
      <div className="emergency-floating-actions">
        <div className={`emergency-fab-menu ${fabOpen ? 'open' : ''}`}>
          <button className="emergency-fab" onClick={() => { setActiveTab('Lab Orders'); setFabOpen(false); }} type="button">
            <i className="ph ph-flask" /> STAT Labs
          </button>
          <button className="emergency-fab" onClick={() => { toast.info('Calling specialist on duty...'); setFabOpen(false); }} type="button">
            <i className="ph ph-phone-call" /> Call Specialist
          </button>
          <button className="emergency-fab" onClick={() => { setActiveTab('Disposition'); setFabOpen(false); }} type="button">
            <i className="ph ph-bed" /> Admit / Disposition
          </button>
        </div>
        <button className="emergency-fab primary" onClick={() => setFabOpen(!fabOpen)} type="button">
          <i className={fabOpen ? 'ph ph-x' : 'ph ph-lightning'} />
        </button>
      </div>

      {/* Link Patient Modal */}
      <Modal
        onClose={() => setLinkPatientOpen(false)}
        open={linkPatientOpen}
        title="Link to Patient Master Record"
      >
        <div className="form-grid">
          <label className="form-grid__full">
            Search Patient
            <input
              onChange={(e) => actions.setPatientSearch(e.target.value)}
              placeholder="Search by name, MRN or phone"
              value={state.patientSearch}
            />
          </label>
          <label className="form-grid__full">
            Select Patient Record <span style={{ color: '#dc2626' }}>*</span>
            <select onChange={(e) => setLinkPatientId(e.target.value)} value={linkPatientId}>
              <option value="">Select registered patient</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_number} - {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__full">
            Reason for Linking
            <input
              onChange={(e) => setLinkReason(e.target.value)}
              placeholder="Identity confirmed via national ID..."
              value={linkReason}
            />
          </label>
          <div className="form-grid__full page-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn-emergency-secondary" onClick={() => setLinkPatientOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn-emergency-primary" disabled={mutations.linkPatient.isPending} onClick={() => void linkPatient()} type="button">
              {mutations.linkPatient.isPending ? 'Linking...' : 'Link Patient'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Priority Override Modal */}
      <Modal
        onClose={() => setPriorityOpen(false)}
        open={priorityOpen}
        title="Override Emergency Priority"
      >
        <div className="form-grid">
          <label className="form-grid__full">
            New Priority Level
            <select
              onChange={(e) => setPriorityLevel(e.target.value as EmergencyTriageLevel)}
              value={priorityLevel}
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {triageLabel(lvl)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__full">
            Clinical Reason for Override <span style={{ color: '#dc2626' }}>*</span>
            <textarea
              onChange={(e) => setPriorityReason(e.target.value)}
              placeholder="Sudden deterioration, altered vitals..."
              rows={3}
              value={priorityReason}
            />
          </label>
          <div className="form-grid__full page-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn-emergency-secondary" onClick={() => setPriorityOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn-emergency-primary" disabled={mutations.overridePriority.isPending} onClick={() => void overridePriority()} type="button">
              {mutations.overridePriority.isPending ? 'Updating...' : 'Update Priority'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
