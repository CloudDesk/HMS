import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyWorkspaceProps, WorkspaceTab } from './types';
import { message } from './utils';

const id = z.string().min(1, 'Required');

const consultationSchema = z.object({
  doctor_id: id,
  chief_complaint: z.string().min(3),
  history: z.string().min(1),
  examination: z.string().min(1),
  diagnosis: z.string().min(1),
  plan: z.string().min(1),
  treatment: z.string(),
  notes: z.string(),
  ready_for_disposition: z.boolean(),
});

type ConsultationForm = z.infer<typeof consultationSchema>;

export type EmergencyConsultationSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  mutations: EmergencyWorkspaceProps['mutations'];
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyConsultationSection({ state, mutations, setActiveTab }: EmergencyConsultationSectionProps) {
  const selected = state.selected || state.encounters[0] || null;

  const consultation = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      doctor_id: '',
      chief_complaint: '',
      history: '',
      examination: '',
      diagnosis: '',
      plan: '',
      treatment: '',
      notes: '',
      ready_for_disposition: false,
    },
  });

  useEffect(() => {
    if (selected) {
      consultation.reset({
        doctor_id: selected.assigned_doctor_id ?? '',
        chief_complaint: selected.consultation?.chiefComplaint ?? selected.chief_complaint,
        history: selected.consultation?.history ?? '',
        examination: selected.consultation?.examination ?? '',
        diagnosis: selected.consultation?.diagnosis ?? '',
        plan: selected.consultation?.plan ?? '',
        treatment: selected.consultation?.treatment ?? '',
        notes: selected.consultation?.notes ?? '',
        ready_for_disposition: selected.status === 'READY_FOR_DISPOSITION',
      });
    }
  }, [selected, consultation]);

  const saveConsultation = consultation.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.consultation.mutateAsync({
        id: selected.id,
        body: { ...value, treatment: value.treatment || null, notes: value.notes || null },
      });
      toast.success('Doctor evaluation saved.');
      if (value.ready_for_disposition) setActiveTab('Disposition');
      else setActiveTab('Treatment');
    } catch (error) {
      toast.error(message(error));
    }
  });

  if (!selected) return null;

  return (
    <form onSubmit={saveConsultation}>
      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Consultation Details</h3>
            <p>Emergency clinical assessment</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Consultation Type</label>
            <select defaultValue="Emergency">
              <option>Emergency</option>
              <option>Trauma</option>
              <option>Pediatric</option>
              <option>Surgical</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Department</label>
            <select defaultValue="Emergency">
              <option>Emergency</option>
              <option>General Medicine</option>
              <option>Surgery</option>
              <option>Cardiology</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Attending Doctor <span style={{ color: '#dc2626' }}>*</span></label>
            <select {...consultation.register('doctor_id')}>
              <option value="">Select Doctor</option>
              {state.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Clinical History & Examination</h3>
            <p>Document the emergency presentation</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Chief Complaint</label>
            <textarea {...consultation.register('chief_complaint')} rows={3} />
          </div>
          <div className="doc-field">
            <label>History of Present Illness</label>
            <textarea {...consultation.register('history')} placeholder="Onset, duration, severity..." rows={3} />
          </div>
          <div className="doc-field">
            <label>Physical Examination</label>
            <textarea {...consultation.register('examination')} placeholder="Chest, abdomen, neuro findings..." rows={3} />
          </div>
          <div className="doc-field">
            <label>Working Diagnosis</label>
            <textarea {...consultation.register('diagnosis')} placeholder="e.g. Acute coronary syndrome / STEMI" rows={3} />
          </div>
          <div className="doc-field" style={{ gridColumn: 'span 2' }}>
            <label>Treatment Plan</label>
            <textarea {...consultation.register('plan')} placeholder="Stat medications, monitoring, investigations..." rows={3} />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" disabled={mutations.consultation.isPending} type="submit">
            {mutations.consultation.isPending ? 'Saving...' : 'Save Evaluation → Treatment'}
          </button>
        </div>
      </div>
    </form>
  );
}
