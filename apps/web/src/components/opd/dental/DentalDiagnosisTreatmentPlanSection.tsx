import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Icd10Diagnosis } from '../../../data/icd10-diagnoses';
import type {
  DentalTreatmentPlanItem,
  OpdConsultationResponse,
  SaveOpdDentalExaminationPayload,
  ToothFinding,
} from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';
import type { DentalTreatmentBillingState } from '../../../api/billing';
import type { PatientResponse } from '../../../api/patients';
import {
  useCreateDentalEpisode,
  useOpdDentalExamination,
  usePatientDentalEpisodes,
  useSaveOpdDentalExaminationDraft,
} from '../../../hooks/opd/useOpd';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { DentalDiagnosisModal } from './DentalDiagnosisModal';
import { DentalTreatmentPlanSection } from './DentalTreatmentPlanSection';
import styles from './DentalExamination.module.css';

export interface DentalDiagnosisTreatmentPlanSectionProps {
  visitId: string;
  canEdit: boolean;
  consultation?: OpdConsultationResponse | null;
  patient?: PatientResponse | null;
  departmentServices?: ServiceResponse[];
  diagnoses?: Icd10Diagnosis[];
  onAddDiagnosis?: (dx: Icd10Diagnosis) => void;
  onRemoveDiagnosis?: (code: string, toothNumber?: number | null) => void;
  assessment?: string;
  onAssessmentChange?: (val: string) => void;
  onSaveDiagnosis?: () => Promise<void>;
  onNextStep?: (tab: string) => void;
  onCompleteExamination?: () => void;
  showToast?: (message: string, tone?: 'success' | 'error') => void;
  billingStates?: DentalTreatmentBillingState[];
  billingStateLoading?: boolean;
  billingStateError?: string;
  canCreateInvoice?: boolean;
  billingTreatmentItemPending?: string | null;
  onCreateInvoice?: (treatmentItemId: string) => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const DentalDiagnosisTreatmentPlanSection: React.FC<DentalDiagnosisTreatmentPlanSectionProps> = ({
  visitId,
  canEdit,
  consultation,
  patient,
  departmentServices = [],
  diagnoses = [],
  onAddDiagnosis,
  onRemoveDiagnosis,
  assessment = '',
  onAssessmentChange,
  onSaveDiagnosis,
  onNextStep,
  onCompleteExamination,
  showToast,
  billingStates = [],
  billingStateLoading = false,
  billingStateError = '',
  canCreateInvoice = false,
  billingTreatmentItemPending = null,
  onCreateInvoice,
  onOpenInvoice,
}) => {
  const { data: dentalExam, isLoading, isError, error, refetch } = useOpdDentalExamination(visitId);
  const saveDraftMutation = useSaveOpdDentalExaminationDraft({ notifyOnError: false, notifyOnSuccess: false });

  // Completing the oral examination locks charting, not the downstream diagnosis,
  // treatment-planning, and quotation workflow. Only the completed consultation
  // (or missing edit permission) makes this section read-only.
  const isReadOnly = !canEdit || consultation?.status === 'COMPLETED';
  const isSaving = saveDraftMutation.isPending;

  const [treatmentPlanItems, setTreatmentPlanItems] = useState<DentalTreatmentPlanItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  dirtyRef.current = isDirty;

  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [diagnosisModalTooth, setDiagnosisModalTooth] = useState<number | null>(null);

  const patientId = patient?.id;
  const { data: episodes = [] } = usePatientDentalEpisodes(patientId);
  const createEpisodeMutation = useCreateDentalEpisode();

  const [createEpisodeModalOpen, setCreateEpisodeModalOpen] = useState(false);
  const [newEpisodeTooth, setNewEpisodeTooth] = useState('');
  const [newEpisodeDiagnosis, setNewEpisodeDiagnosis] = useState('');
  const [newEpisodeNotes, setNewEpisodeNotes] = useState('');

  const formatCurrency = useCurrencyFormatter();

  const teeth: ToothFinding[] = useMemo(() => dentalExam?.teeth ?? [], [dentalExam?.teeth]);

  const totalPlanCost = useMemo(() => {
    return treatmentPlanItems.reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [treatmentPlanItems]);

  const medicalAlerts = useMemo(() => {
    return dentalExam?.dental_history?.medical_alerts ?? [];
  }, [dentalExam?.dental_history?.medical_alerts]);

  // Synchronize incoming data to controlled form state
  useEffect(() => {
    if (dentalExam && !dirtyRef.current) {
      loadedVersion.current = dentalExam.updated_at;
      if (dentalExam.treatment_plan_items) {
        setTreatmentPlanItems(dentalExam.treatment_plan_items);
      }
      setIsDirty(false);
    }
  }, [dentalExam]);

  const activeEpisodeId =
    dentalExam?.episode_id ??
    episodes.find((e) => e.status === 'ACTIVE')?.id ??
    episodes[0]?.id ??
    null;

  const buildPayload = (overrideEpisodeId?: string | null): SaveOpdDentalExaminationPayload => ({
    expected_updated_at: loadedVersion.current,
    episode_id: overrideEpisodeId !== undefined ? overrideEpisodeId : activeEpisodeId,
    dental_history: dentalExam?.dental_history ?? null,
    soft_tissue: dentalExam?.soft_tissue ?? null,
    teeth: teeth.map((t) => ({
      tooth_number: t.tooth_number,
      dentition: t.dentition,
      status: t.status,
      surfaces: t.surfaces ?? [],
      conditions: t.conditions ?? [],
      mobility: t.mobility ?? null,
      pocket_depth_mm: t.pocket_depth_mm ?? null,
      furcation_involvement: t.furcation_involvement ?? null,
      notes: t.notes?.trim() || null,
    })),
    treatment_plan_items: treatmentPlanItems.map((item) => ({
      ...(item.id && /^[a-f\d]{24}$/i.test(item.id) ? { id: item.id } : {}),
      service_id: item.service_id && /^[a-f\d]{24}$/i.test(item.service_id) ? item.service_id : null,
      tooth_number: item.tooth_number ?? null,
      procedure_name: item.procedure_name,
      surfaces: item.surfaces ?? [],
      priority: item.priority ?? 'ROUTINE',
      estimated_cost: item.estimated_cost ?? null,
      notes: item.notes?.trim() || null,
      status: item.status ?? 'PROPOSED',
    })),
  });

  const handleEnsureEpisode = useCallback(async (): Promise<string | null> => {
    const existingId =
      dentalExam?.episode_id ||
      episodes.find((e) => e.status === 'ACTIVE')?.id ||
      episodes[0]?.id;
    if (existingId) return existingId;

    if (!patientId || !visitId) return null;

    try {
      const primaryTooth = treatmentPlanItems[0]?.tooth_number ?? null;
      const toothDx = primaryTooth ? diagnoses.find((d) => d.tooth_number === primaryTooth) : null;
      const generalDx = diagnoses.find((d) => !d.tooth_number) || diagnoses[0];
      const initialDxName =
        toothDx?.name ||
        generalDx?.name ||
        treatmentPlanItems[0]?.procedure_name ||
        consultation?.chief_complaint ||
        'Dental Treatment Plan';

      const newEp = await createEpisodeMutation.mutateAsync({
        patient_id: patientId,
        originating_visit_id: visitId,
        primary_tooth_number: Number.isFinite(primaryTooth) ? primaryTooth : null,
        diagnosis_name: initialDxName,
        notes: 'Auto-created episode for treatment plan & quotation',
      });

      try {
        const payload = buildPayload(newEp.id);
        const saved = await saveDraftMutation.mutateAsync({ visitId, payload });
        loadedVersion.current = saved.updated_at;
      } catch {
        // Non-blocking if draft update fails
      }

      return newEp.id;
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
      return null;
    }
  }, [
    dentalExam?.episode_id,
    episodes,
    patientId,
    visitId,
    treatmentPlanItems,
    diagnoses,
    consultation?.chief_complaint,
    createEpisodeMutation,
    saveDraftMutation,
    showToast,
  ]);

  const handleTreatmentPlanChange = (items: DentalTreatmentPlanItem[]) => {
    setTreatmentPlanItems(items);
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    try {
      let currentEpisodeId = activeEpisodeId;
      if (!currentEpisodeId && treatmentPlanItems.length > 0 && patientId && visitId) {
        currentEpisodeId = (await handleEnsureEpisode()) ?? null;
      }
      const payload = buildPayload(currentEpisodeId);
      await onSaveDiagnosis?.();
      const saved = await saveDraftMutation.mutateAsync({ visitId, payload });
      loadedVersion.current = saved.updated_at;
      if (saved.treatment_plan_items) {
        setTreatmentPlanItems(saved.treatment_plan_items);
      }
      dirtyRef.current = false;
      setIsDirty(false);
      showToast?.('Dental diagnosis and treatment plan draft saved successfully.', 'success');
      return true;
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
      return false;
    }
  };

  const openCreateEpisodeModal = (toothNum?: number | null) => {
    const targetTooth = toothNum !== undefined ? toothNum : null;
    setNewEpisodeTooth(targetTooth ? String(targetTooth) : '');
    const toothDx = targetTooth ? diagnoses.find((d) => d.tooth_number === targetTooth) : null;
    const generalDx = diagnoses.find((d) => !d.tooth_number) || diagnoses[0];
    const initialDxName = toothDx?.name || generalDx?.name || consultation?.chief_complaint || '';
    setNewEpisodeDiagnosis(initialDxName);
    setNewEpisodeNotes('');
    setCreateEpisodeModalOpen(true);
  };

  const handleCreateEpisodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      showToast?.('Patient record is required to create a dental episode.', 'error');
      return;
    }
    try {
      const toothNum = newEpisodeTooth ? parseInt(newEpisodeTooth, 10) : null;
      await createEpisodeMutation.mutateAsync({
        patient_id: patientId,
        originating_visit_id: visitId,
        primary_tooth_number: Number.isFinite(toothNum) ? toothNum : null,
        diagnosis_name: newEpisodeDiagnosis.trim() || null,
        notes: newEpisodeNotes.trim() || null,
      });
      setCreateEpisodeModalOpen(false);
      showToast?.('Dental treatment episode initiated successfully.', 'success');
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <i
          className="ph ph-spinner ph-spin"
          style={{ fontSize: '2rem', color: '#2563eb', display: 'block', marginBottom: '12px' }}
        />
        Loading Dental Diagnosis &amp; Treatment Plan...
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#dc2626' }}>
        <i className="ph ph-warning-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }} />
        Failed to load dental diagnosis and treatment plan.
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
          {getOpdErrorMessage(error)}
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ marginTop: '16px' }}
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 1. Clinical Relationship Card: Tooth | Examination | Diagnosis | Treatment Plan */}
      <section className={`${styles.consultationContext} ${styles.clinicalRelationshipCard}`} aria-label="Dental clinical relationship">
        <div className={styles.clinicalRelationshipHeader}>
          <div className={styles.clinicalRelationshipHeading}>
            <span className={styles.clinicalRelationshipIcon} aria-hidden="true">↗</span>
            <div>
              <h3>Diagnosis &amp; Treatment Plan</h3>
              <p>Linked by FDI tooth number</p>
            </div>
          </div>
          <div>
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              onClick={() => {
                setDiagnosisModalTooth(null);
                setDiagnosisModalOpen(true);
              }}
              disabled={isReadOnly}
            >
              <i className="ph ph-plus" /> Add / Edit Diagnosis
            </button>
          </div>
        </div>

        <div className={styles.compactPlanTableWrapper}>
          <table className={styles.compactPlanTable}>
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Tooth</th>
                <th style={{ width: '28%' }}>Examination</th>
                <th style={{ width: '28%' }}>Diagnosis</th>
                <th style={{ width: '32%' }}>Treatment Plan</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const uniqueToothNumbers = Array.from(
                  new Set([
                    ...teeth.map((tooth) => tooth.tooth_number),
                    ...diagnoses.flatMap((dx) => (dx.tooth_number ? [dx.tooth_number] : [])),
                    ...treatmentPlanItems.flatMap((item) => (item.tooth_number ? [item.tooth_number] : [])),
                  ]),
                ).sort((a, b) => a - b);

                if (uniqueToothNumbers.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} className={styles.emptyTableState}>
                        No tooth-level examination findings, diagnoses, or treatment plans recorded.
                      </td>
                    </tr>
                  );
                }

                return uniqueToothNumbers.map((number) => {
                  const finding = teeth.find((tooth) => tooth.tooth_number === number);
                  const toothDiagnoses = diagnoses.filter((dx) => dx.tooth_number === number);
                  const plannedItems = treatmentPlanItems.filter((item) => item.tooth_number === number);

                  const formatStatusBadge = (status?: string) => {
                    const s = (status ?? 'PROPOSED').toUpperCase();
                    let badgeStyle = styles.planStatusProposed;
                    let label = 'Proposed';
                    if (s === 'ACCEPTED') {
                      badgeStyle = styles.planStatusAccepted;
                      label = 'Accepted';
                    } else if (s === 'IN_PROGRESS') {
                      badgeStyle = styles.planStatusInProgress;
                      label = 'In Progress';
                    } else if (s === 'COMPLETED') {
                      badgeStyle = styles.planStatusCompleted;
                      label = 'Completed';
                    } else if (s === 'DECLINED' || s === 'CANCELLED') {
                      badgeStyle = styles.planStatusCancelled;
                      label = s === 'DECLINED' ? 'Declined' : 'Cancelled';
                    }
                    return <span className={`${styles.planStatusBadge} ${badgeStyle}`}>({label})</span>;
                  };

                  const formatConditionName = (cond: string) => {
                    if (!cond) return '';
                    return cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase().replace(/_/g, ' ');
                  };

                  const conditionsText =
                    finding?.conditions && finding.conditions.length > 0
                      ? finding.conditions.map(formatConditionName).join(', ')
                      : finding
                        ? 'Examined'
                        : '—';

                  const diagnosisText =
                    toothDiagnoses.length > 0
                      ? toothDiagnoses.map((dx) => (dx.code ? `${dx.code} — ${dx.name}` : dx.name)).join('; ')
                      : '—';

                  return (
                    <tr key={number}>
                      <td className={styles.toothNumberCell}>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            cursor: isReadOnly ? 'default' : 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onClick={() => {
                            if (!isReadOnly) {
                              setDiagnosisModalTooth(number);
                              setDiagnosisModalOpen(true);
                            }
                          }}
                          title={isReadOnly ? `Tooth #${number}` : `Edit diagnosis for Tooth #${number}`}
                        >
                          #{number}
                          {!isReadOnly && <i className="ph ph-pencil-simple" style={{ fontSize: '0.72rem' }} />}
                        </button>
                      </td>
                      <td>{conditionsText}</td>
                      <td>
                        {toothDiagnoses.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {toothDiagnoses.map((dx) => (
                              <div key={dx.code} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{dx.code ? `${dx.code} — ${dx.name}` : dx.name}</span>
                                {!isReadOnly && onRemoveDiagnosis && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveDiagnosis(dx.code, number)}
                                    title={`Remove diagnosis ${dx.code} for Tooth #${number}`}
                                    aria-label={`Remove diagnosis ${dx.code} for Tooth #${number}`}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      padding: '1px 3px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      borderRadius: '3px',
                                    }}
                                  >
                                    <i className="ph ph-trash" style={{ fontSize: '0.8rem' }} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {plannedItems.length > 0 ? (
                          <div className={styles.plannedItemsCell}>
                            {plannedItems.map((item, idx) => (
                              <div key={item.id ?? idx} className={styles.plannedItemRow}>
                                <span>{item.procedure_name}</span>
                                {formatStatusBadge(item.status)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.textMuted}>Not planned</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        <div className={styles.generalDiagnosisRow}>
          <span>General / Full Mouth: </span>
          {diagnoses.filter((dx) => !dx.tooth_number).length > 0 ? (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {diagnoses
                .filter((dx) => !dx.tooth_number)
                .map((dx) => (
                  <span
                    key={dx.code}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <strong>{dx.code ? `${dx.code} — ${dx.name}` : dx.name}</strong>
                    {!isReadOnly && onRemoveDiagnosis && (
                      <button
                        type="button"
                        onClick={() => onRemoveDiagnosis(dx.code, null)}
                        title={`Remove ${dx.code}`}
                        aria-label={`Remove ${dx.code}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <i className="ph ph-x" style={{ fontSize: '0.82rem' }} />
                      </button>
                    )}
                  </span>
                ))}
            </div>
          ) : (
            <strong>No general diagnosis recorded</strong>
          )}
          {!isReadOnly && (
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '3px 8px' }}
              onClick={() => {
                setDiagnosisModalTooth(null);
                setDiagnosisModalOpen(true);
              }}
            >
              Edit General Diagnosis
            </button>
          )}
        </div>
      </section>

      {/* 2. Dental Treatment Plan Section (Procedures choosing retrieved from Service Catalogue, Stages, Quotations, Invoicing) */}
      <DentalTreatmentPlanSection
        items={treatmentPlanItems}
        teeth={teeth}
        onChange={handleTreatmentPlanChange}
        disabled={isReadOnly}
        departmentServices={departmentServices}
        billingStates={billingStates}
        billingStateLoading={billingStateLoading}
        billingStateError={billingStateError}
        canCreateInvoice={canCreateInvoice}
        billingBlockedByUnsavedChanges={isDirty}
        billingTreatmentItemPending={billingTreatmentItemPending}
        onCreateInvoice={onCreateInvoice}
        onOpenInvoice={onOpenInvoice}
        patientId={patientId}
        visitId={visitId}
        episodes={episodes}
        episodeId={activeEpisodeId}
        departmentId={dentalExam?.department_id ?? null}
        onStartEpisode={openCreateEpisodeModal}
        onEnsureEpisode={handleEnsureEpisode}
        patientName={
          patient
            ? [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.patient_number
            : undefined
        }
        episodeNumber={episodes.find((e) => e.id === activeEpisodeId)?.episode_number ?? episodes[0]?.episode_number}
        primaryToothNumber={episodes.find((e) => e.id === activeEpisodeId)?.primary_tooth_number ?? episodes[0]?.primary_tooth_number}
      />

      {/* 3. Action Strip at Bottom of Page */}
      <div className={styles.subTabActionBar} style={{ marginTop: '1.25rem' }}>
        <div className={styles.stickySummary}>
          {teeth.length > 0 && (
            <span className={styles.stickyMetric}>
              <i className="ph ph-tooth" style={{ color: '#2563eb' }} />
              Examined Teeth: <strong>{teeth.length}</strong>
            </span>
          )}
          <span className={styles.stickyMetric}>
            <i className="ph ph-calendar-check" style={{ color: '#7c3aed' }} />
            Procedures: <strong>{treatmentPlanItems.length}</strong>
          </span>
          {totalPlanCost > 0 && (
            <span className={styles.stickyMetric}>
              <i className="ph ph-receipt" style={{ color: '#059669' }} />
              Est. Total: <strong>{formatCurrency(totalPlanCost)}</strong>
            </span>
          )}
          {medicalAlerts.length > 0 && (
            <span className={styles.stickyMetricAlert}>
              <i className="ph ph-warning-octagon" />
              {medicalAlerts.length} Alert{medicalAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className={styles.stickyActions}>
          {!isReadOnly && onCompleteExamination ? (
            <button
              type="button"
              className={styles.btnComplete}
              onClick={onCompleteExamination}
              disabled={isSaving}
            >
              <i className="ph ph-check-circle" />
              Complete Examination
            </button>
          ) : null}
          {!isReadOnly && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              <i className="ph ph-floppy-disk" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
          )}

          <button
            type="button"
            className={styles.btnSecondary}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: '#0284c7',
              color: '#0284c7',
              background: '#f0f9ff',
            }}
            onClick={async () => {
              if (isDirty && !isReadOnly) {
                const saved = await handleSaveDraft();
                if (!saved) return;
              }
              onNextStep?.('Imaging Orders');
            }}
            disabled={isSaving}
            title="Order dental imaging / X-rays (IOPA, Bitewing, OPG, CBCT)"
            data-testid="direct-order-imaging-btn"
          >
            <i className="ph ph-camera" />
            Order Imaging (X-Ray)
          </button>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={async () => {
              if (isDirty && !isReadOnly) {
                const saved = await handleSaveDraft();
                if (!saved) return;
              }
              onNextStep?.('Prescription');
            }}
            disabled={isSaving}
          >
            Next: Prescription
            <i className="ph ph-arrow-right" />
          </button>
        </div>
      </div>

      {/* Diagnosis Modal */}
      <DentalDiagnosisModal
        open={diagnosisModalOpen}
        onClose={() => setDiagnosisModalOpen(false)}
        selectedToothNumber={diagnosisModalTooth}
        diagnoses={diagnoses}
        onAddDiagnosis={onAddDiagnosis}
        onRemoveDiagnosis={onRemoveDiagnosis}
        canEdit={!isReadOnly}
        assessment={assessment}
        onAssessmentChange={onAssessmentChange}
        showToast={showToast}
      />

      {/* Create Treatment Episode Modal */}
      {createEpisodeModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="create-episode-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 id="create-episode-title" className={styles.modalTitle}>
                <i className="ph ph-folder-plus" style={{ color: '#2563eb' }} />
                Start Dental Treatment Episode
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setCreateEpisodeModalOpen(false)}
                aria-label="Close"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <form onSubmit={handleCreateEpisodeSubmit}>
              <div className={styles.modalBody}>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                  Initiate a multi-visit dental treatment journey. All subsequent follow-up visits can be linked to this episode to track cumulative findings and treatment stages.
                </p>

                <div className={styles.modalFormGroup}>
                  <label htmlFor="ep-tooth" className={styles.modalFormLabel}>
                    Primary Affected Tooth (FDI Number, Optional)
                  </label>
                  <input
                    id="ep-tooth"
                    type="number"
                    min="11"
                    max="85"
                    placeholder="e.g. 16, 21, 36, 46"
                    className={styles.modalInput}
                    value={newEpisodeTooth}
                    onChange={(e) => setNewEpisodeTooth(e.target.value)}
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label htmlFor="ep-diagnosis" className={styles.modalFormLabel}>
                    Primary Diagnosis / Clinical Focus
                  </label>
                  <input
                    id="ep-diagnosis"
                    type="text"
                    placeholder="e.g. Irreversible Pulpitis, Root Canal Treatment"
                    className={styles.modalInput}
                    value={newEpisodeDiagnosis}
                    onChange={(e) => setNewEpisodeDiagnosis(e.target.value)}
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label htmlFor="ep-notes" className={styles.modalFormLabel}>
                    Episode Plan &amp; Notes (Optional)
                  </label>
                  <textarea
                    id="ep-notes"
                    rows={3}
                    placeholder="Overall treatment goals, multi-stage notes..."
                    className={styles.modalInput}
                    value={newEpisodeNotes}
                    onChange={(e) => setNewEpisodeNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setCreateEpisodeModalOpen(false)}
                  disabled={createEpisodeMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimaryGradient}
                  disabled={createEpisodeMutation.isPending}
                >
                  <i className="ph ph-check" />
                  {createEpisodeMutation.isPending ? 'Creating Episode...' : 'Create Episode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
