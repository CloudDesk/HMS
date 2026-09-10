import React, { useEffect, useRef, useState } from 'react';
import type { Icd10Diagnosis } from '../../../data/icd10-diagnoses';
import type {
  DentalHistory,
  DentalTreatmentPlanItem,
  OpdConsultationResponse,
  OpdDentalExaminationResponse,
  SaveOpdDentalExaminationPayload,
  SoftTissueExamination,
  ToothFinding,
} from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';
import type { DentalTreatmentBillingState } from '../../../api/billing';
import {
  useCompleteOpdDentalExamination,
  useOpdDentalExamination,
  useSaveOpdDentalExaminationDraft,
} from '../../../hooks/opd/useOpd';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { DentalHistorySection } from './DentalHistorySection';
import { DentalSoftTissueSection } from './DentalSoftTissueSection';
import { DentalTreatmentPlanSection } from './DentalTreatmentPlanSection';
import { OdontogramChart } from './OdontogramChart';
import { ToothAffectedSurfaces, ToothExaminationPanel } from './ToothExaminationPanel';
import styles from './DentalExamination.module.css';

interface OpdDentalExaminationTabProps {
  visitId: string;
  canEdit: boolean;
  showToast?: (message: string, tone?: 'success' | 'error') => void;
  consultation?: OpdConsultationResponse | null;
  departmentServices?: ServiceResponse[];
  diagnoses?: Icd10Diagnosis[];
  onOpenDiagnosis?: (tooth: number | null) => void;
  onCompletedChange?: (completed: boolean) => void;
  onSaveDiagnosis?: () => Promise<void>;
  billingStates?: DentalTreatmentBillingState[];
  billingStateLoading?: boolean;
  billingStateError?: string;
  canCreateInvoice?: boolean;
  billingTreatmentItemPending?: string | null;
  onCreateInvoice?: (treatmentItemId: string) => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const OpdDentalExaminationTab: React.FC<OpdDentalExaminationTabProps> = ({
  visitId,
  canEdit,
  showToast,
  consultation,
  departmentServices = [],
  diagnoses = [],
  onOpenDiagnosis,
  onCompletedChange,
  onSaveDiagnosis,
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
  const completeMutation = useCompleteOpdDentalExamination({ notifyOnError: false, notifyOnSuccess: false });

  const [selectedToothNumber, setSelectedToothNumber] = useState<number | null>(null);
  const [dentalHistory, setDentalHistory] = useState<DentalHistory>({
    chief_complaint: '',
    pain_scale: null,
    bleeding_gums: null,
    sensitivity_hot_cold_sweet: null,
    bruxism: null,
    habits: [],
    medical_alerts: [],
  });
  const [softTissue, setSoftTissue] = useState<SoftTissueExamination>({
    gingiva_condition: null,
    calculus_plaque: null,
    oral_mucosa: null,
    tongue_palate_floor: null,
    tmj_evaluation: null,
    occlusion_class: null,
  });
  const [teeth, setTeeth] = useState<ToothFinding[]>([]);
  const [treatmentPlanItems, setTreatmentPlanItems] = useState<DentalTreatmentPlanItem[]>([]);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  dirtyRef.current = isDirty;

  // Synchronize incoming data to controlled form state
  useEffect(() => {
    if (dentalExam && !dirtyRef.current) {
      loadedVersion.current = dentalExam.updated_at;
      if (dentalExam.dental_history) {
        setDentalHistory(dentalExam.dental_history);
      }
      if (dentalExam.soft_tissue) {
        setSoftTissue(dentalExam.soft_tissue);
      }
      if (dentalExam.teeth) {
        setTeeth(dentalExam.teeth);
      }
      if (dentalExam.treatment_plan_items) {
        setTreatmentPlanItems(dentalExam.treatment_plan_items);
      }
      setIsDirty(false);
    }
  }, [dentalExam]);

  const isCompleted = dentalExam?.status === 'COMPLETED';
  const isReadOnly = !canEdit || isCompleted;
  const isSaving = saveDraftMutation.isPending || completeMutation.isPending;
  const controlsDisabled = isReadOnly || isSaving;

  useEffect(() => { onCompletedChange?.(Boolean(isCompleted)); }, [isCompleted, onCompletedChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    const beforeNavigation = (event: Event) => {
      if (!dirtyRef.current || !(event instanceof CustomEvent)) return;
      const destination = new URL(event.detail.to, window.location.href);
      if (destination.pathname === '/opd/consultation' && destination.searchParams.get('id') === visitId) return;
      if (!window.confirm('Discard unsaved dental examination changes and leave this visit?')) event.preventDefault();
    };
    window.addEventListener('hms:before-navigation', beforeNavigation);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('hms:before-navigation', beforeNavigation);
    };
  }, [visitId]);

  const buildPayload = (): SaveOpdDentalExaminationPayload => ({
    expected_updated_at: loadedVersion.current,
    dental_history: {
      chief_complaint: dentalHistory.chief_complaint?.trim() || null,
      pain_scale: dentalHistory.pain_scale ?? null,
      bleeding_gums: dentalHistory.bleeding_gums ?? null,
      sensitivity_hot_cold_sweet: dentalHistory.sensitivity_hot_cold_sweet ?? null,
      bruxism: dentalHistory.bruxism ?? null,
      habits: dentalHistory.habits ?? [],
      medical_alerts: dentalHistory.medical_alerts ?? [],
    },
    soft_tissue: {
      gingiva_condition: softTissue.gingiva_condition?.trim() || null,
      calculus_plaque: softTissue.calculus_plaque?.trim() || null,
      oral_mucosa: softTissue.oral_mucosa?.trim() || null,
      tongue_palate_floor: softTissue.tongue_palate_floor?.trim() || null,
      tmj_evaluation: softTissue.tmj_evaluation?.trim() || null,
      occlusion_class: softTissue.occlusion_class?.trim() || null,
    },
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
      service_id: item.service_id ?? null,
      tooth_number: item.tooth_number ?? null,
      procedure_name: item.procedure_name,
      surfaces: item.surfaces ?? [],
      priority: item.priority ?? 'ROUTINE',
      estimated_cost: item.estimated_cost ?? null,
      notes: item.notes?.trim() || null,
      status: item.status ?? 'PROPOSED',
    })),
  });

  const handleHistoryChange = (h: DentalHistory) => {
    setDentalHistory(h);
    setIsDirty(true);
  };

  const handleSoftTissueChange = (s: SoftTissueExamination) => {
    setSoftTissue(s);
    setIsDirty(true);
  };

  const handleTreatmentPlanChange = (items: DentalTreatmentPlanItem[]) => {
    setTreatmentPlanItems(items);
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    try {
      const payload = buildPayload();
      await onSaveDiagnosis?.();
      const saved = await saveDraftMutation.mutateAsync({ visitId, payload });
      acceptSavedRecord(saved);
      dirtyRef.current = false;
      setIsDirty(false);
      showToast?.('Dental examination draft saved successfully.', 'success');
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
    }
  };

  const handleConfirmComplete = async () => {
    try {
      const payload = buildPayload();
      await onSaveDiagnosis?.();
      const saved = await completeMutation.mutateAsync({ visitId, payload });
      acceptSavedRecord(saved);
      dirtyRef.current = false;
      setIsDirty(false);
      setConfirmCompleteOpen(false);
      showToast?.('Dental examination completed and locked.', 'success');
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
    }
  };

  const acceptSavedRecord = (saved: OpdDentalExaminationResponse) => {
    loadedVersion.current = saved.updated_at;
    setDentalHistory(saved.dental_history ?? {});
    setSoftTissue(saved.soft_tissue ?? {});
    setTeeth(saved.teeth);
    setTreatmentPlanItems(saved.treatment_plan_items);
  };

  const handleUpdateFinding = (finding: ToothFinding) => {
    setIsDirty(true);
    setTeeth((prev) => {
      const idx = prev.findIndex((t) => t.tooth_number === finding.tooth_number);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = finding;
        return copy;
      }
      return [...prev, finding];
    });
  };

  const handleRemoveFinding = (toothNumber: number) => {
    setIsDirty(true);
    setTeeth((prev) => prev.filter((t) => t.tooth_number !== toothNumber));
    if (selectedToothNumber === toothNumber) {
      setSelectedToothNumber(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <i className="ph ph-spinner ph-spin" style={{ fontSize: '2rem', color: '#2563eb', display: 'block', marginBottom: '12px' }} />
        Loading Dental Examination record...
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#dc2626' }}>
        <i className="ph ph-warning-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }} />
        Failed to load dental examination.
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

  const currentFinding = selectedToothNumber
    ? teeth.find((t) => t.tooth_number === selectedToothNumber)
    : undefined;

  return (
    <div className={styles.container}>
      {/* Action Bar */}
      <div className={styles.actionBar}>
        <div className={styles.titleArea}>
          <h2 className={styles.examTitle}>
            <i className="ph ph-tooth" style={{ color: '#2563eb', fontSize: '1.4rem' }} />
            Dental Examination &amp; Odontogram
          </h2>
          {isCompleted ? (
            <span className={styles.statusBadgeCompleted}>
              <i className="ph ph-check-circle-fill" /> Completed &amp; Locked
            </span>
          ) : (
            <>
              <span className={styles.statusBadgeDraft}>
                <i className="ph ph-pencil-simple-line" /> Draft In-Progress
              </span>
              {isDirty && (
                <span className={styles.unsavedBadge}>
                  <i className="ph ph-warning-circle" /> Unsaved Changes
                </span>
              )}
            </>
          )}
        </div>

        <div className={styles.actionButtons}>
          {!isReadOnly && (
            <>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                <i className="ph ph-floppy-disk" />
                {saveDraftMutation.isPending ? 'Saving Draft...' : 'Save Draft'}
              </button>

              <button
                type="button"
                className={styles.btnComplete}
                onClick={() => setConfirmCompleteOpen(true)}
                disabled={isSaving}
              >
                <i className="ph ph-check-circle" />
                Complete Examination
              </button>
            </>
          )}
        </div>
      </div>

      {/* Read-Only / Completed Banner */}
      {isCompleted && (
        <div className={styles.lockedBannerCompleted}>
          <i className="ph ph-lock-key-fill" style={{ fontSize: '1.25rem' }} />
          <span>Dental Examination is marked as COMPLETED &mdash; Records are finalized and locked in read-only mode.</span>
        </div>
      )}

      {!canEdit && !isCompleted && (
        <div className={styles.lockedBanner}>
          <i className="ph ph-info" style={{ fontSize: '1.25rem' }} />
          <span>You have view-only access to this dental examination record.</span>
        </div>
      )}

      {/* 1. Dental History & Medical Alerts Section */}
      <DentalHistorySection
        history={dentalHistory}
        onChange={handleHistoryChange}
        disabled={controlsDisabled}
        consultationChiefComplaint={consultation?.chief_complaint}
        consultationHpi={consultation?.history_present_illness}
        consultationAssessment={consultation?.assessment}
      />

      {/* 2. Interactive Odontogram + Tooth Examination Panel */}
      <div className={styles.odontogramLayout}>
        <div className={styles.odontogramMainColumn}>
          <OdontogramChart
            teeth={teeth}
            selectedToothNumber={selectedToothNumber}
            onSelectTooth={(num) => setSelectedToothNumber(num)}
            disabled={isSaving}
          />
          <ToothAffectedSurfaces
            selectedToothNumber={selectedToothNumber}
            currentFinding={currentFinding}
            onUpdateFinding={handleUpdateFinding}
            disabled={controlsDisabled}
          />
        </div>

        <ToothExaminationPanel
          selectedToothNumber={selectedToothNumber}
          currentFinding={currentFinding}
          onUpdateFinding={handleUpdateFinding}
          onRemoveFinding={handleRemoveFinding}
          disabled={controlsDisabled}
          showAffectedSurfaces={false}
        />
      </div>

      <section className={`${styles.consultationContext} ${styles.clinicalRelationshipCard}`} aria-label="Dental clinical relationship">
        <strong>Examination → Diagnosis → Treatment Plan</strong>
        <p>Linked by FDI tooth number. Diagnoses and procedures are added explicitly.</p>
        {Array.from(new Set([
          ...teeth.map((tooth) => tooth.tooth_number),
          ...diagnoses.flatMap((dx) => dx.tooth_number ? [dx.tooth_number] : []),
          ...treatmentPlanItems.flatMap((item) => item.tooth_number ? [item.tooth_number] : []),
        ])).sort((a, b) => a - b).map((number) => (
          <div key={number} className={styles.clinicalRelationship}>
            <strong>Tooth #{number}</strong>
            <span>{teeth.some((tooth) => tooth.tooth_number === number) ? 'Examined' : 'Not examined'}: {teeth.find((tooth) => tooth.tooth_number === number)?.conditions.join(', ') || 'No conditions recorded'}</span>
            <span>Diagnosis: {diagnoses.filter((dx) => dx.tooth_number === number).map((dx) => `${dx.code} — ${dx.name}`).join('; ') || 'None recorded'}</span>
            <span>Planned: {treatmentPlanItems.filter((item) => item.tooth_number === number).map((item) => `${item.procedure_name} (${item.status ?? 'PROPOSED'})`).join('; ') || 'None recorded'}</span>
          </div>
        ))}
        <p>General / Full Mouth: {diagnoses.filter((dx) => !dx.tooth_number).map((dx) => `${dx.code} — ${dx.name}`).join('; ') || 'No general diagnosis recorded'}</p>
        {onOpenDiagnosis && !isReadOnly && <button type="button" className={styles.btnSecondary} disabled={isSaving} onClick={() => onOpenDiagnosis(selectedToothNumber)}>
          {selectedToothNumber ? `Add diagnosis for Tooth #${selectedToothNumber}` : 'Open diagnosis workflow'}
        </button>}
      </section>

      {/* 3. General Oral & Soft Tissue Section */}
      <DentalSoftTissueSection
        softTissue={softTissue}
        onChange={handleSoftTissueChange}
        disabled={controlsDisabled}
      />

      {/* 4. Proposed Treatment Plan Section */}
      <DentalTreatmentPlanSection
        items={treatmentPlanItems}
        teeth={teeth}
        onChange={handleTreatmentPlanChange}
        disabled={controlsDisabled}
        departmentServices={departmentServices}
        billingStates={billingStates}
        billingStateLoading={billingStateLoading}
        billingStateError={billingStateError}
        canCreateInvoice={canCreateInvoice}
        billingBlockedByUnsavedChanges={isDirty}
        billingTreatmentItemPending={billingTreatmentItemPending}
        onCreateInvoice={onCreateInvoice}
        onOpenInvoice={onOpenInvoice}
      />

      {/* Complete Confirmation Modal */}
      {confirmCompleteOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>
              <i className="ph ph-warning-circle" style={{ color: '#ea580c' }} />
              Complete Dental Examination?
            </h3>
            <div className={styles.modalBody}>
              <p>
                Are you sure you want to complete and finalize this dental examination?
              </p>
              <p style={{ marginTop: '8px', color: '#dc2626', fontWeight: 600 }}>
                Once completed, the odontogram, tooth findings, and clinical notes will be locked in read-only mode and cannot be altered.
              </p>
              <div style={{ marginTop: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div>&bull; <strong>Examined Teeth:</strong> {teeth.length} recorded</div>
                <div>&bull; <strong>Treatment Plan:</strong> {treatmentPlanItems.length} procedures planned</div>
                {dentalHistory.medical_alerts?.length ? (
                  <div style={{ color: '#991b1b' }}>&bull; <strong>Medical Alerts:</strong> {dentalHistory.medical_alerts.length} active</div>
                ) : null}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setConfirmCompleteOpen(false)}
                disabled={completeMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnComplete}
                onClick={handleConfirmComplete}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? 'Completing...' : 'Confirm & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
