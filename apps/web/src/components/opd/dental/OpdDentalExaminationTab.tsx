import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { PatientResponse } from '../../../api/patients';
import {
  useCompleteOpdDentalExamination,
  useCreateDentalEpisode,
  useDentalStages,
  useOpdDentalExamination,
  usePatientDentalEpisodes,
  usePatientToothHistory,
  useSaveOpdDentalExaminationDraft,
} from '../../../hooks/opd/useOpd';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { getPatientAgeInYears, resolveInitialDentition } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { navigate } from '../../../routing/navigation';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DentalDiagnosisModal } from './DentalDiagnosisModal';
import { DentalHistorySection } from './DentalHistorySection';
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
  onAddDiagnosis?: (dx: Icd10Diagnosis) => void;
  onRemoveDiagnosis?: (code: string, toothNumber?: number | null) => void;
  assessment?: string;
  onAssessmentChange?: (val: string) => void;
  onNextStep?: (tab: string) => void;
  onCompletedChange?: (completed: boolean) => void;
  onSaveDiagnosis?: () => Promise<void>;
  billingStates?: DentalTreatmentBillingState[];
  billingStateLoading?: boolean;
  billingStateError?: string;
  canCreateInvoice?: boolean;
  billingTreatmentItemPending?: string | null;
  onCreateInvoice?: (treatmentItemId: string) => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
  renderImaging?: (selectedTooth: number | null, episodeId?: string | null) => React.ReactNode;
  renderLab?: () => React.ReactNode;
}

type DentalExaminationSubTab = 'history' | 'odontogram';

const dentalExaminationSubTabs: Array<{ id: DentalExaminationSubTab; label: string; icon: string }> = [
  { id: 'history', label: 'Examination', icon: 'ph-stethoscope' },
  { id: 'odontogram', label: 'Odontogram', icon: 'ph-tooth' },
];

const dentalExaminationNextStep: Partial<Record<
  DentalExaminationSubTab,
  { id: DentalExaminationSubTab; label: string }
>> = {
  history: { id: 'odontogram', label: 'Next: Odontogram' },
};

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
  onAddDiagnosis,
  onRemoveDiagnosis,
  assessment = '',
  onAssessmentChange,
  onNextStep,
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

  const isCompleted = dentalExam?.status === 'COMPLETED' || consultation?.status === 'COMPLETED';
  const isConsultationCompleted = consultation?.status === 'COMPLETED';
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

  const [selectedToothNumber, setSelectedToothNumber] = useState<number | null>(null);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [diagnosisModalTooth, setDiagnosisModalTooth] = useState<number | null>(null);
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
  const getInitialSubTab = (): DentalExaminationSubTab => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get('section');
      if (s === 'oral-examination' || s === 'odontogram') return 'odontogram';
      if (s === 'history') return 'history';
    }
    return 'history';
  };

  const [activeSubTab, setActiveSubTab] = useState<DentalExaminationSubTab>(getInitialSubTab);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  dirtyRef.current = isDirty;

  useEffect(() => {
    const syncFromUrl = () => {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get('section');
      const target = s === 'oral-examination' ? 'odontogram' : s;
      if (target && (target === 'history' || target === 'odontogram')) {
        setActiveSubTab((prev) => (prev !== target ? target : prev));
        return;
      }
      const p = window.location.pathname;
      let pathTarget: DentalExaminationSubTab | null = null;
      if (p === '/opd/examination') pathTarget = 'history';

      if (pathTarget) {
        setActiveSubTab((prev) => (prev !== pathTarget ? pathTarget! : prev));
      }
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hms:navigation', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hms:navigation', syncFromUrl);
    };
  }, [visitId]);

  const formatCurrency = useCurrencyFormatter();

  const medicalAlerts = useMemo(() => {
    return dentalHistory.medical_alerts ?? [];
  }, [dentalHistory.medical_alerts]);

  const totalPlanCost = useMemo(() => {
    return treatmentPlanItems.reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [treatmentPlanItems]);

  const patientId = patient?.id;
  const { data: episodes = [] } = usePatientDentalEpisodes(patientId);
  const { data: toothHistory = [] } = usePatientToothHistory(patientId, visitId);

  const createEpisodeMutation = useCreateDentalEpisode();

  const episodeForSelectedTooth = useMemo(() => {
    if (selectedToothNumber === null || selectedToothNumber === undefined) return null;
    const active = episodes.find(
      (e) => e.primary_tooth_number === selectedToothNumber && e.status === 'ACTIVE',
    );
    if (active) return active;
    return episodes.find((e) => e.primary_tooth_number === selectedToothNumber) ?? null;
  }, [episodes, selectedToothNumber]);

  const { data: selectedEpisodeStages = [] } = useDentalStages(
    episodeForSelectedTooth?.id,
    undefined,
    Boolean(episodeForSelectedTooth?.id),
  );

  const episodeProgress = useMemo(() => {
    if (!episodeForSelectedTooth) return null;
    const stages = selectedEpisodeStages || [];
    const activeStages = stages.filter((s) => s.status !== 'CANCELLED');
    const totalStages = activeStages.length;
    const completedStages = activeStages.filter((s) => s.status === 'COMPLETED').length;
    const remainingStages = Math.max(0, totalStages - completedStages);
    const isCompleted =
      episodeForSelectedTooth.status === 'COMPLETED' ||
      (totalStages > 0 && completedStages === totalStages);

    return {
      totalStages,
      completedStages,
      remainingStages,
      isCompleted,
    };
  }, [episodeForSelectedTooth, selectedEpisodeStages]);

  const [isEpisodePopoverOpen, setIsEpisodePopoverOpen] = useState(false);
  const [isEpisodeHovered, setIsEpisodeHovered] = useState(false);
  const episodeIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsEpisodePopoverOpen(false);
    setIsEpisodeHovered(false);
  }, [selectedToothNumber]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        episodeIndicatorRef.current &&
        !episodeIndicatorRef.current.contains(event.target as Node)
      ) {
        setIsEpisodePopoverOpen(false);
        setIsEpisodeHovered(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentFinding = useMemo(() => {
    return selectedToothNumber
      ? teeth.find((t) => t.tooth_number === selectedToothNumber)
      : undefined;
  }, [selectedToothNumber, teeth]);

  const currentHistoryFinding = useMemo(() => {
    if (!selectedToothNumber || !toothHistory.length) return null;
    return toothHistory.find((h) => h.tooth_number === selectedToothNumber) ?? null;
  }, [selectedToothNumber, toothHistory]);

  const [createEpisodeModalOpen, setCreateEpisodeModalOpen] = useState(false);
  const [newEpisodeTooth, setNewEpisodeTooth] = useState('');
  const [newEpisodeDiagnosis, setNewEpisodeDiagnosis] = useState('');
  const [newEpisodeNotes, setNewEpisodeNotes] = useState('');

  const openCreateEpisodeModal = (toothNum?: number | null) => {
    const targetTooth = toothNum !== undefined ? toothNum : selectedToothNumber;
    setNewEpisodeTooth(targetTooth ? String(targetTooth) : '');
    const toothDx = targetTooth ? diagnoses.find((d) => d.tooth_number === targetTooth) : null;
    const generalDx = diagnoses[0];
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
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
    }
  };

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
    episode_id: episodeForSelectedTooth?.id ?? dentalExam?.episode_id ?? null,
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
      return true;
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
      return false;
    }
  };

  const handleSubTabChange = async (nextTab: DentalExaminationSubTab) => {
    if (nextTab === activeSubTab || isSaving) return;
    if (isDirty && !isReadOnly) {
      const saved = await handleSaveDraft();
      if (!saved) return;
    }
    setActiveSubTab(nextTab);
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      sp.set('section', nextTab);
      window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}${window.location.hash}`);
      window.dispatchEvent(new Event('hms:navigation'));
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

  return (
    <div className={styles.container}>
      {!canEdit && !isCompleted && (
        <div className={styles.lockedBanner}>
          <i className="ph ph-info" style={{ fontSize: '1.25rem' }} />
          <span>You have view-only access to this dental examination record.</span>
        </div>
      )}

      {/* Top Sticky Header: Secondary Navigation Tabs & Workstation Actions */}
      <div className={styles.topHeaderContainer}>
        {/* Dental Examination Secondary Navigation Tabs */}
        <div className={styles.subTabBar}>
  <div
    className={styles.subTabList}
    role="tablist"
    aria-label="Dental examination sections"
  >
    {dentalExaminationSubTabs.map((tab) => (
      <button
        aria-controls={`dental-subtab-panel-${tab.id}`}
        aria-selected={activeSubTab === tab.id}
        className={`${styles.subTabButton} ${
          activeSubTab === tab.id
            ? styles.subTabButtonActive
            : ''
        }`}
        id={`dental-subtab-${tab.id}`}
        key={tab.id}
        onClick={() => void handleSubTabChange(tab.id)}
        disabled={isSaving}
        role="tab"
        type="button"
      >
        <i className={`ph ${tab.icon}`} aria-hidden="true" />
        {tab.label}
      </button>
    ))}
  </div>

  <div className={styles.subTabStatus} role="status">
    {/* Compact Episode Info Indicator & Popover */}
    {episodeForSelectedTooth && (
      <div
        className={styles.episodeIndicatorWrapper}
        ref={episodeIndicatorRef}
      >
        <button
          type="button"
          className={`${styles.episodeIndicatorBtn} ${
            isEpisodePopoverOpen || isEpisodeHovered
              ? styles.episodeIndicatorBtnActive
              : ''
          }`}
          onClick={() =>
            setIsEpisodePopoverOpen((prev) => !prev)
          }
          onMouseEnter={() => setIsEpisodeHovered(true)}
          onMouseLeave={() => setIsEpisodeHovered(false)}
          aria-expanded={isEpisodePopoverOpen}
          aria-haspopup="dialog"
          aria-label={`Episode Info #${episodeForSelectedTooth.episode_number}`}
          title={`Episode Info #${episodeForSelectedTooth.episode_number}`}
        >
          <i className="ph ph-info" aria-hidden="true" />
          <span className={styles.episodeIndicatorLabel}>
            Episode
          </span>
        </button>

        {(isEpisodePopoverOpen || isEpisodeHovered) && (
          <div
            className={styles.episodePopover}
            role="region"
            aria-label="Dental Treatment Episode Details"
            onMouseEnter={() => setIsEpisodeHovered(true)}
            onMouseLeave={() => setIsEpisodeHovered(false)}
          >
            <div className={styles.episodePopoverTitle}>
              Episode #{episodeForSelectedTooth.episode_number}
            </div>

            <div className={styles.episodePopoverRow}>
              <span className={styles.episodePopoverKey}>
                Status:
              </span>
              <span className={styles.episodePopoverVal}>
                {episodeForSelectedTooth.status.replace('_', ' ')}
              </span>
            </div>

            <div className={styles.episodePopoverRow}>
              <span className={styles.episodePopoverKey}>
                Primary Tooth:
              </span>
              <span className={styles.episodePopoverVal}>
                {episodeForSelectedTooth.primary_tooth_number
                  ? `#${episodeForSelectedTooth.primary_tooth_number}`
                  : '—'}
              </span>
            </div>

            {episodeProgress?.isCompleted ? (
              <div className={styles.episodePopoverSuccessRow}>
                <span
                  className={styles.episodePopoverSuccessText}
                >
                  ✓ All treatment completed
                </span>
              </div>
            ) : episodeProgress &&
              episodeProgress.totalStages === 0 ? (
              <div className={styles.episodePopoverProgressText}>
                Progress: No treatment stages yet
              </div>
            ) : episodeProgress ? (
              <div
                className={styles.episodePopoverProgressSection}
              >
                <div
                  className={styles.episodePopoverProgressRow}
                >
                  <span className={styles.episodePopoverKey}>
                    Progress:
                  </span>
                  <span className={styles.episodePopoverVal}>
                    {episodeProgress.completedStages} /{' '}
                    {episodeProgress.totalStages} stages
                  </span>
                </div>

                {episodeProgress.remainingStages > 0 && (
                  <div
                    className={styles.episodePopoverRemainingRow}
                  >
                    <span
                      className={
                        styles.episodePopoverRemainingText
                      }
                    >
                      {episodeProgress.remainingStages} stage
                      {episodeProgress.remainingStages === 1
                        ? ''
                        : 's'}{' '}
                      remaining
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    )}

    {isCompleted || isConsultationCompleted ? (
      <span
        className={styles.statusBadgeCompleted}
        title="Completed & Locked"
        aria-label="Completed & Locked"
      >
        <i className="ph ph-check-circle-fill" />
        <span>Completed & Locked</span>
      </span>
    ) : (
      <>
        <span
          className={styles.statusBadgeDraft}
          title="Draft In-Progress"
          aria-label="Draft In-Progress"
        >
          <i className="ph ph-pencil-simple-line" />
          <span>Draft In-Progress</span>
        </span>

        {isDirty && (
          <span
            className={styles.unsavedBadge}
            title="Unsaved Changes"
            aria-label="Unsaved Changes"
          >
            <i className="ph ph-warning-circle" />
            <span>Unsaved Changes</span>
          </span>
        )}
      </>
    )}
  </div>
</div>

      </div>

      {/* Panels stay mounted so switching tabs does not discard unsaved section state. */}
      <section className={`${styles.subTabPanel} ${styles.odontogramPanel}`} aria-labelledby="dental-subtab-odontogram" hidden={activeSubTab !== 'odontogram'} id="dental-subtab-panel-odontogram" role="tabpanel">
      <div className={styles.odontogramLayout}>
        <div className={styles.odontogramMainColumn}>
          <OdontogramChart
            teeth={teeth}
            historicalTeeth={toothHistory}
            selectedToothNumber={selectedToothNumber}
            onSelectTooth={(num) => setSelectedToothNumber(num)}
            disabled={isSaving}
            defaultDentition={defaultDentition}
            dentition={defaultDentition}
            patientAge={patientAge}
            showLegend
          />
        </div>

        <ToothExaminationPanel
          selectedToothNumber={selectedToothNumber}
          currentFinding={currentFinding}
          historicalFinding={currentHistoryFinding}
          onUpdateFinding={handleUpdateFinding}
          onRemoveFinding={handleRemoveFinding}
          disabled={controlsDisabled}
          showAffectedSurfaces={true}
          episodeContext={episodeForSelectedTooth ? {
            episode_number: episodeForSelectedTooth.episode_number,
            primary_tooth_number: episodeForSelectedTooth.primary_tooth_number,
            diagnosis_name: episodeForSelectedTooth.diagnosis_name,
          } : null}
          toothDiagnoses={selectedToothNumber ? diagnoses.filter((d) => d.tooth_number === selectedToothNumber) : []}
          allDiagnoses={diagnoses}
          onAddDiagnosis={onAddDiagnosis}
          onRemoveDiagnosis={onRemoveDiagnosis}
          assessment={assessment}
          onAssessmentChange={onAssessmentChange}
          showToast={showToast}
          onOpenDiagnosis={(tooth) => {
            setDiagnosisModalTooth(tooth);
            onOpenDiagnosis?.(tooth);
          }}
          visitId={visitId}
          episodeId={episodeForSelectedTooth?.id ?? dentalExam?.episode_id ?? null}
          canEdit={canEdit && !isReadOnly}
          consultationCompleted={isCompleted}
          softTissue={softTissue}
          onSoftTissueChange={handleSoftTissueChange}
        />
      </div>
      </section>

      <section className={styles.subTabPanel} aria-labelledby="dental-subtab-history" hidden={activeSubTab !== 'history'} id="dental-subtab-panel-history" role="tabpanel">
      <div id="dental-history-section">
        <DentalHistorySection
          history={dentalHistory}
          onChange={handleHistoryChange}
          disabled={controlsDisabled}
          consultationChiefComplaint={consultation?.chief_complaint}
          consultationHpi={consultation?.history_present_illness}
          consultationPastHistory={consultation?.past_history}
          consultationFamilyHistory={consultation?.family_history}
          consultationAllergies={consultation?.allergies}
          consultationAssessment={consultation?.assessment}
        />
      </div>
      </section>

      {/* Action Strip at Bottom of Page */}
      <div className={styles.subTabActionBar} style={{ marginTop: '1.25rem' }}>
        <div className={styles.stickySummary}>
          {isCompleted && (
            <>
              {teeth.length > 0 && (
                <span className={styles.stickyMetric}>
                  <i className="ph ph-tooth" style={{ color: '#2563eb' }} />
                  Examined Teeth: <strong>{teeth.length}</strong>
                </span>
              )}
              {treatmentPlanItems.length > 0 && (
                <span className={styles.stickyMetric}>
                  <i className="ph ph-calendar-check" style={{ color: '#7c3aed' }} />
                  Procedures: <strong>{treatmentPlanItems.length}</strong>
                </span>
              )}
              {totalPlanCost > 0 && (
                <span className={styles.stickyMetric}>
                  <i className="ph ph-receipt" style={{ color: '#059669' }} />
                  Est. Total: <strong>{formatCurrency(totalPlanCost)}</strong>
                </span>
              )}
            </>
          )}
          {medicalAlerts.length > 0 && (
            <span className={styles.stickyMetricAlert}>
              <i className="ph ph-warning-octagon" />
              {medicalAlerts.length} Alert{medicalAlerts.length > 1 ? 's' : ''}
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

          {dentalExaminationNextStep[activeSubTab] ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleSubTabChange(dentalExaminationNextStep[activeSubTab]!.id)}
              disabled={isSaving}
            >
              {dentalExaminationNextStep[activeSubTab]!.label}
              <i className="ph ph-arrow-right" />
            </button>
          ) : (
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

      <DentalDiagnosisModal
        open={diagnosisModalOpen}
        onClose={() => setDiagnosisModalOpen(false)}
        selectedToothNumber={diagnosisModalTooth}
        diagnoses={diagnoses}
        onAddDiagnosis={onAddDiagnosis}
        onRemoveDiagnosis={onRemoveDiagnosis}
        canEdit={canEdit && !isReadOnly}
        assessment={assessment}
        onAssessmentChange={onAssessmentChange}
        showToast={showToast}
      />

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
