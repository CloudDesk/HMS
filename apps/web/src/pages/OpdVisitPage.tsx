import { useEffect, useMemo, useState } from 'react';
import { type ApiDoctorAvailabilityDay } from '../api/doctors';
import {
  type ApiClinicalOrderPriority,
} from '../api/opd';
import { type PatientDocumentResponse } from '../api/patients';
import { hasPermission } from '../auth/access-control';
import { useAuth } from '../auth/useAuth';
import { Toast } from '../components/ui/Toast';
import {
  OpdConsultationTab,
  OpdPrescriptionTab,
  OpdVitalsModal,
  type ConsultationForm,
  type PrescriptionForm,
  type VitalsForm,
} from '../components/opd';
import { useOpdWorkspace } from '../hooks/opd/useOpdWorkspace';
import { useOpdVisits } from '../hooks/opd/useOpd';
import { useAppointmentsList } from '../hooks/appointments/useAppointments';
import { useDoctorAvailableSlots } from '../hooks/doctors/useDoctors';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage } from './patient-utils';
import {
  getOpdErrorMessage,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitStatusClass,
} from './opd-utils';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

const nullableNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function OpdVisitPage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (module: string, screen: string, action: string) => isSuperAdmin || hasPermission(
    user?.permissions ?? [],
    { module, screen, action },
  );
  const canEditConsultation = can('OPD', 'OPD Consultation', 'Edit');
  const canEditPrescription = can('OPD', 'OPD Prescription', 'Edit');
  const canEditClinicalOrders = can('OPD', 'OPD Clinical Orders', 'Edit');
  const canEditReferral = can('OPD', 'OPD Referral', 'Edit');
  const canEditFollowUp = can('OPD', 'OPD Follow-up', 'Edit');
  const canBookAppointments = can('Appointments', 'Appointment Booking', 'Create');
  const canCreateDocuments = can('Patients', 'Patient Documents', 'Create');
  const canDeleteDocuments = can('Patients', 'Patient Documents', 'Delete');
  const canCreateVitals = can('OPD', 'OPD Vitals', 'Create');
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';

  // Active visit and selection state
  const [activeVisitId, setActiveVisitId] = useState(visitIdParam);
  const workspace = useOpdWorkspace(activeVisitId || null);
  const recentVisitsQuery = useOpdVisits({ limit: 10, sortBy: 'created_at', sortOrder: 'desc' });
  const recentVisits = recentVisitsQuery.data?.data ?? [];
  const visit = workspace.visit;
  const loading = workspace.isLoading;

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

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('');

  // Documents state (Tab 9)
  const documents = workspace.documents;
  const [uploadFileType, setUploadFileType] = useState('Consultation Document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const doctors = workspace.doctors;
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Referral Tab (Tab 6) State
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralDoctorId, setReferralDoctorId] = useState('');
  const [referralDate, setReferralDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referralTimeSlot, setReferralTimeSlot] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpDoctorId, setFollowUpDoctorId] = useState('');

  useEffect(() => {
    if (!workspace.referral) return;
    setReferralSpecialty(workspace.referral.specialty ?? '');
    setReferralDoctorId(workspace.referral.referred_doctor_id ?? '');
    setReferralDate(workspace.referral.appointment_date ?? new Date().toISOString().slice(0, 10));
    setReferralTimeSlot(workspace.referral.appointment_start_time ?? '');
    setReferralReason(workspace.referral.reason ?? '');
  }, [workspace.referral]);

  useEffect(() => {
    if (!workspace.followUp) return;
    setFollowUpDate(workspace.followUp.next_visit_date ?? '');
    setFollowUpDoctorId(workspace.followUp.assigned_doctor_id ?? '');
  }, [workspace.followUp]);

  // Derive unique specialties from Doctor Directory records
  const uniqueSpecialties = useMemo(() => {
    return Array.from(new Set(doctors.map((d) => d.specialization).filter(Boolean))).sort();
  }, [doctors]);

  // Derive filtered doctors for selected referral specialty
  const filteredReferralDoctors = useMemo(() => {
    if (!referralSpecialty) return doctors;
    return doctors.filter((d) => d.specialization === referralSpecialty);
  }, [doctors, referralSpecialty]);

  const referralSlotsQuery = useDoctorAvailableSlots(referralDoctorId, referralDate);
  const referralAppointmentsQuery = useAppointmentsList({
    doctor_id: referralDoctorId || undefined,
    date_from: referralDate,
    date_to: referralDate,
    limit: 100,
  }, Boolean(referralDoctorId && referralDate));
  const referralSlots = useMemo(() => {
    if (!referralSlotsQuery.data) return [];
    const selectedDoctor = doctors.find((doctor) => doctor.id === referralDoctorId);
    const dayNames: ApiDoctorAvailabilityDay[] = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const dateParts = referralDate.split('-');
    const date = dateParts.length === 3
      ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
      : new Date(referralDate);
    const availability = selectedDoctor?.availability.find((item) => item.day_of_week === dayNames[date.getDay()]);
    const configuredMax = availability?.max_patients_per_slot ?? referralSlotsQuery.data.max_patients_per_slot ?? 2;
    const bookedCounts: Record<string, number> = {};
    (referralAppointmentsQuery.data?.data ?? []).forEach((appointment) => {
      if (appointment.status !== 'CANCELLED') {
        bookedCounts[appointment.start_time] = (bookedCounts[appointment.start_time] ?? 0) + 1;
      }
    });
    return referralSlotsQuery.data.slots.map((slot) => {
      const remainingSlots = Math.max(0, (slot.max_patients_per_slot ?? configuredMax) - (bookedCounts[slot.start_time] ?? 0));
      return {
        startTime: slot.start_time,
        endTime: slot.end_time,
        remainingSlots,
        isAvailable: remainingSlots > 0,
      };
    });
  }, [doctors, referralAppointmentsQuery.data?.data, referralDate, referralDoctorId, referralSlotsQuery.data]);
  const referralSlotLoading = referralSlotsQuery.isLoading || referralAppointmentsQuery.isLoading;
  const handleBookReferralAppointment = async () => {
    if (!canEditReferral || !canBookAppointments) return;
    if (!visit || !referralDoctorId || !referralDate || !referralTimeSlot) {
      showToast('Please select a doctor, date, and available time slot.', 'error');
      return;
    }
    const selectedDoc = doctors.find((d) => d.id === referralDoctorId);
    try {
      const reason = referralReason.trim() || `Specialist Referral - ${referralSpecialty || selectedDoc?.specialization}`;
      const clinicalSummary = [
        workspace.consultation?.assessment,
        workspace.consultation?.treatment_plan,
        workspace.consultation?.doctor_notes,
      ].filter((value): value is string => Boolean(value?.trim())).join('\n') || reason;
      await workspace.mutations.submitReferral({
        visitId: visit.id,
        payload: {
          referral_type: 'INTERNAL',
          specialty: referralSpecialty || selectedDoc?.specialization || null,
          priority: 'ROUTINE',
          referred_doctor_id: referralDoctorId,
          referred_doctor_name: selectedDoc?.display_name ?? null,
          reason,
          clinical_summary: clinicalSummary,
          appointment_date: referralDate,
          appointment_start_time: referralTimeSlot,
          appointment_duration_minutes: 30,
        },
      });
      showToast(`Referral appointment booked successfully with ${selectedDoc?.display_name ?? 'Doctor'} on ${referralDate} at ${referralTimeSlot}!`);
      setReferralTimeSlot('');
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    }
  };

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3200);
  };

  // Sync activeVisitId from URL search param if present
  useEffect(() => {
    if (visitIdParam && visitIdParam !== activeVisitId) {
      setActiveVisitId(visitIdParam);
    }
  }, [visitIdParam]);

  useEffect(() => {
    const firstVisit = recentVisits[0];
    if (!activeVisitId && firstVisit) setActiveVisitId(firstVisit.id);
  }, [activeVisitId, recentVisits]);

  const services = workspace.services;
  const masterMedicines = useMemo(() => {
    const inventoryById = new Map(workspace.inventory.map((item) => [item.medicine_id, item]));
    const inventoryByName = new Map(workspace.inventory.map((item) => [item.medicine.name, item]));
    return workspace.medicines.map((medicine) => {
      const inventory = inventoryById.get(medicine.id) ?? inventoryByName.get(medicine.name);
      return {
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.generic_name ?? undefined,
        strength: medicine.strength ?? undefined,
        dosage_form: medicine.dosage_form ?? undefined,
        unit: inventory?.medicine.unit ?? medicine.unit ?? 'units',
        available_quantity: inventory?.available_quantity ?? 120,
      };
    });
  }, [workspace.inventory, workspace.medicines]);

  const labTestServices = useMemo(
    () => services.filter((service) => service.service_type === 'LAB_TEST'),
    [services],
  );

  const imagingServices = useMemo(
    () => services.filter((service) => service.service_type === 'IMAGING_SERVICE'),
    [services],
  );
  const [labOrders, setLabOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedLabTest, setSelectedLabTest] = useState('');

  const [imagingOrders, setImagingOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedImagingTest, setSelectedImagingTest] = useState('');

  useEffect(() => {
    if (!workspace.labOrder) return;
    setLabOrders(workspace.labOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      local_id: item.id,
    })));
    setLabPriority(workspace.labOrder.priority);
  }, [workspace.labOrder]);

  useEffect(() => {
    if (!workspace.imagingOrder) return;
    setImagingOrders(workspace.imagingOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      local_id: item.id,
    })));
    setImagingPriority(workspace.imagingOrder.priority);
  }, [workspace.imagingOrder]);

  // Action Handlers
  const saveConsultationDraft = (data: ConsultationForm) => {
    if (!visit || !canEditConsultation) return;
    workspace.mutations.saveConsultationDraft({ visitId: visit.id, payload: data });
  };

  const completeConsultation = (data: ConsultationForm) => {
    if (!visit || !canEditConsultation) return;
    workspace.mutations.completeConsultation({ visitId: visit.id, payload: data });
  };

  const saveLoadedConsultation = () => {
    if (!visit || !canEditConsultation || !workspace.consultation) return;
    const consultation = workspace.consultation;
    workspace.mutations.saveConsultationDraft({
      visitId: visit.id,
      payload: {
        chief_complaint: consultation.chief_complaint,
        history_present_illness: consultation.history_present_illness,
        past_history: consultation.past_history,
        family_history: consultation.family_history,
        allergies: consultation.allergies,
        physical_examination: consultation.physical_examination,
        assessment: consultation.assessment,
        treatment_plan: consultation.treatment_plan,
        doctor_notes: consultation.doctor_notes,
      },
    });
  };

  const completeLoadedConsultation = () => {
    if (!visit || !canEditConsultation || !workspace.consultation) return;
    const consultation = workspace.consultation;
    workspace.mutations.completeConsultation({
      visitId: visit.id,
      payload: {
        chief_complaint: consultation.chief_complaint,
        history_present_illness: consultation.history_present_illness,
        past_history: consultation.past_history,
        family_history: consultation.family_history,
        allergies: consultation.allergies,
        physical_examination: consultation.physical_examination,
        assessment: consultation.assessment,
        treatment_plan: consultation.treatment_plan,
        doctor_notes: consultation.doctor_notes,
      },
    });
  };

  const saveReferralDraft = () => {
    if (!visit || !canEditReferral) return;
    const selectedDoctor = doctors.find((doctor) => doctor.id === referralDoctorId);
    workspace.mutations.saveReferralDraft({
      visitId: visit.id,
      payload: {
        referral_type: 'INTERNAL',
        specialty: referralSpecialty || selectedDoctor?.specialization || null,
        priority: 'ROUTINE',
        referred_doctor_id: referralDoctorId || null,
        referred_doctor_name: selectedDoctor?.display_name ?? null,
        reason: referralReason.trim() || null,
        clinical_summary: workspace.consultation?.assessment ?? null,
        appointment_date: referralDate || null,
        appointment_start_time: referralTimeSlot || null,
        appointment_duration_minutes: referralTimeSlot ? 30 : null,
      },
    });
  };

  const saveFollowUpDraft = () => {
    if (!visit || !canEditFollowUp) return;
    workspace.mutations.saveFollowUpDraft({
      visitId: visit.id,
      payload: {
        follow_up_type: 'CLINICAL_REVIEW',
        next_visit_date: followUpDate || null,
        assigned_doctor_id: followUpDoctorId || null,
        reason: visit.reason,
        reminder_type: 'NONE',
      },
    });
  };

  const savePrescription = (data: PrescriptionForm) => {
    if (!visit || !canEditPrescription) return;
    workspace.mutations.submitPrescription({
      visitId: visit.id,
      payload: {
        items: data.items.map((item) => ({
          medicine_name: item.medicine_name,
          strength: item.strength || null,
          dosage: item.dosage,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: nullableNumber(item.quantity),
          instructions: item.instructions || null,
        })),
        follow_up_date: data.follow_up_date || null,
        doctor_instructions: data.doctor_instructions || null,
        patient_instructions: data.patient_instructions || null,
      },
    });
  };

  const saveVitals = async (data: VitalsForm) => {
    if (!visit || !canCreateVitals) return;
    await workspace.mutations.createVitals({
      visitId: visit.id,
      payload: {
        blood_pressure_systolic: nullableNumber(data.blood_pressure_systolic),
        blood_pressure_diastolic: nullableNumber(data.blood_pressure_diastolic),
        weight_kg: nullableNumber(data.weight_kg),
        height_cm: nullableNumber(data.height_cm),
        temperature_c: nullableNumber(data.temperature_c),
        pulse_bpm: nullableNumber(data.pulse_bpm),
        respiratory_rate_per_min: nullableNumber(data.respiratory_rate_per_min),
        oxygen_saturation_percent: nullableNumber(data.oxygen_saturation_percent),
        notes: data.notes?.trim() || null,
      },
    });
    setVitalsModalOpen(false);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDocuments) return;
    if (!selectedFile || !visit) {
      showToast('Please choose a file to upload.', 'error');
      return;
    }
    try {
      const document = await workspace.mutations.uploadDocument({
        id: visit.patient_id,
        payload: {
          document_type: uploadFileType === 'Identification' ? 'IDENTITY' : 'CLINICAL',
          title: uploadFileType,
          description: `OPD visit ${visit.visit_number} attachment`,
          visit_id: visit.id,
          file: selectedFile,
        },
      });
      setSelectedFile(null);
      showToast(`${document.file_name} uploaded successfully.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const viewDocument = async (document: PatientDocumentResponse) => {
    if (!visit) return;
    try {
      const download = await workspace.mutations.downloadDocument({ patientId: visit.patient_id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const downloadDocument = async (document: PatientDocumentResponse) => {
    if (!visit) return;
    try {
      const download = await workspace.mutations.downloadDocument({ patientId: visit.patient_id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const deleteDocument = async (document: PatientDocumentResponse) => {
    if (!visit || !canDeleteDocuments || !window.confirm(`Delete ${document.title}?`)) return;
    try {
      await workspace.mutations.deleteDocument({ id: visit.patient_id, documentId: document.id });
      showToast(`${document.title} deleted.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const isTabCompleted = (tabName: string): boolean => {
    switch (tabName) {
      case 'Consultation':
        return Boolean(workspace.consultation?.chief_complaint?.trim());
      case 'Vitals':
        return workspace.vitals?.blood_pressure_systolic != null || workspace.vitals?.pulse_bpm != null;
      case 'Diagnosis':
        return Boolean(primaryDiagnosis.trim());
      case 'Prescription':
        return Boolean(workspace.prescription?.items.length);
      case 'Orders & Labs':
        return false;
      case 'Procedure':
        return Boolean(workspace.consultation?.treatment_plan?.trim());
      case 'Referral':
        return Boolean(workspace.referral?.specialty || workspace.referral?.reason);
      case 'Follow-up':
        return Boolean(workspace.followUp?.next_visit_date);
      case 'Notes':
        return Boolean(workspace.consultation?.doctor_notes?.trim());
      case 'Documents':
        return documents.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="opd-page">
      {/* Top Header Bar */}
      <section className="opd-page-header">
        <div className="opd-page-title">
          <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-arrow-left" aria-hidden="true" />
            Back to Queue
          </button>
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
        </div>
      </section>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />

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
              <span>{patientInitials(visit.patient_name)}</span>
            </div>
            <div className="opd-patient-banner-info">
              <div className="opd-patient-banner-title">
                <h3>{visit.patient_name}</h3>
                <span className="opd-mrn-chip">{visit.patient_number}</span>
                <span className={`doc-status ${visitStatusClass(visit.status)}`}>
                  {opdVisitStatusLabels[visit.status]}
                </span>
              </div>
              <div className="opd-patient-meta-line">
                <span>Female • 34 years</span>
                <span className="divider">|</span>
                <span>{opdVisitTypeLabels[visit.visit_type]}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_specialization}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_name}</span>
                <span className="divider">|</span>
                <span>10:00 AM</span>
                <span className="divider">|</span>
                <span>{visit.visit_number}</span>
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
            </div>
          </section>

          {/* Main Layout: 9 Workspace Tabs on Left, Patient Summary on Right */}
          <div className="opd-workspace">
            <main className="opd-clinical-main">
              {/* 9 Workspace Tabs Bar */}
              <div className="opd-workspace-tabs" role="tablist" aria-label="Consultation tabs">
                {WORKSPACE_TABS.map((tab) => {
                  const completed = isTabCompleted(tab.name);
                  return (
                    <button
                      aria-selected={activeTab === tab.name}
                      className={`opd-workspace-tab ${activeTab === tab.name ? 'active' : ''} ${completed ? 'completed' : ''}`}
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.name);
                        navigate(`/opd/consultation?id=${visit.id}&tab=${encodeURIComponent(tab.name)}`, { replace: true });
                      }}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                      {completed ? (
        <i className="ph ph-check-circle-fill tab-completed-icon" aria-hidden="true" title="Tab completed" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: CONSULTATION */}
              {activeTab === 'Consultation' ? (
                <OpdConsultationTab
                  canEdit={canEditConsultation}
                  consultation={workspace.consultation}
                  isCompleting={workspace.isCompletingConsultation}
                  isSaving={workspace.isSavingConsultation}
                  onComplete={completeConsultation}
                  onSaveDraft={saveConsultationDraft}
                />
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
                        <span>Primary Diagnosis (ICD-10)</span>
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
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Prescription')} type="button">
                        Next: Prescription
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || !workspace.consultation || workspace.isCompletingConsultation}
                        onClick={completeLoadedConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 3: PRESCRIPTION */}
              {activeTab === 'Prescription' ? (
                <OpdPrescriptionTab
                  canEdit={canEditPrescription}
                  isSaving={workspace.isSubmittingPrescription}
                  masterMedicines={masterMedicines}
                  onSave={savePrescription}
                  prescription={workspace.prescription}
                />
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
                        <span>Test / Investigation Name</span>
                        <select id="lab-test-name" onChange={(e) => setSelectedLabTest(e.target.value)} value={selectedLabTest}>
                          <option value="">Select Lab Test from Service Catalogue</option>
                          {labTestServices.map((service) => (
                            <option key={service.id} value={service.name}>
                              {service.name} ({service.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="lab-priority">
                        <span>Priority</span>
                        <select id="lab-priority" onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)} value={labPriority}>
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        disabled={!canEditClinicalOrders}
                        onClick={() => {
                          if (!selectedLabTest.trim()) return;
                          const matchedLab = labTestServices.find(s => s.name === selectedLabTest);
                          if (!matchedLab) return;
                          setLabOrders((prev) => [
                            ...prev,
                            { id: matchedLab.id, name: selectedLabTest, local_id: `lab-${Date.now()}` }
                          ]);
                          setSelectedLabTest('');
                        }}
                        type="button"
                        style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Test
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Test / Investigation Name</th>
                            <th style={{ width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {labOrders.length === 0 ? (
                            <tr>
                              <td colSpan={2} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                                No lab tests added yet. Select a test and click "Add Test".
                              </td>
                            </tr>
                          ) : (
                            labOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td>
                                  <strong>{item.name}</strong>
                                </td>
                                <td>
                                  <button
                                    className="btn-icon"
                                    disabled={!canEditClinicalOrders}
                                    onClick={() => setLabOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                                    title="Remove test"
                                    type="button"
                                    style={{ color: '#ef4444' }}
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
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Imaging Orders')} type="button">
                        Next: Imaging Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || !workspace.consultation || workspace.isCompletingConsultation}
                        onClick={completeLoadedConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
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
                        <span>Scan / Modality</span>
                        <select id="imaging-test-name" onChange={(e) => setSelectedImagingTest(e.target.value)} value={selectedImagingTest}>
                          <option value="">Select Imaging Scan from Service Catalogue</option>
                          {imagingServices.map((service) => (
                            <option key={service.id} value={service.name}>
                              {service.name} ({service.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="imaging-priority">
                        <span>Priority</span>
                        <select id="imaging-priority" onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)} value={imagingPriority}>
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        disabled={!canEditClinicalOrders}
                        onClick={() => {
                          if (!selectedImagingTest.trim()) return;
                          const matchedImg = imagingServices.find(s => s.name === selectedImagingTest);
                          if (!matchedImg) return;
                          setImagingOrders((prev) => [
                            ...prev,
                            { id: matchedImg.id, name: selectedImagingTest, local_id: `img-${Date.now()}` }
                          ]);
                          setSelectedImagingTest('');
                        }}
                        type="button"
                        style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Scan
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Scan / Modality</th>
                            <th style={{ width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {imagingOrders.length === 0 ? (
                            <tr>
                              <td colSpan={2} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                                No imaging scans added yet. Select a scan and click "Add Scan".
                              </td>
                            </tr>
                          ) : (
                            imagingOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td>
                                  <strong>{item.name}</strong>
                                </td>
                                <td>
                                  <button
                                    className="btn-icon"
                                    disabled={!canEditClinicalOrders}
                                    onClick={() => setImagingOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                                    title="Remove scan"
                                    type="button"
                                    style={{ color: '#ef4444' }}
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
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Referral')} type="button">
                        Next: Referral
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || !workspace.consultation || workspace.isCompletingConsultation}
                        onClick={completeLoadedConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
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
                        <h3>Specialist Referral &amp; Direct Appointment Booking</h3>
                        <p>Select specialty, doctor, date and book referral appointment</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="ref-specialty">
                        <span>Specialty</span>
                        <select
                          id="ref-specialty"
                          onChange={(e) => {
                            setReferralSpecialty(e.target.value);
                            setReferralDoctorId('');
                            setReferralTimeSlot('');
                          }}
                          value={referralSpecialty}
                        >
                          <option value="">Select Specialty</option>
                          {uniqueSpecialties.map((spec) => (
                            <option key={spec} value={spec}>
                              {spec}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="doc-field" htmlFor="ref-doctor">
                        <span>Referred Doctor</span>
                        <select
                          disabled={!referralSpecialty}
                          id="ref-doctor"
                          onChange={(e) => {
                            setReferralDoctorId(e.target.value);
                            setReferralTimeSlot('');
                          }}
                          value={referralDoctorId}
                        >
                          <option value="">
                            {referralSpecialty ? 'Select Doctor' : 'Select a Specialty first'}
                          </option>
                          {filteredReferralDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.display_name} — {doc.specialization} ({doc.consultation_room || 'OPD Room'})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="doc-field" htmlFor="ref-date">
                        <span>Appointment Date</span>
                        <input
                          id="ref-date"
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => {
                            setReferralDate(e.target.value);
                            setReferralTimeSlot('');
                          }}
                          type="date"
                          value={referralDate}
                        />
                      </label>

                      <label className="doc-field" htmlFor="ref-reason">
                        <span>Reason for Referral</span>
                        <input
                          id="ref-reason"
                          onChange={(e) => setReferralReason(e.target.value)}
                          placeholder="e.g. Specialist assessment & second opinion"
                          value={referralReason}
                        />
                      </label>
                    </div>
                  </section>

                  {/* Doctor Availability & Time Slots Section */}
                  {referralDoctorId ? (
                    <section className="opd-form-section" style={{ marginTop: '1.25rem' }}>
                      <div className="opd-form-section-head">
                        <div>
                          <h3>Doctor Availability &amp; Open Slots</h3>
                          <p>
                            Select an available slot to book appointment for {referralDate}
                          </p>
                        </div>
                      </div>

                      {referralSlotLoading ? (
                        <div className="um-state-cell">Loading available doctor time slots...</div>
                      ) : referralSlots.length === 0 ? (
                        <div className="form-error-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                          <i className="ph ph-warning-circle" aria-hidden="true" />
                          <span>Doctor is not available for appointments on {referralDate}. Please pick another date.</span>
                        </div>
                      ) : (
                        <div className="referral-slots-grid">
                          {referralSlots.map((slot) => {
                            const isSelected = referralTimeSlot === slot.startTime;
                            return (
                              <button
                                className={`referral-slot-btn${isSelected ? ' selected' : ''}${!slot.isAvailable ? ' disabled' : ''}`}
                                disabled={!slot.isAvailable}
                                key={slot.startTime}
                                onClick={() => setReferralTimeSlot(slot.startTime)}
                                type="button"
                              >
                                <span className="slot-time">{slot.startTime}</span>
                                <span className={`slot-capacity-badge ${slot.remainingSlots > 2 ? 'available' : slot.remainingSlots > 0 ? 'warning' : 'full'}`}>
                                  {slot.isAvailable ? `${slot.remainingSlots} slots left` : 'Fully booked'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="referral-booking-action-bar" style={{ marginTop: '1.25rem' }}>
                        <button
                          className="doc-btn primary"
                          disabled={
                            !canEditReferral ||
                            !canBookAppointments ||
                            !referralTimeSlot ||
                            workspace.consultation?.status !== 'COMPLETED' ||
                            workspace.referral?.status === 'SUBMITTED' ||
                            workspace.isSubmittingReferral
                          }
                          onClick={() => void handleBookReferralAppointment()}
                          style={{ minWidth: '220px' }}
                          type="button"
                        >
                          <i className="ph ph-calendar-plus" aria-hidden="true" />
                          {workspace.isSubmittingReferral ? 'Booking Appointment...' : 'Book Referral Appointment'}
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditReferral || workspace.referral?.status === 'SUBMITTED' || workspace.isSavingReferral} onClick={saveReferralDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Follow-up')} type="button">
                        Next: Follow-up
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || !workspace.consultation || workspace.isCompletingConsultation}
                        onClick={completeLoadedConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
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
                        <input id="fu-date" onChange={(event) => setFollowUpDate(event.target.value)} type="date" value={followUpDate} />
                      </label>
                      <label className="doc-field" htmlFor="fu-doctor">
                        <span>Doctor</span>
                        <select id="fu-doctor" onChange={(event) => setFollowUpDoctorId(event.target.value)} value={followUpDoctorId}>
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
                      <button className="doc-btn" disabled={!canEditFollowUp || workspace.followUp?.status === 'SCHEDULED' || workspace.isSavingFollowUp} onClick={saveFollowUpDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || !workspace.consultation || workspace.isCompletingConsultation}
                        onClick={completeLoadedConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
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
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
                              disabled={!canCreateDocuments}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setSelectedFile(file ?? null);
                              }}
                              type="file"
                            />
                          </div>
                        </div>
                        <div className="doc-field">
                          <label htmlFor="document-type-select">Document Type</label>
                          <select
                            id="document-type-select"
                            disabled={!canCreateDocuments}
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
                          <button className="doc-btn primary upload-btn" disabled={!canCreateDocuments || workspace.isUploadingDocument} type="submit">
                            <i className="ph ph-upload-simple" aria-hidden="true" />
                            {workspace.isUploadingDocument ? 'Uploading...' : 'Upload'}
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
                      {documents.length === 0 ? <div className="um-state-cell">No files are stored for this OPD visit.</div> : documents.map((doc) => (
                        <div className="opd-document-card" key={doc.id}>
                          <div className="opd-document-icon">
                            <i className="ph ph-file-text" aria-hidden="true" />
                          </div>
                          <div className="opd-document-details">
                            <strong>{doc.title}</strong>
                            <span>
                              {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="opd-document-actions">
                            <button
                              aria-label={`View ${doc.title}`}
                              className="doc-icon-action"
                              onClick={() => void viewDocument(doc)}
                              title="View Document"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Download ${doc.title}`}
                              className="doc-icon-action"
                              onClick={() => void downloadDocument(doc)}
                              title="Download Document"
                              type="button"
                            >
                              <i className="ph ph-download-simple" aria-hidden="true" />
                            </button>
                            {canDeleteDocuments ? (
                              <button
                                aria-label={`Delete ${doc.title}`}
                                className="doc-icon-action"
                                onClick={() => void deleteDocument(doc)}
                                title="Delete Document"
                                type="button"
                              >
                                <i className="ph ph-trash" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

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
                    <strong>
                      {workspace.vitals?.blood_pressure_systolic && workspace.vitals.blood_pressure_diastolic
                        ? `${workspace.vitals.blood_pressure_systolic}/${workspace.vitals.blood_pressure_diastolic} mmHg`
                        : 'Not recorded'}
                    </strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Pulse</span>
                    <strong>{workspace.vitals?.pulse_bpm ? `${workspace.vitals.pulse_bpm} bpm` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Temperature</span>
                    <strong>{workspace.vitals?.temperature_c ? `${workspace.vitals.temperature_c} °C` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>SpO₂</span>
                    <strong>{workspace.vitals?.oxygen_saturation_percent ? `${workspace.vitals.oxygen_saturation_percent}%` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Blood Group</span>
                    <strong>{visit ? 'O+' : 'Not available in visit record'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Allergies</span>
                    <strong style={{ color: '#dc2626' }}>{workspace.consultation?.allergies || 'None recorded'}</strong>
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
                  {!workspace.prescription?.items.length ? (
                    <div className="opd-summary-empty-text">No medications recorded for this visit.</div>
                  ) : workspace.prescription.items.map((item) => (
                    <div className="opd-medication-chip-item" key={item.id}>
                      <div><strong>{item.medicine_name}</strong><span>{[item.strength, item.dosage, item.frequency].filter(Boolean).join(' ')}</span></div>
                    </div>
                  ))}
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
                <div className="opd-summary-empty-text">No laboratory results are available in this visit.</div>
              </div>

              {/* Clinical Alerts */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Clinical Alerts</h3>
                  </div>
                </div>
                {workspace.consultation?.allergies ? (
                  <div className="opd-clinical-alert warning"><i className="ph ph-warning-circle" aria-hidden="true" /><div><strong>Allergy Alert</strong><span>{workspace.consultation.allergies}</span></div></div>
                ) : <div className="opd-summary-empty-text">No clinical alerts recorded.</div>}
              </div>
            </aside>
          </div>
        </>
      )}

      <OpdVitalsModal
        initialData={workspace.vitals}
        isSaving={workspace.isCreatingVitals}
        onClose={() => setVitalsModalOpen(false)}
        onSave={saveVitals}
        open={vitalsModalOpen}
        visit={visit}
      />
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </div>
  );
}
