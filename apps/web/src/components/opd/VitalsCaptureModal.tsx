import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CreateOpdVitalsPayload, OpdVisitResponse } from '../../api/opd';
import { Modal } from '../ui/Modal';

const optionalNumber = z
  .string()
  .optional()
  .refine((value) => !value?.trim() || Number.isFinite(Number(value)), 'Enter a valid number');

const vitalsSchema = z
  .object({
    blood_pressure_systolic: optionalNumber,
    blood_pressure_diastolic: optionalNumber,
    weight_kg: optionalNumber,
    height_cm: optionalNumber,
    temperature_c: optionalNumber,
    pulse_bpm: optionalNumber,
    respiratory_rate_per_min: optionalNumber,
    oxygen_saturation_percent: optionalNumber,
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (values) => Boolean(values.blood_pressure_systolic?.trim()) === Boolean(values.blood_pressure_diastolic?.trim()),
    { message: 'Enter both systolic and diastolic blood pressure', path: ['blood_pressure_systolic'] },
  );

type VitalsFormValues = z.infer<typeof vitalsSchema>;

type Props = {
  error?: string;
  onClose: () => void;
  onSave: (payload: CreateOpdVitalsPayload) => Promise<void>;
  open: boolean;
  visit: OpdVisitResponse | null;
};

const toNumber = (value?: string) => (value?.trim() ? Number(value) : null);

export function VitalsCaptureModal({ error, onClose, onSave, open, visit }: Props) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      blood_pressure_systolic: '',
      blood_pressure_diastolic: '',
      weight_kg: '',
      height_cm: '',
      temperature_c: '',
      pulse_bpm: '',
      respiratory_rate_per_min: '',
      oxygen_saturation_percent: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset, visit?.id]);

  const submit = handleSubmit(async (values) => {
    await onSave({
      blood_pressure_systolic: toNumber(values.blood_pressure_systolic),
      blood_pressure_diastolic: toNumber(values.blood_pressure_diastolic),
      weight_kg: toNumber(values.weight_kg),
      height_cm: toNumber(values.height_cm),
      temperature_c: toNumber(values.temperature_c),
      pulse_bpm: toNumber(values.pulse_bpm),
      respiratory_rate_per_min: toNumber(values.respiratory_rate_per_min),
      oxygen_saturation_percent: toNumber(values.oxygen_saturation_percent),
      notes: values.notes?.trim() || null,
    });
  });

  return (
    <Modal
      footer={
        <>
          <button className="secondary-action" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
          <button className="primary-action" disabled={isSubmitting || !visit} onClick={() => void submit()} type="button">
            {isSubmitting ? 'Saving vitals...' : 'Save Vitals'}
          </button>
        </>
      }
      icon="ph-heartbeat"
      onClose={onClose}
      open={open}
      size="large"
      title="Record Clinical Vitals"
    >
      <form onSubmit={(event) => void submit(event)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {visit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
              {visit.patient_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: 700 }}>{visit.patient_name}</h4>
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>MRN: {visit.patient_number} · Visit: {visit.visit_number}</span>
            </div>
          </div>
        ) : null}

        {error ? <div className="form-error-banner" role="alert">{error}</div> : null}

        {/* 3-Group Vital Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {/* Group 1: Blood Pressure */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.75rem' }}>
              <i className="ph ph-heartbeat" style={{ fontSize: '1rem' }} /> Blood Pressure
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Systolic (mmHg)</label>
                <input id="vitals-systolic" placeholder="120" inputMode="decimal" {...register('blood_pressure_systolic')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                {errors.blood_pressure_systolic ? <span className="form-error" style={{ fontSize: '0.72rem', color: '#dc2626' }}>{errors.blood_pressure_systolic.message}</span> : null}
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Diastolic (mmHg)</label>
                <input id="vitals-diastolic" placeholder="80" inputMode="decimal" {...register('blood_pressure_diastolic')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                {errors.blood_pressure_diastolic ? <span className="form-error" style={{ fontSize: '0.72rem', color: '#dc2626' }}>{errors.blood_pressure_diastolic.message}</span> : null}
              </div>
            </div>
          </div>

          {/* Group 2: Pulse, SpO2, Respiratory */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.75rem' }}>
              <i className="ph ph-activity" style={{ fontSize: '1rem' }} /> Cardiopulmonary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Pulse (bpm)</label>
                  <input id="vitals-pulse" placeholder="72" inputMode="decimal" {...register('pulse_bpm')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>SpO₂ (%)</label>
                  <input id="vitals-spo2" placeholder="98" inputMode="decimal" {...register('oxygen_saturation_percent')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Resp. Rate (/min)</label>
                <input id="vitals-respiratory" placeholder="16" inputMode="decimal" {...register('respiratory_rate_per_min')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
              </div>
            </div>
          </div>

          {/* Group 3: Anthropometry & Temp */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#059669', marginBottom: '0.75rem' }}>
              <i className="ph ph-thermometer" style={{ fontSize: '1rem' }} /> Temperature & Body
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Temperature (°C)</label>
                <input id="vitals-temperature" placeholder="36.8" inputMode="decimal" step="0.1" {...register('temperature_c')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Weight (kg)</label>
                  <input id="vitals-weight" placeholder="70" inputMode="decimal" step="0.1" {...register('weight_kg')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>Height (cm)</label>
                  <input id="vitals-height" placeholder="170" inputMode="decimal" step="0.1" {...register('height_cm')} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Observations / Notes */}
        <div>
          <label htmlFor="vitals-notes" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
            Clinical Notes & Observations
          </label>
          <textarea
            id="vitals-notes"
            rows={2}
            placeholder="Any notable symptoms, posture, or observation..."
            {...register('notes')}
            style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px' }}
          />
        </div>
      </form>
    </Modal>
  );
}
