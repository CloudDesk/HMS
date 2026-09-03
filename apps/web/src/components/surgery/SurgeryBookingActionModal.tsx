import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { ProcedureBooking, ProcedureRecommendation } from '../../api/surgery';
import type { ServiceResponse } from '../../api/services';
import { Modal } from '../ui/Modal';
import { DoctorAvailabilityChecker } from './DoctorAvailabilityChecker';
import { ProcedureBookingPrerequisiteManager } from './ProcedureBookingPrerequisiteManager';

export type ActionMode =
  | 'confirm'
  | 'reschedule'
  | 'cancel-booking'
  | 'cancel-recommendation'
  | 'complete'
  | null;

const actionSchema = z.object({
  scheduled_start: z.string(),
  doctor_id: z.string(),
  hold_id: z.string(),
  consent_document_id: z.string(),
  deposit_invoice_id: z.string(),
  reason: z.string(),
});

type ActionValues = z.infer<typeof actionSchema>;

const localDateTime = (value: string) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export type SurgeryBookingActionModalProps = {
  actionMode: ActionMode;
  selected: ProcedureBooking | null;
  bookingFor: ProcedureRecommendation | null;
  procedure?: ServiceResponse;
  branchId: string;
  doctors: Array<{ id: string; display_name: string; department_id?: string }>;
  alternatives: Array<{ doctor_id: string; doctor_name: string }>;
  recommendedSlots: Array<{ start_time: string; end_time: string; label: string; formatted: string }>;
  alternativesLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setAvailability: (params: { department_id: string; service_id: string; scheduled_start: string; doctor_id?: string }) => void;
  confirmBooking: (id: string, payload: { hold_id?: string; consent_document_id?: string; deposit_invoice_id?: string }) => Promise<unknown>;
  rescheduleBooking: (id: string, payload: { scheduled_start: string; doctor_id?: string; reason: string }) => Promise<unknown>;
  cancelBooking: (id: string, payload: { reason: string }) => Promise<unknown>;
  cancelRecommendation: (id: string, payload: { reason: string }) => Promise<unknown>;
  completeBooking: (id: string) => Promise<unknown>;
};

export function SurgeryBookingActionModal({
  actionMode,
  selected,
  bookingFor,
  procedure,
  branchId,
  doctors,
  alternatives,
  recommendedSlots,
  alternativesLoading,
  onClose,
  onSuccess,
  setAvailability,
  confirmBooking,
  rescheduleBooking,
  cancelBooking,
  cancelRecommendation,
  completeBooking,
}: SurgeryBookingActionModalProps) {
  const actionForm = useForm<ActionValues>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      scheduled_start: '',
      doctor_id: '',
      hold_id: '',
      consent_document_id: '',
      deposit_invoice_id: '',
      reason: '',
    },
  });

  const watchedActionStart = actionForm.watch('scheduled_start');
  const watchedActionDoctor = actionForm.watch('doctor_id');

  useEffect(() => {
    if (selected) {
      actionForm.reset({
        scheduled_start: localDateTime(selected.scheduled_start),
        doctor_id: selected.doctor_id,
        hold_id: selected.hold_id ?? '',
        consent_document_id: selected.consent_document_id ?? '',
        deposit_invoice_id: selected.deposit_invoice_id ?? '',
        reason: '',
      });
    }
  }, [actionForm, selected]);

  useEffect(() => {
    if (selected && actionMode === 'reschedule' && watchedActionStart) {
      setAvailability({
        department_id: selected.department_id,
        service_id: selected.service_id,
        scheduled_start: watchedActionStart,
        doctor_id: watchedActionDoctor || undefined,
      });
    }
  }, [setAvailability, selected, actionMode, watchedActionStart, watchedActionDoctor]);

  const executeAction = actionForm.handleSubmit(async (values) => {
    try {
      if (actionMode === 'confirm' && selected) {
        await confirmBooking(selected.id, {
          hold_id: values.hold_id || undefined,
          consent_document_id: values.consent_document_id || undefined,
          deposit_invoice_id: values.deposit_invoice_id || undefined,
        });
        toast.success('Procedure booking confirmed.');
      } else if (actionMode === 'reschedule' && selected) {
        if (!values.reason) {
          toast.error('Reason is required to reschedule.');
          return;
        }
        await rescheduleBooking(selected.id, {
          scheduled_start: values.scheduled_start,
          doctor_id: values.doctor_id || undefined,
          reason: values.reason,
        });
        toast.success('Procedure rescheduled.');
      } else if (actionMode === 'complete' && selected) {
        if (new Date(selected.scheduled_start).getTime() > Date.now()) {
          toast.error('Procedure cannot be completed before its scheduled start time.');
          return;
        }
        await completeBooking(selected.id);
        toast.success('Procedure marked as completed.');
      } else if (actionMode === 'cancel-booking' && selected) {
        if (!values.reason) {
          toast.error('Reason is required to cancel a booking.');
          return;
        }
        await cancelBooking(selected.id, { reason: values.reason });
        toast.success('Procedure booking cancelled.');
      } else if (actionMode === 'cancel-recommendation' && bookingFor) {
        if (!values.reason) {
          toast.error('Reason is required to cancel a recommendation.');
          return;
        }
        await cancelRecommendation(bookingFor.id, { reason: values.reason });
        toast.success('Procedure recommendation cancelled.');
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  });

  if (!actionMode) return null;

  return (
    <Modal
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
          <button className="btn-secondary" onClick={onClose} type="button">
            Back
          </button>
          <button
            className={actionMode?.startsWith('cancel') ? 'btn-danger' : 'btn-primary'}
            disabled={
              actionMode === 'complete' &&
              Boolean(selected && new Date(selected.scheduled_start).getTime() > Date.now())
            }
            form="surgery-action-form"
            style={
              actionMode === 'complete'
                ? {
                    background:
                      selected && new Date(selected.scheduled_start).getTime() <= Date.now()
                        ? '#16a34a'
                        : '#94a3b8',
                    borderColor:
                      selected && new Date(selected.scheduled_start).getTime() <= Date.now()
                        ? '#15803d'
                        : '#94a3b8',
                    color: '#ffffff',
                    cursor:
                      selected && new Date(selected.scheduled_start).getTime() <= Date.now()
                        ? 'pointer'
                        : 'not-allowed',
                  }
                : undefined
            }
            type="submit"
          >
            {actionMode?.startsWith('cancel')
              ? 'Confirm Cancellation'
              : actionMode === 'complete'
                ? 'Complete Procedure'
                : 'Confirm Action'}
          </button>
        </div>
      }
      icon={
        actionMode?.startsWith('cancel')
          ? 'ph-x-circle'
          : actionMode === 'complete'
            ? 'ph-check-circle'
            : 'ph-gear-six'
      }
      onClose={onClose}
      open={Boolean(actionMode)}
      size="large"
      title={
        actionMode === 'confirm'
          ? 'Confirm Procedure Booking'
          : actionMode === 'reschedule'
            ? 'Reschedule Procedure'
            : actionMode === 'complete'
              ? 'Complete Procedure'
              : 'Confirm Cancellation'
      }
    >
      <form
        id="surgery-action-form"
        onSubmit={executeAction}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {actionMode === 'complete' && selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#15803d',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                }}
              >
                <i className="ph-fill ph-check-circle" style={{ fontSize: '1.25rem', color: '#16a34a' }} />
                <span>Mark Procedure as Completed</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
                You are about to finalize this procedure. This will mark the booking as completed, free
                up allocated operating theater capacity, and record the completion event on the
                patient’s clinical timeline.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  background: '#ffffff',
                  border: '1px solid #dcfce7',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span
                    style={{
                      color: '#64748b',
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    PATIENT
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selected.patient_name}</strong>{' '}
                  <span style={{ color: '#64748b' }}>({selected.patient_number})</span>
                </div>
                <div>
                  <span
                    style={{
                      color: '#64748b',
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    PROCEDURE
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selected.service_name}</strong>
                </div>
                <div>
                  <span
                    style={{
                      color: '#64748b',
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    OPERATING DOCTOR
                  </span>
                  <strong style={{ color: '#0f172a' }}>{selected.doctor_name}</strong>
                </div>
                <div>
                  <span
                    style={{
                      color: '#64748b',
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    SCHEDULED WINDOW
                  </span>
                  <strong style={{ color: '#0f172a' }}>
                    {new Date(selected.scheduled_start).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </strong>
                </div>
              </div>

              {new Date(selected.scheduled_start).getTime() > Date.now() ? (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <i
                    className="ph-fill ph-warning"
                    style={{ fontSize: '1.2rem', color: '#d97706', flexShrink: 0 }}
                  />
                  <span>
                    <strong>Procedure has not started yet.</strong> This procedure is scheduled for{' '}
                    <strong>
                      {new Date(selected.scheduled_start).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </strong>
                    . Clinically, a surgery can only be marked as completed on or after its scheduled
                    start time.
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {actionMode === 'confirm' && selected ? (
          <ProcedureBookingPrerequisiteManager
            booking={selected}
            branchId={branchId}
            onSelectConsent={(id) => actionForm.setValue('consent_document_id', id)}
            onSelectHold={(id) => actionForm.setValue('hold_id', id)}
            procedure={procedure}
            selectedConsentId={actionForm.watch('consent_document_id')}
            selectedHoldId={actionForm.watch('hold_id')}
          />
        ) : null}

        {actionMode === 'reschedule' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Doctor
              </label>
              <select
                {...actionForm.register('doctor_id')}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              >
                {doctors
                  .filter((item) => !selected || item.department_id === selected.department_id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Schedule Start
              </label>
              <input
                type="datetime-local"
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16)}
                {...actionForm.register('scheduled_start')}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>
        ) : null}

        {actionMode === 'reschedule' ? (
          <DoctorAvailabilityChecker
            alternatives={alternatives}
            departmentName={selected?.department_name ?? 'Department'}
            doctors={doctors
              .filter((d) => !selected || d.department_id === selected.department_id)
              .map((d) => ({ id: d.id, display_name: d.display_name }))}
            durationMinutes={procedure?.default_duration_minutes ?? selected?.duration_minutes ?? 60}
            isLoading={alternativesLoading}
            onSelectDoctor={(docId) => actionForm.setValue('doctor_id', docId)}
            onSelectSlot={(time24) => {
              const cur = actionForm.watch('scheduled_start');
              const baseDate = cur ? cur.slice(0, 10) : new Date().toISOString().slice(0, 10);
              actionForm.setValue('scheduled_start', `${baseDate}T${time24}`);
            }}
            recommendedSlots={recommendedSlots}
            selectedDoctorId={actionForm.watch('doctor_id')}
            watchedStart={actionForm.watch('scheduled_start')}
          />
        ) : null}

        {actionMode && ['cancel-recommendation', 'cancel-booking', 'reschedule'].includes(actionMode) ? (
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              {actionMode === 'reschedule' ? 'Reason for Rescheduling' : 'Reason for Cancellation'}{' '}
              <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              {...actionForm.register('reason')}
              placeholder="State clinical or administrative reason for this action..."
              rows={2}
              style={{
                width: '100%',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                padding: '8px',
                fontSize: '0.82rem',
              }}
            />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
