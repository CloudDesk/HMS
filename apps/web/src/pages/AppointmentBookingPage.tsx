import { AppointmentOphthalmologyFields } from '../components/AppointmentOphthalmologyFields';
import { appointmentSpecialtyFormFields, emptyAppointmentSpecialtyForm, appointmentSpecialtyValue, validateAppointmentSpecialtyForm } from '../hooks/appointments/appointment-specialty-form';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type ApiAppointmentPriority, type ApiAppointmentVisitType } from '../api/appointments';
import { type PatientResponse } from '../api/patients';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentPriorityLabels,
  appointmentVisitTypeLabels,
  formatAppointmentDate,
  parseInputDate,
  toInputDate,
  todayInputValue,
} from './appointment-utils';
import { calculatePatientAge, patientFullName, patientInitials } from './patient-utils';
import { useAppointmentBookingFeature } from '../hooks/appointments/useAppointmentBookingFeature';
import { useTimezone } from '../api/useSettings';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';

type BookingStep = 1 | 2 | 3;

const visitTypeOptions = Object.keys(appointmentVisitTypeLabels) as ApiAppointmentVisitType[];
const priorityOptions: ApiAppointmentPriority[] = ['ROUTINE', 'URGENT', 'EMERGENCY'];

const ophthalmicComplaints = [
  'Blurred Vision',
  'Eye Pain / Discomfort',
  'Redness / Hyperemia',
  'Floaters & Flashes',
  'Watering / Epiphora',
  'Itching & Irritation',
  'Foreign Body Sensation',
  'Diplopia / Double Vision',
  'Photophobia / Glare',
  'Dry Eye Syndrome',
  'Headache / Eyestrain',
  'Routine Vision Exam',
];

const commonEyeHistory = [
  'Cataract Surgery',
  'LASIK / Refractive Surgery',
  'Glaucoma',
  'Diabetic Retinopathy',
  'Hypertension',
  'Diabetes Mellitus',
  'Contact Lens Wearer',
  'Ocular Trauma / Injury',
  'Retinal Detachment / Laser',
];

const commonAllergies = [
  'No Known Drug Allergies (NKDA)',
  'Penicillin',
  'Sulfa Drugs',
  'Eye Drops / Dilating Agents',
  'Latex',
  'NSAIDs',
  'Local Anesthesia',
];

export const isSlotInPast = (dateStr: string, slotStartTimeStr: string): boolean => {
  const today = todayInputValue();
  if (dateStr < today) return true;
  if (dateStr > today) return false;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  return slotStartTimeStr < currentTimeStr;
};

const bookingSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  doctor_id: z.string().min(1, 'Doctor is required'),
  appointment_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Time slot is required'),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'REVIEW', 'EMERGENCY']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
  reason: z.string().trim().optional(),
  notes: z.string().optional(),
  history_present_illness: z.string().optional(),
  past_history: z.string().optional(),
  family_history: z.string().optional(),
  allergies: z.string().optional(),
  ...appointmentSpecialtyFormFields,
}).superRefine(validateAppointmentSpecialtyForm);

export type BookingFormData = z.infer<typeof bookingSchema>;

export function AppointmentBookingPage() {
  const { search, pathname } = useAppLocation();
  const specialtyOpen = new URLSearchParams(search).get('specialty_details') === 'open';
  const specialtyPage = Number(new URLSearchParams(search).get('specialty_page') ?? 1);
  const setSpecialtyQuery = (open: boolean, page: number) => { const next = new URLSearchParams(search); if (open) { next.set('specialty_details', 'open'); next.set('specialty_page', String(page)); } else { next.delete('specialty_details'); next.delete('specialty_page'); } navigate(`${pathname}?${next}`); };
  const initialPatientId = new URLSearchParams(search).get('patient') ?? '';
  const referralVisitId = new URLSearchParams(search).get('referral_visit') ?? '';
  const emergencyReferralId = new URLSearchParams(search).get('emergency_referral') ?? '';
  const emergencyBranchId = new URLSearchParams(search).get('branch_id') ?? '';
  const [step, setStep] = useState<BookingStep>(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [showClinicalDetails, setShowClinicalDetails] = useState(false);
  const [hpiEye, setHpiEye] = useState<'OD' | 'OS' | 'OU'>('OU');
  const [hpiDurationValue, setHpiDurationValue] = useState<string>('');
  const [hpiDurationUnit, setHpiDurationUnit] = useState<string>('WEEK');
  const [hpiOnset, setHpiOnset] = useState<string>('');
  const [hpiProgression, setHpiProgression] = useState<string>('');
  const [hpiSeverity, setHpiSeverity] = useState<string>('');
  const [openIntakeSections, setOpenIntakeSections] = useState<{
    complaints: boolean;
    hpi: boolean;
    history: boolean;
    allergies: boolean;
    notes: boolean;
  }>({
    complaints: true,
    hpi: true,
    history: false,
    allergies: false,
    notes: false,
  });

  const toggleIntakeSection = (section: keyof typeof openIntakeSections) => {
    setOpenIntakeSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const allIntakeOpen = Object.values(openIntakeSections).every(Boolean);
  const toggleAllIntakeSections = () => {
    const nextState = !allIntakeOpen;
    setOpenIntakeSections({
      complaints: nextState,
      hpi: nextState,
      history: nextState,
      allergies: nextState,
      notes: nextState,
    });
  };
  const timezone = useTimezone();

  const {
    register,
    watch,
    setValue,
    clearErrors,
    setError,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      patient_id: initialPatientId,
      doctor_id: '',
      appointment_date: todayInputValue(),
      start_time: '',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      reason: '',
      notes: '',
      history_present_illness: '',
      past_history: '',
      family_history: '',
      allergies: '',
      ...emptyAppointmentSpecialtyForm,
    },
  });

  const selectedDoctorId = watch('doctor_id');
  const appointmentDate = watch('appointment_date');
  const selectedSlot = watch('start_time');
  const visitType = watch('visit_type');
  const priority = watch('priority');
  const currentReason = watch('reason') || '';

  const toggleComplaintTag = (complaint: string) => {
    const current = watch('reason') || '';
    const parts = current.split(',').map((s) => s.trim()).filter(Boolean);
    let next: string[];
    if (parts.includes(complaint)) {
      next = parts.filter((s) => s !== complaint);
    } else {
      next = [...parts, complaint];
    }
    setValue('reason', next.join(', '), { shouldDirty: true, shouldValidate: true });
  };

  const toggleHistoryTag = (tag: string) => {
    const current = watch('past_history') || '';
    const parts = current.split(',').map((s) => s.trim()).filter(Boolean);
    let next: string[];
    if (parts.includes(tag)) {
      next = parts.filter((s) => s !== tag);
    } else {
      next = [...parts, tag];
    }
    setValue('past_history', next.join(', '), { shouldDirty: true });
  };

  const toggleAllergyTag = (tag: string) => {
    const current = watch('allergies') || '';
    const parts = current.split(',').map((s) => s.trim()).filter(Boolean);
    let next: string[];
    if (tag === 'No Known Drug Allergies (NKDA)') {
      next = parts.includes(tag) ? [] : [tag];
    } else {
      const withoutNkda = parts.filter((s) => s !== 'No Known Drug Allergies (NKDA)');
      if (withoutNkda.includes(tag)) {
        next = withoutNkda.filter((s) => s !== tag);
      } else {
        next = [...withoutNkda, tag];
      }
    }
    setValue('allergies', next.join(', '), { shouldDirty: true });
  };

  const syncHpiToField = (
    eye = hpiEye,
    durVal = hpiDurationValue,
    durUnit = hpiDurationUnit,
    onset = hpiOnset,
    prog = hpiProgression,
    sev = hpiSeverity,
  ) => {
    const parts = [
      `Affected Eye: ${eye}`,
      durVal ? `Duration: ${durVal} ${durUnit.toLowerCase()}(s)` : null,
      onset ? `Onset: ${onset}` : null,
      prog ? `Progression: ${prog}` : null,
      sev ? `Severity: ${sev}` : null,
    ].filter(Boolean);

    const existing = getValues('history_present_illness') || '';
    const structuredPrefix = parts.join(' | ');
    const noteMarker = '\nNotes: ';
    const existingParts = existing.split(noteMarker);
    const existingNotes = existingParts.length > 1 ? existingParts[1] : (existing.startsWith('Affected Eye:') ? '' : existing);
    const combined = existingNotes ? `${structuredPrefix}${noteMarker}${existingNotes}` : structuredPrefix;
    setValue('history_present_illness', combined, { shouldDirty: true });
  };

  const {
    state: {
      specialtyServices,
      specialtyChoices,
      specialtyReady,
      departments,
      initialPatientData,
      referral,
      patientResults,
      patientLoading,
      doctors,
      doctorLoading,
      slotsData,
      slotLoading,
      existingApptsData,
      existingApptsLoading,
      isSubmitting,
    },
    actions: {
      searchPatientsRefetch,
      handleCreateAppointment,
    }
  } = useAppointmentBookingFeature(
    initialPatientId,
    patientSearch,
    selectedDoctorId,
    appointmentDate,
    referralVisitId,
    emergencyReferralId,
    emergencyBranchId,
    { open: specialtyOpen, page: specialtyPage },
  );

  const filteredDoctors = useMemo(() => {
    if (!selectedDepartmentId) return doctors;
    return doctors.filter((doc) => doc.department_id === selectedDepartmentId);
  }, [doctors, selectedDepartmentId]);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === selectedDoctorId), [doctors, selectedDoctorId]);
  const selectedDoctorDepartment = useMemo(() => {
    if (!selectedDoctor) return null;
    return departments.find((d) => d.id === selectedDoctor.department_id);
  }, [departments, selectedDoctor]);

  const [selectedPatient, setSelectedPatient] = useState<PatientResponse | null>(null);

  useEffect(() => {
    if (initialPatientData) {
      setSelectedPatient(initialPatientData);
      setValue('patient_id', initialPatientData.id);
      setStep(2);
    }
  }, [initialPatientData, setValue]);

  useEffect(() => {
    if (!referral) return;
    if (referral.referred_doctor_id) setValue('doctor_id', referral.referred_doctor_id);
    setValue('priority', referral.priority);
    setValue('reason', referral.reason ?? '');
    setValue('notes', referral.clinical_summary ?? '');
  }, [referral, setValue]);

  // Set default doctor when loaded
  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctorId && !referral?.referred_doctor_id) {
      const firstDoctorId = doctors[0]?.id;
      if (firstDoctorId) setValue('doctor_id', firstDoctorId);
    }
  }, [doctors, referral?.referred_doctor_id, selectedDoctorId, setValue]);

  // Sync department filter if doctor selected has department
  useEffect(() => {
    if (selectedDoctor?.department_id && !selectedDepartmentId) {
      setSelectedDepartmentId(selectedDoctor.department_id);
    }
  }, [selectedDoctor, selectedDepartmentId]);

  // Clear slot on date/doctor change
  useEffect(() => {
    setValue('start_time', '', {
      shouldDirty: false,
      shouldValidate: false,
    });
    clearErrors('start_time');
  }, [
    appointmentDate,
    clearErrors,
    selectedDoctorId,
    setValue,
  ]);

  const searchPatients = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!patientSearch.trim()) return;
    setHasSearched(true);
    void searchPatientsRefetch();
  };

  const selectPatient = (patient: PatientResponse) => {
    setSelectedPatient(patient);
    setValue('patient_id', patient.id);
    setStep(2);
  };

  const configuredMaxPatients = 1;

  const slotOptions = useMemo(() => {
    if (!slotsData) return [];

    const existingAppts = existingApptsData?.data || [];
    const bookedCountMap: Record<string, number> = {};
    existingAppts.forEach((appt) => {
      if (appt.status !== 'CANCELLED') {
        bookedCountMap[appt.start_time] = (bookedCountMap[appt.start_time] || 0) + 1;
      }
    });

    return slotsData.slots.map(slot => {
      const isPast = isSlotInPast(appointmentDate, slot.start_time);
      const maxCapacity = configuredMaxPatients;
      const bookedCount = bookedCountMap[slot.start_time] || 0;
      const remainingSlots = Math.max(0, maxCapacity - bookedCount);
      const isAvailable = remainingSlots > 0 && !isPast;
      
      const startParts = slot.start_time.split(':').map(Number);
      const endParts = slot.end_time.split(':').map(Number);
      const durationMinutes = ((endParts[0] || 0) * 60 + (endParts[1] || 0)) - ((startParts[0] || 0) * 60 + (startParts[1] || 0));

      return {
        startTime: slot.start_time,
        endTime: slot.end_time,
        durationMinutes,
        maxCapacity,
        bookedCount,
        remainingSlots,
        isAvailable
      };
    });
  }, [slotsData, existingApptsData, appointmentDate, configuredMaxPatients]);

  const selectedSlotOption = slotOptions.find((slot) => slot.startTime === selectedSlot);

  const morningSlots = useMemo(
    () => slotOptions.filter((s) => parseInt(s.startTime.split(':')[0] || '0', 10) < 12),
    [slotOptions],
  );
  const afternoonSlots = useMemo(
    () =>
      slotOptions.filter((s) => {
        const h = parseInt(s.startTime.split(':')[0] || '0', 10);
        return h >= 12 && h < 17;
      }),
    [slotOptions],
  );
  const eveningSlots = useMemo(
    () => slotOptions.filter((s) => parseInt(s.startTime.split(':')[0] || '0', 10) >= 17),
    [slotOptions],
  );

  const allSlotsInPast = useMemo(
    () => slotOptions.length > 0 && slotOptions.every((s) => isSlotInPast(appointmentDate, s.startTime)),
    [slotOptions, appointmentDate],
  );
  
  const slotUnavailableReason = slotsData?.unavailable_reason || (
    slotOptions.length === 0 ? 'No working hours scheduled for this doctor on the selected date.' 
    : allSlotsInPast ? 'All consultation slots for today have passed.'
    : 'All available appointment slots for this date are fully booked.'
  );

  const stepDate = (offset: number) => {
    const current = parseInputDate(appointmentDate);
    current.setDate(current.getDate() + offset);
    const nextDateStr = toInputDate(current);
    if (nextDateStr >= todayInputValue()) {
      setValue('appointment_date', nextDateStr, { shouldDirty: true, shouldValidate: true });
    }
  };

  const setQuickDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    setValue('appointment_date', toInputDate(d), { shouldDirty: true, shouldValidate: true });
  };

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartmentId(deptId);
    if (deptId) {
      const docsInDept = doctors.filter((d) => d.department_id === deptId);
      if (docsInDept[0] && (!selectedDoctorId || !docsInDept.some((d) => d.id === selectedDoctorId))) {
        setValue('doctor_id', docsInDept[0].id, { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const continueToConfirmation = async () => {
    const isValid = await trigger();
    if (getValues('specialty_enabled') && !specialtyReady) { setError('root', { message: 'Refresh specialty options for the selected consultant before continuing.' }); return; }
    if (isValid && selectedSlot) {
      setStep(3);
    }
  };

  const submitBooking = async (data: BookingFormData) => {
    try {
      await handleCreateAppointment({
        patient_id: data.patient_id, doctor_id: data.doctor_id, appointment_date: data.appointment_date, start_time: data.start_time, visit_type: data.visit_type, priority: data.priority, ophthalmology: appointmentSpecialtyValue(data),
        duration_minutes: selectedSlotOption?.durationMinutes ?? 30,
        reason: data.reason?.trim() || null,
        notes: data.notes?.trim() || null,
        consultation_intake: {
          chief_complaint: data.reason?.trim() || null,
          history_present_illness: data.history_present_illness?.trim() || null,
          past_history: data.past_history?.trim() || null,
          family_history: data.family_history?.trim() || null,
          allergies: data.allergies?.trim() || null,
        },
      });
      navigate('/appointments/queue');
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Appointment could not be saved.' });
    }
  };

  return (
    <>
      <div className="appointment-page appointment-booking-page">
        {errors.root && <p role="alert" className="form-error-banner">{errors.root.message}</p>}{errors.specialty_subtype && <p role="alert" className="form-error-banner">{errors.specialty_subtype.message}</p>}
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Book Appointment</h2>
            <p>Schedule patient consultations, assign clinicians, and reserve real-time slots.</p>
          </div>
        </section>

        {/* 1. Enhanced Connected Stepper */}
        <nav aria-label="Booking steps" className="hms-booking-stepper">
          <button
            className={`hms-stepper-item ${step === 1 ? 'active' : step > 1 ? 'complete' : ''}`}
            onClick={() => {
              if (step > 1) setStep(1);
            }}
            type="button"
          >
            <div className="hms-stepper-num">
              {step > 1 ? <i className="ph ph-check" aria-hidden="true" /> : '1'}
            </div>
            <div className="hms-stepper-text">
              <span className="hms-stepper-title">Patient Identification</span>
              <span className="hms-stepper-subtitle">Select or register patient</span>
            </div>
          </button>

          <div className={`hms-stepper-line ${step > 1 ? 'completed' : ''}`} />

          <button
            className={`hms-stepper-item ${step === 2 ? 'active' : step > 2 ? 'complete' : ''}`}
            onClick={() => {
              if (selectedPatient && step > 2) setStep(2);
            }}
            type="button"
          >
            <div className="hms-stepper-num">
              {step > 2 ? <i className="ph ph-check" aria-hidden="true" /> : '2'}
            </div>
            <div className="hms-stepper-text">
              <span className="hms-stepper-title">Clinician & Schedule</span>
              <span className="hms-stepper-subtitle">Doctor, date & slot</span>
            </div>
          </button>

          <div className={`hms-stepper-line ${step > 2 ? 'completed' : ''}`} />

          <button
            className={`hms-stepper-item ${step === 3 ? 'active' : ''}`}
            type="button"
          >
            <div className="hms-stepper-num">3</div>
            <div className="hms-stepper-text">
              <span className="hms-stepper-title">Verification & Pass</span>
              <span className="hms-stepper-subtitle">Confirm appointment</span>
            </div>
          </button>
        </nav>

        {/* STEP 1: PATIENT IDENTIFICATION */}
        {step === 1 ? (
          <section className="doc-card appointment-booking-card">
            <div className="doc-card-header">
              <div>
                <h3>Locate or Register Patient</h3>
                <p>Search active registry by MRN, full name, phone number, or email.</p>
              </div>
              <button
                className="doc-btn"
                onClick={() => navigate('/patients/register?return=/appointments/book')}
                type="button"
              >
                <i className="ph ph-user-plus" aria-hidden="true" />
                Register New Patient
              </button>
            </div>

            <form className="hms-search-box-wrap" onSubmit={searchPatients}>
              <div className="hms-search-input-container">
                <i className="ph ph-magnifying-glass search-icon" aria-hidden="true" />
                <input
                  aria-label="Patient Search"
                  id="booking-patient-search"
                  onChange={(event) => setPatientSearch(event.target.value)}
                  placeholder="Enter patient MRN, name, phone, or email (e.g. HMS-2026-000022)"
                  value={patientSearch}
                />
                {patientSearch && (
                  <button
                    aria-label="Clear search"
                    className="hms-search-clear-btn"
                    onClick={() => {
                      setPatientSearch('');
                      setHasSearched(false);
                    }}
                    type="button"
                  >
                    <i className="ph ph-x" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button className="doc-btn primary" disabled={patientLoading} type="submit">
                {patientLoading ? (
                  <>
                    <MedicalSpinner size="sm" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <i className="ph ph-magnifying-glass" aria-hidden="true" />
                    Search Patient
                  </>
                )}
              </button>
            </form>

            {patientLoading ? (
              <div style={{ padding: '2.5rem 1rem' }}>
                <MedicalLoader size="small" text="Searching master patient directory..." subtext="Querying active records" />
              </div>
            ) : patientResults.length > 0 ? (
              <div className="hms-patient-results-grid">
                {patientResults.map((patient) => (
                  <article className="hms-patient-card" key={patient.id}>
                    <div>
                      <div className="hms-patient-card-top">
                        <span className="hms-patient-avatar">{patientInitials(patient)}</span>
                        <div className="hms-patient-card-info">
                          <h4 className="hms-patient-card-name">
                            {patientFullName(patient)}
                            <i className="ph ph-check-circle" style={{ color: '#16a34a' }} title="Verified Profile" />
                          </h4>
                          <span className="hms-patient-card-mrn">{patient.patient_number}</span>
                        </div>
                      </div>

                      <div className="hms-patient-chips">
                        <span className="hms-chip">
                          <i className="ph ph-user" aria-hidden="true" />
                          {patient.gender}
                        </span>
                        <span className="hms-chip">
                          <i className="ph ph-cake" aria-hidden="true" />
                          {calculatePatientAge(patient.date_of_birth)}
                        </span>
                        <span className="hms-chip">
                          <i className="ph ph-phone" aria-hidden="true" />
                          {patient.phone || 'No phone'}
                        </span>
                        {patient.blood_group && (
                          <span className="hms-chip" style={{ color: '#b91c1c', background: '#fee2e2' }}>
                            <i className="ph ph-drop" aria-hidden="true" />
                            {patient.blood_group}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      className="doc-btn primary"
                      onClick={() => selectPatient(patient)}
                      style={{ width: '100%', justifyContent: 'center' }}
                      type="button"
                    >
                      <span>Select Patient</span>
                      <i className="ph ph-arrow-right" aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="hms-empty-state-card">
                <div className="hms-empty-state-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <i className="ph ph-user-circle-minus" aria-hidden="true" />
                </div>
                <h4>No Patients Found</h4>
                <p>
                  No active patient matched <strong>"{patientSearch}"</strong>. Verify MRN, name spelling, or create a new patient profile.
                </p>
              </div>
            ) : (
              <div className="hms-empty-state-card">
                <div className="hms-empty-state-icon">
                  <i className="ph ph-user-focus" aria-hidden="true" />
                </div>
                <h4>Search or Register a Patient</h4>
              </div>
            )}
          </section>
        ) : step === 2 ? (
          /* STEP 2: CLINICIAN, SCHEDULE & INTAKE */
          <>
            {/* Verified Patient Banner */}
            {selectedPatient && (
              <section className="hms-verified-patient-banner">
                <div className="hms-verified-patient-info">
                  <span className="hms-verified-patient-avatar">{patientInitials(selectedPatient)}</span>
                  <div className="hms-verified-patient-details">
                    <h3>
                      {patientFullName(selectedPatient)}
                      <span className="verified-badge">
                        <i className="ph ph-check" aria-hidden="true" />
                        Verified Patient
                      </span>
                    </h3>
                    <div className="hms-verified-patient-meta">
                      <span className="hms-patient-chip mrn-chip">MRN: {selectedPatient.patient_number}</span>
                      <span className="hms-patient-chip">
                        <i className="ph ph-user" aria-hidden="true" />
                        {selectedPatient.gender}
                      </span>
                      <span className="hms-patient-chip">
                        <i className="ph ph-cake" aria-hidden="true" />
                        {calculatePatientAge(selectedPatient.date_of_birth)}
                      </span>
                      <span className="hms-patient-chip">
                        <i className="ph ph-phone" aria-hidden="true" />
                        {selectedPatient.phone || 'No phone'}
                      </span>
                      {selectedPatient.blood_group && (
                        <span className="hms-patient-chip" style={{ color: '#b91c1c', background: '#fee2e2', borderColor: '#fca5a5' }}>
                          <i className="ph ph-drop" aria-hidden="true" />
                          {selectedPatient.blood_group}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="doc-btn" onClick={() => setStep(1)} type="button">
                  <i className="ph ph-arrows-clockwise" aria-hidden="true" />
                  Change Patient
                </button>
              </section>
            )}

            <form
              className="doc-card appointment-booking-card"
              onSubmit={(e) => {
                e.preventDefault();
                void continueToConfirmation();
              }}
            >
              <div className="doc-card-header">
                <div>
                  <h3>Clinician & Consultation Schedule</h3>
                  <p>Filter by clinical department, pick attending physician, and select consultation session.</p>
                </div>
              </div>

              <div className="appointment-form-grid">
                {/* Department Filter */}
                <div className="doc-field">
                  <label htmlFor="booking-department">
                    Clinical Department <span className="doc-field-hint">(Filter doctors)</span>
                  </label>
                  <select
                    id="booking-department"
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    value={selectedDepartmentId}
                  >
                    <option value="">All Departments ({doctors.length} Doctors)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Doctor Select */}
                <div className={`doc-field${errors.doctor_id ? ' has-error' : ''}`}>
                  <label htmlFor="booking-doctor">
                    Attending Doctor <span className="required-asterisk">*</span>
                  </label>
                  <select
                    disabled={doctorLoading}
                    id="booking-doctor"
                    {...register('doctor_id')}
                  >
                    <option value="">Select attending clinician</option>
                    {filteredDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.display_name} - {doctor.specialization}
                      </option>
                    ))}
                  </select>
                  {errors.doctor_id && <span className="field-error-msg">{errors.doctor_id.message}</span>}
                </div>

                {/* Selected Doctor Preview Card */}
                {selectedDoctor && (
                  <div className="doc-field full">
                    <div className="hms-doctor-preview-card">
                      <div className="hms-doctor-avatar">
                        <i className="ph ph-stethoscope" aria-hidden="true" />
                      </div>
                      <div className="hms-doctor-info">
                        <div className="hms-doctor-name">{selectedDoctor.display_name}</div>
                        <div className="hms-doctor-subtext">
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>{selectedDoctor.specialization}</span>
                          {selectedDoctorDepartment && <span>• {selectedDoctorDepartment.name}</span>}
                          {selectedDoctor.consultation_room && (
                            <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                              Room: {selectedDoctor.consultation_room}
                            </span>
                          )}
                          <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <i className="ph ph-dot" style={{ fontSize: '1.2rem' }} />
                            Available for Bookings
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Appointment Date with Quick Date Chips & Stepper */}
                <div className={`doc-field full${errors.appointment_date ? ' has-error' : ''}`}>
                  <div className="hms-date-picker-header">
                    <label htmlFor="booking-date" style={{ margin: 0 }}>
                      Appointment Date <span className="required-asterisk">*</span>
                    </label>
                    <div className="hms-quick-date-chips">
                      <button
                        className={`hms-quick-date-btn${appointmentDate === todayInputValue() ? ' active' : ''}`}
                        onClick={() => setQuickDate(0)}
                        type="button"
                      >
                        Today
                      </button>
                      <button
                        className={`hms-quick-date-btn${
                          appointmentDate ===
                          toInputDate(new Date(Date.now() + 86400000))
                            ? ' active'
                            : ''
                        }`}
                        onClick={() => setQuickDate(1)}
                        type="button"
                      >
                        Tomorrow
                      </button>
                      <button
                        className="hms-quick-date-btn"
                        onClick={() => setQuickDate(2)}
                        type="button"
                      >
                        +2 Days
                      </button>
                      <button
                        className="hms-quick-date-btn"
                        onClick={() => setQuickDate(3)}
                        type="button"
                      >
                        +3 Days
                      </button>
                    </div>
                  </div>

                  <div className="hms-date-input-group">
                    <button
                      aria-label="Previous day"
                      className="hms-date-step-btn"
                      disabled={appointmentDate <= todayInputValue()}
                      onClick={() => stepDate(-1)}
                      title="Previous Day"
                      type="button"
                    >
                      <i className="ph ph-caret-left" />
                    </button>
                    <input
                      id="booking-date"
                      min={todayInputValue()}
                      style={{ flex: 1 }}
                      type="date"
                      {...register('appointment_date')}
                    />
                    <button
                      aria-label="Next day"
                      className="hms-date-step-btn"
                      onClick={() => stepDate(1)}
                      title="Next Day"
                      type="button"
                    >
                      <i className="ph ph-caret-right" />
                    </button>
                  </div>
                  {errors.appointment_date && <span className="field-error-msg">{errors.appointment_date.message}</span>}
                </div>

                {/* Visit Type & Priority */}
                <div className="doc-field">
                  <label htmlFor="booking-visit-type">Appointment Visit Type</label>
                  <select id="booking-visit-type" {...register('visit_type')}>
                    {visitTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {appointmentVisitTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="doc-field">
                  <label htmlFor="booking-priority">Triage Priority</label>
                  <select id="booking-priority" {...register('priority')}>
                    {priorityOptions.map((item) => (
                      <option key={item} value={item}>
                        {appointmentPriorityLabels[item]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Available Time Slots with Sessions (Morning, Afternoon, Evening) */}
                <div className={`doc-field full${errors.start_time ? ' has-error' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <label style={{ margin: 0, fontWeight: 700 }}>
                      Available Consultation Slots <span className="required-asterisk">*</span>
                    </label>
                    {errors.start_time && (
                      <span className="field-error-msg" style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <i className="ph ph-warning-circle" aria-hidden="true" />
                        {errors.start_time.message}
                      </span>
                    )}
                  </div>

                  {slotLoading || existingApptsLoading ? (
                    <div style={{ padding: '2.5rem 1rem' }}>
                      <MedicalLoader
                        size="small"
                        subtext="Checking doctor schedule, room assignment, and existing bookings"
                        text="Loading available consultation slots..."
                      />
                    </div>
                  ) : slotOptions.length === 0 ? (
                    <div className="appointment-no-slots-notice" role="alert">
                      <i className="ph ph-info" aria-hidden="true" />
                      <div>
                        <strong>No Working Hours Scheduled</strong>
                        <p>{slotUnavailableReason || 'No consultation slots are configured for this doctor on the selected date.'}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* If all slots are in the past for today, prompt switch to tomorrow */}
                      {allSlotsInPast && (
                        <div className="hms-past-prompt-banner">
                          <div className="message">
                            <i className="ph ph-clock-countdown" aria-hidden="true" />
                            <span>All clinic hours for today have expired. Switch to tomorrow to view active openings.</span>
                          </div>
                          <button
                            className="doc-btn primary"
                            onClick={() => setQuickDate(1)}
                            type="button"
                          >
                            <i className="ph ph-calendar-plus" aria-hidden="true" />
                            View Tomorrow's Slots
                          </button>
                        </div>
                      )}

                      <div className="hms-sessions-container">
                        {/* Morning Session */}
                        {morningSlots.length > 0 && (
                          <div className="hms-session-group">
                            <div className="hms-session-header">
                              <span className="hms-session-title">
                                <i className="ph ph-sun-horizon" aria-hidden="true" />
                                Morning Session (08:00 AM - 12:00 PM)
                              </span>
                              <span
                                className={`hms-session-badge ${
                                  morningSlots.some((s) => s.isAvailable) ? 'has-available' : ''
                                }`}
                              >
                                {morningSlots.filter((s) => s.isAvailable).length} available
                              </span>
                            </div>
                            <div className="hms-slot-grid-session">
                              {morningSlots.map((slot) => {
                                const isSelected = selectedSlot === slot.startTime;
                                const isFull = slot.remainingSlots <= 0;
                                const isPast = isSlotInPast(appointmentDate, slot.startTime);
                                const isDisabled = isFull || isPast;
                                return (
                                  <button
                                    className={`hms-slot-pill${isSelected ? ' selected' : ''}`}
                                    disabled={isDisabled}
                                    key={slot.startTime}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setValue('start_time', slot.startTime, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        });
                                      }
                                    }}
                                    type="button"
                                  >
                                    <span className="hms-slot-time">
                                      {slot.startTime}
                                    </span>
                                    <span className="hms-slot-duration">{slot.durationMinutes}m slot</span>
                                    <span
                                      className={`hms-slot-badge ${
                                        isPast ? 'past' : isFull ? 'full' : 'available'
                                      }`}
                                    >
                                      {isPast ? 'Past' : isFull ? 'Booked' : 'Available'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Afternoon Session */}
                        {afternoonSlots.length > 0 && (
                          <div className="hms-session-group">
                            <div className="hms-session-header">
                              <span className="hms-session-title afternoon">
                                <i className="ph ph-sun" aria-hidden="true" />
                                Afternoon Session (12:00 PM - 05:00 PM)
                              </span>
                              <span
                                className={`hms-session-badge ${
                                  afternoonSlots.some((s) => s.isAvailable) ? 'has-available' : ''
                                }`}
                              >
                                {afternoonSlots.filter((s) => s.isAvailable).length} available
                              </span>
                            </div>
                            <div className="hms-slot-grid-session">
                              {afternoonSlots.map((slot) => {
                                const isSelected = selectedSlot === slot.startTime;
                                const isFull = slot.remainingSlots <= 0;
                                const isPast = isSlotInPast(appointmentDate, slot.startTime);
                                const isDisabled = isFull || isPast;
                                return (
                                  <button
                                    className={`hms-slot-pill${isSelected ? ' selected' : ''}`}
                                    disabled={isDisabled}
                                    key={slot.startTime}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setValue('start_time', slot.startTime, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        });
                                      }
                                    }}
                                    type="button"
                                  >
                                    <span className="hms-slot-time">
                                      {slot.startTime}
                                    </span>
                                    <span className="hms-slot-duration">{slot.durationMinutes}m slot</span>
                                    <span
                                      className={`hms-slot-badge ${
                                        isPast ? 'past' : isFull ? 'full' : 'available'
                                      }`}
                                    >
                                      {isPast ? 'Past' : isFull ? 'Booked' : 'Available'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Evening Session */}
                        {eveningSlots.length > 0 && (
                          <div className="hms-session-group">
                            <div className="hms-session-header">
                              <span className="hms-session-title evening">
                                <i className="ph ph-moon" aria-hidden="true" />
                                Evening Session (05:00 PM onwards)
                              </span>
                              <span
                                className={`hms-session-badge ${
                                  eveningSlots.some((s) => s.isAvailable) ? 'has-available' : ''
                                }`}
                              >
                                {eveningSlots.filter((s) => s.isAvailable).length} available
                              </span>
                            </div>
                            <div className="hms-slot-grid-session">
                              {eveningSlots.map((slot) => {
                                const isSelected = selectedSlot === slot.startTime;
                                const isFull = slot.remainingSlots <= 0;
                                const isPast = isSlotInPast(appointmentDate, slot.startTime);
                                const isDisabled = isFull || isPast;
                                return (
                                  <button
                                    className={`hms-slot-pill${isSelected ? ' selected' : ''}`}
                                    disabled={isDisabled}
                                    key={slot.startTime}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setValue('start_time', slot.startTime, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        });
                                      }
                                    }}
                                    type="button"
                                  >
                                    <span className="hms-slot-time">
                                      {slot.startTime}
                                    </span>
                                    <span className="hms-slot-duration">{slot.durationMinutes}m slot</span>
                                    <span
                                      className={`hms-slot-badge ${
                                        isPast ? 'past' : isFull ? 'full' : 'available'
                                      }`}
                                    >
                                      {isPast ? 'Past' : isFull ? 'Booked' : 'Available'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Ophthalmic Clinical Intake & Presenting Complaints */}
                <div className="doc-field full" style={{ marginTop: '0.5rem' }}>
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '0.75rem',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb',
                            fontSize: '1.2rem',
                          }}
                        >
                          <i className="ph ph-eye" />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                            Ophthalmic Clinical Intake & Presenting Complaints
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                            Capture presenting ocular symptoms, HPI parameters, ocular history, and drug sensitivities for this consultation
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={toggleAllIntakeSections}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            color: '#334155',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <i className={`ph ph-${allIntakeOpen ? 'caret-up' : 'caret-down'}`} />
                          <span>{allIntakeOpen ? 'Collapse All' : 'Expand All'}</span>
                        </button>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#2563eb',
                            background: '#eff6ff',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {(watch('reason') || '').split(',').map((s) => s.trim()).filter(Boolean).length} Selected
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Chief Complaints & Presenting Symptoms */}
                    <div style={{ marginBottom: '10px' }}>
                      <div
                        onClick={() => toggleIntakeSection('complaints')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: openIntakeSections.complaints ? '#f8fafc' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: openIntakeSections.complaints ? '10px 10px 0 0' : '10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            1
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                            Chief Complaints & Presenting Symptoms
                          </span>
                          {!openIntakeSections.complaints && Boolean(watch('reason')) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#2563eb',
                                background: '#eff6ff',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {watch('reason')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {openIntakeSections.complaints ? 'Collapse' : 'Expand'}
                          </span>
                          <i className={`ph ph-caret-${openIntakeSections.complaints ? 'up' : 'down'}`} />
                        </div>
                      </div>

                      {openIntakeSections.complaints && (
                        <div
                          style={{
                            border: '1px solid #e2e8f0',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px',
                            padding: '14px',
                            background: '#ffffff',
                          }}
                        >
                          <label
                            htmlFor="booking-reason"
                            style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}
                          >
                            Presenting Ophthalmic Complaints <span style={{ color: '#2563eb', fontWeight: 500 }}>(Click tags to toggle)</span>
                          </label>
                          <div className="hms-complaint-chips-wrap">
                            {ophthalmicComplaints.map((tag) => {
                              const isSelected = (watch('reason') || '').split(',').map((s) => s.trim()).includes(tag);
                              return (
                                <button
                                  className={`hms-complaint-tag ${isSelected ? 'selected' : ''}`}
                                  key={tag}
                                  onClick={() => toggleComplaintTag(tag)}
                                  style={
                                    isSelected
                                      ? { background: '#2563eb', color: '#ffffff', borderColor: '#2563eb', fontWeight: 700 }
                                      : {}
                                  }
                                  type="button"
                                >
                                  <i className={`ph ${isSelected ? 'ph-check' : 'ph-plus-circle'}`} />
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            id="booking-reason"
                            placeholder="Enter or refine presenting symptoms and chief complaint summary"
                            rows={2}
                            style={{
                              width: '100%',
                              marginTop: '0.4rem',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.84rem',
                            }}
                            {...register('reason')}
                          />
                          {errors.reason ? <small className="field-error">{errors.reason.message}</small> : null}
                        </div>
                      )}
                    </div>

                    {/* Section 2: Presentation & History of Present Illness (HPI) */}
                    <div style={{ marginBottom: '10px' }}>
                      <div
                        onClick={() => toggleIntakeSection('hpi')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: openIntakeSections.hpi ? '#f8fafc' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: openIntakeSections.hpi ? '10px 10px 0 0' : '10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            2
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                            Presentation &amp; History of Present Illness (HPI)
                          </span>
                          {!openIntakeSections.hpi && Boolean(watch('history_present_illness')) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#0369a1',
                                background: '#e0f2fe',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {watch('history_present_illness')?.slice(0, 50)}...
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {openIntakeSections.hpi ? 'Collapse' : 'Expand'}
                          </span>
                          <i className={`ph ph-caret-${openIntakeSections.hpi ? 'up' : 'down'}`} />
                        </div>
                      </div>

                      {openIntakeSections.hpi && (
                        <div
                          style={{
                            border: '1px solid #e2e8f0',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px',
                            padding: '14px',
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: '0.85rem',
                            }}
                          >
                            {/* Affected Eye */}
                            <div>
                              <label
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                Affected Eye
                              </label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {[
                                  { id: 'OD', label: 'OD (Right)' },
                                  { id: 'OS', label: 'OS (Left)' },
                                  { id: 'OU', label: 'OU (Both)' },
                                ].map((eye) => (
                                  <button
                                    key={eye.id}
                                    type="button"
                                    className={`doc-btn ${hpiEye === eye.id ? 'primary' : ''}`}
                                    style={{
                                      flex: 1,
                                      padding: '4px 6px',
                                      fontSize: '0.78rem',
                                      minHeight: '32px',
                                      justifyContent: 'center',
                                    }}
                                    onClick={() => {
                                      setHpiEye(eye.id as 'OD' | 'OS' | 'OU');
                                      syncHpiToField(eye.id as 'OD' | 'OS' | 'OU');
                                    }}
                                  >
                                    {eye.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Duration */}
                            <div>
                              <label
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                Duration
                              </label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  placeholder="e.g. 2"
                                  value={hpiDurationValue}
                                  onChange={(e) => {
                                    setHpiDurationValue(e.target.value);
                                    syncHpiToField(undefined, e.target.value);
                                  }}
                                  style={{
                                    width: '70px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.82rem',
                                  }}
                                />
                                <select
                                  value={hpiDurationUnit}
                                  onChange={(e) => {
                                    setHpiDurationUnit(e.target.value);
                                    syncHpiToField(undefined, undefined, e.target.value);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.82rem',
                                  }}
                                >
                                  <option value="DAY">day(s)</option>
                                  <option value="WEEK">week(s)</option>
                                  <option value="MONTH">month(s)</option>
                                  <option value="YEAR">year(s)</option>
                                </select>
                              </div>
                            </div>

                            {/* Onset */}
                            <div>
                              <label
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                Onset
                              </label>
                              <select
                                value={hpiOnset}
                                onChange={(e) => {
                                  setHpiOnset(e.target.value);
                                  syncHpiToField(undefined, undefined, undefined, e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.82rem',
                                }}
                              >
                                <option value="">Select Onset</option>
                                <option value="SUDDEN">Sudden</option>
                                <option value="GRADUAL">Gradual</option>
                                <option value="UNKNOWN">Unknown</option>
                              </select>
                            </div>

                            {/* Progression */}
                            <div>
                              <label
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                Progression
                              </label>
                              <select
                                value={hpiProgression}
                                onChange={(e) => {
                                  setHpiProgression(e.target.value);
                                  syncHpiToField(undefined, undefined, undefined, undefined, e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.82rem',
                                }}
                              >
                                <option value="">Select Progression</option>
                                <option value="IMPROVING">Improving</option>
                                <option value="STABLE">Stable</option>
                                <option value="WORSENING">Worsening</option>
                                <option value="INTERMITTENT">Intermittent</option>
                              </select>
                            </div>

                            {/* Severity */}
                            <div>
                              <label
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                Severity
                              </label>
                              <select
                                value={hpiSeverity}
                                onChange={(e) => {
                                  setHpiSeverity(e.target.value);
                                  syncHpiToField(undefined, undefined, undefined, undefined, undefined, e.target.value);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.82rem',
                                }}
                              >
                                <option value="">Select Severity</option>
                                <option value="MILD">Mild</option>
                                <option value="MODERATE">Moderate</option>
                                <option value="SEVERE">Severe</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.75rem' }}>
                            <label
                              htmlFor="booking-hpi"
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                color: '#475569',
                                display: 'block',
                                marginBottom: '0.25rem',
                              }}
                            >
                              HPI Narrative &amp; Associated Symptoms
                            </label>
                            <textarea
                              id="booking-hpi"
                              placeholder="Detailed timeline, triggers, vision changes, or pain characteristics"
                              rows={2}
                              style={{
                                width: '100%',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.82rem',
                              }}
                              {...register('history_present_illness')}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 3: Past Ophthalmic & Medical History */}
                    <div style={{ marginBottom: '10px' }}>
                      <div
                        onClick={() => toggleIntakeSection('history')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: openIntakeSections.history ? '#f8fafc' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: openIntakeSections.history ? '10px 10px 0 0' : '10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#e0f2fe',
                              color: '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            3
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                            Past Ophthalmic &amp; Medical History
                          </span>
                          {!openIntakeSections.history && Boolean(watch('past_history')) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#0284c7',
                                background: '#e0f2fe',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {watch('past_history')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {openIntakeSections.history ? 'Collapse' : 'Expand'}
                          </span>
                          <i className={`ph ph-caret-${openIntakeSections.history ? 'up' : 'down'}`} />
                        </div>
                      </div>

                      {openIntakeSections.history && (
                        <div
                          style={{
                            border: '1px solid #e2e8f0',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px',
                            padding: '14px',
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                              Common Ocular &amp; Systemic Conditions
                            </span>
                            <button
                              type="button"
                              onClick={() => setValue('past_history', 'No significant prior ophthalmic history', { shouldDirty: true })}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '3px 9px',
                                fontSize: '0.74rem',
                                color: '#475569',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              No Significant History
                            </button>
                          </div>

                          <div className="hms-complaint-chips-wrap" style={{ marginBottom: '0.5rem' }}>
                            {commonEyeHistory.map((tag) => {
                              const isSelected = (watch('past_history') || '').split(',').map((s) => s.trim()).includes(tag);
                              return (
                                <button
                                  className={`hms-complaint-tag ${isSelected ? 'selected' : ''}`}
                                  key={tag}
                                  onClick={() => toggleHistoryTag(tag)}
                                  style={
                                    isSelected
                                      ? { background: '#0284c7', color: '#ffffff', borderColor: '#0284c7', fontWeight: 700 }
                                      : {}
                                  }
                                  type="button"
                                >
                                  <i className={`ph ${isSelected ? 'ph-check' : 'ph-plus-circle'}`} />
                                  {tag}
                                </button>
                              );
                            })}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                              gap: '0.75rem',
                            }}
                          >
                            <div>
                              <label
                                htmlFor="booking-past-history"
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.25rem',
                                }}
                              >
                                Past Ocular Surgeries &amp; Systemic Conditions
                              </label>
                              <textarea
                                id="booking-past-history"
                                placeholder="Previous ocular surgeries, laser treatments, systemic diseases (DM, HTN)"
                                rows={2}
                                style={{
                                  width: '100%',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.82rem',
                                }}
                                {...register('past_history')}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="booking-family-history"
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#475569',
                                  display: 'block',
                                  marginBottom: '0.25rem',
                                }}
                              >
                                Family Eye History
                              </label>
                              <textarea
                                id="booking-family-history"
                                placeholder="Family history of Glaucoma, AMD, Keratoconus, Strabismus"
                                rows={2}
                                style={{
                                  width: '100%',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.82rem',
                                }}
                                {...register('family_history')}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 4: Allergies & Drug Sensitivities */}
                    <div style={{ marginBottom: '10px' }}>
                      <div
                        onClick={() => toggleIntakeSection('allergies')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: openIntakeSections.allergies ? '#fef2f2' : '#ffffff',
                          border: '1px solid #fecaca',
                          borderRadius: openIntakeSections.allergies ? '10px 10px 0 0' : '10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#fee2e2',
                              color: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            <i className="ph ph-warning" />
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991b1b' }}>
                            Allergies &amp; Drug Sensitivities
                          </span>
                          {!openIntakeSections.allergies && Boolean(watch('allergies')) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#b91c1c',
                                background: '#fee2e2',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              {watch('allergies')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {openIntakeSections.allergies ? 'Collapse' : 'Expand'}
                          </span>
                          <i className={`ph ph-caret-${openIntakeSections.allergies ? 'up' : 'down'}`} />
                        </div>
                      </div>

                      {openIntakeSections.allergies && (
                        <div
                          style={{
                            border: '1px solid #fecaca',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px',
                            padding: '14px',
                            background: '#fef2f2',
                          }}
                        >
                          <div className="hms-complaint-chips-wrap" style={{ marginBottom: '0.5rem' }}>
                            {commonAllergies.map((tag) => {
                              const isSelected = (watch('allergies') || '').split(',').map((s) => s.trim()).includes(tag);
                              return (
                                <button
                                  className={`hms-complaint-tag ${isSelected ? 'selected' : ''}`}
                                  key={tag}
                                  onClick={() => toggleAllergyTag(tag)}
                                  style={
                                    isSelected
                                      ? { background: '#dc2626', color: '#ffffff', borderColor: '#dc2626', fontWeight: 700 }
                                      : { borderColor: '#fca5a5', color: '#7f1d1d' }
                                  }
                                  type="button"
                                >
                                  <i className={`ph ${isSelected ? 'ph-check' : 'ph-plus-circle'}`} />
                                  {tag}
                                </button>
                              );
                            })}
                          </div>

                          <div>
                            <textarea
                              id="booking-allergies"
                              placeholder="Document all known drug allergies (e.g. Penicillin, Sulfa, Dilating drops, Preservatives) or enter NKDA"
                              rows={2}
                              style={{
                                width: '100%',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.82rem',
                                background: '#ffffff',
                              }}
                              {...register('allergies')}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 5: Special Clinic Instructions */}
                    <div>
                      <div
                        onClick={() => toggleIntakeSection('notes')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: openIntakeSections.notes ? '#f8fafc' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: openIntakeSections.notes ? '10px 10px 0 0' : '10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#f1f5f9',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            5
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                            Special Clinic Instructions &amp; Operational Notes
                          </span>
                          {!openIntakeSections.notes && Boolean(watch('notes')) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#475569',
                                background: '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 500,
                              }}
                            >
                              {watch('notes')?.slice(0, 45)}...
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                            {openIntakeSections.notes ? 'Collapse' : 'Expand'}
                          </span>
                          <i className={`ph ph-caret-${openIntakeSections.notes ? 'up' : 'down'}`} />
                        </div>
                      </div>

                      {openIntakeSections.notes && (
                        <div
                          style={{
                            border: '1px solid #e2e8f0',
                            borderTop: 'none',
                            borderRadius: '0 0 10px 10px',
                            padding: '14px',
                            background: '#ffffff',
                          }}
                        >
                          <textarea
                            id="booking-notes"
                            placeholder="Transport assistance, wheelchair required, pupil dilation consent, interpreter required, or referral remarks"
                            rows={2}
                            style={{
                              width: '100%',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.82rem',
                            }}
                            {...register('notes')}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="appointment-form-actions">
                <button className="doc-btn" onClick={() => setStep(1)} type="button">
                  <i className="ph ph-arrow-left" aria-hidden="true" />
                  Back
                </button>
                <div>
                  <button className="doc-btn" onClick={() => navigate('/appointments')} type="button">
                    Cancel
                  </button>
                  <button className="doc-btn primary" type="submit">
                    <span>Continue to Confirmation</span>
                    <i className="ph ph-arrow-right" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          /* STEP 3: OFFICIAL HOSPITAL BOOKING PASS CONFIRMATION */
          <section className="hms-booking-slip">
            <div className="hms-slip-top-banner">
              <div className="hms-slip-hospital-brand">
                <div className="hms-slip-hospital-logo">
                  <i className="ph ph-hospital" />
                </div>
                <div className="hms-slip-title">
                  <h3>Hospital Management System</h3>
                  <p>Official Consultation Booking Pass & Summary</p>
                </div>
              </div>
              <span className="hms-slip-status-tag">
                <i className="ph ph-check-circle" />
                Ready to Confirm
              </span>
            </div>

            <div className="hms-slip-body">
              {/* Card 1: Patient Profile */}
              <div className="hms-slip-section">
                <div className="hms-slip-section-header">
                  <i className="ph ph-user-circle" />
                  Patient Profile
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Full Name</span>
                  <span className="hms-slip-value">
                    {selectedPatient ? patientFullName(selectedPatient) : '-'}
                  </span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">MRN</span>
                  <span className="hms-slip-value" style={{ fontFamily: 'monospace', color: '#2563eb' }}>
                    {selectedPatient?.patient_number ?? '-'}
                  </span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Demographics</span>
                  <span className="hms-slip-value">
                    {selectedPatient?.gender ?? '-'} • {calculatePatientAge(selectedPatient?.date_of_birth)}
                  </span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Contact</span>
                  <span className="hms-slip-value">{selectedPatient?.phone || 'No phone recorded'}</span>
                </div>
              </div>

              {/* Card 2: Clinician & Department */}
              <div className="hms-slip-section">
                <div className="hms-slip-section-header">
                  <i className="ph ph-stethoscope" />
                  Attending Clinician
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Doctor Name</span>
                  <span className="hms-slip-value">{selectedDoctor?.display_name ?? '-'}</span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Specialization</span>
                  <span className="hms-slip-value">{selectedDoctor?.specialization ?? '-'}</span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Department</span>
                  <span className="hms-slip-value">{selectedDoctorDepartment?.name || 'General Clinic'}</span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Consultation Room</span>
                  <span className="hms-slip-value">{selectedDoctor?.consultation_room || 'Assigned on arrival'}</span>
                </div>
              </div>

              {/* Card 3: Schedule & Slot Details */}
              <div className="hms-slip-section">
                <div className="hms-slip-section-header">
                  <i className="ph ph-calendar-blank" />
                  Schedule & Timing
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Consultation Date</span>
                  <span className="hms-slip-value">{formatAppointmentDate(appointmentDate, timezone)}</span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Time Window</span>
                  <span className="hms-slip-value" style={{ color: '#2563eb' }}>
                    {selectedSlot} {selectedSlotOption ? `- ${selectedSlotOption.endTime}` : ''} ({selectedSlotOption?.durationMinutes || 30} mins)
                  </span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Visit Type</span>
                  <span className="hms-slip-value">{appointmentVisitTypeLabels[visitType]}</span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Triage Priority</span>
                  <span className="hms-slip-value">{appointmentPriorityLabels[priority]}</span>
                </div>
              </div>

              {/* Card 4: Clinical Context */}
              <div className="hms-slip-section">
                <div className="hms-slip-section-header">
                  <i className="ph ph-clipboard-text" />
                  Clinical Context & Ophthalmic Intake
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Chief Complaints</span>
                  <span className="hms-slip-value" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {watch('reason') || 'Routine Consultation'}
                  </span>
                </div>
                {Boolean(watch('history_present_illness')) && (
                  <div className="hms-slip-row">
                    <span className="hms-slip-label">HPI & Presentation</span>
                    <span className="hms-slip-value" style={{ fontSize: '0.84rem' }}>
                      {watch('history_present_illness')}
                    </span>
                  </div>
                )}
                {Boolean(watch('past_history')) && (
                  <div className="hms-slip-row">
                    <span className="hms-slip-label">Past History</span>
                    <span className="hms-slip-value" style={{ fontSize: '0.84rem' }}>
                      {watch('past_history')}
                    </span>
                  </div>
                )}
                {Boolean(watch('family_history')) && (
                  <div className="hms-slip-row">
                    <span className="hms-slip-label">Family Eye History</span>
                    <span className="hms-slip-value" style={{ fontSize: '0.84rem' }}>
                      {watch('family_history')}
                    </span>
                  </div>
                )}
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Recorded Allergies</span>
                  <span className="hms-slip-value">
                    {watch('allergies') ? (
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>
                        <i className="ph ph-warning-circle" style={{ marginRight: '3px' }} />
                        {watch('allergies')}
                      </span>
                    ) : (
                      'None documented'
                    )}
                  </span>
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Special Notes</span>
                  <span className="hms-slip-value">{watch('notes') || 'Standard consultation procedure'}</span>
                </div>
              </div>
            </div>

            <div className="appointment-form-actions" style={{ padding: '1.25rem 1.75rem', background: '#f8fafc' }}>
              <button className="doc-btn" disabled={isSubmitting} onClick={() => setStep(2)} type="button">
                <i className="ph ph-arrow-left" aria-hidden="true" />
                Back to Edit
              </button>
              <div>
                <button className="doc-btn" disabled={isSubmitting} onClick={() => navigate('/appointments')} type="button">
                  Cancel
                </button>
                <button
                  className="doc-btn primary"
                  disabled={isSubmitting}
                  onClick={() => submitBooking(getValues())}
                  style={{ minWidth: '180px', justifyContent: 'center' }}
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <MedicalSpinner size="sm" />
                      <span>Confirming Booking...</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-check" aria-hidden="true" />
                      Confirm & Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}
    </div>
    </>
  );
}
