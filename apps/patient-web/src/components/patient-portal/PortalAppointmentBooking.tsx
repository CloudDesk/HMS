import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import { patientPortalApi, type PatientPortalContext, type PublicBranch, type PublicDepartment, type PublicDoctor } from '../../api/patient-portal';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient.'),
  branch_id: z.string().min(1, 'Select a branch.'),
  department_id: z.string().min(1, 'Select a department.'),
  doctor_id: z.string().min(1, 'Select a doctor.'),
  appointment_date: z.string().min(1, 'Select an appointment date.'),
  start_time: z.string().min(1, 'Select an available time.'),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
  reason: z.string().trim().min(3, 'Tell us briefly why you need the appointment.').max(500),
});
type BookingValues = z.infer<typeof schema>;

const minutesBetween = (start: string, end: string) => {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
};

const localDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function PortalAppointmentBooking({ context, initialDoctorId, initialBranchId, initialDepartmentId, onBooked, onCancel }: {
  context: PatientPortalContext;
  initialDoctorId?: string;
  initialBranchId?: string;
  initialDepartmentId?: string;
  onBooked: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const today = localDateValue(new Date());
  const form = useForm<BookingValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: context.patients[0]?.id ?? '',
      branch_id: initialBranchId ?? '',
      department_id: initialDepartmentId ?? '',
      doctor_id: initialDoctorId ?? '',
      appointment_date: '',
      start_time: '',
      visit_type: 'NEW_CONSULTATION',
      reason: '',
    },
  });
  const branchId = form.watch('branch_id');
  const departmentId = form.watch('department_id');
  const doctorId = form.watch('doctor_id');
  const appointmentDate = form.watch('appointment_date');
  const selectedTime = form.watch('start_time');

  const branches = useQuery({ queryKey: ['public-branches'], queryFn: () => patientPortalApi.publicBranches({ limit: 24 }) });
  const departments = useQuery({ queryKey: ['public-departments-booking', branchId], queryFn: () => patientPortalApi.publicDepartments({ limit: 24, branchId: branchId || undefined }) });
  const doctors = useQuery({ queryKey: ['public-doctors-booking', branchId, departmentId], queryFn: () => patientPortalApi.publicDoctors({ limit: 24, branchId: branchId || undefined, departmentId: departmentId || undefined }) });
  const slots = useQuery({
    queryKey: ['public-doctor-slots', doctorId, appointmentDate],
    queryFn: () => patientPortalApi.publicDoctorSlots(doctorId, appointmentDate),
    enabled: Boolean(doctorId && appointmentDate),
  });

  const extractArray = <T,>(queryData: unknown): T[] => {
    if (!queryData) return [];
    if (Array.isArray(queryData)) return queryData as T[];
    if (typeof queryData === 'object' && queryData !== null) {
      const obj = queryData as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as T[];
      if (obj.data && typeof obj.data === 'object' && Array.isArray((obj.data as Record<string, unknown>).data)) {
        return (obj.data as Record<string, unknown>).data as T[];
      }
    }
    return [];
  };

  const apiBranches = extractArray<PublicBranch>(branches.data);
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

  const NON_CLINICAL_TERMS = ['administration', 'admin', 'billing', 'finance', 'reception', 'nursing', 'pharmacy', 'imaging', 'laboratory', 'lab'];
  const allDepartments = extractArray<PublicDepartment>(departments.data).filter((dept) => {
    const name = dept.name?.toLowerCase() ?? '';
    const code = dept.code?.toLowerCase() ?? '';
    return !NON_CLINICAL_TERMS.some((term) => name.includes(term) || code.includes(term));
  });
  const filteredDepts = branchId ? allDepartments.filter((d) => d.branch?.id === branchId) : [];
  const scopedDepts = filteredDepts.length > 0 ? filteredDepts : allDepartments;
  const deptMap = new Map<string, PublicDepartment>();
  scopedDepts.forEach((dept) => {
    if (dept.name && !deptMap.has(dept.name)) {
      deptMap.set(dept.name, dept);
    }
  });
  const departmentList = Array.from(deptMap.values());

  const allDoctors = extractArray<PublicDoctor>(doctors.data);
  const doctorList = departmentId
    ? allDoctors.filter((doc) => doc.department?.id === departmentId)
    : allDoctors;

  useEffect(() => form.setValue('start_time', ''), [doctorId, appointmentDate, form]);

  const resetSchedule = () => {
    form.setValue('appointment_date', '');
    form.setValue('start_time', '');
  };

  const mutation = useMutation({
    mutationFn: async (values: BookingValues) => {
      const slot = slots.data?.slots.find((item) => item.start_time === values.start_time);
      if (!slot) throw new Error('Select an available appointment time.');
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

  const mutationMessage = mutation.error instanceof ApiError ? mutation.error.message : mutation.error instanceof Error ? mutation.error.message : null;
  return <form className="portal-booking-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    <section><div className="portal-form-section-title"><span>1</span><div><strong>Patient and hospital location</strong><small>Choose who the visit is for and where care is needed.</small></div></div><div className="portal-form-grid">
      <label><span>Patient <b>*</b></span><select {...form.register('patient_id')}>{context.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.patient_number}</option>)}</select>{form.formState.errors.patient_id ? <small>{form.formState.errors.patient_id.message}</small> : null}</label>
      <label><span>Branch <b>*</b></span><select {...form.register('branch_id', { onChange: () => { form.setValue('department_id', ''); form.setValue('doctor_id', ''); resetSchedule(); } })} disabled={branches.isLoading}><option value="">{branches.isLoading ? 'Loading branches…' : 'Select a branch'}</option>{branchList.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` · ${branch.city}` : ''}</option>)}</select>{form.formState.errors.branch_id ? <small>{form.formState.errors.branch_id.message}</small> : null}</label>
      <label><span>Department <b>*</b></span><select {...form.register('department_id', { onChange: () => { form.setValue('doctor_id', ''); resetSchedule(); } })} disabled={departments.isLoading}><option value="">{departments.isLoading ? 'Loading departments…' : 'Select a department'}</option>{departmentList.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{form.formState.errors.department_id ? <small>{form.formState.errors.department_id.message}</small> : null}</label>
      <label><span>Doctor <b>*</b></span><select {...form.register('doctor_id', { onChange: resetSchedule })} disabled={doctors.isLoading}><option value="">{!departmentId ? 'Select a department first' : doctors.isLoading ? 'Loading doctors…' : doctorList.length === 0 ? 'No doctors available in this department' : 'Select a doctor'}</option>{doctorList.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name} · {doctor.specialization}</option>)}</select>{form.formState.errors.doctor_id ? <small>{form.formState.errors.doctor_id.message}</small> : null}</label>
    </div></section>
    <section><div className="portal-form-section-title"><span>2</span><div><strong>Date and available time</strong><small>Select a date to load the doctor’s live appointment slots.</small></div></div><div className="portal-form-grid portal-date-options"><label><span>Appointment date <b>*</b></span><input min={today} type="date" {...form.register('appointment_date')} />{form.formState.errors.appointment_date ? <small>{form.formState.errors.appointment_date.message}</small> : null}</label><label><span>Visit type <b>*</b></span><select {...form.register('visit_type')}><option value="NEW_CONSULTATION">New consultation</option><option value="FOLLOW_UP">Follow-up</option><option value="PROCEDURE">Procedure</option></select></label></div>
      <div className="portal-slot-area">{!doctorId || !appointmentDate ? <p><i className="ph ph-info" /> Select a doctor and date to view available times.</p> : slots.isLoading ? <p><i className="ph ph-spinner-gap" /> Checking live availability…</p> : slots.isError ? <p className="error"><i className="ph ph-warning-circle" /> Availability could not be loaded.</p> : slots.data?.slots.length ? <div className="portal-slot-grid">{slots.data.slots.map((slot) => <button className={selectedTime === slot.start_time ? 'selected' : ''} key={slot.start_time} onClick={() => form.setValue('start_time', slot.start_time, { shouldValidate: true })} type="button"><strong>{slot.start_time}</strong><small>to {slot.end_time}</small></button>)}</div> : <p><i className="ph ph-calendar-x" /> {slots.data?.unavailable_reason || 'No open times remain on this date.'}</p>}{form.formState.errors.start_time ? <small className="portal-field-error">{form.formState.errors.start_time.message}</small> : null}</div>
    </section>
    <section><div className="portal-form-section-title"><span>3</span><div><strong>Reason for visit</strong><small>This helps the care team prepare for your appointment.</small></div></div><div className="portal-form-grid"><label className="wide"><span>Reason <b>*</b></span><textarea placeholder="Briefly describe the concern or service you need" rows={4} {...form.register('reason')} />{form.formState.errors.reason ? <small>{form.formState.errors.reason.message}</small> : null}</label></div></section>
    {mutationMessage ? <div className="auth-alert auth-alert--error" role="alert">{mutationMessage}</div> : null}
    <footer className="portal-form-actions"><button onClick={onCancel} type="button">Cancel</button><button className="primary" disabled={mutation.isPending} type="submit"><i className="ph ph-calendar-check" /> {mutation.isPending ? 'Booking…' : 'Confirm appointment'}</button></footer>
  </form>;
}
