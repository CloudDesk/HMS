import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import {
  patientPortalApi,
  type PatientPortalContext,
  type PublicBranch,
  type PublicDepartment,
} from '../../api/patient-portal';
import { portalQueryKeys } from '../../api/query-keys';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient.'),
  branch_id: z.string().min(1, 'Select a branch.'),
  department_id: z.string().min(1, 'Select a department.'),
  doctor_id: z.string().min(1, 'Select a doctor.'),
  appointment_date: z.string().min(1, 'Select an appointment date.'),
  start_time: z.string().min(1, 'Select an available time.'),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
  reason: z.string().min(3, 'Provide a reason for the visit (minimum 3 characters).'),
});
type BookingValues = z.infer<typeof schema>;

const minutesBetween = (start: string, end: string) => {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

const localDateValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function PortalAppointmentBooking({
  context,
  initialPatientId,
  initialBranchId,
  initialDepartmentId,
  initialDoctorId,
  onBooked,
  onCancel,
}: {
  context: PatientPortalContext;
  initialPatientId?: string;
  initialBranchId?: string;
  initialDepartmentId?: string;
  initialDoctorId?: string;
  onBooked: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const today = localDateValue(new Date());
  const defaultPatient =
    (initialPatientId ? context.patients.find((p) => p.id === initialPatientId) : undefined) ??
    context.patients.find((p) => p.is_primary) ??
    context.patients[0];
  const form = useForm<BookingValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: defaultPatient?.id ?? '',
      branch_id: initialBranchId || defaultPatient?.preferred_branch?.id || '',
      department_id: initialDepartmentId || '',
      doctor_id: initialDoctorId || '',
      appointment_date: today,
      start_time: '',
      visit_type: 'NEW_CONSULTATION',
      reason: '',
    },
  });
  const selectedPatientId = form.watch('patient_id');
  const branchId = form.watch('branch_id');
  const departmentId = form.watch('department_id');
  const doctorId = form.watch('doctor_id');
  const appointmentDate = form.watch('appointment_date');
  const selectedTime = form.watch('start_time');

  const previousPatientId = useRef(selectedPatientId);

  useEffect(() => {
    if (initialPatientId && form.getValues('patient_id') !== initialPatientId) {
      form.setValue('patient_id', initialPatientId, { shouldValidate: true });
      const targetPatient = context.patients.find((p) => p.id === initialPatientId);
      if (targetPatient?.preferred_branch?.id && !initialBranchId) {
        form.setValue('branch_id', targetPatient.preferred_branch.id, { shouldValidate: true });
      }
    }
  }, [initialPatientId, initialBranchId, context.patients, form]);

  // Auto-populate branch when patient selection changes
  useEffect(() => {
    if (previousPatientId.current !== selectedPatientId) {
      previousPatientId.current = selectedPatientId;
      const selectedPatient = context.patients.find((p) => p.id === selectedPatientId);
      if (selectedPatient?.preferred_branch?.id) {
        form.setValue('branch_id', selectedPatient.preferred_branch.id, {
          shouldValidate: true,
        });
        form.setValue('department_id', '');
        form.setValue('doctor_id', '');
        form.setValue('start_time', '');
      }
    }
  }, [selectedPatientId, context.patients, form]);

  const branches = useQuery({
    queryKey: portalQueryKeys.branches({ limit: 24 }),
    queryFn: () => patientPortalApi.publicBranches({ limit: 24 }),
  });
  const departments = useQuery({
    queryKey: portalQueryKeys.departments({
      limit: 24,
      branchId: branchId || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDepartments({
        limit: 24,
        branchId: branchId || undefined,
      }),
  });
  const doctors = useQuery({
    queryKey: portalQueryKeys.doctors({
      limit: 24,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDoctors({
        limit: 24,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
      }),
  });
  const slots = useQuery({
    queryKey: portalQueryKeys.doctorSlots(doctorId, appointmentDate),
    queryFn: () => patientPortalApi.publicDoctorSlots(doctorId, appointmentDate),
    enabled: Boolean(doctorId && appointmentDate),
  });

  const apiBranches = branches.data?.data ?? [];
  const contextBranches: PublicBranch[] = context.patients
    .map((p) => p.preferred_branch)
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({
      id: b.id,
      code: 'BRANCH',
      name: b.name,
      short_name: b.name,
      email: null,
      phone: null,
      address: null,
      city: b.city ?? null,
      state: null,
      country: null,
      postal_code: null,
    }));

  const branchMap = new Map<string, PublicBranch>();
  [...contextBranches, ...apiBranches].forEach((b) => {
    if (b.id && !branchMap.has(b.id)) branchMap.set(b.id, b);
  });
  const branchList = Array.from(branchMap.values());

  const NON_CLINICAL_TERMS = [
    'administration',
    'admin',
    'billing',
    'finance',
    'reception',
    'nursing',
    'pharmacy',
    'imaging',
    'laboratory',
    'lab',
  ];
  const allDepartments = (departments.data?.data ?? []).filter((dept) => {
    const name = dept.name?.toLowerCase() ?? '';
    const code = dept.code?.toLowerCase() ?? '';
    return !NON_CLINICAL_TERMS.some((term) => name.includes(term) || code.includes(term));
  });
  const filteredDepts = branchId
    ? allDepartments.filter((d) => d.branch?.id === branchId)
    : [];
  const scopedDepts = filteredDepts.length > 0 ? filteredDepts : allDepartments;
  const deptMap = new Map<string, PublicDepartment>();
  scopedDepts.forEach((dept) => {
    if (dept.name && !deptMap.has(dept.name)) {
      deptMap.set(dept.name, dept);
    }
  });
  const departmentList = Array.from(deptMap.values());

  const allDoctors = doctors.data?.data ?? [];
  const doctorList = departmentId
    ? allDoctors.filter((doc) => doc.department?.id === departmentId)
    : allDoctors;

  useEffect(() => form.setValue('start_time', ''), [doctorId, appointmentDate, form]);

  const resetSchedule = () => {
    form.setValue('appointment_date', today);
    form.setValue('start_time', '');
  };

  const mutation = useMutation({
    mutationFn: async (values: BookingValues) => {
      const slot = slots.data?.slots.find((item) => item.start_time === values.start_time);
      if (!slot) throw new Error('Select an available appointment time.');
      if (slot.available === false || slot.is_available === false) {
        throw new Error('This time slot is no longer available. Select an open slot.');
      }
      return patientPortalApi.bookAppointment({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: values.appointment_date,
        start_time: values.start_time,
        visit_type: values.visit_type,
        reason: values.reason,
        duration_minutes: minutesBetween(slot.start_time, slot.end_time),
      });
    },
    onSuccess: async (appointment) => {
      toast.success(`Appointment ${appointment.appointment_number} booked successfully.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-portal-appointments'] }),
      ]);
      onBooked();
    },
  });

  const mutationMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error instanceof Error
        ? mutation.error.message
        : null;

  return (
    <form
      className="portal-booking-form"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <section>
        <div className="portal-form-section-title">
          <span>1</span>
          <div>
            <strong>Patient and hospital location</strong>
            <small>Choose who the visit is for and where care is needed.</small>
          </div>
        </div>
        <div className="portal-form-grid">
          <label>
            <span>
              Patient <b>*</b>
            </span>
            <select {...form.register('patient_id')}>
              {context.patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name} · {patient.patient_number}
                </option>
              ))}
            </select>
            {form.formState.errors.patient_id ? (
              <small>{form.formState.errors.patient_id.message}</small>
            ) : null}
          </label>
          <label>
            <span>
              Branch <b>*</b>
            </span>
            <select
              {...form.register('branch_id', {
                onChange: () => {
                  form.setValue('department_id', '');
                  form.setValue('doctor_id', '');
                  resetSchedule();
                },
              })}
              disabled={branches.isLoading || branches.isError}
            >
              <option value="">
                {branches.isLoading
                  ? 'Loading branches…'
                  : branches.isError
                    ? 'Failed to load branches'
                    : 'Select a branch'}
              </option>
              {branchList.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.city ? ` · ${branch.city}` : ''}
                </option>
              ))}
            </select>
            {branches.isError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.25rem',
                }}
              >
                <small className="portal-field-error">Could not load branches.</small>
                <button
                  onClick={() => void branches.refetch()}
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--portal-border, #cbd5e1)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  <i className="ph ph-arrows-clockwise" /> Retry
                </button>
              </div>
            ) : form.formState.errors.branch_id ? (
              <small>{form.formState.errors.branch_id.message}</small>
            ) : null}
          </label>
          <label>
            <span>
              Department <b>*</b>
            </span>
            <select
              {...form.register('department_id', {
                onChange: () => {
                  form.setValue('doctor_id', '');
                  resetSchedule();
                },
              })}
              disabled={departments.isLoading || departments.isError}
            >
              <option value="">
                {departments.isLoading
                  ? 'Loading departments…'
                  : departments.isError
                    ? 'Failed to load departments'
                    : 'Select a department'}
              </option>
              {departmentList.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {departments.isError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.25rem',
                }}
              >
                <small className="portal-field-error">Could not load departments.</small>
                <button
                  onClick={() => void departments.refetch()}
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--portal-border, #cbd5e1)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  <i className="ph ph-arrows-clockwise" /> Retry
                </button>
              </div>
            ) : form.formState.errors.department_id ? (
              <small>{form.formState.errors.department_id.message}</small>
            ) : null}
          </label>
          <label>
            <span>
              Doctor <b>*</b>
            </span>
            <select
              {...form.register('doctor_id', { onChange: resetSchedule })}
              disabled={doctors.isLoading || doctors.isError}
            >
              <option value="">
                {!departmentId
                  ? 'Select a department first'
                  : doctors.isLoading
                    ? 'Loading doctors…'
                    : doctors.isError
                      ? 'Failed to load doctors'
                      : doctorList.length === 0
                        ? 'No doctors available in this department'
                        : 'Select a doctor'}
              </option>
              {doctorList.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name} · {doctor.specialization}
                </option>
              ))}
            </select>
            {doctors.isError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.25rem',
                }}
              >
                <small className="portal-field-error">Could not load doctors.</small>
                <button
                  onClick={() => void doctors.refetch()}
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--portal-border, #cbd5e1)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  <i className="ph ph-arrows-clockwise" /> Retry
                </button>
              </div>
            ) : form.formState.errors.doctor_id ? (
              <small>{form.formState.errors.doctor_id.message}</small>
            ) : null}
          </label>
        </div>
      </section>

      <section>
        <div className="portal-form-section-title">
          <span>2</span>
          <div>
            <strong>Date and available time</strong>
            <small>Select a date to load the doctor’s live appointment slots.</small>
          </div>
        </div>
        <div className="portal-form-grid portal-date-options">
          <label>
            <span>
              Appointment date <b>*</b>
            </span>
            <input
              min={today}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  /* ignore browsers without showPicker support */
                }
              }}
              style={{ cursor: 'pointer' }}
              type="date"
              {...form.register('appointment_date')}
            />
            {form.formState.errors.appointment_date ? (
              <small>{form.formState.errors.appointment_date.message}</small>
            ) : null}
          </label>
          <label>
            <span>
              Visit type <b>*</b>
            </span>
            <select {...form.register('visit_type')}>
              <option value="NEW_CONSULTATION">New consultation</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="PROCEDURE">Procedure</option>
            </select>
          </label>
        </div>
        <div className="portal-slot-area">
          {!doctorId || !appointmentDate ? (
            <p>
              <i className="ph ph-info" /> Select a doctor and date to view available times.
            </p>
          ) : slots.isLoading ? (
            <p>
              <i className="ph ph-spinner-gap" /> Checking live availability…
            </p>
          ) : slots.isError ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#b91c1c',
              }}
            >
              <i className="ph ph-warning-circle" />
              <span>Availability could not be loaded.</span>
              <button
                onClick={() => void slots.refetch()}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  background: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#991b1b',
                }}
                type="button"
              >
                <i className="ph ph-arrows-clockwise" /> Try again
              </button>
            </div>
          ) : slots.data?.slots.length ? (
            <div className="portal-slot-grid">
              {slots.data.slots.map((slot) => {
                const isAvailable =
                  slot.available !== false && slot.is_available !== false;
                const isSelected = selectedTime === slot.start_time;
                return (
                  <button
                    className={`portal-slot-btn ${isAvailable ? 'available' : 'unavailable'} ${
                      isSelected ? 'selected' : ''
                    }`}
                    disabled={!isAvailable}
                    key={slot.start_time}
                    onClick={() => {
                      if (isAvailable) {
                        form.setValue('start_time', slot.start_time, {
                          shouldValidate: true,
                        });
                      }
                    }}
                    type="button"
                  >
                    <div className="portal-slot-time">
                      <strong>{slot.start_time}</strong>
                      <small>to {slot.end_time}</small>
                    </div>
                    <span
                      className={`portal-slot-status-badge ${
                        isAvailable ? 'badge-available' : 'badge-unavailable'
                      }`}
                    >
                      {isAvailable ? 'Available' : slot.reason || 'Booked'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p>
              <i className="ph ph-calendar-x" />{' '}
              {slots.data?.unavailable_reason || 'No open times remain on this date.'}
            </p>
          )}
          {form.formState.errors.start_time ? (
            <small className="portal-field-error">
              {form.formState.errors.start_time.message}
            </small>
          ) : null}
        </div>
      </section>

      <section>
        <div className="portal-form-section-title">
          <span>3</span>
          <div>
            <strong>Reason for visit</strong>
            <small>This helps the care team prepare for your appointment.</small>
          </div>
        </div>
        <div className="portal-form-grid">
          <label className="wide">
            <span>
              Reason <b>*</b>
            </span>
            <textarea
              placeholder="Briefly describe the concern or service you need"
              rows={4}
              {...form.register('reason')}
            />
            {form.formState.errors.reason ? (
              <small>{form.formState.errors.reason.message}</small>
            ) : null}
          </label>
        </div>
      </section>

      {mutationMessage ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {mutationMessage}
        </div>
      ) : null}

      <footer className="portal-form-actions">
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary"
          disabled={mutation.isPending}
          type="submit"
        >
          <i className="ph ph-calendar-check" />{' '}
          {mutation.isPending ? 'Booking…' : 'Confirm appointment'}
        </button>
      </footer>
    </form>
  );
}
