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
  todayInputValue,
} from './appointment-utils';
import { patientFullName, patientInitials } from './patient-utils';
import { useAppointmentBookingFeature } from '../hooks/appointments/useAppointmentBookingFeature';

type BookingStep = 1 | 2 | 3;

const visitTypeOptions = Object.keys(appointmentVisitTypeLabels) as ApiAppointmentVisitType[];
const priorityOptions: ApiAppointmentPriority[] = ['ROUTINE', 'URGENT', 'EMERGENCY'];

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
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export function AppointmentBookingPage() {
  const { search } = useAppLocation();
  const initialPatientId = new URLSearchParams(search).get('patient') ?? '';
  const referralVisitId = new URLSearchParams(search).get('referral_visit') ?? '';
  const [step, setStep] = useState<BookingStep>(1);
  const [patientSearch, setPatientSearch] = useState('');
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BookingFormData>({
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
    },
  });

  const selectedDoctorId = watch('doctor_id');
  const appointmentDate = watch('appointment_date');
  const selectedSlot = watch('start_time');
  const visitType = watch('visit_type');
  const priority = watch('priority');

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
  } = useAppointmentBookingFeature(initialPatientId, patientSearch, selectedDoctorId, appointmentDate, referralVisitId);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === selectedDoctorId), [doctors, selectedDoctorId]);
  
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

  // Clear slot on date/doctor change
  useEffect(() => {
    setValue('start_time', '', { shouldValidate: step === 2 });
  }, [appointmentDate, selectedDoctorId, setValue, step]);

  const searchPatients = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!patientSearch.trim()) return;
    void searchPatientsRefetch();
  };

  // Removed legacy methods

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
  
  const slotUnavailableReason = slotsData?.unavailable_reason || (
    slotOptions.length === 0 ? 'No working hours scheduled for this doctor on the selected date.' 
    : slotOptions.every(s => isSlotInPast(appointmentDate, s.startTime)) ? 'All time slots for today have passed.'
    : 'All available appointment slots for this date are fully booked.'
  );

  const continueToConfirmation = async () => {
    const isValid = await handleSubmit(() => {})();
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
            <p>Find a patient, choose an available clinician slot, and confirm the booking.</p>
          </div>
        </section>

      <section className="appointment-steps" aria-label="Booking progress">
        {['Search Patient', 'Appointment Details', 'Confirmation'].map((label, index) => {
          const stepNumber = (index + 1) as BookingStep;
          const stateClass = step === stepNumber ? 'active' : step > stepNumber ? 'complete' : '';
          return (
            <div className={`appointment-step ${stateClass}`} key={label}>
              <span>{step > stepNumber ? <i className="ph ph-check" aria-hidden="true" /> : stepNumber}</span>
              {label}
            </div>
          );
        })}
      </section>

      {step === 1 ? (
        <section className="doc-card appointment-booking-card">
          <div className="doc-card-header">
            <div>
              <h3>Search Patient</h3>
              <p>Use MRN, phone, email, or patient name to locate an active patient record.</p>
            </div>
          </div>
          <form className="appointment-patient-search" onSubmit={searchPatients}>
            <div className="doc-field grow doc-search">
              <label htmlFor="booking-patient-search">Patient Search</label>
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                id="booking-patient-search"
                onChange={(event) => setPatientSearch(event.target.value)}
                placeholder="Enter patient MRN, name, phone, or email"
                value={patientSearch}
              />
            </div>
            <button className="doc-btn primary" disabled={patientLoading} type="submit">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              {patientLoading ? 'Searching...' : 'Search Patient'}
            </button>
          </form>

          {patientLoading ? (
            <div className="um-state-cell">Searching patients...</div>
          ) : patientResults.length === 0 ? (
            <div className="appointment-empty-search">
              <i className="ph ph-user-plus" aria-hidden="true" />
              <div className="copy">
                <strong>No patient selected</strong>
                <span>Search for an existing patient, or register a new patient before booking.</span>
              </div>
              <button className="doc-btn primary" onClick={() => navigate('/patients/register?return=/appointments/book')} type="button">
                Register Patient
              </button>
            </div>
          ) : (
            <div className="appointment-card-grid">
              {patientResults.map((patient) => (
                <article className="appointment-patient-card" key={patient.id}>
                  <span className="doc-avatar">{patientInitials(patient)}</span>
                  <div className="copy">
                    <h3>{patientFullName(patient)}</h3>
                    <p>
                      {patient.patient_number} · {patient.gender} · {formatAppointmentDate(patient.date_of_birth)}
                    </p>
                    <div className="appointment-patient-meta">
                      <span>
                        <i className="ph ph-phone" aria-hidden="true" />
                        {patient.phone || 'No phone'}
                      </span>
                      <span>{patient.blood_group || 'Blood group not recorded'}</span>
                    </div>
                  </div>
                  <button className="doc-btn primary" onClick={() => selectPatient(patient)} type="button">
                    Use Patient
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : step === 2 ? (
        <>
          {selectedPatient && (
            <section className="appointment-patient-card selected">
              <span className="doc-avatar">{patientInitials(selectedPatient)}</span>
              <div className="copy">
                <h3>{patientFullName(selectedPatient)}</h3>
                <p>
                  {selectedPatient.patient_number} · {selectedPatient.gender} ·{' '}
                  {formatAppointmentDate(selectedPatient.date_of_birth)}
                </p>
                <div className="appointment-patient-meta">
                  <span>{selectedPatient.phone || 'No phone'}</span>
                  <span>{selectedPatient.email || 'No email'}</span>
                </div>
              </div>
              <button className="doc-btn" onClick={() => setStep(1)} type="button">
                Change Patient
              </button>
            </section>
          )}

          <form className="doc-card appointment-booking-card" onSubmit={(e) => { e.preventDefault(); void continueToConfirmation(); }}>
            <div className="doc-card-header">
              <div>
                <h3>Appointment Information</h3>
                <p>Choose the clinician, date, and available appointment slot.</p>
              </div>
            </div>

            <div className="appointment-form-grid">
              <div className="doc-field">
                <label htmlFor="booking-doctor">
                  Doctor <span className="required-asterisk">*</span>
                </label>
                <select
                  disabled={doctorLoading}
                  id="booking-doctor"
                  {...register('doctor_id')}
                >
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.display_name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
                {errors.doctor_id && <span className="field-error-msg">{errors.doctor_id.message}</span>}
              </div>
              <div className="doc-field">
                <label htmlFor="booking-date">
                  Appointment Date <span className="required-asterisk">*</span>
                </label>
                <input
                  id="booking-date"
                  min={todayInputValue()}
                  type="date"
                  {...register('appointment_date')}
                />
                {errors.appointment_date && <span className="field-error-msg">{errors.appointment_date.message}</span>}
              </div>
              <div className="doc-field">
                <label htmlFor="booking-visit-type">Appointment Type</label>
                <select
                  id="booking-visit-type"
                  {...register('visit_type')}
                >
                  {visitTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {appointmentVisitTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="doc-field">
                <label htmlFor="booking-priority">Priority</label>
                <select
                  id="booking-priority"
                  {...register('priority')}
                >
                  {priorityOptions.map((item) => (
                    <option key={item} value={item}>
                      {appointmentPriorityLabels[item]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`doc-field full${errors.start_time ? ' has-error' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <label style={{ margin: 0 }}>
                    Available Time Slots <span className="required-asterisk">*</span>
                  </label>
                  {errors.start_time && (
                    <span className="field-error-msg" style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {errors.start_time.message}
                    </span>
                  )}
                </div>
                {slotLoading || existingApptsLoading ? (
                  <div className="appointment-slot-state">Loading available slots...</div>
                ) : slotOptions.length === 0 || !slotOptions.some((s) => s.isAvailable) ? (
                  <div className="appointment-no-slots-notice" role="alert">
                    <i className="ph ph-info" aria-hidden="true" />
                    <div>
                      <strong>No Slots Available</strong>
                      <p>{slotUnavailableReason || 'No appointment slots are available for this doctor on the selected date.'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="appointment-slot-grid" style={errors.start_time ? { border: '1px solid #fca5a5', padding: '0.75rem', borderRadius: '10px', backgroundColor: '#fef2f2' } : undefined}>
                    {slotOptions.map((slot) => {
                      const isSelected = selectedSlot === slot.startTime;
                      const isFull = slot.remainingSlots <= 0;
                      const isPast = isSlotInPast(appointmentDate, slot.startTime);
                      const isDisabled = isFull || isPast;
                      return (
                        <button
                          className={`appointment-slot${isSelected ? ' selected' : ''}${isFull ? ' full' : ''}${isPast ? ' past-slot' : ''}`}
                          disabled={isDisabled}
                          key={slot.startTime}
                          onClick={() => {
                            if (!isDisabled) {
                              setValue('start_time', slot.startTime, { shouldValidate: true });
                            }
                          }}
                          style={isPast ? { opacity: 0.45, cursor: 'not-allowed', backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' } : undefined}
                          type="button"
                        >
                          <div className="slot-time-range">
                            <strong style={isPast ? { color: '#64748b', textDecoration: 'line-through' } : undefined}>{slot.startTime}</strong>
                            <span style={isPast ? { color: '#94a3b8' } : undefined}>{slot.endTime}</span>
                          </div>
                          <div
                            className={`slot-capacity-badge ${isPast ? 'past' : isFull ? 'full' : slot.remainingSlots === 1 ? 'warning' : 'available'}`}
                            style={isPast ? { backgroundColor: '#e2e8f0', color: '#64748b', border: '1px solid #cbd5e1' } : undefined}
                          >
                            {isPast ? 'Expired / Past' : isFull ? 'Fully Booked' : `${slot.remainingSlots} ${slot.remainingSlots === 1 ? 'slot' : 'slots'} left`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="doc-field full">
                <label htmlFor="booking-reason">Reason for Visit</label>
                <input
                  id="booking-reason"
                  placeholder="Brief reason for appointment"
                  {...register('reason')}
                />
              </div>
              <div className="doc-field full">
                <label htmlFor="booking-notes">Additional Notes</label>
                <textarea
                  id="booking-notes"
                  placeholder="Optional booking instructions"
                  rows={3}
                  {...register('notes')}
                />
              </div>
            </div>

            <div className="appointment-form-actions">
              <button className="doc-btn" onClick={() => setStep(1)} type="button">
                Back
              </button>
              <div>
                <button className="doc-btn" onClick={() => navigate('/appointments')} type="button">
                  Cancel
                </button>
                <button className="doc-btn primary" type="submit">
                  Continue to Confirmation
                  <i className="ph ph-arrow-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </>
      ) : (
        <section className="doc-card appointment-confirmation">
          <div className="appointment-confirmation-icon">
            <i className="ph ph-calendar-check" aria-hidden="true" />
          </div>
          <h3>Confirm Appointment</h3>
          <p>Review the booking details before saving the appointment record.</p>
          <div className="appointment-summary-grid">
            <div>
              <span>Patient</span>
              <strong>{selectedPatient ? patientFullName(selectedPatient) : '-'}</strong>
            </div>
            <div>
              <span>MRN</span>
              <strong>{selectedPatient?.patient_number ?? '-'}</strong>
            </div>
            <div>
              <span>Doctor</span>
              <strong>{selectedDoctor?.display_name ?? '-'}</strong>
            </div>
            <div>
              <span>Specialization</span>
              <strong>{selectedDoctor?.specialization ?? '-'}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{formatAppointmentDate(appointmentDate)}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>
                {selectedSlot}
                {selectedSlotOption ? ` - ${selectedSlotOption.endTime}` : ''}
              </strong>
            </div>
            <div>
              <span>Visit Type</span>
              <strong>{appointmentVisitTypeLabels[visitType]}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{appointmentPriorityLabels[priority]}</strong>
            </div>
          </div>
          <div className="appointment-form-actions">
            <button className="doc-btn" disabled={isSubmitting} onClick={() => setStep(2)} type="button">
              Back
            </button>
            <div>
              <button className="doc-btn" disabled={isSubmitting} onClick={() => navigate('/appointments')} type="button">
                Cancel
              </button>
              <button className="doc-btn primary" disabled={isSubmitting} onClick={() => handleSubmit(submitBooking)()} type="button">
                <i className="ph ph-check" aria-hidden="true" />
                {isSubmitting ? 'Saving...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
    </>
  );
}
