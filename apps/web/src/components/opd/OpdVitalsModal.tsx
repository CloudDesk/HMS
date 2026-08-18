import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { type OpdVisitResponse } from '../../api/opd';

const vitalsSchema = z.object({
  blood_pressure_systolic: z.string().optional(),
  blood_pressure_diastolic: z.string().optional(),
  weight_kg: z.string().optional(),
  height_cm: z.string().optional(),
  temperature_c: z.string().optional(),
  pulse_bpm: z.string().optional(),
  respiratory_rate_per_min: z.string().optional(),
  oxygen_saturation_percent: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if ((data.blood_pressure_systolic && !data.blood_pressure_diastolic) || (!data.blood_pressure_systolic && data.blood_pressure_diastolic)) {
    return false;
  }
  return true;
}, {
  message: "Both systolic and diastolic BP must be provided together",
  path: ["blood_pressure_systolic"]
});

export type VitalsForm = z.infer<typeof vitalsSchema>;

interface OpdVitalsModalProps {
  open: boolean;
  onClose: () => void;
  visit: OpdVisitResponse | null;
  initialData: any;
  onSave: (data: VitalsForm) => void;
  isSaving: boolean;
}

export function OpdVitalsModal({ open, onClose, visit, initialData, onSave, isSaving }: OpdVitalsModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<VitalsForm>({
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
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        blood_pressure_systolic: initialData.blood_pressure_systolic?.toString() ?? '',
        blood_pressure_diastolic: initialData.blood_pressure_diastolic?.toString() ?? '',
        weight_kg: initialData.weight_kg?.toString() ?? '',
        height_cm: initialData.height_cm?.toString() ?? '',
        temperature_c: initialData.temperature_c?.toString() ?? '',
        pulse_bpm: initialData.pulse_bpm?.toString() ?? '',
        respiratory_rate_per_min: initialData.respiratory_rate_per_min?.toString() ?? '',
        oxygen_saturation_percent: initialData.oxygen_saturation_percent?.toString() ?? '',
        notes: initialData.notes ?? '',
      });
    }
  }, [initialData, reset]);

  return (
    <Modal
      footer={
        <>
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-action" disabled={isSaving} onClick={handleSubmit(onSave)} type="button">
            {isSaving ? 'Saving...' : 'Save Vitals'}
          </button>
        </>
      }
      icon="ph-heartbeat"
      onClose={onClose}
      open={open}
      title={`Record Vitals - ${visit?.patient_name ?? ''}`}
    >
      <form onSubmit={handleSubmit(onSave)}>
        <div className="walk-in-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="form-group">
            <label htmlFor="sys-bp">Systolic BP (mmHg)</label>
            <input
              id="sys-bp"
              placeholder="120"
              type="number"
              {...register('blood_pressure_systolic')}
            />
            {errors.blood_pressure_systolic && <span className="form-error">{errors.blood_pressure_systolic.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="dia-bp">Diastolic BP (mmHg)</label>
            <input
              id="dia-bp"
              placeholder="80"
              type="number"
              {...register('blood_pressure_diastolic')}
            />
            {errors.blood_pressure_diastolic && <span className="form-error">{errors.blood_pressure_diastolic.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="pulse">Pulse Rate (bpm)</label>
            <input
              id="pulse"
              placeholder="72"
              type="number"
              {...register('pulse_bpm')}
            />
            {errors.pulse_bpm && <span className="form-error">{errors.pulse_bpm.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="temp">Temperature (°C)</label>
            <input
              id="temp"
              placeholder="36.8"
              step="0.1"
              type="number"
              {...register('temperature_c')}
            />
            {errors.temperature_c && <span className="form-error">{errors.temperature_c.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="spo2">SpO₂ (%)</label>
            <input
              id="spo2"
              placeholder="98"
              type="number"
              {...register('oxygen_saturation_percent')}
            />
            {errors.oxygen_saturation_percent && <span className="form-error">{errors.oxygen_saturation_percent.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="resp">Resp. Rate (min)</label>
            <input
              id="resp"
              placeholder="16"
              type="number"
              {...register('respiratory_rate_per_min')}
            />
            {errors.respiratory_rate_per_min && <span className="form-error">{errors.respiratory_rate_per_min.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="weight">Weight (kg)</label>
            <input
              id="weight"
              placeholder="70"
              step="0.1"
              type="number"
              {...register('weight_kg')}
            />
            {errors.weight_kg && <span className="form-error">{errors.weight_kg.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="height">Height (cm)</label>
            <input
              id="height"
              placeholder="170"
              step="0.1"
              type="number"
              {...register('height_cm')}
            />
            {errors.height_cm && <span className="form-error">{errors.height_cm.message}</span>}
          </div>
          <div className="form-group full-width">
            <label htmlFor="vitals-notes">Clinical Notes</label>
            <textarea
              id="vitals-notes"
              placeholder="Any additional observations..."
              rows={3}
              {...register('notes')}
            />
            {errors.notes && <span className="form-error">{errors.notes.message}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
