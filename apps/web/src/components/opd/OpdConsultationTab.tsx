import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type OpdConsultationResponse } from '../../api/opd';

const consultationSchema = z.object({
  chief_complaint: z.string().optional(),
  history_present_illness: z.string().optional(),
  past_history: z.string().optional(),
  family_history: z.string().optional(),
  allergies: z.string().optional(),
  physical_examination: z.string().optional(),
  assessment: z.string().optional(),
  treatment_plan: z.string().optional(),
  doctor_notes: z.string().optional(),
});

export type ConsultationForm = z.infer<typeof consultationSchema>;

interface OpdConsultationTabProps {
  consultation: OpdConsultationResponse | null;
  onSaveDraft: (data: ConsultationForm) => void;
  onComplete: (data: ConsultationForm) => void;
  isSaving: boolean;
  isCompleting: boolean;
  canEdit: boolean;
}

export function OpdConsultationTab({ consultation, onSaveDraft, onComplete, isSaving, isCompleting, canEdit }: OpdConsultationTabProps) {
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      chief_complaint: consultation?.chief_complaint ?? '',
      history_present_illness: consultation?.history_present_illness ?? '',
      past_history: consultation?.past_history ?? '',
      family_history: consultation?.family_history ?? '',
      allergies: consultation?.allergies ?? '',
      physical_examination: consultation?.physical_examination ?? '',
      assessment: consultation?.assessment ?? '',
      treatment_plan: consultation?.treatment_plan ?? '',
      doctor_notes: consultation?.doctor_notes ?? '',
    }
  });

  useEffect(() => {
    if (consultation) {
      reset({
        chief_complaint: consultation.chief_complaint ?? '',
        history_present_illness: consultation.history_present_illness ?? '',
        past_history: consultation.past_history ?? '',
        family_history: consultation.family_history ?? '',
        allergies: consultation.allergies ?? '',
        physical_examination: consultation.physical_examination ?? '',
        assessment: consultation.assessment ?? '',
        treatment_plan: consultation.treatment_plan ?? '',
        doctor_notes: consultation.doctor_notes ?? '',
      });
    }
  }, [consultation, reset]);

  return (
    <div className="doc-card">
      <div className="doc-card-header">
        <div>
          <h3>Clinical Consultation</h3>
          <p>Record subjective and objective findings, assessment, and care plan.</p>
        </div>
        {canEdit && (
          <div className="doc-actions">
            <button
              className="doc-btn"
              disabled={isSaving || isCompleting || !isDirty}
              onClick={handleSubmit(onSaveDraft)}
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              className="doc-btn success"
              disabled={isSaving || isCompleting}
              onClick={handleSubmit(onComplete)}
              type="button"
            >
              {isCompleting ? 'Completing...' : 'Complete Phase'}
            </button>
          </div>
        )}
      </div>
      <form className="doc-form-grid">
        <div className="form-group full-width">
          <label htmlFor="chief_complaint">Chief Complaint</label>
          <textarea
            id="chief_complaint"
            placeholder="Primary reason for visit"
            rows={2}
            readOnly={!canEdit}
            {...register('chief_complaint')}
          />
          {errors.chief_complaint && <span className="form-error">{errors.chief_complaint.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="history_present_illness">History of Present Illness (HPI)</label>
          <textarea
            id="history_present_illness"
            placeholder="Detailed description of the current issue"
            rows={4}
            readOnly={!canEdit}
            {...register('history_present_illness')}
          />
          {errors.history_present_illness && <span className="form-error">{errors.history_present_illness.message}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="past_history">Past Medical History</label>
          <textarea
            id="past_history"
            placeholder="Relevant past conditions and surgeries"
            rows={3}
            readOnly={!canEdit}
            {...register('past_history')}
          />
          {errors.past_history && <span className="form-error">{errors.past_history.message}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="family_history">Family History</label>
          <textarea
            id="family_history"
            placeholder="Relevant family conditions"
            rows={3}
            readOnly={!canEdit}
            {...register('family_history')}
          />
          {errors.family_history && <span className="form-error">{errors.family_history.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="allergies">Allergies</label>
          <textarea
            id="allergies"
            placeholder="Known drug or food allergies"
            rows={2}
            readOnly={!canEdit}
            {...register('allergies')}
          />
          {errors.allergies && <span className="form-error">{errors.allergies.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="physical_examination">Physical Examination</label>
          <textarea
            id="physical_examination"
            placeholder="Objective findings from physical exam"
            rows={4}
            readOnly={!canEdit}
            {...register('physical_examination')}
          />
          {errors.physical_examination && <span className="form-error">{errors.physical_examination.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="assessment">Assessment</label>
          <textarea
            id="assessment"
            placeholder="Clinical diagnosis and reasoning"
            rows={3}
            readOnly={!canEdit}
            {...register('assessment')}
          />
          {errors.assessment && <span className="form-error">{errors.assessment.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="treatment_plan">Treatment Plan</label>
          <textarea
            id="treatment_plan"
            placeholder="Proposed plan of care"
            rows={4}
            readOnly={!canEdit}
            {...register('treatment_plan')}
          />
          {errors.treatment_plan && <span className="form-error">{errors.treatment_plan.message}</span>}
        </div>
        <div className="form-group full-width">
          <label htmlFor="doctor_notes">Internal Notes</label>
          <textarea
            id="doctor_notes"
            placeholder="Private notes not printed on patient records"
            rows={2}
            readOnly={!canEdit}
            {...register('doctor_notes')}
          />
          {errors.doctor_notes && <span className="form-error">{errors.doctor_notes.message}</span>}
        </div>
      </form>
    </div>
  );
}
