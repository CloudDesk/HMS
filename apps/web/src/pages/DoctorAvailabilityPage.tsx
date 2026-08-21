import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  DoctorAvailabilityEditor,
  createDefaultDoctorAvailability,
} from '../components/doctors/DoctorAvailabilityEditor';
import { useDoctorAvailability } from '../hooks/doctors/useDoctorAvailability';
import { navigate, useAppLocation } from '../routing/navigation';

const availabilityDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const isValidDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const dateSchema = z.string().refine(isValidDate, 'Enter a valid date in YYYY-MM-DD format.');
const timeSchema = z.string().regex(timePattern, 'Enter a valid time in HH:mm format.');

const workingBlockSchema = z.object({
  start_time: timeSchema,
  end_time: timeSchema,
  slot_duration_minutes: z.number().int().min(5).max(240),
});

const availabilityFormSchema = z
  .object({
    availability: z.array(
      z.object({
        day_of_week: z.enum(availabilityDays),
        is_available: z.boolean(),
        working_blocks: z.array(workingBlockSchema).max(8),
      }),
    ).min(1).max(7),
  })
  .superRefine((form, context) => {
    form.availability.forEach((day) => {
      if (day.is_available && day.working_blocks.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Every available day must contain at least one working block.',
          path: ['availability'],
        });
      }
    });
  });

const leaveFormSchema = z
  .object({
    start_date: dateSchema,
    end_date: dateSchema,
    reason: z.string().trim().min(3, 'Leave reason must contain at least 3 characters.').max(500),
  })
  .refine((form) => form.start_date <= form.end_date, {
    message: 'Leave end date must be on or after the start date.',
    path: ['end_date'],
  });

const exceptionFormSchema = z
  .object({
    date: dateSchema,
    is_available: z.boolean(),
    working_blocks: z.array(
      z.object({
        start_time: timeSchema,
        end_time: timeSchema,
        slot_duration_minutes: z.number().int().min(5).max(240),
      }),
    ).max(8),
    reason: z.string().trim().min(3, 'Exception reason must contain at least 3 characters.').max(500),
  })
  .superRefine((form, context) => {
    if (form.is_available && form.working_blocks.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Custom availability requires a working block.',
        path: ['working_blocks'],
      });
    }
  });

type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;
type LeaveFormValues = z.infer<typeof leaveFormSchema>;
type ExceptionFormValues = z.infer<typeof exceptionFormSchema>;

const todayValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const defaultExceptionBlock = () => ({
  start_time: '09:00',
  end_time: '13:00',
  slot_duration_minutes: 30,
});

const defaultLeaveForm = (): LeaveFormValues => ({
  start_date: todayValue(),
  end_date: todayValue(),
  reason: '',
});

const defaultExceptionForm = (): ExceptionFormValues => ({
  date: todayValue(),
  is_available: false,
  working_blocks: [],
  reason: '',
});

export function DoctorAvailabilityPage() {
  const { search } = useAppLocation();
  const initialDoctorId = new URLSearchParams(search).get('doctor_id') ?? '';
  const availability = useDoctorAvailability(initialDoctorId);

  const availabilityValues = useMemo<AvailabilityFormValues>(
    () => ({
      availability:
        availability.availability ?? createDefaultDoctorAvailability(),
    }),
    [availability.availability],
  );
  const availabilityForm = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      availability: createDefaultDoctorAvailability(),
    },
    values: availabilityValues,
  });
  const leaveForm = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: defaultLeaveForm(),
  });
  const exceptionForm = useForm<ExceptionFormValues>({
    resolver: zodResolver(exceptionFormSchema),
    defaultValues: defaultExceptionForm(),
  });

  const leaveStartDate = leaveForm.watch('start_date');
  const exceptionValues = exceptionForm.watch();
  const exceptionBlock =
    exceptionValues.working_blocks[0] ?? defaultExceptionBlock();
  const saving =
    availability.isSaving ||
    availabilityForm.formState.isSubmitting ||
    leaveForm.formState.isSubmitting ||
    exceptionForm.formState.isSubmitting;
  const formError =
    availabilityForm.formState.errors.root?.message ??
    availabilityForm.formState.errors.availability?.message ??
    leaveForm.formState.errors.root?.message ??
    leaveForm.formState.errors.start_date?.message ??
    leaveForm.formState.errors.end_date?.message ??
    leaveForm.formState.errors.reason?.message ??
    exceptionForm.formState.errors.root?.message ??
    exceptionForm.formState.errors.date?.message ??
    exceptionForm.formState.errors.working_blocks?.root?.message ??
    exceptionForm.formState.errors.reason?.message;
  const errorMessage = formError ?? availability.errorMessage;

  const saveAvailability = availabilityForm.handleSubmit(async (values) => {
    await availability.updateAvailability(values);
  });
  const submitLeave = leaveForm.handleSubmit(async (values) => {
    if (await availability.createLeave(values)) {
      leaveForm.reset(defaultLeaveForm());
    }
  });
  const submitException = exceptionForm.handleSubmit(async (values) => {
    if (await availability.saveException(values)) {
      exceptionForm.reset(defaultExceptionForm());
    }
  });

  const [activeTab, setActiveTab] = useState<'schedule' | 'leave'>('schedule');

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>Availability Management</h2>
          <p>Configure recurring blocks, dated exceptions, and doctor leave.</p>
        </div>
        <div className="doctor-page-actions">
          <button
            className="doc-btn"
            disabled={!availability.selectedDoctorId}
            onClick={() =>
              navigate(`/doctors/profile?id=${availability.selectedDoctorId}`)
            }
            type="button"
          >
            <i className="ph ph-user-circle" /> Profile
          </button>
          {activeTab === 'schedule' ? (
            <button
              className="doc-btn primary"
              disabled={
                saving ||
                !availability.selectedDoctorId ||
                !availability.canEdit
              }
              onClick={() => void saveAvailability()}
              type="button"
            >
              <i className="ph ph-floppy-disk" /> Save Working Hours
            </button>
          ) : null}
        </div>
      </section>

      <section className="doc-toolbar">
        <div className="doc-field grow">
          <label htmlFor="availability-doctor">Doctor</label>
          <select
            disabled={availability.isDoctorUser || availability.isLoading}
            id="availability-doctor"
            onChange={(event) =>
              availability.setSelectedDoctorId(event.target.value)
            }
            value={availability.selectedDoctorId}
          >
            {availability.doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.display_name} · {doctor.specialization}
              </option>
            ))}
          </select>
        </div>
        {availability.selectedDoctor ? (
          <div className="doctor-availability-summary">
            <div>
              <span>Status</span>
              <strong>
                {availability.selectedDoctor.status.replace('_', ' ')}
              </strong>
            </div>
          </div>
        ) : null}
      </section>

      {errorMessage ? (
        <section className="form-error-banner" role="alert">
          <i className="ph ph-warning-circle" />
          <span>{errorMessage}</span>
        </section>
      ) : null}

      {availability.isLoading ? (
        <section className="doc-card um-state-cell">
          Loading doctor availability...
        </section>
      ) : availability.doctors.length === 0 ? (
        <section className="doc-card um-state-cell">
          No doctor records are available.
        </section>
      ) : (
        <>
          <div className="tabs-container" style={{ margin: '0.25rem 0 1rem', borderBottom: '1px solid #e2e8f0' }}>
            <button
              className={`tab-btn${activeTab === 'schedule' ? ' active' : ''}`}
              onClick={() => setActiveTab('schedule')}
              type="button"
            >
              <i className="ph ph-clock" style={{ marginRight: '6px' }} />
              Recurring Working Hours
            </button>
            <button
              className={`tab-btn${activeTab === 'leave' ? ' active' : ''}`}
              onClick={() => setActiveTab('leave')}
              type="button"
            >
              <i className="ph ph-calendar-x" style={{ marginRight: '6px' }} />
              Doctor Leave {availability.leaves.length > 0 ? `(${availability.leaves.length})` : ''}
            </button>
          </div>

          {activeTab === 'schedule' ? (
            <section className="doc-card" style={{ width: '100%' }}>
              <div className="doc-card-header">
                <div>
                  <h3>Recurring Working Hours</h3>
                  <p>Add multiple non-overlapping blocks for each available day.</p>
                </div>
              </div>
              <Controller
                control={availabilityForm.control}
                name="availability"
                render={({ field }) => (
                  <DoctorAvailabilityEditor
                    disabled={saving || !availability.canEdit}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />
            </section>
          ) : (
            <section className="doc-card" style={{ width: '100%' }}>
              <div className="doc-card-header">
                <div>
                  <h3>Doctor Leave Management</h3>
                  <p>Date ranges block all generated appointment slots for this doctor.</p>
                </div>
              </div>
              <form className="doc-form-grid two" onSubmit={submitLeave} style={{ marginBottom: '1.5rem' }}>
                <label className="doc-field">
                  <span>From Date</span>
                  <input
                    {...leaveForm.register('start_date')}
                    disabled={!availability.canEdit}
                    min={todayValue()}
                    type="date"
                  />
                </label>
                <label className="doc-field">
                  <span>To Date</span>
                  <input
                    {...leaveForm.register('end_date')}
                    disabled={!availability.canEdit}
                    min={leaveStartDate}
                    type="date"
                  />
                </label>
                <label className="doc-field full">
                  <span>Leave Reason / Clinical Notes</span>
                  <input
                    placeholder="e.g. Annual Leave, Medical Leave, Conference"
                    {...leaveForm.register('reason')}
                    disabled={!availability.canEdit}
                  />
                </label>
                <div className="full">
                  <button
                    className="doc-btn primary"
                    disabled={saving || !availability.canEdit}
                    type="submit"
                  >
                    <i className="ph ph-plus" /> Add Leave Record
                  </button>
                </div>
              </form>

              <div className="doc-table-wrap doctor-subtable" style={{ maxHeight: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="doc-table">
                  <thead>
                    <tr><th>From</th><th>To</th><th>Reason</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {availability.leaves.length === 0 ? (
                      <tr><td className="um-state-cell" colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>No leave records.</td></tr>
                    ) : (
                      availability.leaves.map((leave) => (
                        <tr key={leave.id}>
                          <td><strong>{leave.start_date.slice(0, 10)}</strong></td>
                          <td><strong>{leave.end_date.slice(0, 10)}</strong></td>
                          <td>{leave.reason}</td>
                          <td>
                            <span className={`status-badge ${leave.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                              {leave.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {leave.status === 'ACTIVE' && availability.canEdit ? (
                              <button
                                className="doc-action danger"
                                disabled={saving}
                                onClick={() => void availability.cancelLeave(leave.id)}
                                title="Cancel leave"
                                type="button"
                              >
                                <i className="ph ph-x" /> Cancel
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
