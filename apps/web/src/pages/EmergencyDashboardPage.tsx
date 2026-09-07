import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyEncounter, EmergencyStatus, EmergencyTriageLevel } from '../api/emergency';
import { Modal } from '../components/ui/Modal';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { navigate } from '../routing/navigation';

const id = z.string().min(1, 'Required');
const optionalNumber = z.number().optional();
const numericInput = { setValueAs: (value: string) => (value === '' ? undefined : Number(value)) };

const registrationSchema = z
  .object({
    department_id: id,
    patient_id: z.string().optional(),
    display_name: z.string().optional(),
    estimated_age: optionalNumber,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
    contact: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^\d{10}$/.test(val),
        'Phone number must be exactly 10 numeric digits',
      ),
    identity_notes: z.string().optional(),
    arrival_mode: z.string().min(2),
    chief_complaint: z.string().min(3, 'Chief emergency complaint is required'),
    arrival_notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.patient_id && (!value.display_name || value.display_name.trim().length < 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['patient_id'],
        message: 'Select a registered patient OR enter a patient name / unknown tag',
      });
    }
  });

type RegistrationForm = z.infer<typeof registrationSchema>;

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

const getWaitMinutes = (arrivalAt?: string, createdAt?: string) => {
  const timeStr = arrivalAt || createdAt;
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    const diff = Math.max(1, Math.floor((Date.now() - d.getTime()) / (1000 * 60)));
    return diff > 1000 ? '—' : `${diff} min`;
  } catch {
    return '—';
  }
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Action could not be completed.';

const TERMINAL_STATUSES = new Set([
  'DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED',
]);

// ─── Role-specific page subtitles ────────────────────────────────────────────

const SUBTITLE: Record<string, string> = {
  receptionist: 'Emergency registration, patient identification and administrative queue',
  nurse: 'Triage, vitals, nursing assessment and patient monitoring',
  doctor: 'Clinical consultation, diagnosis, orders and disposition',
  viewer: 'Live emergency operations, triage and bed readiness',
};

// ─── Patient avatar initials helper ──────────────────────────────────────────

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ER';

const Avatar = ({ name }: { name: string }) => (
  <div
    style={{
      width: '34px',
      height: '34px',
      borderRadius: '8px',
      background: '#2563eb',
      color: '#ffffff',
      display: 'grid',
      placeItems: 'center',
      fontSize: '0.78rem',
      fontWeight: 700,
      flexShrink: 0,
    }}
  >
    {initials(name)}
  </div>
);

export function EmergencyDashboardPage() {
  const { state, actions, mutations } = useEmergencyWorkspaceFeature();
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const { capabilities, dashboardProfile, currentUserId, currentDoctorId } = state;

  const isAssignedToMe = useMemo(() => {
    return (docId: string | null) =>
      Boolean(
        docId &&
          ((currentDoctorId && docId === currentDoctorId) ||
            (currentUserId && docId === currentUserId)),
      );
  }, [currentDoctorId, currentUserId]);

  const registration = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      department_id: '',
      patient_id: '',
      display_name: '',
      gender: 'UNKNOWN',
      contact: '',
      identity_notes: '',
      arrival_mode: 'Walk-in',
      chief_complaint: '',
      arrival_notes: '',
    },
  });

  const selectedPatientId = registration.watch('patient_id');
  const selectedPatient = state.patients.find((p) => p.id === selectedPatientId);

  const emergencyComplaintPresets = [
    '⚡ Acute Chest Pain',
    '🫁 Severe Dyspnea / SOB',
    '🚗 Polytrauma / RTA',
    '🩸 Major Hemorrhage',
    '🧠 Stroke / Altered Consciousness',
    '🔥 Burn Injury',
    '⚠️ Acute Abdominal Pain',
    '😵 Syncope / Unresponsive',
  ];

  const quickTraumaTags = [
    'Unknown Male #1',
    'Unknown Female #1',
    'Trauma Victim #1',
    'Pediatric Trauma #1',
    'Unconscious Patient #1',
  ];

  const handleSelectPresetComplaint = (presetText: string) => {
    const cleanText = presetText.replace(/^[\p{Emoji}\s]+/gu, '').trim();
    const current = registration.getValues('chief_complaint') || '';
    if (!current.trim()) {
      registration.setValue('chief_complaint', cleanText, { shouldValidate: true });
    } else if (!current.includes(cleanText)) {
      registration.setValue('chief_complaint', `${current}, ${cleanText}`, { shouldValidate: true });
    }
  };

  const createEncounter = registration.handleSubmit(async (values) => {
    try {
      const isKnown = Boolean(values.patient_id);
      const created = await mutations.create.mutateAsync({
        branch_id: state.branchId,
        department_id: values.department_id,
        patient_id: isKnown ? values.patient_id : null,
        provisional_identity: !isKnown
          ? {
              display_name: values.display_name || 'Unknown Patient',
              estimated_age: values.estimated_age ?? null,
              gender: values.gender || 'UNKNOWN',
              contact: values.contact || null,
              identity_notes: values.identity_notes || null,
            }
          : null,
        arrival_mode: values.arrival_mode,
        chief_complaint: values.chief_complaint,
        arrival_notes: values.arrival_notes || null,
      });
      setRegistrationOpen(false);
      registration.reset();
      toast.success(`Encounter ${created.emergency_identifier || created.encounter_number} registered.`);
      navigate(`/emergency/queue?branch_id=${state.branchId}`);
    } catch (error) {
      toast.error(message(error));
    }
  });

  // ─── Encounter partitions ─────────────────────────────────────────────────

  const allEncounters = state.encounters;

  const activeEncounters = useMemo(
    () => allEncounters.filter((e) => !TERMINAL_STATUSES.has(e.status)),
    [allEncounters],
  );

  // Doctor queue: assigned to current doctor OR unassigned — no other doctors' cases.
  const doctorQueueEncounters = useMemo(
    () =>
      activeEncounters.filter(
        (e) => isAssignedToMe(e.assigned_doctor_id) || e.assigned_doctor_id === null,
      ),
    [activeEncounters, isAssignedToMe],
  );

  const queueEncounters =
    dashboardProfile === 'doctor' ? doctorQueueEncounters : activeEncounters;

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(queueEncounters.length / pageSize));
  const paginatedEncounters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return queueEncounters.slice(start, start + pageSize);
  }, [queueEncounters, page]);

  // ─── KPI derivations ──────────────────────────────────────────────────────

  const visitsCount = allEncounters.length;
  const newlyRegistered = activeEncounters.filter((e) => e.status === 'REGISTERED').length;
  const provisionalCount = activeEncounters.filter((e) => e.provisional_identity !== null).length;
  const awaitingTriageCount = activeEncounters.filter(
    (e) => e.status === 'WAITING_FOR_TRIAGE' || e.status === 'REGISTERED',
  ).length;
  const criticalCount = activeEncounters.filter(
    (e) => e.triage?.effective_level === 'LEVEL_1_CRITICAL',
  ).length;
  const waitingCount = activeEncounters.filter((e) =>
    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(e.status),
  ).length;
  const inTreatmentCount = activeEncounters.filter((e) => e.status === 'IN_TREATMENT').length;
  const readyAdmissionCount = activeEncounters.filter(
    (e) => e.status === 'READY_FOR_DISPOSITION',
  ).length;

  // Doctor-specific KPIs
  const myActiveCount = doctorQueueEncounters.filter(
    (e) => isAssignedToMe(e.assigned_doctor_id),
  ).length;
  const myReviewCount = doctorQueueEncounters.filter((e) =>
    ['TRIAGED', 'WAITING_FOR_DOCTOR'].includes(e.status),
  ).length;
  const myTreatmentCount = doctorQueueEncounters.filter(
    (e) => e.status === 'IN_TREATMENT' && isAssignedToMe(e.assigned_doctor_id),
  ).length;
  const pendingResultsCount = doctorQueueEncounters.filter(
    (e) => e.orders && e.orders.length > 0 && isAssignedToMe(e.assigned_doctor_id),
  ).length;
  const myReadyForDispositionCount = doctorQueueEncounters.filter(
    (e) => e.status === 'READY_FOR_DISPOSITION',
  ).length;

  // TODO: P3-2 replace bed availability with live IP bed board API once available.
  const beds = [
    { name: 'Resuscitation', available: 2, total: 4 },
    { name: 'Trauma Bay', available: 1, total: 3 },
    { name: 'Observation', available: 5, total: 12 },
    { name: 'Pediatric ER', available: 2, total: 4 },
  ];
  const totalBedsAvailable = beds.reduce((sum, b) => sum + b.available, 0);

  // ─── Quick action helpers ─────────────────────────────────────────────────

  const openRegistration = () => {
    registration.setValue('department_id', state.departments[0]?.id ?? '');
    setRegistrationOpen(true);
  };

  const openQueueWithFilter = (params?: string) =>
    navigate(`/emergency/queue?branch_id=${state.branchId}${params ? `&${params}` : ''}`);

  const firstDispositionReady = activeEncounters.find(
    (e) => e.status === 'READY_FOR_DISPOSITION',
  );

  // ─── Render helpers ───────────────────────────────────────────────────────

  /** Single Quick Action button — compact clinical layout */
  const QuickActionBtn = ({
    icon,
    label,
    sub,
    color,
    onClick,
    'data-testid': testId,
  }: {
    icon: string;
    label: string;
    sub: string;
    color: string;
    onClick: () => void;
    'data-testid'?: string;
  }) => (
    <button
      className="doc-btn"
      onClick={onClick}
      style={{
        justifyContent: 'flex-start',
        padding: '0.45rem 0.65rem',
        width: '100%',
        borderRadius: '7px',
        gap: '0.5rem',
      }}
      type="button"
      data-testid={testId}
    >
      <i className={`ph ${icon}`} style={{ color, fontSize: '1.05rem', flexShrink: 0 }} />
      <div style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
        <strong style={{ display: 'block', fontSize: '0.78rem', lineHeight: 1.2 }}>{label}</strong>
        <span
          style={{
            fontSize: '0.66rem',
            color: '#64748b',
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </span>
      </div>
    </button>
  );

  /** Single KPI card */
  const KpiCard = ({
    icon,
    color,
    label,
    value,
    sub,
  }: {
    icon: string;
    color: string;
    label: string;
    value: number;
    sub: string;
  }) => (
    <div className="doc-kpi">
      <div className={`doc-kpi-icon ${color}`}>
        <i className={`ph ${icon}`} aria-hidden="true" />
      </div>
      <div className="doc-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );

  // ─── Receptionist KPIs ────────────────────────────────────────────────────

  const ReceptionistKpis = () => (
    <section className="emergency-kpi-grid" data-testid="kpi-receptionist">
      <KpiCard icon="ph-first-aid" color="blue" label="Total ER Arrivals" value={visitsCount} sub="Today's total census" />
      <KpiCard icon="ph-user-plus" color="green" label="Newly Registered" value={newlyRegistered} sub="Registered, not triaged" />
      <KpiCard icon="ph-question-mark" color="orange" label="Provisional / Unidentified" value={provisionalCount} sub="Require identification" />
      <KpiCard icon="ph-hourglass" color="red" label="Awaiting Triage" value={awaitingTriageCount} sub="Waiting for triage" />
      <KpiCard icon="ph-clock" color="cyan" label="Patients Waiting" value={waitingCount} sub="In queue" />
    </section>
  );

  // ─── Nurse KPIs ───────────────────────────────────────────────────────────

  const NurseKpis = () => (
    <section className="emergency-kpi-grid" data-testid="kpi-nurse">
      <KpiCard icon="ph-hourglass" color="red" label="Awaiting Triage" value={awaitingTriageCount} sub="Triage workload" />
      <KpiCard icon="ph-warning-circle" color="orange" label="Critical Patients" value={criticalCount} sub="Immediate attention" />
      <KpiCard icon="ph-users" color="blue" label="Patients Waiting" value={waitingCount} sub="In queue" />
      <KpiCard icon="ph-heartbeat" color="cyan" label="In Treatment" value={inTreatmentCount} sub="Active care" />
      <KpiCard icon="ph-door-open" color="green" label="Available ER Beds" value={totalBedsAvailable} sub="Across ER zones" />
    </section>
  );

  // ─── Doctor KPIs ──────────────────────────────────────────────────────────

  const DoctorKpis = () => (
    <section className="emergency-kpi-grid" data-testid="kpi-doctor">
      <KpiCard icon="ph-stethoscope" color="blue" label="My Active Cases" value={myActiveCount} sub="Assigned to me" />
      <KpiCard icon="ph-clock" color="orange" label="Waiting for My Review" value={myReviewCount} sub="Triaged, need consultation" />
      <KpiCard icon="ph-heartbeat" color="cyan" label="In Treatment" value={myTreatmentCount} sub="My patients in care" />
      <KpiCard icon="ph-flask" color="purple" label="Pending Results" value={pendingResultsCount} sub="Orders in progress" />
      <KpiCard icon="ph-bed" color="red" label="Ready for Disposition" value={myReadyForDispositionCount} sub="Awaiting decision" />
    </section>
  );

  // ─── Viewer/fallback KPIs (super-admin, viewer-only) ─────────────────────

  const ViewerKpis = () => (
    <section className="emergency-kpi-grid viewer-kpi-grid" data-testid="kpi-viewer">
      <KpiCard icon="ph-first-aid" color="blue" label="Today's ER Visits" value={visitsCount} sub="Live emergency census" />
      <KpiCard icon="ph-warning-circle" color="red" label="Critical Patients" value={criticalCount} sub="Immediate attention" />
      <KpiCard icon="ph-hourglass-medium" color="orange" label="Waiting Patients" value={waitingCount} sub="Triage completed" />
      <KpiCard icon="ph-heartbeat" color="cyan" label="Patients In Treatment" value={inTreatmentCount} sub="Active care" />
      <KpiCard icon="ph-bed" color="purple" label="Ready for Admission" value={readyAdmissionCount} sub="Bed assignment needed" />
      <KpiCard icon="ph-door-open" color="green" label="Available Emergency Beds" value={totalBedsAvailable} sub="Across ER zones" />
    </section>
  );

  // ─── Queue column config per profile ─────────────────────────────────────

  const renderQueueRow = (item: EmergencyEncounter) => {
    const level = item.triage?.effective_level ?? item.triage?.level;
    const name = item.patient_name || item.provisional_identity?.display_name || 'Unknown Patient';

    if (dashboardProfile === 'receptionist') {
      return (
        <tr key={item.id}>
          <td>
            <strong className="patient-mrn">{item.emergency_identifier || item.encounter_number}</strong>
          </td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={name} />
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.85rem' }}>{name}</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {item.patient_number || 'Provisional Identity'}
                </span>
              </div>
            </div>
          </td>
          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {formatTime(item.arrival_at || item.created_at)}
          </td>
          <td style={{ fontSize: '0.82rem', maxWidth: '200px', whiteSpace: 'normal' }}>
            {item.chief_complaint}
          </td>
          <td style={{ fontSize: '0.82rem', color: '#334155' }}>{item.arrival_mode}</td>
          <td>
            <span className={`doc-status ${statusSlug(item.status)}`}>{statusLabel(item.status)}</span>
          </td>
          <td>
            <span className={`emergency-triage ${triageSlug(level)}`}>{triageLabel(level)}</span>
          </td>
          <td style={{ fontSize: '0.82rem', color: '#475569' }}>
            {getWaitMinutes(item.arrival_at, item.created_at)}
          </td>
          <td style={{ textAlign: 'right' }}>
            <div className="doc-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                className="doc-action"
                onClick={() => navigate(`/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}`)}
                title="Open Workspace"
                type="button"
              >
                <i className="ph ph-arrow-square-out" />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    if (dashboardProfile === 'nurse') {
      return (
        <tr key={item.id}>
          <td>
            <strong className="patient-mrn">{item.emergency_identifier || item.encounter_number}</strong>
          </td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={name} />
              <div>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.85rem' }}>{name}</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {item.patient_number || 'Provisional Identity'}
                </span>
              </div>
            </div>
          </td>
          <td>
            <span className={`emergency-triage ${triageSlug(level)}`}>{triageLabel(level)}</span>
          </td>
          <td>
            <span className={`doc-status ${statusSlug(item.status)}`}>{statusLabel(item.status)}</span>
          </td>
          <td style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            {getWaitMinutes(item.arrival_at, item.created_at)}
          </td>
          <td style={{ textAlign: 'right' }}>
            <div className="doc-actions" style={{ justifyContent: 'flex-end' }}>
              {capabilities.assessTriage && item.status === 'WAITING_FOR_TRIAGE' && (
                <button
                  className="doc-btn compact primary"
                  onClick={() => navigate(`/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}&tab=Triage`)}
                  title="Start Triage"
                  type="button"
                  style={{ fontSize: '0.74rem', padding: '3px 10px' }}
                >
                  <i className="ph ph-stethoscope" /> Triage
                </button>
              )}
              <button
                className="doc-action"
                onClick={() => navigate(`/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}`)}
                title="Open Workspace"
                type="button"
              >
                <i className="ph ph-arrow-square-out" />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    // Doctor and viewer rows
    return (
      <tr key={item.id}>
        <td>
          <strong className="patient-mrn">{item.emergency_identifier || item.encounter_number}</strong>
        </td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar name={name} />
            <div>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.85rem' }}>{name}</strong>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {item.patient_number || 'Provisional Identity'}
              </span>
            </div>
          </div>
        </td>
        <td>
          <span className={`emergency-triage ${triageSlug(level)}`}>{triageLabel(level)}</span>
        </td>
        <td style={{ whiteSpace: 'normal', minWidth: '140px', maxWidth: '220px', fontSize: '0.82rem' }}>
          {item.chief_complaint}
        </td>
        <td style={{ fontSize: '0.82rem', color: '#334155' }}>
          {item.assigned_doctor_name || 'Unassigned'}
        </td>
        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {formatTime(item.arrival_at || item.created_at)}
        </td>
        <td>
          <span className={`doc-status ${statusSlug(item.status)}`}>{statusLabel(item.status)}</span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <div className="doc-actions" style={{ justifyContent: 'flex-end' }}>
            {capabilities.editConsultation && (
              <button
                className="doc-btn compact primary"
                onClick={() =>
                  navigate(
                    `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}&tab=Consultation`,
                  )
                }
                title="Open Consultation"
                type="button"
                style={{ fontSize: '0.74rem', padding: '3px 10px' }}
              >
                <i className="ph ph-stethoscope" /> Consult
              </button>
            )}
            <button
              className="doc-action"
              onClick={() =>
                navigate(
                  `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}`,
                )
              }
              title="Open Workspace"
              type="button"
            >
              <i className="ph ph-arrow-square-out" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Queue table column headers per profile
  const QueueTableHead = () => {
    if (dashboardProfile === 'receptionist') {
      return (
        <thead>
          <tr>
            <th>Token</th>
            <th>Patient</th>
            <th>Arrival Time</th>
            <th>Chief Complaint</th>
            <th>Arrival Mode</th>
            <th>Status</th>
            <th>Triage</th>
            <th>Wait Time</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
      );
    }
    if (dashboardProfile === 'nurse') {
      return (
        <thead>
          <tr>
            <th>Token</th>
            <th>Patient</th>
            <th>Triage Level</th>
            <th>Status</th>
            <th>Wait Time</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
      );
    }
    // Doctor + Viewer
    return (
      <thead>
        <tr>
          <th>Token</th>
          <th>Patient</th>
          <th>Triage Level</th>
          <th>Chief Complaint</th>
          <th>Assigned Doctor</th>
          <th>Arrival Time</th>
          <th>Current Status</th>
          <th style={{ textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
    );
  };

  const colSpan =
    dashboardProfile === 'receptionist' ? 9
    : dashboardProfile === 'nurse' ? 6
    : 8;

  // ─── Queue title per profile ──────────────────────────────────────────────

  const queueTitle =
    dashboardProfile === 'doctor'
      ? 'My Emergency Cases'
      : dashboardProfile === 'nurse'
        ? 'Emergency Triage Queue'
        : dashboardProfile === 'receptionist'
          ? 'Administrative Emergency Queue'
          : 'Live Emergency Queue';

  const queueSubtitle =
    dashboardProfile === 'doctor'
      ? 'Assigned to me and unassigned cases available for pickup'
      : dashboardProfile === 'nurse'
        ? 'Patients awaiting triage, sorted by acuity and arrival time'
        : dashboardProfile === 'receptionist'
          ? 'All active emergency patients – administrative view'
          : 'Prioritized by triage acuity and arrival time';

  // ─── Quick Actions per profile ────────────────────────────────────────────

  const ReceptionistActions = () => (
    <div style={{ display: 'grid', gap: '0.45rem' }} data-testid="quick-actions-receptionist">
      {capabilities.register && (
        <QuickActionBtn
          data-testid="qa-register"
          icon="ph-user-plus"
          label="Register Emergency Encounter"
          sub="Start emergency intake"
          color="#dc2626"
          onClick={openRegistration}
        />
      )}
      {capabilities.linkPatient && (
        <QuickActionBtn
          data-testid="qa-link-patient"
          icon="ph-link"
          label="Find / Link Patient"
          sub="Match provisional to registered patient"
          color="#2563eb"
          onClick={() => openQueueWithFilter()}
        />
      )}
      <QuickActionBtn
        data-testid="qa-open-queue"
        icon="ph-queue"
        label="Emergency Queue"
        sub="Manage waiting patients"
        color="#64748b"
        onClick={() => openQueueWithFilter()}
      />
    </div>
  );

  const NurseActions = () => (
    <div style={{ display: 'grid', gap: '0.45rem' }} data-testid="quick-actions-nurse">
      {capabilities.assessTriage && (
        <QuickActionBtn
          data-testid="qa-start-triage"
          icon="ph-stethoscope"
          label="Start Triage"
          sub="Assess next waiting patient"
          color="#dc2626"
          onClick={() => {
            const nextForTriage = activeEncounters.find(
              (e) => e.status === 'WAITING_FOR_TRIAGE',
            );
            if (nextForTriage) {
              navigate(
                `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${nextForTriage.id}&tab=Triage`,
              );
            } else {
              toast.info('No patients currently waiting for triage.');
            }
          }}
        />
      )}
      <QuickActionBtn
        data-testid="qa-awaiting-triage"
        icon="ph-hourglass"
        label="Patients Awaiting Triage"
        sub={`${awaitingTriageCount} patient${awaitingTriageCount !== 1 ? 's' : ''} in queue`}
        color="#f59e0b"
        onClick={() => openQueueWithFilter('status=WAITING_FOR_TRIAGE')}
      />
      <QuickActionBtn
        data-testid="qa-open-queue"
        icon="ph-queue"
        label="Emergency Queue"
        sub="Full triage and nursing queue"
        color="#64748b"
        onClick={() => openQueueWithFilter()}
      />
    </div>
  );

  const DoctorActions = () => (
    <div style={{ display: 'grid', gap: '0.45rem' }} data-testid="quick-actions-doctor">
      <QuickActionBtn
        data-testid="qa-my-cases"
        icon="ph-person-simple-run"
        label="My Emergency Cases"
        sub={`${myActiveCount} active case${myActiveCount !== 1 ? 's' : ''} assigned to me`}
        color="#2563eb"
        onClick={() => openQueueWithFilter()}
      />
      {capabilities.editConsultation && (
        <QuickActionBtn
          data-testid="qa-start-consultation"
          icon="ph-stethoscope"
          label="Start Consultation"
          sub="Open next case for clinical review"
          color="#dc2626"
          onClick={() => {
            const nextCase =
              doctorQueueEncounters.find(
                (e) =>
                  isAssignedToMe(e.assigned_doctor_id) &&
                  ['TRIAGED', 'WAITING_FOR_DOCTOR'].includes(e.status),
              ) ||
              doctorQueueEncounters.find(
                (e) =>
                  e.assigned_doctor_id === null &&
                  ['TRIAGED', 'WAITING_FOR_DOCTOR'].includes(e.status),
              );
            if (nextCase) {
              navigate(
                `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${nextCase.id}&tab=Consultation`,
              );
            } else {
              toast.info('No patients currently waiting for consultation.');
            }
          }}
        />
      )}
      <QuickActionBtn
        data-testid="qa-review-results"
        icon="ph-flask"
        label="Review Results"
        sub="Check pending lab and imaging"
        color="#9333ea"
        onClick={() => openQueueWithFilter()}
      />
      {(capabilities.discharge || capabilities.admit || capabilities.transfer) && (
        <QuickActionBtn
          data-testid="qa-disposition"
          icon="ph-door-open"
          label="Complete Disposition"
          sub={
            firstDispositionReady
              ? 'Patient ready for admission/discharge'
              : 'No patients currently ready'
          }
          color="#16a34a"
          onClick={() => {
            if (firstDispositionReady) {
              navigate(
                `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${firstDispositionReady.id}&tab=Disposition`,
              );
            } else {
              toast.info('No patients currently ready for disposition.');
            }
          }}
        />
      )}
    </div>
  );

  const ViewerActions = () => (
    <div style={{ display: 'grid', gap: '0.45rem' }} data-testid="quick-actions-viewer">
      <QuickActionBtn
        icon="ph-queue"
        label="Open Queue"
        sub="Manage waiting patients"
        color="#64748b"
        onClick={() => openQueueWithFilter()}
      />
    </div>
  );

  // ─── ER Alerts (shown to all — operational context) ───────────────────────

  const ERAlerts = () => (
    <div className="emergency-panel-card">
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>ER Alerts</h3>
      <div className="emergency-alert-list" style={{ gap: '0.45rem' }}>
        <div className="emergency-alert-item" style={{ padding: '0.45rem 0.6rem', gap: '0.5rem' }}>
          <i className="ph ph-warning-circle" style={{ fontSize: '1rem' }} />
          <div>
            <strong style={{ fontSize: '0.78rem' }}>Critical Arrival</strong>
            <span style={{ fontSize: '0.68rem', display: 'block' }}>Level 1 cardiac patient arriving in 4 min.</span>
          </div>
        </div>
        <div className="emergency-alert-item warning" style={{ padding: '0.45rem 0.6rem', gap: '0.5rem' }}>
          <i className="ph ph-clock" style={{ fontSize: '1rem' }} />
          <div>
            <strong style={{ fontSize: '0.78rem' }}>Extended Wait</strong>
            <span style={{ fontSize: '0.68rem', display: 'block' }}>ER-005 exceeded target triage time.</span>
          </div>
        </div>
        <div className="emergency-alert-item info" style={{ padding: '0.45rem 0.6rem', gap: '0.5rem' }}>
          <i className="ph ph-flask" style={{ fontSize: '1rem' }} />
          <div>
            <strong style={{ fontSize: '0.78rem' }}>STAT Results Ready</strong>
            <span style={{ fontSize: '0.68rem', display: 'block' }}>Troponin and ABG results available.</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Bed availability (nurse + doctor only — read-only operational info) ──
  // TODO: P3-2 replace static placeholder with live IP bed board API.

  const BedAvailability = () => (
    <div className="emergency-panel-card" data-testid="bed-availability">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.85rem' }}>Bed Availability</h3>
        <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Read-only</span>
      </div>
      <div className="emergency-bed-grid" style={{ gap: '0.4rem' }}>
        {beds.map((b) => (
          <div className={`emergency-bed ${b.available > 0 ? 'available' : 'occupied'}`} key={b.name} style={{ padding: '0.35rem 0.5rem' }}>
            <span style={{ fontSize: '0.7rem' }}>{b.name}</span>
            <strong style={{ fontSize: '0.82rem' }}>
              {b.available}/{b.total}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="emergency-page emergency-theme">
      {/* Page Header */}
      <div className="emergency-page-header">
        <div className="emergency-page-title">
          <h2>Emergency Dashboard</h2>
          <p>{SUBTITLE[dashboardProfile]}</p>
        </div>
        <div className="emergency-page-actions">
          {state.branches.length > 1 ? (
            <select
              aria-label="Select Branch"
              className="um-filter"
              onChange={(e) => actions.setBranchId(e.target.value)}
              style={{ minWidth: '170px', fontWeight: 500 }}
              value={state.branchId}
            >
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className="btn-emergency-secondary"
            onClick={() => navigate(`/emergency/queue?branch_id=${state.branchId}`)}
            type="button"
          >
            <i className="ph ph-queue" /> Open Queue
          </button>
          {/* Register button in header — only for users with registration capability */}
          {capabilities.register && (
            <button
              className="btn-emergency-primary"
              data-testid="header-register-btn"
              onClick={openRegistration}
              type="button"
            >
              <i className="ph ph-plus" /> Register Patient
            </button>
          )}
        </div>
      </div>

      {/* Role-adaptive KPI Grid */}
      {dashboardProfile === 'receptionist' && <ReceptionistKpis />}
      {dashboardProfile === 'nurse' && <NurseKpis />}
      {dashboardProfile === 'doctor' && <DoctorKpis />}
      {dashboardProfile === 'viewer' && <ViewerKpis />}

      {/* Main 2-Column Layout */}
      <div className="emergency-dashboard-layout">
        {/* Left: Queue Table */}
        <div className="doc-card" style={{ marginBottom: 0 }}>
          <div className="doc-card-header" style={{ padding: '0.65rem 0.9rem' }}>
            <div>
              <h3 style={{ fontSize: '0.92rem', margin: '0 0 2px' }}>{queueTitle}</h3>
              <p style={{ fontSize: '0.74rem', margin: 0 }}>{queueSubtitle}</p>
            </div>
          </div>

          <div className="doc-table-wrap">
            <table className="doc-table">
              <QueueTableHead />
              <tbody>
                {state.listQuery.isLoading ? (
                  <tr>
                    <td colSpan={colSpan} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      <i
                        className="ph ph-circle-notch"
                        style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }}
                      />
                      Loading live emergency queue...
                    </td>
                  </tr>
                ) : queueEncounters.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      <i
                        className="ph ph-first-aid"
                        style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.4rem' }}
                      />
                      {dashboardProfile === 'doctor'
                        ? 'No cases currently assigned to you or available for pickup.'
                        : 'No active emergency patients in queue.'}
                    </td>
                  </tr>
                ) : (
                  paginatedEncounters.map((item) => renderQueueRow(item))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {queueEncounters.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.78rem',
                color: '#64748b',
                background: '#ffffff',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
              }}
            >
              <div>
                Showing{' '}
                <strong>{Math.min((page - 1) * pageSize + 1, queueEncounters.length)}</strong> to{' '}
                <strong>{Math.min(page * pageSize, queueEncounters.length)}</strong> of{' '}
                <strong>{queueEncounters.length}</strong> emergency encounters
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  <i className="ph ph-caret-left" /> Previous
                </button>
                <span style={{ padding: '0 8px', fontWeight: 600, color: '#1e293b' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Next <i className="ph ph-caret-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Side Panel */}
        <aside className="emergency-side-panel">
          <ERAlerts />

          {/* Bed Availability — Nurse and Doctor only (read-only operational context) */}
          {(dashboardProfile === 'nurse' || dashboardProfile === 'doctor' || dashboardProfile === 'viewer') && (
            <BedAvailability />
          )}

          {/* Quick Actions — capability-driven per profile */}
          <div className="emergency-panel-card" data-testid="quick-actions-panel">
            <h3>Quick Actions</h3>
            {dashboardProfile === 'receptionist' && <ReceptionistActions />}
            {dashboardProfile === 'nurse' && <NurseActions />}
            {dashboardProfile === 'doctor' && <DoctorActions />}
            {dashboardProfile === 'viewer' && <ViewerActions />}
          </div>
        </aside>
      </div>

      {/* Registration Modal — preserved exactly as before */}
      <Modal
        onClose={() => setRegistrationOpen(false)}
        open={registrationOpen}
        size="large"
        title="Register Emergency Encounter"
        icon="ph-first-aid"
      >
        <form onSubmit={createEncounter} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '560px' }}>
          {/* Department & Arrival Mode Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Emergency Department <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                {...registration.register('department_id')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              >
                <option value="">Select department</option>
                {state.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {registration.formState.errors.department_id?.message && (
                <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {registration.formState.errors.department_id.message}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Arrival Mode <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                {...registration.register('arrival_mode')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              >
                <option value="Ambulance">🚑 Ambulance</option>
                <option value="Walk-in">🚶 Walk-in</option>
                <option value="Police">🚓 Police</option>
                <option value="Referral">📋 Referral</option>
                <option value="Air Ambulance">🚁 Air Ambulance</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Unified Patient Identification & Intake Section */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ph ph-user-circle" style={{ color: '#2563eb', fontSize: '1.15rem' }} />
                Patient Identification &amp; Intake
              </span>
              {selectedPatient && (
                <button
                  type="button"
                  onClick={() => {
                    registration.setValue('patient_id', '');
                    actions.setPatientSearch('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-x" /> Deselect Patient
                </button>
              )}
            </div>

            {selectedPatient ? (
              /* State A: Existing Patient Selected */
              <div className="emergency-patient-selected-card">
                <div className="emergency-patient-selected-info">
                  <div className="emergency-patient-avatar-badge">
                    {(selectedPatient.first_name?.[0] || '') + (selectedPatient.last_name?.[0] || 'P')}
                  </div>
                  <div className="emergency-patient-details-stack">
                    <span className="emergency-patient-name-title">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </span>
                    <div className="emergency-patient-meta-row">
                      <span className="emergency-patient-meta-tag">MRN: {selectedPatient.patient_number}</span>
                      <span>Gender: {selectedPatient.gender}</span>
                      {selectedPatient.phone ? <span>Phone: {selectedPatient.phone}</span> : null}
                      {selectedPatient.blood_group ? (
                        <span className="emergency-patient-meta-tag" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          Blood: {selectedPatient.blood_group}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    registration.setValue('patient_id', '');
                    actions.setPatientSearch('');
                  }}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-arrows-clockwise" /> Search Other
                </button>
              </div>
            ) : (
              /* State B: Unified Search-or-Create Flow */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    1. Search Existing Registered Patient (MRN, Name, Phone)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      onChange={(event) => actions.setPatientSearch(event.target.value)}
                      placeholder="Type patient MRN, name, or phone number..."
                      value={state.patientSearch}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px 0 28px', fontSize: '0.82rem', background: '#fff' }}
                    />
                    {state.patientSearch && (
                      <button
                        type="button"
                        onClick={() => actions.setPatientSearch('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="ph ph-x" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Search Candidate Results */}
                {state.patientSearch.trim().length >= 2 ? (
                  state.patients.length > 0 ? (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Matching Registered Patients ({state.patients.length}):
                      </span>
                      <div className="emergency-candidate-list">
                        {state.patients.map((p) => (
                          <div
                            key={p.id}
                            className="emergency-candidate-item"
                            onClick={() => {
                              registration.setValue('patient_id', p.id, { shouldValidate: true });
                              registration.setValue('display_name', '');
                              actions.setPatientSearch('');
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="ph ph-user" style={{ color: '#2563eb' }} />
                              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{p.first_name} {p.last_name}</strong>
                              <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>{p.patient_number}</span>
                              <span style={{ fontSize: '0.72rem', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>{p.gender}</span>
                              {p.phone ? <span style={{ fontSize: '0.72rem', color: '#64748b' }}>📞 {p.phone}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="doc-btn compact primary"
                              style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                            >
                              Select Patient
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>No registered patient found matching &ldquo;<strong>{state.patientSearch}</strong>&rdquo;</span>
                      <button
                        type="button"
                        className="doc-btn compact primary"
                        onClick={() => registration.setValue('display_name', state.patientSearch, { shouldValidate: true })}
                        style={{ fontSize: '0.74rem' }}
                      >
                        <i className="ph ph-plus" /> Use as Patient Name
                      </button>
                    </div>
                  )
                ) : null}

                {/* Inline New / Unknown Patient Entry */}
                <div style={{ paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      2. If not registered or unidentified, provide emergency intake details:
                    </div>
                    <div className="emergency-quick-chips-wrap">
                      {quickTraumaTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="emergency-quick-chip"
                          onClick={() => {
                            registration.setValue('display_name', tag, { shouldValidate: true });
                            if (tag.toLowerCase().includes('male')) registration.setValue('gender', 'MALE', { shouldValidate: true });
                            else if (tag.toLowerCase().includes('female')) registration.setValue('gender', 'FEMALE', { shouldValidate: true });
                          }}
                        >
                          <i className="ph ph-plus" /> {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Patient Name / Unknown Tag <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        {...registration.register('display_name')}
                        placeholder="e.g. John Doe or Unknown Trauma #1"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                      {registration.formState.errors.display_name?.message && (
                        <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                          {registration.formState.errors.display_name.message}
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Estimated Age
                      </label>
                      <input
                        type="number"
                        {...registration.register('estimated_age', numericInput)}
                        placeholder="e.g. 45"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Gender
                      </label>
                      <select
                        {...registration.register('gender')}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      >
                        <option value="UNKNOWN">UNKNOWN</option>
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Contact / Phone / Bystander <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <input
                        {...registration.register('contact', {
                          onChange: (e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            registration.setValue('contact', digits, { shouldValidate: true });
                          },
                        })}
                        maxLength={10}
                        inputMode="numeric"
                        placeholder="10-digit phone number"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                      {registration.formState.errors.contact?.message && (
                        <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                          {registration.formState.errors.contact.message}
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Physical Description / Location Found <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <input
                        {...registration.register('identity_notes')}
                        placeholder="Clothing, location found, markings..."
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {registration.formState.errors.patient_id?.message && (
              <span style={{ color: '#dc2626', fontSize: '0.72rem' }}>
                {registration.formState.errors.patient_id.message}
              </span>
            )}
          </div>

          {/* Chief Complaint Section with Presets */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                Chief Emergency Complaint <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Click presets to quick-fill</span>
            </div>

            <div className="emergency-quick-chips-wrap" style={{ marginBottom: '6px' }}>
              {emergencyComplaintPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="emergency-quick-chip danger-chip"
                  onClick={() => handleSelectPresetComplaint(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              {...registration.register('chief_complaint')}
              placeholder="Primary presenting emergency (e.g. Acute chest pain radiating to left arm, severe SOB, polytrauma)..."
              rows={2}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
            />
            {registration.formState.errors.chief_complaint?.message && (
              <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {registration.formState.errors.chief_complaint.message}
              </span>
            )}
          </div>

          {/* Arrival Notes */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Paramedic / Intake Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              {...registration.register('arrival_notes')}
              placeholder="Initial paramedic observations, on-scene vitals, intake details..."
              rows={2}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              className="btn-emergency-secondary"
              onClick={() => setRegistrationOpen(false)}
              type="button"
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              disabled={mutations.create.isPending}
              type="submit"
              style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#ffffff', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-plus-circle" />{' '}
              {mutations.create.isPending ? 'Registering...' : 'Register Encounter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}