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
import { useDepartmentsList } from '../hooks/departments/useDepartments';
import { useTimezone } from '../api/useSettings';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';

type BookingStep = 1 | 2 | 3;

const visitTypeOptions = Object.keys(appointmentVisitTypeLabels) as ApiAppointmentVisitType[];
const priorityOptions: ApiAppointmentPriority[] = ['ROUTINE', 'URGENT', 'EMERGENCY'];

const commonComplaints = [
  'Routine Health Checkup',
  'Follow-up Consultation',
  'Toothache / Dental Pain',
  'Fever & Flu Symptoms',
  'Prescription Refill',
  'Specialist Consultation',
  'Lab Report Review',
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
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
  reason: z.string().trim().optional(),
  notes: z.string().optional(),
  history_present_illness: z.string().optional(),
  past_history: z.string().optional(),
  family_history: z.string().optional(),
  allergies: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export function AppointmentBookingPage() {
  const { search } = useAppLocation();
  const initialPatientId = new URLSearchParams(search).get('patient') ?? '';
  const referralVisitId = new URLSearchParams(search).get('referral_visit') ?? '';
  const emergencyReferralId = new URLSearchParams(search).get('emergency_referral') ?? '';
  const emergencyBranchId = new URLSearchParams(search).get('branch_id') ?? '';
  const [step, setStep] = useState<BookingStep>(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [showClinicalDetails, setShowClinicalDetails] = useState(false);
  const timezone = useTimezone();

  const {
    register,
    watch,
    setValue,
    clearErrors,
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
    },
  });

  const selectedDoctorId = watch('doctor_id');
  const appointmentDate = watch('appointment_date');
  const selectedSlot = watch('start_time');
  const visitType = watch('visit_type');
  const priority = watch('priority');
  const currentReason = watch('reason') || '';

  const {
    state: {
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
  );

  const { data: deptData } = useDepartmentsList({ status: 'ACTIVE', limit: 100 });
  const departments = deptData?.data || [];

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
        durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
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
      if (docsInDept.length > 0 && (!selectedDoctorId || !docsInDept.some((d) => d.id === selectedDoctorId))) {
        setValue('doctor_id', docsInDept[0]!.id, { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const continueToConfirmation = async () => {
    const isValid = await trigger();
    if (isValid && selectedSlot) {
      setStep(3);
    }
  };

  const submitBooking = async (data: BookingFormData) => {
    try {
      await handleCreateAppointment({
        ...data,
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
    } catch {
      // toast is handled by mutation
    }
  };

  return (
    <>
      <div className="appointment-page appointment-booking-page">
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
                <button
                  className="doc-btn primary"
                  onClick={() => navigate('/patients/register?return=/appointments/book')}
                  type="button"
                >
                  <i className="ph ph-user-plus" aria-hidden="true" />
                  Register New Patient
                </button>
              </div>
            ) : (
              <div className="hms-empty-state-card">
                <div className="hms-empty-state-icon">
                  <i className="ph ph-user-focus" aria-hidden="true" />
                </div>
                <h4>Search or Register a Patient</h4>
                <p>
                  Enter patient identifier above to access medical records, view booking eligibility, and reserve an appointment.
                </p>
                <button
                  className="doc-btn primary"
                  onClick={() => navigate('/patients/register?return=/appointments/book')}
                  type="button"
                >
                  <i className="ph ph-user-plus" aria-hidden="true" />
                  Register New Patient
                </button>
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

                {/* Chief Complaint & Quick Tags */}
                <div className="doc-field full">
                  <label htmlFor="booking-reason">
                    Chief Complaint / Consultation Reason <span className="doc-field-hint">(Select tag or write notes)</span>
                  </label>
                  <div className="hms-complaint-chips-wrap">
                    {commonComplaints.map((tag) => (
                      <button
                        className="hms-complaint-tag"
                        key={tag}
                        onClick={() => {
                          const updated = currentReason ? `${currentReason}, ${tag}` : tag;
                          setValue('reason', updated, { shouldDirty: true, shouldValidate: true });
                        }}
                        type="button"
                      >
                        <i className="ph ph-plus-circle" />
                        {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="booking-reason"
                    placeholder="Enter main clinical symptoms, concerns, or reason for this consultation"
                    rows={2}
                    {...register('reason')}
                  />
                  {errors.reason ? <small className="field-error">{errors.reason.message}</small> : null}
                </div>

                {/* Collapsible Clinical Details Accordion */}
                <div className="doc-field full">
                  <button
                    className="hms-clinical-accordion-toggle"
                    onClick={() => setShowClinicalDetails(!showClinicalDetails)}
                    type="button"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="ph ph-file-text" style={{ color: '#2563eb' }} />
                      Additional Clinical Intake & Allergies (Optional)
                    </span>
                    <i className={`ph ph-caret-${showClinicalDetails ? 'up' : 'down'}`} />
                  </button>

                  {showClinicalDetails && (
                    <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', background: '#fafbfc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div className="doc-field full">
                        <label htmlFor="booking-hpi">History of Present Illness (HPI)</label>
                        <textarea
                          id="booking-hpi"
                          placeholder="Onset, duration, severity, and related symptom timeline"
                          rows={2}
                          {...register('history_present_illness')}
                        />
                      </div>
                      <div className="doc-field">
                        <label htmlFor="booking-past-history">Past Medical History</label>
                        <textarea
                          id="booking-past-history"
                          placeholder="Previous conditions, surgeries, chronic diseases"
                          rows={2}
                          {...register('past_history')}
                        />
                      </div>
                      <div className="doc-field">
                        <label htmlFor="booking-family-history">Family History</label>
                        <textarea
                          id="booking-family-history"
                          placeholder="Relevant hereditary conditions or family medical background"
                          rows={2}
                          {...register('family_history')}
                        />
                      </div>
                      <div className="doc-field full">
                        <label htmlFor="booking-allergies" style={{ color: '#b91c1c' }}>
                          <i className="ph ph-warning-circle" style={{ marginRight: '4px' }} />
                          Allergies & Drug Sensitivities
                        </label>
                        <textarea
                          id="booking-allergies"
                          placeholder="e.g. Penicillin, NSAIDs, Latex, Anesthesia, Food allergies"
                          rows={2}
                          style={{ borderColor: '#fca5a5' }}
                          {...register('allergies')}
                        />
                      </div>
                      <div className="doc-field full">
                        <label htmlFor="booking-notes">Special Clinic Instructions / Notes</label>
                        <textarea
                          id="booking-notes"
                          placeholder="Optional operational instructions, room preparation, or referral details"
                          rows={2}
                          {...register('notes')}
                        />
                      </div>
                    </div>
                  )}
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
                  Clinical Context
                </div>
                <div className="hms-slip-row">
                  <span className="hms-slip-label">Chief Complaint</span>
                  <span className="hms-slip-value" style={{ fontWeight: 600 }}>
                    {watch('reason') || 'Routine Consultation'}
                  </span>
                </div>
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
