import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import { patientPortalApi, type PortalAppointment } from '../../api/patient-portal';

const schema = z.object({
  branch_id: z.string().min(1, 'Select a branch.'),
  department_id: z.string().min(1, 'Select a department.'),
  doctor_id: z.string().min(1, 'Select a doctor.'),
  appointment_date: z.string().min(1, 'Select a date.'),
  start_time: z.string().min(1, 'Select an available time.'),
});
type Values = z.infer<typeof schema>;

const minutesBetween = (start: string, end: string) => {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
};

const localDateValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function PortalAppointmentRescheduling({ appointment, onSaved, onCancel }: {
  appointment: PortalAppointment;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      branch_id: appointment.branch?.id ?? '',
      department_id: appointment.department_id,
      doctor_id: appointment.doctor_id,
      appointment_date: '',
      start_time: '',
    },
  });
  const branchId = form.watch('branch_id');
  const departmentId = form.watch('department_id');
  const doctorId = form.watch('doctor_id');
  const appointmentDate = form.watch('appointment_date');
  const selectedTime = form.watch('start_time');
  const eligibility = useQuery({
    queryKey: ['patient-portal-reschedule-eligibility', appointment.id],
    queryFn: () => patientPortalApi.rescheduleEligibility(appointment.id),
  });
  const branches = useQuery({ queryKey: ['public-branches'], queryFn: () => patientPortalApi.publicBranches({ limit: 24 }) });
  const departments = useQuery({
    queryKey: ['public-departments-reschedule', branchId],
    queryFn: () => patientPortalApi.publicDepartments({ limit: 24, branchId }),
    enabled: Boolean(branchId),
  });
  const doctors = useQuery({
    queryKey: ['public-doctors-reschedule', branchId, departmentId],
    queryFn: () => patientPortalApi.publicDoctors({ limit: 24, branchId, departmentId }),
    enabled: Boolean(branchId && departmentId),
  });
  const slots = useQuery({
    queryKey: ['public-doctor-slots', doctorId, appointmentDate],
    queryFn: () => patientPortalApi.publicDoctorSlots(doctorId, appointmentDate),
    enabled: Boolean(doctorId && appointmentDate && eligibility.data?.eligible),
  });
  useEffect(() => form.setValue('start_time', ''), [appointmentDate, doctorId, form]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const slot = slots.data?.slots.find((item) => item.start_time === values.start_time);
      if (!slot) throw new Error('Select an available appointment time.');
      return patientPortalApi.rescheduleAppointment(appointment.id, {
        doctor_id: values.doctor_id,
        appointment_date: values.appointment_date,
        start_time: values.start_time,
        duration_minutes: minutesBetween(slot.start_time, slot.end_time),
      });
    },
    onSuccess: async (replacement) => {
      toast.success(`Appointment rescheduled to ${replacement.appointment_number}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient-portal-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] }),
      ]);
      onSaved();
    },
  });

  if (eligibility.isLoading) return <div className="portal-empty"><div className="portal-spinner" /><strong>Checking reschedule eligibility…</strong></div>;
  if (eligibility.isError || !eligibility.data) return <div className="portal-empty"><i className="ph ph-warning-circle" /><strong>Eligibility could not be checked</strong><button onClick={() => void eligibility.refetch()} type="button">Try again</button></div>;
  if (!eligibility.data.eligible) return <div className="portal-empty"><i className="ph ph-calendar-x" /><strong>Rescheduling is not available</strong><span>{eligibility.data.reason}</span><button onClick={onCancel} type="button">Close</button></div>;

  const mutationMessage = mutation.error instanceof ApiError ? mutation.error.message : mutation.error instanceof Error ? mutation.error.message : null;
  return <form className="portal-booking-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    <div className="portal-reschedule-current">
      <i className="ph ph-calendar-blank" />
      <div>
        <small>Current appointment</small>
        <strong>{appointment.doctor_name}</strong>
        <div className="apt-meta">
          <span className="apt-chip"><i className="ph ph-calendar" />{localDateValue(new Date(appointment.appointment_date))}</span>
          <span className="apt-chip"><i className="ph ph-clock" />{appointment.start_time}–{appointment.end_time}</span>
          {appointment.branch ? <span className="apt-chip"><i className="ph ph-map-pin" />{appointment.branch.name}</span> : null}
          <span className="apt-number">{appointment.appointment_number}</span>
        </div>
      </div>
    </div>
    <section><div className="portal-form-section-title"><span>1</span><div><strong>Choose the new care location</strong><small>You may keep the same doctor or choose another available doctor.</small></div></div><div className="portal-form-grid">
      <label><span>Branch <b>*</b></span><select {...form.register('branch_id', { onChange: () => { form.setValue('department_id', ''); form.setValue('doctor_id', ''); form.setValue('appointment_date', ''); } })}><option value="">Select a branch</option>{branches.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Department <b>*</b></span><select disabled={!branchId || departments.isLoading} {...form.register('department_id', { onChange: () => { form.setValue('doctor_id', ''); form.setValue('appointment_date', ''); } })}><option value="">Select a department</option>{departments.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="wide"><span>Doctor <b>*</b></span><select disabled={!departmentId || doctors.isLoading} {...form.register('doctor_id', { onChange: () => form.setValue('appointment_date', '') })}><option value="">Select a doctor</option>{doctors.data?.data.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.specialization}</option>)}</select></label>
    </div></section>
    <section><div className="portal-form-section-title"><span>2</span><div><strong>Select a new date and time</strong><small>The new slot is checked again when you confirm.</small></div></div><div className="portal-form-grid portal-date-options"><label><span>New date <b>*</b></span><input min={localDateValue(new Date())} type="date" {...form.register('appointment_date')} /></label></div>
      <div className="portal-slot-area">{!doctorId || !appointmentDate ? <p><i className="ph ph-info" /> Select a doctor and date to see available times.</p> : slots.isLoading ? <p><i className="ph ph-spinner-gap" /> Checking live availability…</p> : slots.isError ? <p className="error"><i className="ph ph-warning-circle" /> Availability could not be loaded.</p> : slots.data?.slots.length ? <div className="portal-slot-grid">{slots.data.slots.map((slot) => <button className={selectedTime === slot.start_time ? 'selected' : ''} key={slot.start_time} onClick={() => form.setValue('start_time', slot.start_time, { shouldValidate: true })} type="button"><strong>{slot.start_time}</strong><small>to {slot.end_time}</small></button>)}</div> : <p><i className="ph ph-calendar-x" /> No open times remain on this date.</p>}</div>
    </section>
    {mutationMessage ? <div className="auth-alert auth-alert--error" role="alert">{mutationMessage}</div> : null}
    <footer className="portal-form-actions"><button onClick={onCancel} type="button">Keep current appointment</button><button className="primary" disabled={mutation.isPending} type="submit"><i className="ph ph-calendar-check" /> {mutation.isPending ? 'Rescheduling…' : 'Confirm new appointment'}</button></footer>
  </form>;
}
