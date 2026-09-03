import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { ProcedureRecommendation } from '../../api/surgery';
import type { ServiceResponse } from '../../api/services';
import { Modal } from '../ui/Modal';
import { DoctorAvailabilityChecker } from './DoctorAvailabilityChecker';

const bookingSchema = z.object({
  doctor_id: z.string().min(1, 'Select a doctor'),
  scheduled_start: z.string().min(1, 'Select date and time'),
  hold_id: z.string(),
  consent_document_id: z.string(),
  deposit_invoice_id: z.string(),
  notes: z.string().max(2000),
});

type BookingValues = z.infer<typeof bookingSchema>;

function FieldError({ text }: { text?: string }) {
  return text ? (
    <small className="form-error" style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '2px', display: 'block' }}>
      {text}
    </small>
  ) : null;
}

export type SurgeryBookingCreateModalProps = {
  bookingFor: ProcedureRecommendation | null;
  onClose: () => void;
  branchId: string;
  procedure?: ServiceResponse;
  eligibleDoctors: Array<{ id: string; display_name: string }>;
  alternatives: Array<{ doctor_id: string; doctor_name: string }>;
  recommendedSlots: Array<{ start_time: string; end_time: string; label: string; formatted: string }>;
  alternativesLoading: boolean;
  createBookingPending: boolean;
  setAvailability: (params: { department_id: string; service_id: string; scheduled_start: string; doctor_id?: string }) => void;
  createBooking: (payload: { recommendation_id: string; branch_id: string; doctor_id: string; scheduled_start: string; notes?: string }) => Promise<unknown>;
  onSuccess: () => void;
};

export function SurgeryBookingCreateModal({
  bookingFor,
  onClose,
  branchId,
  procedure,
  eligibleDoctors,
  alternatives,
  recommendedSlots,
  alternativesLoading,
  createBookingPending,
  setAvailability,
  createBooking,
  onSuccess,
}: SurgeryBookingCreateModalProps) {
  const bookingForm = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      doctor_id: '',
      scheduled_start: '',
      hold_id: '',
      consent_document_id: '',
      deposit_invoice_id: '',
      notes: '',
    },
  });

  const watchedStart = bookingForm.watch('scheduled_start');
  const watchedDoctor = bookingForm.watch('doctor_id');

  useEffect(() => {
    if (bookingFor) {
      bookingForm.reset({
        doctor_id: bookingFor.recommending_doctor_id || '',
        scheduled_start: '',
        hold_id: '',
        consent_document_id: '',
        deposit_invoice_id: '',
        notes: '',
      });
    }
  }, [bookingFor, bookingForm]);

  useEffect(() => {
    if (bookingFor && watchedStart) {
      setAvailability({
        department_id: bookingFor.department_id,
        service_id: bookingFor.service_id,
        scheduled_start: watchedStart,
        doctor_id: watchedDoctor || undefined,
      });
    }
  }, [setAvailability, bookingFor, watchedStart, watchedDoctor]);

  const handleSubmit = bookingForm.handleSubmit(async (values) => {
    if (!bookingFor) return;
    try {
      await createBooking({
        recommendation_id: bookingFor.id,
        branch_id: branchId,
        doctor_id: values.doctor_id,
        scheduled_start: values.scheduled_start,
        notes: values.notes || undefined,
      });
      toast.success('Procedure booking created in pending confirmation status.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create booking.');
    }
  });

  return (
    <Modal
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
          <button className="btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={createBookingPending}
            form="procedure-booking-form"
            type="submit"
          >
            <i className="ph ph-check-circle" />{' '}
            {createBookingPending ? 'Booking...' : 'Create Pending Booking'}
          </button>
        </div>
      }
      icon="ph-calendar-check"
      onClose={onClose}
      open={Boolean(bookingFor)}
      size="large"
      title="Book Recommended Procedure"
    >
      <form
        id="procedure-booking-form"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* Step Progress Nav */}
        <div className="surgery-step-nav">
          <div className="surgery-step-item completed">
            <i className="ph-fill ph-check-circle" /> 1. Recommendation
          </div>
          <div className="surgery-step-item active">
            <i className="ph-fill ph-calendar" /> 2. Procedure Schedule
          </div>
          <div className="surgery-step-item">
            <i className="ph ph-shield-check" /> 3. Prerequisite Checks
          </div>
        </div>

        {/* Procedure Summary Card */}
        <div className="surgery-detail-grid">
          <div className="surgery-detail-item">
            <span>Patient</span>
            <strong>{bookingFor?.patient_name}</strong>
            <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{bookingFor?.patient_number}</small>
          </div>
          <div className="surgery-detail-item">
            <span>Procedure</span>
            <strong>{bookingFor?.service_name}</strong>
            <small style={{ fontSize: '0.75rem', color: '#64748b' }}>{procedure?.category ?? 'Surgical'}</small>
          </div>
          <div className="surgery-detail-item">
            <span>Configured Duration</span>
            <strong>{procedure?.default_duration_minutes ?? '-'} Minutes</strong>
            <small style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Capacity: {procedure?.booking_capacity ?? 1} concurrent
            </small>
          </div>
        </div>

        {/* Doctor & Schedule Grid */}
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
              Operating Doctor / Surgeon <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              {...bookingForm.register('doctor_id')}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '6px',
                border: bookingForm.formState.errors.doctor_id
                  ? '1px solid #ef4444'
                  : '1px solid #cbd5e1',
                padding: '0 8px',
                fontSize: '0.82rem',
              }}
            >
              <option value="">Select Doctor</option>
              {eligibleDoctors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name}
                </option>
              ))}
            </select>
            <FieldError text={bookingForm.formState.errors.doctor_id?.message} />
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
              Start Date &amp; Time <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="datetime-local"
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)}
              {...bookingForm.register('scheduled_start')}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '6px',
                border: bookingForm.formState.errors.scheduled_start
                  ? '1px solid #ef4444'
                  : '1px solid #cbd5e1',
                padding: '0 8px',
                fontSize: '0.82rem',
              }}
            />
            <FieldError text={bookingForm.formState.errors.scheduled_start?.message} />
          </div>
        </div>

        {/* Detailed Doctor Availability Verification */}
        <DoctorAvailabilityChecker
          alternatives={alternatives}
          departmentName={bookingFor?.department_name ?? 'Department'}
          doctors={eligibleDoctors}
          durationMinutes={procedure?.default_duration_minutes ?? 60}
          isLoading={alternativesLoading}
          onSelectDoctor={(docId) => bookingForm.setValue('doctor_id', docId)}
          onSelectSlot={(time24) => {
            const baseDate = watchedStart
              ? watchedStart.slice(0, 10)
              : new Date().toISOString().slice(0, 10);
            bookingForm.setValue('scheduled_start', `${baseDate}T${time24}`);
          }}
          recommendedSlots={recommendedSlots}
          selectedDoctorId={bookingForm.watch('doctor_id')}
          watchedStart={watchedStart}
        />

        {/* Prerequisite Info Notice */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <i
            className="ph-fill ph-info"
            style={{ color: '#0284c7', fontSize: '1.2rem', marginTop: '2px', flexShrink: 0 }}
          />
          <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
            <strong>Prerequisite Notice:</strong> Creating a pending booking automatically generates
            the required procedure invoice. Consent documents, advance payment, and bed holds will be
            verified during the <strong>Confirmation</strong> step.
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              color: '#334155',
              display: 'block',
              marginBottom: '3px',
            }}
          >
            Booking Notes <span style={{ color: '#94a3b8' }}>(Optional)</span>
          </label>
          <textarea
            {...bookingForm.register('notes')}
            placeholder="Special requirements, surgical team notices..."
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
      </form>
    </Modal>
  );
}
