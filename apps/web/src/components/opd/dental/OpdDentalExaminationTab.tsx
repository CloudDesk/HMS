import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Icd10Diagnosis } from '../../../data/icd10-diagnoses';
import type {
  DentalEpisodeStatus,
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
  useCreateDentalEpisode,
  useLinkVisitToDentalEpisode,
  useOpdDentalExamination,
  usePatientDentalEpisodes,
  usePatientToothHistory,
  useSaveOpdDentalExaminationDraft,
  useUpdateDentalEpisodeStatus,
} from '../../../hooks/opd/useOpd';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { getPatientAgeInYears, getToothName, resolveInitialDentition } from '../../../pages/dental-utils';
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
  renderImaging?: (selectedTooth: number | null, episodeId?: string | null) => React.ReactNode;
  renderLab?: () => React.ReactNode;
}

type DentalExaminationSubTab = 'odontogram' | 'history' | 'imaging' | 'laboratory' | 'treatment-plan';

const dentalExaminationSubTabs: Array<{ id: DentalExaminationSubTab; label: string; icon: string }> = [
  { id: 'history', label: 'History & Risk', icon: 'ph-heartbeat' },
  { id: 'odontogram', label: 'Odontogram', icon: 'ph-tooth' },
  { id: 'imaging', label: 'Imaging', icon: 'ph-image-square' },
  { id: 'laboratory', label: 'Laboratory', icon: 'ph-flask' },
  { id: 'treatment-plan', label: 'Diagnosis & Plan', icon: 'ph-clipboard-text' },
];

const dentalExaminationNextStep: Partial<Record<
  DentalExaminationSubTab,
  { id: DentalExaminationSubTab; label: string }
>> = {
  history: { id: 'odontogram', label: 'Next: Odontogram' },
  odontogram: { id: 'imaging', label: 'Next: Imaging' },
  imaging: { id: 'laboratory', label: 'Next: Laboratory' },
  laboratory: { id: 'treatment-plan', label: 'Next: Diagnosis & Plan' },
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
  const [activeSubTab, setActiveSubTab] = useState<DentalExaminationSubTab>('history');
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const loadedVersion = useRef<string | undefined>(undefined);
  dirtyRef.current = isDirty;

  useEffect(() => {
    setActiveSubTab('history');
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
  const linkVisitMutation = useLinkVisitToDentalEpisode();
  const updateEpisodeStatusMutation = useUpdateDentalEpisodeStatus();

  const activeEpisodeForPatient = useMemo(() => {
    return episodes.find((e) => e.status === 'ACTIVE') ?? null;
  }, [episodes]);

  const episodeForSelectedTooth = useMemo(() => {
    if (selectedToothNumber === null || selectedToothNumber === undefined) return null;
    const active = episodes.find(
      (e) => e.primary_tooth_number === selectedToothNumber && e.status === 'ACTIVE',
    );
    if (active) return active;
    return episodes.find((e) => e.primary_tooth_number === selectedToothNumber) ?? null;
  }, [episodes, selectedToothNumber]);

  const displayedEpisode = useMemo(() => {
    if (selectedToothNumber !== null && selectedToothNumber !== undefined) {
      return episodeForSelectedTooth;
    }
    return null;
  }, [selectedToothNumber, episodeForSelectedTooth]);

  const currentFinding = useMemo(() => {
    return selectedToothNumber
      ? teeth.find((t) => t.tooth_number === selectedToothNumber)
      : undefined;
  }, [selectedToothNumber, teeth]);

  const isVisitLinkedToEpisode = useMemo(() => {
    if (!displayedEpisode) return false;
    return (
      dentalExam?.episode_id === displayedEpisode.id ||
      displayedEpisode.visit_ids?.includes(visitId)
    );
  }, [displayedEpisode, dentalExam?.episode_id, visitId]);

  const currentHistoryFinding = useMemo(() => {
    if (!selectedToothNumber || !toothHistory.length) return null;
    return toothHistory.find((h) => h.tooth_number === selectedToothNumber) ?? null;
  }, [selectedToothNumber, toothHistory]);

  const [createEpisodeModalOpen, setCreateEpisodeModalOpen] = useState(false);
  const [newEpisodeTooth, setNewEpisodeTooth] = useState('');
  const [newEpisodeDiagnosis, setNewEpisodeDiagnosis] = useState('');
  const [newEpisodeNotes, setNewEpisodeNotes] = useState('');

  const openCreateEpisodeModal = () => {
    setNewEpisodeTooth(selectedToothNumber ? String(selectedToothNumber) : '');
    const toothDx = selectedToothNumber ? diagnoses.find((d) => d.tooth_number === selectedToothNumber) : null;
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

  const handleLinkVisit = async () => {
    if (!displayedEpisode) return;
    try {
      await linkVisitMutation.mutateAsync({ episodeId: displayedEpisode.id, visitId });
    } catch (err) {
      showToast?.(getOpdErrorMessage(err), 'error');
    }
  };

  const handleEpisodeStatusChange = async (newStatus: DentalEpisodeStatus) => {
    if (!displayedEpisode) return;
    try {
      await updateEpisodeStatusMutation.mutateAsync({
        episodeId: displayedEpisode.id,
        payload: { status: newStatus },
      });
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
    episode_id: displayedEpisode?.id ?? dentalExam?.episode_id ?? null,
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
  };

  const handleOpenDiagnosis = async () => {
    if (!onOpenDiagnosis || isSaving) return;
    if (isDirty && !isReadOnly) {
      const saved = await handleSaveDraft();
      if (!saved) return;
    }
    onOpenDiagnosis(selectedToothNumber);
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

      {/* Dental Treatment Episode Journey Card - strictly selected tooth driven */}
      {selectedToothNumber !== null ? (
        displayedEpisode ? (
          displayedEpisode.status !== 'ACTIVE' || isVisitLinkedToEpisode ? (
            <div className={styles.episodeCard} role="region" aria-label="Dental Treatment Episode">
              <div className={styles.episodeCardHeader}>
                <div className={styles.episodeInfoGroup}>
                  <span className={styles.episodeNumberBadge}>
                    <i className="ph ph-folder-notch-open" />
                    Episode #{displayedEpisode.episode_number}
                  </span>
                  <span
                    className={
                      displayedEpisode.status === 'ACTIVE'
                        ? styles.episodeStatusActive
                        : displayedEpisode.status === 'ON_HOLD'
                        ? styles.episodeStatusOnHold
                        : displayedEpisode.status === 'COMPLETED'
                        ? styles.episodeStatusCompleted
                        : styles.episodeStatusCancelled
                    }
                  >
                    <i className="ph ph-circle-fill" style={{ fontSize: '0.5rem' }} />
                    {displayedEpisode.status.replace('_', ' ')}
                  </span>
                  {displayedEpisode.primary_tooth_number && (
                    <span className={styles.episodeNumberBadge} style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                      <i className="ph ph-tooth" />
                      Primary Tooth #{displayedEpisode.primary_tooth_number}
                    </span>
                  )}
                </div>

                {!isReadOnly && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Episode Status:</label>
                    <select
                      className={styles.modalInput}
                      style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                      value={displayedEpisode.status}
                      disabled={updateEpisodeStatusMutation.isPending}
                      onChange={(e) => handleEpisodeStatusChange(e.target.value as DentalEpisodeStatus)}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ON_HOLD">ON HOLD</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                )}
              </div>

              <div className={styles.episodeDetailsRow}>
                {displayedEpisode.diagnosis_name && (
                  <div className={styles.episodeDetailItem}>
                    <span className={styles.episodeDetailLabel}>Diagnosis:</span>
                    <span className={styles.episodeDetailVal}>{displayedEpisode.diagnosis_name}</span>
                  </div>
                )}
                <div className={styles.episodeDetailItem}>
                  <span className={styles.episodeDetailLabel}>Primary Doctor:</span>
                  <span className={styles.episodeDetailVal}>{displayedEpisode.primary_doctor_name}</span>
                </div>
                <div className={styles.episodeDetailItem}>
                  <span className={styles.episodeDetailLabel}>Linked Visits:</span>
                  <span className={styles.episodeDetailVal}>
                    {displayedEpisode.visit_ids?.length ?? 1} visit{(displayedEpisode.visit_ids?.length ?? 1) === 1 ? '' : 's'} in journey
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.episodeNoticeCard} role="region" aria-label="Active Dental Episode Notice">
              <div className={styles.episodeNoticeContent}>
                <i className="ph ph-info" style={{ fontSize: '1.4rem', color: '#16a34a' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.88rem' }}>
                    Active Dental Episode #{displayedEpisode.episode_number}
                    {displayedEpisode.diagnosis_name ? ` – ${displayedEpisode.diagnosis_name}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '2px' }}>
                    This patient has an active treatment journey on Tooth #{displayedEpisode.primary_tooth_number} with {displayedEpisode.visit_ids?.length ?? 1} prior visit(s).
                    Link this visit to record cumulative progress.
                  </div>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  className={styles.btnPrimaryGradient}
                  onClick={handleLinkVisit}
                  disabled={linkVisitMutation.isPending}
                >
                  <i className="ph ph-link" />
                  {linkVisitMutation.isPending ? 'Linking...' : 'Link This Visit to Episode'}
                </button>
              )}
            </div>
          )
        ) : activeEpisodeForPatient ? (
          <div className={styles.episodeNoticeEmpty} role="region" aria-label="Active Dental Episode Exists for Patient">
            <div className={styles.episodeNoticeContent}>
              <i className="ph ph-warning-circle" style={{ fontSize: '1.25rem', color: '#d97706' }} />
              <div>
                <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.85rem' }}>
                  An active treatment episode already exists for this patient.
                </div>
                <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                  Active Episode: #{activeEpisodeForPatient.episode_number} &middot; Primary Tooth #{activeEpisodeForPatient.primary_tooth_number ?? 'General'}
                  {activeEpisodeForPatient.diagnosis_name ? ` (${activeEpisodeForPatient.diagnosis_name})` : ''}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.episodeNoticeEmpty} role="region" aria-label={`No Treatment Episode for Tooth #${selectedToothNumber}`}>
            <div className={styles.episodeNoticeContent}>
              <i className="ph ph-tooth" style={{ fontSize: '1.25rem', color: '#0284c7' }} />
              <div>
                <div style={{ fontWeight: 600, color: '#0369a1', fontSize: '0.85rem' }}>
                  Tooth #{selectedToothNumber} &middot; {getToothName(selectedToothNumber)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '2px' }}>
                  No treatment episode has been started for this tooth.
                </div>
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem', padding: '5px 12px' }}
                onClick={openCreateEpisodeModal}
              >
                <i className="ph ph-plus-circle" />
                Start Treatment Episode
              </button>
            )}
          </div>
        )
      ) : null}

      <div className={styles.subTabBar}>
      <div className={styles.subTabList} role="tablist" aria-label="Dental examination sections">
        {dentalExaminationSubTabs.map((tab) => (
          <button
            aria-controls={`dental-subtab-panel-${tab.id}`}
            aria-selected={activeSubTab === tab.id}
            className={`${styles.subTabButton} ${activeSubTab === tab.id ? styles.subTabButtonActive : ''}`}
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
        {isCompleted ? (
          <span className={styles.statusBadgeCompleted}>
            <i className="ph ph-check-circle-fill" /> Completed &amp; Locked
          </span>
        ) : isConsultationCompleted ? (
          <span className={styles.statusBadgeCompleted}>
            <i className="ph ph-lock-key" /> Consultation Completed · Read Only
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
            dentition={currentDentition}
            defaultDentition={defaultDentition}
            onDentitionChange={handleDentitionChange}
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
          episodeContext={displayedEpisode ? {
            episode_number: displayedEpisode.episode_number,
            primary_tooth_number: displayedEpisode.primary_tooth_number,
            diagnosis_name: displayedEpisode.diagnosis_name,
          } : null}
          toothDiagnoses={selectedToothNumber ? diagnoses.filter((d) => d.tooth_number === selectedToothNumber) : []}
          visitId={visitId}
          episodeId={displayedEpisode?.id ?? dentalExam?.episode_id ?? null}
          canEdit={canEdit && !isReadOnly}
          consultationCompleted={isCompleted}
          additionalContent={(
            <DentalSoftTissueSection
              softTissue={softTissue}
              onChange={handleSoftTissueChange}
              disabled={controlsDisabled}
              embedded
            />
          )}
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
          consultationAssessment={consultation?.assessment}
        />
      </div>
      </section>

      <section className={styles.subTabPanel} aria-labelledby="dental-subtab-imaging" hidden={activeSubTab !== 'imaging'} id="dental-subtab-panel-imaging" role="tabpanel">
        {renderImaging?.(null, displayedEpisode?.id ?? dentalExam?.episode_id ?? null)}
      </section>
      <section className={styles.subTabPanel} aria-labelledby="dental-subtab-laboratory" hidden={activeSubTab !== 'laboratory'} id="dental-subtab-panel-laboratory" role="tabpanel">
        {renderLab?.()}
      </section>

      <section className={styles.subTabPanel} aria-labelledby="dental-subtab-treatment-plan" hidden={activeSubTab !== 'treatment-plan'} id="dental-subtab-panel-treatment-plan" role="tabpanel">
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
        patientId={patientId}
        episodeId={
          dentalExam?.episode_id ??
          activeEpisodeForPatient?.id ??
          displayedEpisode?.id ??
          episodes[0]?.id
        }
        departmentId={dentalExam?.department_id ?? displayedEpisode?.department_id ?? null}
        onStartEpisode={openCreateEpisodeModal}
        patientName={patient ? [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.patient_number : undefined}
        episodeNumber={displayedEpisode?.episode_number ?? activeEpisodeForPatient?.episode_number ?? episodes[0]?.episode_number}
        primaryToothNumber={displayedEpisode?.primary_tooth_number ?? activeEpisodeForPatient?.primary_tooth_number ?? episodes[0]?.primary_tooth_number}
      />
      </section>

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
          ) : onOpenDiagnosis ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleOpenDiagnosis()}
              disabled={isSaving}
            >
              Next: Diagnosis
              <i className="ph ph-arrow-right" />
            </button>
          ) : null}
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
