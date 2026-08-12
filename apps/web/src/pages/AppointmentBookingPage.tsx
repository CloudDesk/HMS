import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { appointmentsApi, type ApiAppointmentPriority, type ApiAppointmentVisitType } from '../api/appointments';
import { doctorsApi, type ApiDoctorAvailabilityDay, type DoctorResponse } from '../api/doctors';
import { patientsApi, type PatientResponse } from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentPriorityLabels,
  appointmentVisitTypeLabels,
  formatAppointmentDate,
  getAppointmentErrorMessage,
  todayInputValue,
} from './appointment-utils';
import { getPatientErrorMessage, patientFullName, patientInitials } from './patient-utils';

type BookingStep = 1 | 2 | 3;

type SlotOption = {
  startTime: string;
  endTime: string;
  disabled: boolean;
};

const dayNames: ApiDoctorAvailabilityDay[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const visitTypeOptions = Object.keys(appointmentVisitTypeLabels) as ApiAppointmentVisitType[];
const priorityOptions = Object.keys(appointmentPriorityLabels) as ApiAppointmentPriority[];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const dateDayName = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return dayNames[date.getDay()];
};

const buildSlots = (doctor: DoctorResponse | null, dateValue: string, bookedTimes: Set<string>): SlotOption[] => {
  if (!doctor || !dateValue) return [];
  const availability = doctor.availability?.find((item) => item.day_of_week === dateDayName(dateValue));

  if (
    !availability ||
    !availability.is_available ||
    !timePattern.test(availability.start_time) ||
    !timePattern.test(availability.end_time) ||
    availability.slot_duration_minutes <= 0
  ) {
    return [];
  }

  const slots: SlotOption[] = [];
  const duration = availability.slot_duration_minutes;
  const breakStart = availability.break_start_time ? toMinutes(availability.break_start_time) : null;
  const breakEnd = availability.break_end_time ? toMinutes(availability.break_end_time) : null;

  for (let current = toMinutes(availability.start_time); current + duration <= toMinutes(availability.end_time); current += duration) {
    const startTime = toTime(current);
    const endTime = toTime(current + duration);
    const overlapsBreak = breakStart !== null && breakEnd !== null && current < breakEnd && current + duration > breakStart;
    slots.push({
      startTime,
      endTime,
      disabled: overlapsBreak || bookedTimes.has(startTime),
    });
  }

  return slots;
};

export function AppointmentBookingPage() {
  const { search } = useAppLocation();
  const initialPatientId = new URLSearchParams(search).get('patient') ?? '';
  const [step, setStep] = useState<BookingStep>(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResponse[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResponse | null>(null);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(todayInputValue());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [visitType, setVisitType] = useState<ApiAppointmentVisitType>('NEW_CONSULTATION');
  const [priority, setPriority] = useState<ApiAppointmentPriority>('ROUTINE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [patientLoading, setPatientLoading] = useState(false);
  const doctorLoading = loadingInitial;
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const slotOptions = useMemo(
    () => buildSlots(selectedDoctor, appointmentDate, bookedTimes),
    [appointmentDate, bookedTimes, selectedDoctor],
  );

  const selectedSlotOption = slotOptions.find((slot) => slot.startTime === selectedSlot);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadInitialData = useCallback(async () => {
    setLoadingInitial(true);
    setError('');

    try {
      const [doctorResponse, patientResponse] = await Promise.all([
        doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
        initialPatientId ? patientsApi.getById(initialPatientId) : Promise.resolve(null),
      ]);
      setDoctors(doctorResponse.data);
      setSelectedDoctorId(doctorResponse.data[0]?.id ?? '');

      if (patientResponse) {
        setSelectedPatient(patientResponse);
        setStep(2);
      }
    } catch (loadError) {
      setError(getAppointmentErrorMessage(loadError));
    } finally {
      setLoadingInitial(false);
    }
  }, [initialPatientId]);

  const searchPatients = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!patientSearch.trim()) {
      setError('Enter MRN, patient name, phone, or email to search.');
      return;
    }

    setPatientLoading(true);
    setError('');

    try {
      const response = await patientsApi.list({
        search: patientSearch.trim(),
        status: 'ACTIVE',
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      setPatientResults(response.data);
    } catch (searchError) {
      setPatientResults([]);
      setError(getPatientErrorMessage(searchError));
    } finally {
      setPatientLoading(false);
    }
  };

  const loadBookedSlots = useCallback(async () => {
    if (!selectedDoctorId || !appointmentDate) {
      setBookedTimes(new Set());
      return;
    }

    setSlotLoading(true);

    try {
      const response = await appointmentsApi.list({
        doctor_id: selectedDoctorId,
        date_from: appointmentDate,
        date_to: appointmentDate,
        limit: 100,
        sortBy: 'start_time',
        sortOrder: 'asc',
      });
      setBookedTimes(
        new Set(
          response.data
            .filter((appointment) => !['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(appointment.status))
            .map((appointment) => appointment.start_time),
        ),
      );
    } catch (slotError) {
      setBookedTimes(new Set());
      showToast(getAppointmentErrorMessage(slotError));
    } finally {
      setSlotLoading(false);
    }
  }, [appointmentDate, selectedDoctorId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadBookedSlots();
  }, [loadBookedSlots]);

  useEffect(() => {
    setSelectedSlot('');
  }, [appointmentDate, selectedDoctorId]);

  const selectPatient = (patient: PatientResponse) => {
    setSelectedPatient(patient);
    setStep(2);
    setError('');
  };

  const continueToConfirmation = (event: FormEvent) => {
    event.preventDefault();

    if (!selectedPatient) {
      setError('Select a patient before booking.');
      setStep(1);
      return;
    }

    if (!selectedDoctor || !selectedSlot) {
      setError('Select a doctor, date, and available time slot.');
      return;
    }

    setError('');
    setStep(3);
  };

  const submitBooking = async () => {
    if (!selectedPatient || !selectedDoctor || !selectedSlot) {
      setError('Complete patient, doctor, and slot selection before saving.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const appointment = await appointmentsApi.create({
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor.id,
        appointment_date: appointmentDate,
        start_time: selectedSlot,
        duration_minutes: selectedDoctor.availability?.find((item) => item.day_of_week === dateDayName(appointmentDate))
          ?.slot_duration_minutes ?? 30,
        visit_type: visitType,
        priority,
        reason: nullable(reason),
        notes: nullable(notes),
      });

      showToast(`Appointment ${appointment.appointment_number} booked successfully.`);
      navigate('/appointments');
    } catch (submitError) {
      setError(getAppointmentErrorMessage(submitError));
    } finally {
      setSubmitting(false);
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
          <button className="doc-btn" onClick={() => navigate('/appointments')} type="button">
            <i className="ph ph-arrow-left" aria-hidden="true" />
            Appointment Dashboard
          </button>
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

        {error && (
          <div className="form-error-banner" role="alert">
            <i className="ph ph-warning-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {loadingInitial ? (
          <section className="doc-card">
            <div className="um-state-cell">Loading appointment booking workspace...</div>
          </section>
        ) : step === 1 ? (
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

            <form className="doc-card appointment-booking-card" onSubmit={continueToConfirmation}>
              <div className="doc-card-header">
                <div>
                  <h3>Appointment Information</h3>
                  <p>Choose the clinician, date, and available appointment slot.</p>
                </div>
              </div>

              <div className="appointment-form-grid">
                <div className="doc-field">
                  <label htmlFor="booking-doctor">Doctor</label>
                  <select
                    disabled={doctorLoading}
                    id="booking-doctor"
                    onChange={(event) => setSelectedDoctorId(event.target.value)}
                    required
                    value={selectedDoctorId}
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.display_name} - {doctor.specialization}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="doc-field">
                  <label htmlFor="booking-date">Appointment Date</label>
                  <input
                    id="booking-date"
                    min={todayInputValue()}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                    required
                    type="date"
                    value={appointmentDate}
                  />
                </div>
                <div className="doc-field">
                  <label htmlFor="booking-visit-type">Appointment Type</label>
                  <select
                    id="booking-visit-type"
                    onChange={(event) => setVisitType(event.target.value as ApiAppointmentVisitType)}
                    value={visitType}
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
                    onChange={(event) => setPriority(event.target.value as ApiAppointmentPriority)}
                    value={priority}
                  >
                    {priorityOptions.map((item) => (
                      <option key={item} value={item}>
                        {appointmentPriorityLabels[item]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="doc-field full">
                  <label>Available Time Slots</label>
                  {slotLoading ? (
                    <div className="appointment-slot-state">Loading available slots...</div>
                  ) : slotOptions.length === 0 ? (
                    <div className="appointment-slot-state">No available slots for this doctor on the selected date.</div>
                  ) : (
                    <div className="appointment-slot-grid">
                      {slotOptions.map((slot) => (
                        <button
                          className={`appointment-slot${selectedSlot === slot.startTime ? ' selected' : ''}`}
                          disabled={slot.disabled}
                          key={slot.startTime}
                          onClick={() => setSelectedSlot(slot.startTime)}
                          type="button"
                        >
                          <strong>{slot.startTime}</strong>
                          <span>{slot.disabled ? 'Unavailable' : `${slot.endTime}`}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="doc-field full">
                  <label htmlFor="booking-reason">Reason for Visit</label>
                  <input
                    id="booking-reason"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Brief reason for appointment"
                    value={reason}
                  />
                </div>
                <div className="doc-field full">
                  <label htmlFor="booking-notes">Additional Notes</label>
                  <textarea
                    id="booking-notes"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional booking instructions"
                    rows={3}
                    value={notes}
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
              <button className="doc-btn" disabled={submitting} onClick={() => setStep(2)} type="button">
                Back
              </button>
              <div>
                <button className="doc-btn" disabled={submitting} onClick={() => navigate('/appointments')} type="button">
                  Cancel
                </button>
                <button className="doc-btn primary" disabled={submitting} onClick={submitBooking} type="button">
                  <i className="ph ph-check" aria-hidden="true" />
                  {submitting ? 'Saving...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
