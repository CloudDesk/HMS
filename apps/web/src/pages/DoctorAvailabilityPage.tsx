import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
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
          <section className="doc-card">
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

          <div className="doc-grid two doctor-availability-management-grid">
            <section className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Doctor Leave</h3>
                  <p>Date ranges block all generated appointment slots.</p>
                </div>
              </div>
              <form className="doc-form-grid two" onSubmit={submitLeave}>
                <label className="doc-field">
                  <span>From</span>
                  <input
                    {...leaveForm.register('start_date')}
                    disabled={!availability.canEdit}
                    min={todayValue()}
                    type="date"
                  />
                </label>
                <label className="doc-field">
                  <span>To</span>
                  <input
                    {...leaveForm.register('end_date')}
                    disabled={!availability.canEdit}
                    min={leaveStartDate}
                    type="date"
                  />
                </label>
                <label className="doc-field full">
                  <span>Reason</span>
                  <input
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
                    <i className="ph ph-plus" /> Add Leave
                  </button>
                </div>
              </form>
              <div className="doc-table-wrap doctor-subtable">
                <table className="doc-table">
                  <thead>
                    <tr><th>From</th><th>To</th><th>Reason</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {availability.leaves.length === 0 ? (
                      <tr><td className="um-state-cell" colSpan={5}>No leave records.</td></tr>
                    ) : (
                      availability.leaves.map((leave) => (
                        <tr key={leave.id}>
                          <td>{leave.start_date.slice(0, 10)}</td>
                          <td>{leave.end_date.slice(0, 10)}</td>
                          <td>{leave.reason}</td>
                          <td>{leave.status}</td>
                          <td>
                            {leave.status === 'ACTIVE' && availability.canEdit ? (
                              <button
                                className="doc-action danger"
                                disabled={saving}
                                onClick={() => void availability.cancelLeave(leave.id)}
                                title="Cancel leave"
                                type="button"
                              >
                                <i className="ph ph-x" />
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

            <section className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Availability Exceptions</h3>
                  <p>Override a single date with closure or custom working blocks.</p>
                </div>
              </div>
              <form className="doc-form-grid two" onSubmit={submitException}>
                <label className="doc-field">
                  <span>Date</span>
                  <input
                    {...exceptionForm.register('date')}
                    disabled={!availability.canEdit}
                    min={todayValue()}
                    type="date"
                  />
                </label>
                <label className="doc-field">
                  <span>Availability</span>
                  <Controller
                    control={exceptionForm.control}
                    name="is_available"
                    render={({ field }) => (
                      <select
                        disabled={!availability.canEdit}
                        onChange={(event) => {
                          const isAvailable = event.target.value === 'available';
                          field.onChange(isAvailable);
                          exceptionForm.setValue(
                            'working_blocks',
                            isAvailable
                              ? exceptionValues.working_blocks.length
                                ? exceptionValues.working_blocks
                                : [defaultExceptionBlock()]
                              : [],
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                        value={field.value ? 'available' : 'unavailable'}
                      >
                        <option value="unavailable">Unavailable</option>
                        <option value="available">Custom hours</option>
                      </select>
                    )}
                  />
                </label>
                {exceptionValues.is_available ? (
                  <>
                    <label className="doc-field">
                      <span>From</span>
                      <input
                        disabled={!availability.canEdit}
                        onChange={(event) =>
                          exceptionForm.setValue(
                            'working_blocks',
                            [{ ...exceptionBlock, start_time: event.target.value }],
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                        type="time"
                        value={exceptionBlock.start_time}
                      />
                    </label>
                    <label className="doc-field">
                      <span>To</span>
                      <input
                        disabled={!availability.canEdit}
                        onChange={(event) =>
                          exceptionForm.setValue(
                            'working_blocks',
                            [{ ...exceptionBlock, end_time: event.target.value }],
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                        type="time"
                        value={exceptionBlock.end_time}
                      />
                    </label>
                  </>
                ) : null}
                <label className="doc-field full">
                  <span>Reason</span>
                  <input
                    {...exceptionForm.register('reason')}
                    disabled={!availability.canEdit}
                  />
                </label>
                <div className="full">
                  <button
                    className="doc-btn primary"
                    disabled={saving || !availability.canEdit}
                    type="submit"
                  >
                    <i className="ph ph-plus" /> Save Exception
                  </button>
                </div>
              </form>
              <div className="doc-table-wrap doctor-subtable">
                <table className="doc-table">
                  <thead>
                    <tr><th>Date</th><th>Override</th><th>Reason</th><th /></tr>
                  </thead>
                  <tbody>
                    {availability.exceptions.length === 0 ? (
                      <tr><td className="um-state-cell" colSpan={4}>No dated exceptions.</td></tr>
                    ) : (
                      availability.exceptions.map((exception) => (
                        <tr key={exception.id}>
                          <td>{exception.date.slice(0, 10)}</td>
                          <td>
                            {exception.is_available
                              ? exception.working_blocks
                                  .map((block) => `${block.start_time}–${block.end_time}`)
                                  .join(', ')
                              : 'Unavailable'}
                          </td>
                          <td>{exception.reason}</td>
                          <td>
                            {availability.canEdit ? (
                              <button
                                className="doc-action danger"
                                disabled={saving}
                                onClick={() => void availability.deleteException(exception.id)}
                                title="Delete exception"
                                type="button"
                              >
                                <i className="ph ph-trash" />
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
          </div>
        </>
      )}
    </div>
  );
}
