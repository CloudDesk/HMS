import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Icd10Diagnosis } from '../../../data/icd10-diagnoses';
import type {
  DentalHistory,
  DentalTreatmentPlanItem,
  DentitionType,
  OpdConsultationResponse,
  OpdDentalExaminationResponse,
  SaveOpdDentalExaminationPayload,
  SoftTissueExamination,
  ToothFinding,
} from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';
import type { DentalTreatmentBillingState } from '../../../api/billing';
import type { PatientResponse } from '../../../api/patients';
import {
  useCompleteOpdDentalExamination,
  useOpdDentalExamination,
  useSaveOpdDentalExaminationDraft,
} from '../../../hooks/opd/useOpd';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { getPatientAgeInYears, resolveInitialDentition } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { navigate } from '../../../routing/navigation';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DentalHistorySection } from './DentalHistorySection';
import { DentalSoftTissueSection } from './DentalSoftTissueSection';
import { DentalTreatmentPlanSection } from './DentalTreatmentPlanSection';
import { OdontogramChart } from './OdontogramChart';
import { ToothExaminationPanel } from './ToothExaminationPanel';
import styles from './DentalExamination.module.css';

interface OpdDentalExaminationTabProps {
  visitId: string;
  canEdit: boolean;
  showToast?: (message: string, tone?: 'success' | 'error') => void;
  consultation?: OpdConsultationResponse | null;
  patient?: PatientResponse | null;
  patientDateOfBirth?: string | null;
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
  renderImaging?: (selectedTooth: number | null) => React.ReactNode;
  renderLab?: () => React.ReactNode;
}

export const OpdDentalExaminationTab: React.FC<OpdDentalExaminationTabProps> = ({
  visitId,
  canEdit,
  showToast,
  consultation,
  patient,
  patientDateOfBirth,
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
  renderImaging,
  renderLab,
}) => {
  const { data: dentalExam, isLoading, isError, error, refetch } = useOpdDentalExamination(visitId);

  const saveDraftMutation = useSaveOpdDentalExaminationDraft({ notifyOnError: false, notifyOnSuccess: false });
  const completeMutation = useCompleteOpdDentalExamination({ notifyOnError: false, notifyOnSuccess: false });

  const isCompleted = dentalExam?.status === 'COMPLETED';
  const isReadOnly = !canEdit || isCompleted;
  const isSaving = saveDraftMutation.isPending || completeMutation.isPending;
  const controlsDisabled = isReadOnly || isSaving;

  const effectiveDob = patientDateOfBirth ?? patient?.date_of_birth ?? null;
  const patientAge = useMemo(() => getPatientAgeInYears(effectiveDob), [effectiveDob]);

  const defaultDentition = useMemo(
    () =>
      resolveInitialDentition({
        dateOfBirth: effectiveDob,
        existingTeeth: dentalExam?.teeth,
        isCompleted,
      }),
    [effectiveDob, dentalExam?.teeth, isCompleted],
  );

  const [currentDentition, setCurrentDentition] = useState<DentitionType>(defaultDentition);
  const userOverriddenDentitionRef = useRef(false);
  const lastVisitIdRef = useRef(visitId);

  // When visitId changes (e.g. switching patient/visit), reset manual override and recalculate default
  useEffect(() => {
    if (lastVisitIdRef.current !== visitId) {
      lastVisitIdRef.current = visitId;
      userOverriddenDentitionRef.current = false;
      setCurrentDentition(defaultDentition);
    }
  }, [visitId, defaultDentition]);

  // When defaultDentition resolves/updates on initial data load, sync if user hasn't overridden
  useEffect(() => {
    if (!userOverriddenDentitionRef.current) {
      setCurrentDentition(defaultDentition);
    }
  }, [defaultDentition]);

  const handleDentitionChange = (newDentition: DentitionType) => {
    userOverriddenDentitionRef.current = true;
    setCurrentDentition(newDentition);
  };

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
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  dirtyRef.current = isDirty;

  const formatCurrency = useCurrencyFormatter();

  const medicalAlerts = useMemo(() => {
    return dentalHistory.medical_alerts ?? [];
  }, [dentalHistory.medical_alerts]);

  const totalPlanCost = useMemo(() => {
    return treatmentPlanItems.reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [treatmentPlanItems]);

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

  useEffect(() => { onCompletedChange?.(Boolean(isCompleted)); }, [isCompleted, onCompletedChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    const beforeNavigation = (event: Event) => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      if (!dirtyRef.current || !(event instanceof CustomEvent)) return;
      const destination = new URL(event.detail.to, window.location.href);
      if (destination.pathname === '/opd/consultation' && destination.searchParams.get('id') === visitId) return;
      event.preventDefault();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    window.addEventListener('hms:before-navigation', beforeNavigation);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('hms:before-navigation', beforeNavigation);
    };
  }, [visitId]);

  const confirmDiscardAndNavigate = () => {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation(null);
    allowNavigationRef.current = true;
    navigate(destination);
  };

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
            <i className="ph ph-tooth" style={{ color: '#2563eb', fontSize: '1.25rem' }} />
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



      {!canEdit && !isCompleted && (
        <div className={styles.lockedBanner}>
          <i className="ph ph-info" style={{ fontSize: '1.25rem' }} />
          <span>You have view-only access to this dental examination record.</span>
        </div>
      )}

      {/* Medical Alerts Top Banner */}
      <div
        className={`${styles.medicalAlertBanner} ${medicalAlerts.length > 0 ? styles.medicalAlertBannerAlert : styles.medicalAlertBannerClean}`}
        role="region"
        aria-label="Patient Medical Alerts"
      >
        <div className={styles.medicalAlertLeft}>
          <span className={styles.medicalAlertTitle}>
            <i
              className={medicalAlerts.length > 0 ? 'ph ph-warning-octagon' : 'ph ph-check-circle'}
              style={{ fontSize: '1.2rem', color: medicalAlerts.length > 0 ? '#dc2626' : '#16a34a' }}
            />
            {medicalAlerts.length > 0 ? 'Medical Alerts & Risk Factors:' : 'Medical Alerts:'}
          </span>
          {medicalAlerts.length > 0 ? (
            <div className={styles.medicalAlertList}>
              {medicalAlerts.map((alert) => {
                const isAllergy = /allerg/i.test(alert);
                return (
                  <span
                    key={alert}
                    className={`${styles.medicalAlertBadge} ${isAllergy ? styles.medicalAlertBadgeAllergy : ''}`}
                  >
                    <i className={isAllergy ? 'ph ph-warning-diamond-fill' : 'ph ph-warning'} />
                    {alert}
                  </span>
                );
              })}
            </div>
          ) : (
            <span style={{ color: '#166534', fontSize: '0.8rem' }}>
              No active medical alerts, drug allergies, or systemic contraindications recorded.
            </span>
          )}
        </div>

        <button
          type="button"
          className={styles.medicalAlertJumpBtn}
          onClick={() => {
            const historyEl = document.getElementById('dental-history-section');
            historyEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          title="Jump to Dental History & Medical Risk Assessment"
        >
          <i className="ph ph-heartbeat" />
          {medicalAlerts.length > 0 ? 'Review History' : 'Add Medical Alerts'}
        </button>
      </div>

      {/* 1. Interactive Odontogram Hero + Side-by-Side Tooth Detail & Affected Surfaces Panel */}
      <div className={styles.odontogramLayout}>
        <div className={styles.odontogramMainColumn}>
          <OdontogramChart
            teeth={teeth}
            selectedToothNumber={selectedToothNumber}
            onSelectTooth={(num) => setSelectedToothNumber(num)}
            disabled={isSaving}
            dentition={currentDentition}
            defaultDentition={defaultDentition}
            onDentitionChange={handleDentitionChange}
            patientAge={patientAge}
          />
        </div>

        <ToothExaminationPanel
          selectedToothNumber={selectedToothNumber}
          currentFinding={currentFinding}
          onUpdateFinding={handleUpdateFinding}
          onRemoveFinding={handleRemoveFinding}
          disabled={controlsDisabled}
          showAffectedSurfaces={true}
          onSave={isReadOnly ? undefined : handleSaveDraft}
          isSaving={saveDraftMutation.isPending}
        />
      </div>

      {/* 2. Dental History & Medical Alerts Section (Now placed below the Odontogram) */}
      <div id="dental-history-section">
        <DentalHistorySection
          history={dentalHistory}
          onChange={handleHistoryChange}
          disabled={controlsDisabled}
          consultationChiefComplaint={consultation?.chief_complaint}
          consultationHpi={consultation?.history_present_illness}
          consultationAssessment={consultation?.assessment}
        />
      </div>

      {renderImaging?.(selectedToothNumber)}
      {renderLab?.()}

      <section className={`${styles.consultationContext} ${styles.clinicalRelationshipCard}`} aria-label="Dental clinical relationship">
        <div className={styles.clinicalRelationshipHeader}>
          <div className={styles.clinicalRelationshipHeading}>
            <span className={styles.clinicalRelationshipIcon} aria-hidden="true">↗</span>
            <div>
              <h3>Examination → Diagnosis → Treatment Plan</h3>
              <p>Linked by FDI tooth number. Diagnoses and procedures are added explicitly.</p>
            </div>
          </div>
          {onOpenDiagnosis && !isReadOnly && <button type="button" className={styles.btnSecondary} disabled={isSaving} onClick={() => onOpenDiagnosis(selectedToothNumber)}>
            <span aria-hidden="true">+</span>
            {selectedToothNumber ? `Add diagnosis for Tooth #${selectedToothNumber}` : 'Open diagnosis workflow'}
          </button>}
        </div>
        <div className={styles.clinicalRelationshipList}>
        {Array.from(new Set([
          ...teeth.map((tooth) => tooth.tooth_number),
          ...diagnoses.flatMap((dx) => dx.tooth_number ? [dx.tooth_number] : []),
          ...treatmentPlanItems.flatMap((item) => item.tooth_number ? [item.tooth_number] : []),
        ])).sort((a, b) => a - b).map((number) => {
          const finding = teeth.find((tooth) => tooth.tooth_number === number);
          const toothDiagnoses = diagnoses.filter((dx) => dx.tooth_number === number);
          const plannedItems = treatmentPlanItems.filter((item) => item.tooth_number === number);
          return (
            <article key={number} className={styles.clinicalRelationship}>
              <div className={styles.clinicalRelationshipTooth}>
                <span>FDI</span>
                <strong>Tooth #{number}</strong>
              </div>
              <div className={styles.clinicalRelationshipDetail}>
                <span>Examination</span>
                <strong>{finding?.conditions.join(', ') || 'No conditions recorded'}</strong>
                <small>{finding ? 'Examined' : 'Not examined'}</small>
              </div>
              <div className={styles.clinicalRelationshipDetail}>
                <span>Diagnosis</span>
                <strong>{toothDiagnoses.map((dx) => `${dx.code} — ${dx.name}`).join('; ') || 'None recorded'}</strong>
              </div>
              <div className={styles.clinicalRelationshipDetail}>
                <span>Treatment plan</span>
                <strong>{plannedItems.map((item) => `${item.procedure_name} (${item.status ?? 'PROPOSED'})`).join('; ') || 'None recorded'}</strong>
              </div>
            </article>
          );
        })}
        </div>
        <div className={styles.generalDiagnosisRow}>
          <span>General / Full Mouth: </span>
          <strong>{diagnoses.filter((dx) => !dx.tooth_number).map((dx) => `${dx.code} — ${dx.name}`).join('; ') || 'No general diagnosis recorded'}</strong>
        </div>
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

      {/* Sticky Bottom Workstation Action Bar */}
      <div className={styles.stickyActionBar}>
        <div className={styles.stickySummary}>
          <span className={styles.stickyMetric}>
            <i className="ph ph-tooth" style={{ color: '#2563eb' }} />
            Examined Teeth: <strong>{teeth.length}</strong>
          </span>
          <span className={styles.stickyMetric}>
            <i className="ph ph-calendar-check" style={{ color: '#7c3aed' }} />
            Procedures: <strong>{treatmentPlanItems.length}</strong>
          </span>
          <span className={styles.stickyMetric}>
            <i className="ph ph-receipt" style={{ color: '#059669' }} />
            Est. Total: <strong>{formatCurrency(totalPlanCost)}</strong>
          </span>
          {medicalAlerts.length > 0 && (
            <span className={styles.stickyMetricAlert}>
              <i className="ph ph-warning-octagon" />
              {medicalAlerts.length} Alert{medicalAlerts.length > 1 ? 's' : ''}
            </span>
          )}
          {isDirty && (
            <span className={styles.unsavedBadge}>
              <i className="ph ph-warning-circle" /> Unsaved Changes
            </span>
          )}
        </div>

        <div className={styles.stickyActions}>
          {!isReadOnly && (
            <>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                <i className="ph ph-floppy-disk" />
                {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
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

          {onOpenDiagnosis && (
            <button
              type="button"
              className={styles.btnPrimaryGradient}
              onClick={() => onOpenDiagnosis(selectedToothNumber)}
            >
              Continue to Diagnosis
              <i className="ph ph-arrow-right" />
            </button>
          )}
        </div>
      </div>

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

      <ConfirmDialog
        confirmLabel="Discard and Leave"
        message="Discard unsaved dental examination changes and leave this visit?"
        onCancel={() => setPendingNavigation(null)}
        onConfirm={confirmDiscardAndNavigate}
        open={Boolean(pendingNavigation)}
        title="Unsaved Dental Examination"
      />
    </div>
  );
};
