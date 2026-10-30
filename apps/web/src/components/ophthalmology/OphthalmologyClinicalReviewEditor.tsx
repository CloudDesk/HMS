import { confirmAction } from '../ui/confirm-action';
import { OphthalmologyEscalateModal } from './OphthalmologyEscalateModal';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { clinicalReviewWriteSchema, treatmentActionTypeSchema, treatmentWriteBaseSchema, type ClinicalReview } from '../../api/ophthalmology-care';
import type { OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { getEncounterDraft, setEncounterDraft, clearEncounterDraft, registerDraftSaveHandler } from '../../hooks/ophthalmology/encounter-draft-cache';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

const rowSchema = z.object({
  ...treatmentWriteBaseSchema.shape,
  action_type: z.union([treatmentActionTypeSchema, z.literal('')]),
  priority: z.union([treatmentWriteBaseSchema.shape.priority, z.literal('')]),
  status: z.union([treatmentWriteBaseSchema.shape.status, z.literal('')]),
  diagnosis_laterality: z.union([treatmentWriteBaseSchema.shape.diagnosis_laterality, z.literal('')]),
  legacy_category: z.string().nullable().optional(),
}).strict();

const editorSchema = z.object({
  ...clinicalReviewWriteSchema.shape,
  treatment_plans: z.array(rowSchema).max(100),
});

type Editor = z.infer<typeof editorSchema>;

function initial(record: ClinicalReview | null): Editor {
  return {
    expected_version: record?.version ?? 0,
    clinical_summary: record?.current.clinical_summary ?? '',
    follow_up_decision: record?.current.follow_up_decision ?? null,
    patient_instructions: record?.current.patient_instructions ?? null,
    treatment_plans: (record?.current.treatment_plans ?? []).map((plan) => ({
      diagnosis_code: plan.diagnosis_code,
      diagnosis_laterality: plan.diagnosis_laterality,
      treatment: plan.treatment,
      action_type: plan.action_type ?? '',
      legacy_category: plan.legacy_category,
      priority: plan.priority,
      status: plan.status,
      medication_prescription_id: plan.medication_prescription_id,
      optical_prescription_id: plan.optical_prescription_id,
      clinical_order_ids: plan.clinical_order_ids,
      procedure_recommendation_id: plan.procedure_recommendation_id,
      referral_id: plan.referral_id,
      follow_up_id: plan.follow_up_id,
    })),
  };
}

export type OpenProcedureModalOptions = {
  initialReason?: string;
  targetEye?: 'OD' | 'OS' | 'OU' | '';
  onCreated?: (created: { id: string }) => void;
};

export function OphthalmologyClinicalReviewEditor({
  feature: f,
  onOpenProcedureModal,
}: {
  feature: OphthalmologyCareFeature;
  onOpenProcedureModal?: (options?: OpenProcedureModalOptions) => void;
}) {
  const [escalationOpen, setEscalationOpen] = useState(false);
  const visitId = f.workspace?.visitId ?? '';
  const cachedDraft = typeof getEncounterDraft === 'function' ? getEncounterDraft<Editor>(visitId, 'clinical-review') : undefined;
  const [baseline, setBaseline] = useState(f.clinical);
  const { register, control, handleSubmit, setValue, setError, reset, getValues, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({
    resolver: zodResolver(editorSchema),
    defaultValues: cachedDraft ?? initial(baseline),
  });
  const rows = useFieldArray({ control, name: 'treatment_plans' });
  const watched = useWatch({ control, name: 'treatment_plans' });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'area']);

  const isRoutineBlocked = Boolean(
    f.workspace?.emergencyAlerts?.some(
      (a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED' || (a.status === 'CLEARED' && !a.clearance?.resumption_permitted)
    )
  );

  useEffect(() => {
    if (isDirty && typeof setEncounterDraft === 'function') {
      setEncounterDraft(visitId, 'clinical-review', getValues(), true);
    }
  }, [isDirty, getValues, visitId, watched]);

  useEffect(() => {
    if (typeof registerDraftSaveHandler !== 'function') return;
    return registerDraftSaveHandler('current', async () => {
      let saved = false;
      await handleSubmit(async (values) => {
        const treatmentPlans = values.treatment_plans.map((plan) => {
          if (!plan.diagnosis_laterality || !plan.status || !plan.action_type || !plan.priority) {
            return {
              ...plan,
              action_type: plan.action_type || 'OTHER',
              priority: plan.priority || 'ROUTINE',
              status: plan.status || 'PLANNED',
              diagnosis_laterality: plan.diagnosis_laterality || 'OU',
            };
          }
          return plan;
        });
        const body = clinicalReviewWriteSchema.parse({
          ...values,
          expected_version: baseline?.version ?? 0,
          treatment_plans: treatmentPlans,
        });
        const result = await f.saveClinical(body);
        if (result) {
          if (typeof clearEncounterDraft === 'function') clearEncounterDraft(visitId, 'clinical-review');
          setBaseline(result);
          reset(initial(result));
          saved = true;
        }
      })();
      if (!saved) throw new Error('Treatment review draft could not be saved.');
    });
  }, [handleSubmit, f, baseline?.version, reset, visitId]);

  const changed = (baseline?.version ?? 0) !== (f.clinical?.version ?? 0) || baseline?.id !== f.clinical?.id;
  const disabled = !f.canSaveClinical || f.busy || isSubmitting || changed;

  const clearReferences = (index: number) => {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    setValue(`treatment_plans.${index}.medication_prescription_id`, null, options);
    setValue(`treatment_plans.${index}.optical_prescription_id`, null, options);
    setValue(`treatment_plans.${index}.clinical_order_ids`, [], options);
    setValue(`treatment_plans.${index}.procedure_recommendation_id`, null, options);
    setValue(`treatment_plans.${index}.referral_id`, null, options);
    setValue(`treatment_plans.${index}.follow_up_id`, null, options);
    setValue(`treatment_plans.${index}.legacy_category`, null, options);
  };

  const getActionBadgeClass = (actionType?: string) => {
    switch (actionType) {
      case 'PROCEDURE': return 'oph-action-badge procedure';
      case 'MEDICATION': return 'oph-action-badge medication';
      case 'OPTICAL': return 'oph-action-badge optical';
      case 'INVESTIGATION': return 'oph-action-badge investigation';
      case 'REFERRAL': return 'oph-action-badge referral';
      case 'FOLLOW_UP': return 'oph-action-badge follow-up';
      default: return 'oph-action-badge other';
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<Editor>) => {
    const errorMessages: string[] = [];
    if (fieldErrors.clinical_summary?.message) {
      errorMessages.push(`Clinical Summary: ${fieldErrors.clinical_summary.message}`);
    }
    if (fieldErrors.treatment_plans) {
      if ('root' in fieldErrors.treatment_plans && fieldErrors.treatment_plans.root?.message) {
        errorMessages.push(fieldErrors.treatment_plans.root.message);
      } else if (Array.isArray(fieldErrors.treatment_plans)) {
        fieldErrors.treatment_plans.forEach((rowErr, idx) => {
          if (rowErr) {
            Object.values(rowErr).forEach((fErr) => {
              if (fErr && typeof fErr === 'object' && 'message' in fErr && typeof fErr.message === 'string') {
                errorMessages.push(`Plan #${idx + 1}: ${fErr.message}`);
              }
            });
          }
        });
      }
    }
    const message = errorMessages.length > 0 ? errorMessages.join(' · ') : 'Please check required fields in treatment plan.';
    setError('root', { message });
    toast.error(message);
  };

  return (
    <form
      className="doc-card oph-treatment-card-wrapper"
      onSubmit={handleSubmit(async (values) => {
        try {
          const blocked = values.treatment_plans.find((plan) =>
            ['PLANNED', 'ACTIVE'].includes(plan.status) &&
            f.diagnoses.some((diagnosis) =>
              diagnosis.code === plan.diagnosis_code &&
              (diagnosis.laterality ?? 'NOT_APPLICABLE') === plan.diagnosis_laterality &&
              diagnosis.status === 'RULED_OUT'
            )
          );
          if (blocked) {
            const msg = 'Planned or active treatment cannot use a ruled-out diagnosis. Update the action status or select a current diagnosis.';
            setError('root', { message: msg });
            toast.error(msg);
            return;
          }
          const treatmentPlans = values.treatment_plans.map(({ legacy_category, ...plan }) => {
            void legacy_category;
            return {
              ...plan,
              action_type: plan.action_type || 'OTHER',
              priority: plan.priority || 'ROUTINE',
              status: plan.status || 'PLANNED',
              diagnosis_laterality: plan.diagnosis_laterality || 'OU',
            };
          });
          const body = clinicalReviewWriteSchema.parse({
            ...values,
            expected_version: baseline?.version ?? 0,
            treatment_plans: treatmentPlans,
          });
          const saved = await f.saveClinical(body);
          if (saved) {
            if (typeof clearEncounterDraft === 'function') clearEncounterDraft(visitId, 'clinical-review');
            setBaseline(saved);
            reset(initial(saved));
            toast.success('Clinical review and treatment plan saved.');
          } else {
            const errorMsg = f.error || 'Failed to save clinical review. Please check entries.';
            setError('root', { message: errorMsg });
            toast.error(errorMsg);
          }
        } catch (error) {
          const msg = error instanceof z.ZodError
            ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ')
            : (error instanceof Error ? error.message : 'Check the treatment entries.');
          setError('root', { message: msg });
          toast.error(msg);
        }
      }, onInvalid)}
    >
            <div className="oph-diag-header">
        <div className="oph-diag-title-group">
          <div className="oph-diag-icon-badge treatment" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Ophthalmic treatment &amp; management plan
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Define clinical management strategy, interventions, medications, follow-up intervals, and patient education
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="oph-status-badge version">
            Draft v{baseline?.version ?? 0}
          </span>

          <button
            type="button"
            className="doc-btn"
            disabled={f.busy || f.clinicalQuery.isError}
            onClick={async () => {
              if (!isDirty || await confirmAction('Discard entered values and reload the latest saved review?')) {
                setBaseline(f.clinical);
                reset(initial(f.clinical));
              }
            }}
          >
            Reload Saved
          </button>

          {f.workspace?.canEscalate && (
            <button
              type="button"
              className="doc-btn"
              style={{ background: '#ffffff', color: '#dc2626', borderColor: '#fecaca', fontWeight: 600 }}
              disabled={f.busy}
              onClick={() => setEscalationOpen(true)}
            >
              <i className="ph ph-warning-bold" style={{ marginRight: '4px', color: '#dc2626' }} />
              Escalate Emergency
            </button>
          )}

          {f.workspace?.canClearEmergency && (f.workspace.emergencyAlerts?.some((a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED')) && (
            <button
              type="button"
              className="doc-btn"
              disabled={f.busy}
              onClick={() => {
                const alertToClear = f.workspace?.emergencyAlerts?.find((a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
                if (alertToClear) {
                  f.workspace?.setQuery('clear_alert_id', alertToClear.id);
                }
              }}
            >
              <i className="ph ph-check-circle" style={{ marginRight: '4px' }} />
              Clear Emergency
            </button>
          )}
        </div>
      </div>

      {changed && (
        <p role="alert" className="form-error-banner">
          The saved review changed in another session. Your entries remain here; review the latest record before saving.
        </p>
      )}
      <EditorErrors errors={errors} />

      <fieldset className="oph-fieldset" disabled={disabled}>
        {/* Treatment Plans List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rows.fields.length === 0 && (
            <div className="oph-empty-diagnoses-box">
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>
                No treatment plan actions added yet.
              </p>
              <p style={{ margin: '4px 0 12px', fontSize: '0.82rem', color: '#64748b' }}>
                Link specific interventions (procedures, medications, optical prescription, orders) to the patient&apos;s diagnoses.
              </p>
              <button
                type="button"
                className="doc-btn primary"
                disabled={!f.diagnoses.length}
                onClick={() => {
                  const firstDiag = f.diagnoses[0];
                  rows.append({
                    diagnosis_code: firstDiag?.code ?? '',
                    diagnosis_laterality: firstDiag?.laterality ?? 'NOT_APPLICABLE',
                    treatment: '',
                    action_type: 'PROCEDURE',
                    legacy_category: null,
                    priority: 'ROUTINE',
                    status: 'PLANNED',
                    medication_prescription_id: null,
                    optical_prescription_id: null,
                    clinical_order_ids: [],
                    procedure_recommendation_id: null,
                    referral_id: null,
                    follow_up_id: null,
                  });
                }}
              >
                + Add First Treatment Action
              </button>
            </div>
          )}

          {rows.fields.map((row, index) => {
            const currentPlan = watched[index];
            const actionType = currentPlan?.action_type ?? '';
            const isProcedure = actionType === 'PROCEDURE';
            const isOptical = actionType === 'OPTICAL';
            const isMedication = actionType === 'MEDICATION';
            const isInvestigation = actionType === 'INVESTIGATION';

            return (
              <section className="oph-treatment-row-card" key={row.id}>
                <div className="oph-treatment-row-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="oph-diag-index-badge">#{index + 1}</span>
                    <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>
                      Treatment Item #{index + 1}
                    </strong>
                    {actionType && (
                      <span className={getActionBadgeClass(actionType)}>
                        {actionType}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="oph-remove-diag-btn"
                    onClick={async () => {
                      if (await confirmAction('Remove this treatment row from the draft?')) {
                        rows.remove(index);
                      }
                    }}
                    title="Remove treatment row"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Remove
                  </button>
                </div>

                <div className="doc-form-grid two" style={{ marginTop: '0.75rem', gap: '12px' }}>
                  {/* Linked Diagnosis Selection */}
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Saved diagnosis and eye <span className="oph-required">*</span>
                    </span>
                    <select
                      value={`${currentPlan?.diagnosis_code ?? ''}:${currentPlan?.diagnosis_laterality ?? ''}`}
                      onChange={(event) => {
                        const selected = f.diagnoses.find(
                          (diagnosis) => `${diagnosis.code}:${diagnosis.laterality ?? 'NOT_APPLICABLE'}` === event.target.value
                        );
                        if (selected) {
                          setValue(`treatment_plans.${index}.diagnosis_code`, selected.code, { shouldDirty: true });
                          setValue(`treatment_plans.${index}.diagnosis_laterality`, selected.laterality ?? 'NOT_APPLICABLE', { shouldDirty: true });
                        }
                      }}
                    >
                      <option value=":">-- Select Diagnosed Condition --</option>
                      {row.diagnosis_code && !f.diagnoses.some((d) => d.code === row.diagnosis_code && (d.laterality ?? 'NOT_APPLICABLE') === row.diagnosis_laterality) && (
                        <option value={`${row.diagnosis_code}:${row.diagnosis_laterality}`}>
                          Saved {row.diagnosis_code} · {row.diagnosis_laterality} (prior version)
                        </option>
                      )}
                      {f.diagnoses.map((diagnosis) => (
                        <option key={`${diagnosis.code}:${diagnosis.laterality}`} value={`${diagnosis.code}:${diagnosis.laterality ?? 'NOT_APPLICABLE'}`}>
                          {diagnosis.code} — {diagnosis.display} ({diagnosis.laterality ?? 'OU'} · {diagnosis.status ?? 'CONFIRMED'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Action Type */}
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Action <span className="oph-required">*</span>
                    </span>
                    <select
                      {...register(`treatment_plans.${index}.action_type`, {
                        onChange: () => {
                          clearReferences(index);
                        },
                      })}
                    >
                      <option value="">-- Select Treatment Action --</option>
                      <option value="PROCEDURE">PROCEDURE — Surgery / Minor Ophthalmic Procedure</option>
                      <option value="MEDICATION">MEDICATION — Eye Drops / Oral Pharmacotherapy</option>
                      <option value="OPTICAL">OPTICAL — Spectacles / Contact Lenses</option>
                      <option value="INVESTIGATION">INVESTIGATION — Lab Test / Ocular Imaging / OCT</option>
                      <option value="REFERRAL">REFERRAL — Subspecialty / External Referral</option>
                      <option value="FOLLOW_UP">FOLLOW_UP — Clinic Review &amp; Re-assessment</option>
                      <option value="OTHER">OTHER — Supportive Care / Patient Counseling</option>
                    </select>
                  </label>

                  {/* Priority */}
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Priority <span className="oph-required">*</span>
                    </span>
                    <select {...register(`treatment_plans.${index}.priority`)}>
                      <option value="">Select Priority</option>
                      {treatmentWriteBaseSchema.shape.priority.options.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>

                  {/* Status */}
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Plan Status <span className="oph-required">*</span>
                    </span>
                    <select {...register(`treatment_plans.${index}.status`)}>
                      <option value="">Select Status</option>
                      {treatmentWriteBaseSchema.shape.status.options.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Treatment Details */}
                <div style={{ marginTop: '0.75rem' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Treatment Details &amp; Clinical Instructions <span className="oph-required">*</span>
                    </span>
                    <textarea
                      maxLength={4000}
                      rows={2}
                      {...register(`treatment_plans.${index}.treatment`)}
                      placeholder={
                        isProcedure
                          ? 'e.g. Right eye Phacoemulsification with posterior chamber intraocular lens (PCIOL) implantation under topical anesthesia...'
                          : isOptical
                          ? 'e.g. Single vision polycarbonate lenses for distance correction with anti-reflective coating...'
                          : isMedication
                          ? 'e.g. Carboxymethylcellulose 0.5% eye drops 1 drop 4 times daily for 30 days...'
                          : 'e.g. Full treatment details, instructions, and intended clinical outcomes...'
                      }
                      style={{ fontSize: '0.86rem' }}
                    />
                  </label>
                </div>

                {/* PROCEDURE SPECIFIC CALLOUT */}
                {isProcedure && (
                  <div className="oph-procedure-action-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="oph-proc-icon-circle">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="6" cy="6" r="3"></circle>
                            <circle cx="6" cy="18" r="3"></circle>
                            <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                            <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                            <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                          </svg>
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.88rem', color: '#1e1b4b' }}>
                            Surgery &amp; Procedure Recommendation
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#4338ca' }}>
                            Recommend surgical or in-office procedure for OT booking and pre-op clearance.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {currentPlan?.procedure_recommendation_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="oph-linked-badge">
                              ✓ Linked: {currentPlan.procedure_recommendation_id.slice(-8)}
                            </span>
                            <button
                              type="button"
                              className="doc-btn"
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                              onClick={() => setValue(`treatment_plans.${index}.procedure_recommendation_id`, null, { shouldDirty: true })}
                            >
                              Unlink
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="doc-btn primary"
                            style={{ fontSize: '0.8rem', padding: '6px 14px', background: '#4f46e5', borderColor: '#4338ca' }}
                            disabled={isRoutineBlocked}
                            title={isRoutineBlocked ? 'Procedure recommendations blocked during active emergency alert' : undefined}
                            onClick={() => {
                              const reason = currentPlan?.treatment ||
                                `${currentPlan?.diagnosis_code || 'Ophthalmic'} procedure (${currentPlan?.diagnosis_laterality || 'OU'})`;
                              const targetEye = (currentPlan?.diagnosis_laterality && ['OD', 'OS'].includes(currentPlan.diagnosis_laterality))
                                ? (currentPlan.diagnosis_laterality as 'OD' | 'OS')
                                : '';
                              onOpenProcedureModal?.({
                                initialReason: reason,
                                targetEye,
                                onCreated: (created) => {
                                  setValue(`treatment_plans.${index}.procedure_recommendation_id`, created.id, { shouldDirty: true, shouldValidate: true });
                                },
                              });
                            }}
                          >
                            + Recommend Procedure / Surgery Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTICAL SPECIFIC SHORTCUT */}
                {isOptical && (
                  <div className="oph-optical-action-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>👓</span>
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#0c4a6e' }}>
                            Optical Prescription Link
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#0369a1' }}>
                            Spectacle or contact lens prescription with sphere, cylinder, axis, and PD.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="doc-btn"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => f.workspace.setQuery('care_tab', 'optical')}
                      >
                        Open Optical Prescription Workspace →
                      </button>
                    </div>
                  </div>
                )}

                {/* MEDICATION SPECIFIC SHORTCUT */}
                {isMedication && (
                  <div className="oph-med-action-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>💊</span>
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#166534' }}>
                            Prescription Pharmacy Link
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#15803d' }}>
                            Submit drug prescriptions to pharmacy for dispensing and medication safety checks.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="doc-btn"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => f.openShared('Prescription', 'OPD Prescription')}
                      >
                        💊 Prescribe Medication →
                      </button>
                    </div>
                  </div>
                )}

                {/* INVESTIGATION SPECIFIC SHORTCUT */}
                {isInvestigation && (
                  <div className="oph-inv-action-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🔬</span>
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: '#854d0e' }}>
                            Diagnostic Investigation Orders
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#a16207' }}>
                            Order laboratory tests or ophthalmic imaging (OCT, Fundus photography, Visual field).
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="doc-btn"
                          style={{ fontSize: '0.76rem' }}
                          onClick={() => f.openShared('Lab Orders', 'OPD Clinical Orders')}
                        >
                          🔬 Order Lab
                        </button>
                        <button
                          type="button"
                          className="doc-btn"
                          style={{ fontSize: '0.76rem' }}
                          onClick={() => f.openShared('Imaging Orders', 'OPD Clinical Orders')}
                        >
                          📷 Order Imaging
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </section>
            );
          })}
        </div>

        {/* Add Treatment Action Button */}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="doc-btn"
            disabled={rows.fields.length >= 100 || !f.diagnoses.length}
            onClick={() => {
              const firstDiag = f.diagnoses[0];
              rows.append({
                diagnosis_code: firstDiag?.code ?? '',
                diagnosis_laterality: firstDiag?.laterality ?? 'NOT_APPLICABLE',
                treatment: '',
                action_type: '',
                legacy_category: null,
                priority: 'ROUTINE',
                status: 'PLANNED',
                medication_prescription_id: null,
                optical_prescription_id: null,
                clinical_order_ids: [],
                procedure_recommendation_id: null,
                referral_id: null,
                follow_up_id: null,
              });
            }}
          >
            + Add Another Treatment Plan Item
          </button>
          {!f.diagnoses.length && (
            <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#e11d48' }}>
              Please save at least one diagnosis above to link treatment actions.
            </span>
          )}
        </div>

        {/* Follow-up & Patient Instructions */}
        <div className="doc-form-grid two" style={{ marginTop: '1.25rem', gap: '12px' }}>
          <label className="doc-field">
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Follow-up Review Schedule</span>
            <select {...register('follow_up_decision', { setValueAs: (value: string) => value || null })}>
              <option value="">Select interval...</option>
              <option value="FOLLOW_UP_RECORDED">Follow-up recorded in shared encounter</option>
              <option value="NO_FOLLOW_UP">No follow-up required / routine review</option>
            </select>
          </label>
          <label className="doc-field">
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Patient Care &amp; Discharge Instructions</span>
            <textarea
              maxLength={4000}
              rows={2}
              {...register('patient_instructions', { setValueAs: (value: string) => value || null })}
              placeholder="e.g. Wear sunglasses outdoors; avoid rubbing eyes; return immediately if experiencing severe eye pain, sudden vision drop, or new floaters."
              style={{ fontSize: '0.84rem' }}
            />
          </label>
        </div>

        {/* Submit */}
        <div className="oph-toolbar" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button type="submit" className="doc-btn primary" disabled={disabled}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save treatment plan
          </button>
        </div>
      </fieldset>

      {f.error && (
        <p className="form-error-banner" role="alert" style={{ marginTop: '0.75rem' }}>
          {f.error} Your entered values are preserved.
        </p>
      )}

      {/* Saved Version History in collapsible accordion */}
      {f.clinical?.history && f.clinical.history.length > 0 && (
        <details className="oph-audit-accordion" style={{ marginTop: '1.5rem' }}>
          <summary className="oph-audit-summary">
            <span style={{ fontWeight: 600, fontSize: '0.86rem', color: '#475569' }}>
              📜 Treatment Plan Version History ({f.clinical.history.length} saved revisions)
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Click to view audit</span>
          </summary>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {f.clinical.history.map((entry) => (
              <div key={entry.clinical_version} style={{ padding: '8px 12px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>Version {entry.clinical_version}</strong>
                  <span style={{ color: '#64748b' }}>{new Date(entry.created_at).toLocaleString()} · {entry.created_by}</span>
                </div>
                <p style={{ margin: '2px 0 6px', color: '#334155' }}>{entry.clinical_summary}</p>
                {entry.treatment_plans.map((plan) => (
                  <div key={plan.id} style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '8px' }}>
                    • {plan.diagnosis_code} ({plan.diagnosis_laterality}) — {plan.action_type ?? 'Care Action'}: {plan.treatment} [{plan.status}]
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
      <OphthalmologyEscalateModal emergencyOnly open={escalationOpen} onClose={() => setEscalationOpen(false)}
        onEscalate={(reason, findings, urgency) => f.workspace?.escalate?.(
          reason, ['EXAMINATION_FINDING', ...(findings ?? [])], urgency ?? 'EMERGENCY'
        ) ?? Promise.resolve(undefined)} />
    </form>
  );
}
