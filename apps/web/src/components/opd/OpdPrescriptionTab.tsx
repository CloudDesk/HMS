import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type OpdPrescriptionResponse } from '../../api/opd';

const prescriptionItemSchema = z.object({
  local_id: z.string(),
  medicine_name: z.string().min(1, "Medicine name is required"),
  strength: z.string().optional(),
  dosage: z.string().min(1, "Dosage is required"),
  route: z.string().min(1, "Route is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  quantity: z.string().optional(),
  intake_time: z.string().optional(),
  instructions: z.string().optional(),
});

const prescriptionSchema = z.object({
  items: z.array(prescriptionItemSchema),
  follow_up_date: z.string().optional(),
  doctor_instructions: z.string().optional(),
  patient_instructions: z.string().optional(),
});

export type PrescriptionForm = z.infer<typeof prescriptionSchema>;

interface OpdPrescriptionTabProps {
  onChange?: (data: PrescriptionForm) => void;
  prescription: OpdPrescriptionResponse | null;
  masterMedicines: Array<{ id: string; name: string; generic_name?: string; strength?: string; dosage_form?: string; unit?: string; available_quantity: number; }>;
  onSave: (data: PrescriptionForm) => void;
  isSaving: boolean;
  canEdit: boolean;
}

export function OpdPrescriptionTab({ prescription, masterMedicines, onSave, isSaving, canEdit, onChange }: OpdPrescriptionTabProps) {
  const { register, control, handleSubmit, reset, watch, formState: { isDirty } } = useForm<PrescriptionForm>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      items: prescription?.items?.map((i) => ({
        local_id: i.id,
        medicine_name: i.medicine_name,
        strength: i.strength ?? '',
        dosage: i.dosage,
        route: i.route,
        frequency: i.frequency,
        duration: i.duration,
        quantity: i.quantity?.toString() ?? '',
        intake_time: i.intake_time ?? '',
        instructions: i.instructions ?? '',
      })) ?? [],
      follow_up_date: prescription?.follow_up_date?.slice(0, 10) ?? '',
      doctor_instructions: prescription?.doctor_instructions ?? '',
      patient_instructions: prescription?.patient_instructions ?? '',
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  useEffect(() => {
    const sub = watch((value) => {
      if (onChange) onChange(value as PrescriptionForm);
    });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  useEffect(() => {
    if (prescription) {
      reset({
        items: prescription.items?.map(i => ({
          local_id: i.id,
          medicine_name: i.medicine_name,
          strength: i.strength ?? '',
          dosage: i.dosage,
          route: i.route,
          frequency: i.frequency,
          duration: i.duration,
          quantity: i.quantity?.toString() ?? '',
          intake_time: i.intake_time ?? '',
          instructions: i.instructions ?? '',
        })) ?? [],
        follow_up_date: prescription.follow_up_date?.slice(0, 10) ?? '',
        doctor_instructions: prescription.doctor_instructions ?? '',
        patient_instructions: prescription.patient_instructions ?? '',
      });
    }
  }, [prescription, reset]);

  return (
    <div className="doc-card">
      <div className="doc-card-header">
        <div>
          <h3>Prescription</h3>
          <p>Prescribe medications, dosage, and instructions.</p>
        </div>
        {canEdit && (
          <div className="doc-actions">
            <button className="doc-btn primary" disabled={isSaving || !isDirty} onClick={handleSubmit(onSave)} type="button">
              {isSaving ? 'Submitting...' : 'Submit Prescription'}
            </button>
          </div>
        )}
      </div>

      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th style={{ width: '80px' }}>Qty</th>
              <th>Intake Time</th>
              <th>Instructions</th>
              {canEdit && <th style={{ width: '50px' }} />}
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td className="um-state-cell" colSpan={canEdit ? 8 : 7}>
                  No medications prescribed yet.
                </td>
              </tr>
            ) : (
              fields.map((field, index) => (
                <tr key={field.local_id}>
                  <td>
                    {canEdit ? (
                      <select
                        className="inline-input"
                        {...register(`items.${index}.medicine_name`)}
                      >
                        <option value="">Select Medicine</option>
                        {masterMedicines.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="inline-input"
                        readOnly
                        {...register(`items.${index}.medicine_name`)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      readOnly={!canEdit}
                      {...register(`items.${index}.dosage`)}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      readOnly={!canEdit}
                      {...register(`items.${index}.frequency`)}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      readOnly={!canEdit}
                      {...register(`items.${index}.duration`)}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      readOnly={!canEdit}
                      type="number"
                      {...register(`items.${index}.quantity`)}
                    />
                  </td>
                  <td>
                    {canEdit ? (
                      <select
                        className="inline-input"
                        {...register(`items.${index}.intake_time`)}
                      >
                        <option value="">Select Time</option>
                        <option value="Before Food">Before Food</option>
                        <option value="After Food">After Food</option>
                        <option value="Empty Stomach">Empty Stomach</option>
                        <option value="At Bed Time">At Bed Time</option>
                      </select>
                    ) : (
                      <input
                        className="inline-input"
                        readOnly
                        {...register(`items.${index}.intake_time`)}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      readOnly={!canEdit}
                      {...register(`items.${index}.instructions`)}
                    />
                  </td>
                  {canEdit && (
                    <td>
                      <button className="doc-action error" onClick={() => remove(index)} type="button">
                        <i className="ph ph-trash" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div style={{ padding: '1rem' }}>
          <button
            className="doc-btn"
            onClick={() => append({ local_id: Date.now().toString(), medicine_name: '', dosage: '', route: 'Oral', frequency: '', duration: '', quantity: '', intake_time: '', instructions: '' })}
            type="button"
          >
            <i className="ph ph-plus" /> Add Medication
          </button>
        </div>
      )}

      <form className="doc-form-grid" style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
        <div className="form-group">
          <label htmlFor="follow_up_date">Follow-up Date</label>
          <input
            id="follow_up_date"
            readOnly={!canEdit}
            type="date"
            {...register('follow_up_date')}
          />
        </div>
        <div className="form-group full-width">
          <label htmlFor="patient_instructions">Patient Instructions</label>
          <textarea
            id="patient_instructions"
            placeholder="Instructions for the patient"
            readOnly={!canEdit}
            rows={3}
            {...register('patient_instructions')}
          />
        </div>
      </form>
    </div>
  );
}
