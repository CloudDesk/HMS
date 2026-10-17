import { useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clinicalCorrectionWriteSchema, completeWriteSchema, consultationCorrectionWriteSchema, opticalCorrectionWriteSchema, reopenWriteSchema } from '../../api/ophthalmology-completion';
import type { ClinicalReview } from '../../api/ophthalmology-care';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
import { Modal } from '../ui/Modal';

type Action = 'complete' | 'reopen' | 'correct_consultation' | 'correct_clinical' | 'correct_optical';
const formSchema = z.object({
  reason: z.string().max(2000), assessment: z.string().max(10000), treatment_plan: z.string().max(10000), doctor_notes: z.string().max(10000),
  clinical_summary: z.string().max(10000), patient_instructions: z.string().max(4000),
  od_sphere: z.number().min(-40).max(40).nullable(), os_sphere: z.number().min(-40).max(40).nullable(), usage_instructions: z.string().max(2000),
});
type FormValues = z.infer<typeof formSchema>;
const writePlan = (plan: ClinicalReview['current']['treatment_plans'][number]) => ({
  diagnosis_code: plan.diagnosis_code, diagnosis_laterality: plan.diagnosis_laterality, treatment: plan.treatment,
  category: plan.category, priority: plan.priority, status: plan.status, medication_prescription_id: plan.medication_prescription_id,
  clinical_order_ids: plan.clinical_order_ids, procedure_recommendation_id: plan.procedure_recommendation_id,
  referral_id: plan.referral_id, follow_up_id: plan.follow_up_id,
});

export function OphthalmologyFinalizationDialog({ feature: f, action }: { feature: OphthalmologyCompletionFeature; action: Action }) {
  const summary = f.summary; const history = f.history; const readiness = f.readiness; const episode = f.openEpisode;
  const initial = useMemo<FormValues>(() => ({
    reason: '', assessment: summary?.consultation?.assessment ?? '', treatment_plan: summary?.consultation?.treatment_plan ?? '',
    doctor_notes: summary?.consultation?.doctor_notes ?? '', clinical_summary: summary?.clinical_review?.current.clinical_summary ?? '',
    patient_instructions: summary?.clinical_review?.current.patient_instructions ?? '',
    od_sphere: summary?.optical_prescription?.current.power.OD?.sphere ?? null,
    os_sphere: summary?.optical_prescription?.current.power.OS?.sphere ?? null,
    usage_instructions: summary?.optical_prescription?.current.usage_instructions ?? '',
  }), [summary]);
  const baseline = useRef({ finalization: history?.version, context: readiness?.context_version, consultation: summary?.consultation?.version,
    clinical: summary?.clinical_review?.version, optical: summary?.optical_prescription?.version, episode: episode?.id });
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isDirty, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: initial });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'completion_action']);
  const changed = baseline.current.finalization !== history?.version || baseline.current.context !== readiness?.context_version
    || baseline.current.consultation !== summary?.consultation?.version || baseline.current.clinical !== summary?.clinical_review?.version
    || baseline.current.optical !== summary?.optical_prescription?.version || baseline.current.episode !== episode?.id;
  const allowed = action === 'complete' ? f.completionAllowed : action === 'reopen' ? f.reopenAllowed : f.correctionAllowed;
  const close = () => { if (!f.busy && !isSubmitting) f.setQuery({ completion_action: null }); };
  const title = action === 'complete' ? history?.status === 'AMENDMENT_OPEN' ? 'Reapprove corrected consultation' : 'Complete ophthalmology consultation'
    : action === 'reopen' ? 'Reopen consultation for correction' : action === 'correct_consultation' ? 'Correct OPD consultation'
      : action === 'correct_clinical' ? 'Correct clinical review' : 'Correct optical prescription';
  return <Modal open size="large" className="oph-workspace" title={title} onClose={close} footer={<>
    <button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={close}>Cancel</button>
    <button type="submit" form="oph-finalization-action" className="doc-btn primary" disabled={!allowed || changed || f.busy || isSubmitting}>{action === 'complete' ? history?.status === 'AMENDMENT_OPEN' ? 'Reapprove' : 'Complete consultation' : action === 'reopen' ? 'Reopen' : 'Save correction'}</button>
  </>}>
    <p>Finalization version {baseline.current.finalization ?? 0}. The server revalidates permissions, scope, source versions and readiness inside the transaction.</p>
    {changed && <p role="alert">The saved clinical state changed. Your entries remain here; close and reopen this action after reviewing the refreshed records.</p>}
    <form id="oph-finalization-action" onSubmit={handleSubmit(async (values) => {
      if (!allowed || changed || baseline.current.finalization === undefined) return;
      try {
        const confirmed = window.confirm(action === 'complete' ? 'Approve this exact clinical summary and complete the consultation?' : action === 'reopen' ? 'Reopen this completed consultation for a controlled correction?' : 'Save this correction as a new authoritative source version?');
        if (!confirmed) return;
        let saved;
        if (action === 'complete') {
          if (!readiness || readiness.clinical_review_version === null) throw new Error('A current clinical review version is required.');
          const body = completeWriteSchema.parse({ expected_version: baseline.current.finalization, expected_context_version: readiness.context_version,
            expected_consultation_version: readiness.consultation_version, expected_clinical_review_version: readiness.clinical_review_version,
            expected_optical_prescription_version: readiness.optical_prescription_version });
          const signature = JSON.stringify(body); if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
          saved = await f.complete(body, attempt.current.key);
        } else if (action === 'reopen') saved = await f.reopen(reopenWriteSchema.parse({ expected_version: baseline.current.finalization, expected_status: 'COMPLETED', reason: values.reason }));
        else {
          if (!episode) throw new Error('An open correction episode is required.');
          const envelope = { expected_version: baseline.current.finalization, expected_status: 'AMENDMENT_OPEN' as const, episode_id: episode.id, reason: values.reason };
          if (action === 'correct_consultation') {
            if (!summary?.consultation) throw new Error('The authoritative OPD consultation is unavailable.');
            saved = await f.correctConsultation(consultationCorrectionWriteSchema.parse({ ...envelope, expected_source_version: summary.consultation.version,
              consultation: { assessment: values.assessment || null, treatment_plan: values.treatment_plan || null, doctor_notes: values.doctor_notes || null } }));
          } else if (action === 'correct_clinical') {
            if (!summary?.clinical_review) throw new Error('The authoritative clinical review is unavailable.');
            saved = await f.correctClinical(clinicalCorrectionWriteSchema.parse({ ...envelope, expected_source_version: summary.clinical_review.version,
              clinical_review: { clinical_summary: values.clinical_summary, treatment_plans: summary.clinical_review.current.treatment_plans.map(writePlan),
                follow_up_decision: summary.clinical_review.current.follow_up_decision, patient_instructions: values.patient_instructions || null } }));
          } else {
            if (!summary?.optical_prescription) throw new Error('An approved optical prescription is required for correction.');
            const current = summary.optical_prescription.current;
            saved = await f.correctOptical(opticalCorrectionWriteSchema.parse({ ...envelope, expected_source_version: summary.optical_prescription.version,
              optical_prescription: { prescription_type: current.prescription_type, power: {
                OD: current.power.OD ? { ...current.power.OD, sphere: values.od_sphere } : current.power.OD,
                OS: current.power.OS ? { ...current.power.OS, sphere: values.os_sphere } : current.power.OS,
              }, pupillary_distance: current.pupillary_distance, segment_height: current.segment_height, lens_type: current.lens_type,
              material: current.material, coating_codes: current.coating_codes, usage_instructions: values.usage_instructions,
              valid_until: current.valid_until, review_date: current.review_date } }));
          }
        }
        if (saved) close();
      } catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ') : error instanceof Error ? error.message : 'Check the correction.' }); }
    })}><EditorErrors errors={errors} />
      <fieldset className="oph-fieldset" disabled={!allowed || changed || f.busy || isSubmitting}>
        {action !== 'complete' && <label className="doc-field"><span>Reason <span className="oph-required">*</span></span><textarea maxLength={2000} {...register('reason')} /></label>}
        {action === 'complete' && <><p><strong>Readiness:</strong> {readiness?.ready ? 'All configured checks satisfied' : 'Authorized exact override recorded for current unmet checks'}.</p><p><strong>Assessment:</strong> {summary?.consultation?.assessment || 'Not recorded'}</p><p><strong>Clinical summary:</strong> {summary?.clinical_review?.current.clinical_summary || 'Not recorded'}</p><p>This approval does not publish records to the patient portal.</p></>}
        {action === 'reopen' && <p>Reopening creates an immutable correction episode. It does not alter the completed OPD visit or any source record by itself.</p>}
        {action === 'correct_consultation' && <><label className="doc-field">Assessment<textarea maxLength={10000} {...register('assessment')} /></label><label className="doc-field">Treatment plan<textarea maxLength={10000} {...register('treatment_plan')} /></label><label className="doc-field">Doctor notes<textarea maxLength={10000} {...register('doctor_notes')} /></label></>}
        {action === 'correct_clinical' && <><label className="doc-field"><span>Clinical summary <span className="oph-required">*</span></span><textarea maxLength={10000} {...register('clinical_summary')} /></label><label className="doc-field">Patient instructions<textarea maxLength={4000} {...register('patient_instructions')} /></label><p>Diagnosis-linked treatment plans and authoritative references are preserved from the selected source version.</p></>}
        {action === 'correct_optical' && <><div className="doc-form-grid two">{summary?.optical_prescription?.current.power.OD && <label className="doc-field">OD sphere<input type="number" step="any" {...register('od_sphere', { setValueAs: (value: string) => value === '' ? null : Number(value) })} /></label>}{summary?.optical_prescription?.current.power.OS && <label className="doc-field">OS sphere<input type="number" step="any" {...register('os_sphere', { setValueAs: (value: string) => value === '' ? null : Number(value) })} /></label>}</div><label className="doc-field"><span>Usage instructions <span className="oph-required">*</span></span><textarea maxLength={2000} {...register('usage_instructions')} /></label><p>The corrected prescription becomes a draft and must be approved in Optical Prescription before consultation reapproval.</p></>}
      </fieldset>{f.error && <p role="alert" className="form-error-banner">{f.error} Entries are retained. Refresh the saved state before retrying a conflict.</p>}
    </form>
  </Modal>;
}
