import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { useFundusCameraCapture } from '../../hooks/ophthalmology/useFundusCameraCapture';
import { usePatientDocuments, useUploadPatientDocument } from '../../hooks/patients/usePatients';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { navigate } from '../../routing/navigation';
import type { OphthalmologyResultFeature, OphthalmologyResultWorkspace } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';
import { useOpdConsultation, useSaveOpdConsultationDraft } from '../../hooks/opd/useOpd';
import { getEncounterDraft, setEncounterDraft, registerDraftSaveHandler } from '../../hooks/ophthalmology/encounter-draft-cache';
import {
  serializeOphthalmicExam,
  parseOphthalmicExam,
  type OphthalmicExamState,
} from '../../hooks/ophthalmology/ophthalmology-exam-storage';

type CapturedFundusPhoto = {
  id: string;
  documentId?: string;
  patientId?: string;
  eye: 'OD' | 'OS';
  timestamp: string;
  previewUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  storageKey?: string;
  cloudStored: boolean;
};

type Props = {
  feature: OphthalmologyResultFeature;
  workspace: OphthalmologyResultWorkspace;
  onOpenIntake?: () => void;
};

export function OphthalmologyExaminationDashboard({ feature: f, workspace, onOpenIntake }: Props) {
  // 1. Visual Acuity State
  const [vaMode, setVaMode] = useState<'without' | 'with'>('without');
  const [vaOdUnaided, setVaOdUnaided] = useState('');
  const [vaOsUnaided, setVaOsUnaided] = useState('');
  const [vaOdPh, setVaOdPh] = useState('');
  const [vaOsPh, setVaOsPh] = useState('');
  const [vaOdNearUn, setVaOdNearUn] = useState('');
  const [vaOsNearUn, setVaOsNearUn] = useState('');

  const [vaCorrType, setVaCorrType] = useState('Presenting Spectacles');
  const [vaOdCorr, setVaOdCorr] = useState('');
  const [vaOsCorr, setVaOsCorr] = useState('');
  const [vaOdNearCorr, setVaOdNearCorr] = useState('');
  const [vaOsNearCorr, setVaOsNearCorr] = useState('');
  const [vaLensWorn, setVaLensWorn] = useState('');
  const [vaColorVision, setVaColorVision] = useState('');
  const [vaNotes, setVaNotes] = useState('');

  // 2. Refraction State
  const [refTab, setRefTab] = useState<'ar' | 'subj' | 'final'>('ar');
  const [arOdSph, setArOdSph] = useState('');
  const [arOdCyl, setArOdCyl] = useState('');
  const [arOdAxis, setArOdAxis] = useState('');
  const [arOsSph, setArOsSph] = useState('');
  const [arOsCyl, setArOsCyl] = useState('');
  const [arOsAxis, setArOsAxis] = useState('');
  const [arPd, setArPd] = useState('');
  const [arNotes, setArNotes] = useState('');

  const [subjType, setSubjType] = useState<'dry' | 'wet'>('dry');
  const [subjOdSph, setSubjOdSph] = useState('');
  const [subjOdCyl, setSubjOdCyl] = useState('');
  const [subjOdAxis, setSubjOdAxis] = useState('');
  const [subjOsSph, setSubjOsSph] = useState('');
  const [subjOsCyl, setSubjOsCyl] = useState('');
  const [subjOsAxis, setSubjOsAxis] = useState('');
  const [subjAdd, setSubjAdd] = useState('');
  const [subjDuochrome, setSubjDuochrome] = useState('');

  // 3. IOP State
  const [iopMethod, setIopMethod] = useState('Applanation Tonometry (Goldmann GAT)');
  const [iopOd, setIopOd] = useState('');
  const [iopOs, setIopOs] = useState('');
  const [iopTime, setIopTime] = useState('');
  const [iopNotes, setIopNotes] = useState('');

  // 4. Slit Lamp State
  const [slitTab, setSlitTab] = useState<'anterior' | 'posterior'>('anterior');
  const [slitOdLids, setSlitOdLids] = useState('');
  const [slitOsLids, setSlitOsLids] = useState('');
  const [slitOdConj, setSlitOdConj] = useState('');
  const [slitOsConj, setSlitOsConj] = useState('');
  const [slitOdCornea, setSlitOdCornea] = useState('');
  const [slitOsCornea, setSlitOsCornea] = useState('');
  const [slitOdAc, setSlitOdAc] = useState('');
  const [slitOsAc, setSlitOsAc] = useState('');
  const [slitOdIris, setSlitOdIris] = useState('');
  const [slitOsIris, setSlitOsIris] = useState('');
  const [slitOdLens, setSlitOdLens] = useState('');
  const [slitOsLens, setSlitOsLens] = useState('');
  const [slitAntNotes, setSlitAntNotes] = useState('');

  const [slitOdVitreous, setSlitOdVitreous] = useState('');
  const [slitOsVitreous, setSlitOsVitreous] = useState('');
  const [slitOdOnh, setSlitOdOnh] = useState('');
  const [slitOsOnh, setSlitOsOnh] = useState('');
  const [slitOdMacula, setSlitOdMacula] = useState('');
  const [slitOsMacula, setSlitOsMacula] = useState('');
  const [slitOdVessels, setSlitOdVessels] = useState('');
  const [slitOsVessels, setSlitOsVessels] = useState('');
  const [slitOdPole, setSlitOdPole] = useState('');
  const [slitOsPole, setSlitOsPole] = useState('');
  const [slitPostNotes, setSlitPostNotes] = useState('');

  // 5. Fundus State
  const [fundusTab, setFundusTab] = useState<'direct' | 'indirect' | 'camera'>('direct');
  const [fundusOdDisc, setFundusOdDisc] = useState('');
  const [fundusOsDisc, setFundusOsDisc] = useState('');
  const [fundusOdMacula, setFundusOdMacula] = useState('');
  const [fundusOsMacula, setFundusOsMacula] = useState('');
  const [fundusOdVessels, setFundusOdVessels] = useState('');
  const [fundusOsVessels, setFundusOsVessels] = useState('');
  const [fundusDirectNotes, setFundusDirectNotes] = useState('');
  const [fundusIndirectNotes, setFundusIndirectNotes] = useState('');

  // Draft Persistence & Opd Consultation Hook
  const consultationQuery = useOpdConsultation(workspace.visitId, Boolean(workspace.visitId));
  const saveConsultationDraft = useSaveOpdConsultationDraft({ notifyOnError: false });
  const [isSavingExamDraft, setIsSavingExamDraft] = useState(false);
  const isHydratedRef = useRef(false);

  const currentExamState: OphthalmicExamState = useMemo(() => ({
    vaMode,
    vaOdUnaided,
    vaOsUnaided,
    vaOdPh,
    vaOsPh,
    vaOdNearUn,
    vaOsNearUn,
    vaCorrType,
    vaOdCorr,
    vaOsCorr,
    vaOdNearCorr,
    vaOsNearCorr,
    vaLensWorn,
    vaColorVision,
    vaNotes,

    refTab,
    arOdSph,
    arOdCyl,
    arOdAxis,
    arOsSph,
    arOsCyl,
    arOsAxis,
    arPd,
    arNotes,
    subjType,
    subjOdSph,
    subjOdCyl,
    subjOdAxis,
    subjOsSph,
    subjOsCyl,
    subjOsAxis,
    subjAdd,
    subjDuochrome,

    iopMethod,
    iopOd,
    iopOs,
    iopTime,
    iopNotes,

    slitTab,
    slitOdLids,
    slitOsLids,
    slitOdConj,
    slitOsConj,
    slitOdCornea,
    slitOsCornea,
    slitOdAc,
    slitOsAc,
    slitOdIris,
    slitOdLens,
    slitOsLens,
    slitAntNotes,
    slitOdVitreous,
    slitOsVitreous,
    slitOdOnh,
    slitOsOnh,
    slitOdMacula,
    slitOsMacula,
    slitOdVessels,
    slitOsVessels,
    slitOdPole,
    slitOsPole,
    slitPostNotes,
    slitOsIris,

    fundusTab,
    fundusOdDisc,
    fundusOsDisc,
    fundusOdMacula,
    fundusOsMacula,
    fundusOdVessels,
    fundusOsVessels,
    fundusDirectNotes,
    fundusIndirectNotes,
  }), [
    vaMode, vaOdUnaided, vaOsUnaided, vaOdPh, vaOsPh, vaOdNearUn, vaOsNearUn,
    vaCorrType, vaOdCorr, vaOsCorr, vaOdNearCorr, vaOsNearCorr, vaLensWorn, vaColorVision, vaNotes,
    refTab, arOdSph, arOdCyl, arOdAxis, arOsSph, arOsCyl, arOsAxis, arPd, arNotes,
    subjType, subjOdSph, subjOdCyl, subjOdAxis, subjOsSph, subjOsCyl, subjOsAxis, subjAdd, subjDuochrome,
    iopMethod, iopOd, iopOs, iopTime, iopNotes,
    slitTab, slitOdLids, slitOsLids, slitOdConj, slitOsConj, slitOdCornea, slitOsCornea,
    slitOdAc, slitOsAc, slitOdIris, slitOsIris, slitOdLens, slitOsLens, slitAntNotes,
    slitOdVitreous, slitOsVitreous, slitOdOnh, slitOsOnh, slitOdMacula, slitOsMacula,
    slitOdVessels, slitOsVessels, slitOdPole, slitOsPole, slitPostNotes,
    fundusTab, fundusOdDisc, fundusOsDisc, fundusOdMacula, fundusOsMacula,
    fundusOdVessels, fundusOsVessels, fundusDirectNotes, fundusIndirectNotes,
  ]);

  const applyExamState = useCallback((s: Partial<OphthalmicExamState>) => {
    if (s.vaMode !== undefined) setVaMode(s.vaMode);
    if (s.vaOdUnaided !== undefined) setVaOdUnaided(s.vaOdUnaided);
    if (s.vaOsUnaided !== undefined) setVaOsUnaided(s.vaOsUnaided);
    if (s.vaOdPh !== undefined) setVaOdPh(s.vaOdPh);
    if (s.vaOsPh !== undefined) setVaOsPh(s.vaOsPh);
    if (s.vaOdNearUn !== undefined) setVaOdNearUn(s.vaOdNearUn);
    if (s.vaOsNearUn !== undefined) setVaOsNearUn(s.vaOsNearUn);
    if (s.vaCorrType !== undefined) setVaCorrType(s.vaCorrType);
    if (s.vaOdCorr !== undefined) setVaOdCorr(s.vaOdCorr);
    if (s.vaOsCorr !== undefined) setVaOsCorr(s.vaOsCorr);
    if (s.vaOdNearCorr !== undefined) setVaOdNearCorr(s.vaOdNearCorr);
    if (s.vaOsNearCorr !== undefined) setVaOsNearCorr(s.vaOsNearCorr);
    if (s.vaLensWorn !== undefined) setVaLensWorn(s.vaLensWorn);
    if (s.vaColorVision !== undefined) setVaColorVision(s.vaColorVision);
    if (s.vaNotes !== undefined) setVaNotes(s.vaNotes);

    if (s.refTab !== undefined) setRefTab(s.refTab);
    if (s.arOdSph !== undefined) setArOdSph(s.arOdSph);
    if (s.arOdCyl !== undefined) setArOdCyl(s.arOdCyl);
    if (s.arOdAxis !== undefined) setArOdAxis(s.arOdAxis);
    if (s.arOsSph !== undefined) setArOsSph(s.arOsSph);
    if (s.arOsCyl !== undefined) setArOsCyl(s.arOsCyl);
    if (s.arOsAxis !== undefined) setArOsAxis(s.arOsAxis);
    if (s.arPd !== undefined) setArPd(s.arPd);
    if (s.arNotes !== undefined) setArNotes(s.arNotes);
    if (s.subjType !== undefined) setSubjType(s.subjType);
    if (s.subjOdSph !== undefined) setSubjOdSph(s.subjOdSph);
    if (s.subjOdCyl !== undefined) setSubjOdCyl(s.subjOdCyl);
    if (s.subjOdAxis !== undefined) setSubjOdAxis(s.subjOdAxis);
    if (s.subjOsSph !== undefined) setSubjOsSph(s.subjOsSph);
    if (s.subjOsCyl !== undefined) setSubjOsCyl(s.subjOsCyl);
    if (s.subjOsAxis !== undefined) setSubjOsAxis(s.subjOsAxis);
    if (s.subjAdd !== undefined) setSubjAdd(s.subjAdd);
    if (s.subjDuochrome !== undefined) setSubjDuochrome(s.subjDuochrome);

    if (s.iopMethod !== undefined) setIopMethod(s.iopMethod);
    if (s.iopOd !== undefined) setIopOd(s.iopOd);
    if (s.iopOs !== undefined) setIopOs(s.iopOs);
    if (s.iopTime !== undefined) setIopTime(s.iopTime);
    if (s.iopNotes !== undefined) setIopNotes(s.iopNotes);

    if (s.slitTab !== undefined) setSlitTab(s.slitTab);
    if (s.slitOdLids !== undefined) setSlitOdLids(s.slitOdLids);
    if (s.slitOsLids !== undefined) setSlitOsLids(s.slitOsLids);
    if (s.slitOdConj !== undefined) setSlitOdConj(s.slitOdConj);
    if (s.slitOsConj !== undefined) setSlitOsConj(s.slitOsConj);
    if (s.slitOdCornea !== undefined) setSlitOdCornea(s.slitOdCornea);
    if (s.slitOsCornea !== undefined) setSlitOsCornea(s.slitOsCornea);
    if (s.slitOdAc !== undefined) setSlitOdAc(s.slitOdAc);
    if (s.slitOsAc !== undefined) setSlitOsAc(s.slitOsAc);
    if (s.slitOdIris !== undefined) setSlitOdIris(s.slitOdIris);
    if (s.slitOsIris !== undefined) setSlitOsIris(s.slitOsIris);
    if (s.slitOdLens !== undefined) setSlitOdLens(s.slitOdLens);
    if (s.slitOsLens !== undefined) setSlitOsLens(s.slitOsLens);
    if (s.slitAntNotes !== undefined) setSlitAntNotes(s.slitAntNotes);
    if (s.slitOdVitreous !== undefined) setSlitOdVitreous(s.slitOdVitreous);
    if (s.slitOsVitreous !== undefined) setSlitOsVitreous(s.slitOsVitreous);
    if (s.slitOdOnh !== undefined) setSlitOdOnh(s.slitOdOnh);
    if (s.slitOsOnh !== undefined) setSlitOsOnh(s.slitOsOnh);
    if (s.slitOdMacula !== undefined) setSlitOdMacula(s.slitOdMacula);
    if (s.slitOsMacula !== undefined) setSlitOsMacula(s.slitOsMacula);
    if (s.slitOdVessels !== undefined) setSlitOdVessels(s.slitOdVessels);
    if (s.slitOsVessels !== undefined) setSlitOsVessels(s.slitOsVessels);
    if (s.slitOdPole !== undefined) setSlitOdPole(s.slitOdPole);
    if (s.slitOsPole !== undefined) setSlitOsPole(s.slitOsPole);
    if (s.slitPostNotes !== undefined) setSlitPostNotes(s.slitPostNotes);

    if (s.fundusTab !== undefined) setFundusTab(s.fundusTab);
    if (s.fundusOdDisc !== undefined) setFundusOdDisc(s.fundusOdDisc);
    if (s.fundusOsDisc !== undefined) setFundusOsDisc(s.fundusOsDisc);
    if (s.fundusOdMacula !== undefined) setFundusOdMacula(s.fundusOdMacula);
    if (s.fundusOsMacula !== undefined) setFundusOsMacula(s.fundusOsMacula);
    if (s.fundusOdVessels !== undefined) setFundusOdVessels(s.fundusOdVessels);
    if (s.fundusOsVessels !== undefined) setFundusOsVessels(s.fundusOsVessels);
    if (s.fundusDirectNotes !== undefined) setFundusDirectNotes(s.fundusDirectNotes);
    if (s.fundusIndirectNotes !== undefined) setFundusIndirectNotes(s.fundusIndirectNotes);
  }, []);

  // Hydrate from in-memory cache or remote consultation record
  useEffect(() => {
    if (isHydratedRef.current) return;
    const cached = getEncounterDraft<OphthalmicExamState>(workspace.visitId, 'preliminary-exam');
    if (cached) {
      applyExamState(cached);
      isHydratedRef.current = true;
      return;
    }
    if (consultationQuery.data?.physical_examination) {
      const parsed = parseOphthalmicExam(consultationQuery.data.physical_examination);
      if (parsed) {
        applyExamState(parsed);
        isHydratedRef.current = true;
      }
    } else if (consultationQuery.isSuccess) {
      isHydratedRef.current = true;
    }
  }, [workspace.visitId, consultationQuery.data, consultationQuery.isSuccess, applyExamState]);

  // Synchronize to in-memory draft cache when user edits findings
  useEffect(() => {
    if (!isHydratedRef.current) return;
    setEncounterDraft(workspace.visitId, 'preliminary-exam', currentExamState, true);
  }, [workspace.visitId, currentExamState]);

  // Persistent save handler
  const handleSaveExamDraft = useCallback(async () => {
    if (isSavingExamDraft) return;
    setIsSavingExamDraft(true);
    try {
      const serialized = serializeOphthalmicExam(currentExamState);
      await saveConsultationDraft.mutateAsync({
        visitId: workspace.visitId,
        payload: {
          physical_examination: serialized,
          expected_version: consultationQuery.data?.version ?? 0,
          expected_status: 'DRAFT',
        },
      });
      setEncounterDraft(workspace.visitId, 'preliminary-exam', currentExamState, false);
      toast.success('Preliminary examination findings saved.');
    } catch (err) {
      toast.error(`Failed to save examination findings: ${getOpdErrorMessage(err)}`);
    } finally {
      setIsSavingExamDraft(false);
    }
  }, [isSavingExamDraft, currentExamState, saveConsultationDraft, workspace.visitId, consultationQuery.data?.version]);

  // Register with footer / global draft save registry
  useEffect(() => {
    return registerDraftSaveHandler('preliminary-exam', handleSaveExamDraft);
  }, [handleSaveExamDraft]);

  // Real Camera & Cloud Storage Upload Hooks
  const camera = useFundusCameraCapture(fundusTab === 'camera');
  const uploadPatientDoc = useUploadPatientDocument({ notifyOnError: false });
  const patientDocsQuery = usePatientDocuments(workspace.visit?.patient_id ?? null, {
    visit_id: workspace.visitId,
    document_type: 'CLINICAL',
  });

  const [cameraFlashOd, setCameraFlashOd] = useState(false);
  const [cameraFlashOs, setCameraFlashOs] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string | null>(null);
  const [uploadingEye, setUploadingEye] = useState<'OD' | 'OS' | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedFundusPhoto[]>([]);
  const [selectedModalPhoto, setSelectedModalPhoto] = useState<CapturedFundusPhoto | null>(null);
  const [examCollapsed, setExamCollapsed] = useState(false);

  const odFileInputRef = useRef<HTMLInputElement>(null);
  const osFileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  // Sync existing patient documents for this encounter
  useEffect(() => {
    if (!patientDocsQuery.data?.data) return;
    const docs = patientDocsQuery.data.data;
    const fundusDocs = docs.filter((d) =>
      d.title?.toLowerCase().includes('fundus') ||
      d.description?.toLowerCase().includes('fundus') ||
      d.title?.toLowerCase().includes('topcon')
    );
    if (fundusDocs.length > 0) {
      setCapturedPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.documentId).filter(Boolean));
        const newPhotos: CapturedFundusPhoto[] = [];
        for (const doc of fundusDocs) {
          if (!existingIds.has(doc.id)) {
            const isOd = doc.title?.includes('OD') || doc.title?.toLowerCase().includes('right');
            const eye: 'OD' | 'OS' = isOd ? 'OD' : 'OS';
            newPhotos.push({
              id: `DOC-${doc.id.slice(-6).toUpperCase()}`,
              documentId: doc.id,
              patientId: doc.patient_id,
              eye,
              timestamp: new Date(doc.created_at).toLocaleDateString('en-GB') + ' ' + new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              previewUrl: `/api/patients/${encodeURIComponent(doc.patient_id)}/documents/${encodeURIComponent(doc.id)}/download`,
              fileName: doc.file_name,
              fileSizeBytes: doc.file_size_bytes,
              storageKey: doc.storage_key,
              cloudStored: true,
            });
          }
        }
        return [...newPhotos, ...prev];
      });
    }
  }, [patientDocsQuery.data]);

  // Uploads captured/selected image to Cloud Storage & Patient EHR documents
  const saveFundusFile = async (eye: 'OD' | 'OS', file: File) => {
    setUploadingEye(eye);
    try {
      const patientId = workspace.visit?.patient_id;
      if (!patientId) {
        toast.error('Patient record not found for this encounter.');
        return;
      }

      const doc = await uploadPatientDoc.mutateAsync({
        id: patientId,
        payload: {
          document_type: 'CLINICAL',
          title: `Fundus Photography - ${eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}`,
          file,
          visit_id: workspace.visitId,
          branch_id: workspace.visit?.branch_id,
          description: `Topcon TRC-50DX Fundus Photography (${eye})`,
        },
      });

      if (fundusTask && f.canAttach) {
        try {
          await f.upload({
            task_id: fundusTask.id,
            result_id: null,
            title: `Fundus Photography - ${eye}`,
            acquired_at: new Date().toISOString(),
            file,
            key: crypto.randomUUID(),
          });
        } catch (syncErr) {
          console.warn('Ophthalmology task attachment optional sync notice:', syncErr);
        }
      }

      const now = new Date();
      const timeStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const docId = doc?.id ? `DOC-${doc.id.slice(-6).toUpperCase()}` : `DOC-${Date.now().toString().slice(-6)}`;

      const newPhoto: CapturedFundusPhoto = {
        id: docId,
        documentId: doc?.id,
        patientId,
        eye,
        timestamp: timeStr,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSizeBytes: file.size,
        storageKey: doc?.storage_key,
        cloudStored: true,
      };

      setCapturedPhotos((prev) => [newPhoto, ...prev.filter((p) => p.eye !== eye || p.id !== docId)]);
      const statusMsg = `${eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'} Fundus Captured: Image saved to Cloud Storage & EHR Attachments (${docId}) at ${timeStr}.`;
      setCameraStatusMsg(statusMsg);
      toast.success(`${eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'} Fundus image saved to Cloud Storage!`);
    } catch (err) {
      const msg = getOpdErrorMessage(err);
      toast.error(`Failed to save to cloud storage: ${msg}`);
      setCameraStatusMsg(`Error saving ${eye} fundus photo: ${msg}`);
    } finally {
      setUploadingEye(null);
    }
  };

  const handleCapturePhoto = async (eye: 'OD' | 'OS') => {
    if (camera.status !== 'live') {
      toast.error('Live camera hardware is not connected or streaming. Connect camera or import image file.');
      return;
    }

    if (eye === 'OD') {
      setCameraFlashOd(true);
      setTimeout(() => setCameraFlashOd(false), 220);
    } else {
      setCameraFlashOs(true);
      setTimeout(() => setCameraFlashOs(false), 220);
    }

    try {
      const file = await camera.capture();
      if (!file) {
        toast.error('No live frame could be grabbed from the camera. Please try again.');
        return;
      }
      await saveFundusFile(eye, file);
    } catch (err) {
      toast.error(getOpdErrorMessage(err));
    }
  };

  const setAllSlitNormal = () => {
    setSlitOdLids('Normal / Clear'); setSlitOsLids('Normal / Clear');
    setSlitOdConj('Quiet & White'); setSlitOsConj('Quiet & White');
    setSlitOdCornea('Clear & Lustrous'); setSlitOsCornea('Clear & Lustrous');
    setSlitOdAc('Deep & Quiet (Van Herick Gr IV)'); setSlitOsAc('Deep & Quiet (Van Herick Gr IV)');
    setSlitOdIris('Normal architecture, PERRLA'); setSlitOsIris('Normal architecture, PERRLA');
    setSlitOdLens('Clear / Physiologic'); setSlitOsLens('Clear / Physiologic');
    setSlitAntNotes('Anterior segment normal OU. Cornea clear with intact luster. Angles wide open.');
    setSlitOdVitreous('Optically Clear / No cells'); setSlitOsVitreous('Optically Clear / No cells');
    setSlitOdOnh('C:D 0.40, Healthy Pink, ISNT intact'); setSlitOsOnh('C:D 0.40, Healthy Pink, ISNT intact');
    setSlitOdMacula('Sharp foveal reflex, flat & dry'); setSlitOsMacula('Sharp foveal reflex, flat & dry');
    setSlitOdVessels('A:V 2:3, Normal caliber & crossing'); setSlitOsVessels('A:V 2:3, Normal caliber & crossing');
    setSlitOdPole('Attached 360°, no heme/exudate'); setSlitOsPole('Attached 360°, no heme/exudate');
    setSlitPostNotes('90D biomicroscopy confirms physiologic optic disc OU. Clear vitreous cavity without detachment.');
  };

  // Find linked tasks from the real queue
  const vaTask = f.tasks.find((t) => t.test_code === 'VA' || t.test_name.toLowerCase().includes('acuity'));
  const refTask = f.tasks.find((t) => t.test_code === 'ARK' || t.test_code === 'REFRACTION' || t.test_name.toLowerCase().includes('refraction'));
  const iopTask = f.tasks.find((t) => t.test_code === 'IOP' || t.test_name.toLowerCase().includes('tonometry') || t.test_name.toLowerCase().includes('pressure'));
  const slitTask = f.tasks.find((t) => t.test_code === 'SLIT_LAMP' || t.test_name.toLowerCase().includes('slit'));
  const fundusTask = f.tasks.find((t) => t.test_code === 'FUNDUS' || t.test_name.toLowerCase().includes('fundus'));

  return (
    <div className="oph-exam-dashboard">
      {/* Examination Findings Unified Parent Container */}
      <div className="oph-exam-section-container">
        {/* Examination Findings Section Header */}
        <div className="oph-exam-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="oph-exam-header-icon">
              <i className="ph ph-eye" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
              Examination Findings
            </span>
            {f.tasks.length === 0 ? (
              <span className="oph-exam-status-badge empty">
                <span>🚫</span> No examination performed yet
              </span>
            ) : (
              <span className="oph-exam-status-badge available">
                {f.tasks.length} Authorized Tasks Available
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenIntake && (
              <button
                type="button"
                className="oph-btn-clinical-intake"
                onClick={onOpenIntake}
                title="View patient clinical intake and history"
              >
                <i className="ph ph-clipboard-text" />
                <span>Clinical Intake</span>
              </button>
            )}
            <button
              type="button"
              className="doc-btn primary"
              onClick={handleSaveExamDraft}
              disabled={isSavingExamDraft}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '4px 10px' }}
              title="Save preliminary examination findings to consultation draft"
            >
              <i className={`ph ${isSavingExamDraft ? 'ph-spinner ph-spin' : 'ph-floppy-disk'}`} />
              <span>{isSavingExamDraft ? 'Saving Exam...' : 'Save Exam Draft'}</span>
            </button>
            {f.tasks.length > 0 && f.tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                className="doc-btn"
                style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#f8fafc' }}
                onClick={() => workspace.setQuery('task_id', task.id)}
              >
                <span style={{ fontWeight: 600 }}>{task.test_name}</span> · {task.laterality} ·{' '}
                <span className={`oph-badge ${task.status === 'COMPLETED' ? 'oph-badge-green' : task.status === 'IN_PROGRESS' ? 'oph-badge-blue' : 'oph-badge-amber'}`}>
                  {task.status}
                </span>
              </button>
            ))}
            <button
              type="button"
              className="doc-btn compact"
              onClick={() => setExamCollapsed(!examCollapsed)}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              title={examCollapsed ? 'Expand Examination Findings' : 'Collapse Examination Findings'}
              aria-expanded={!examCollapsed}
              aria-controls="oph-exam-findings-content"
            >
              <i className={`ph ph-caret-${examCollapsed ? 'down' : 'up'}`} />
            </button>
          </div>
        </div>

        {!examCollapsed && (
          <div id="oph-exam-findings-content" className="oph-exam-section-body">
            {f.tasksQuery.data && f.tasksQuery.data.meta.totalPages > 1 && (
              <div className="oph-toolbar" style={{ margin: '0 0 10px 0' }}>
                <button type="button" className="doc-btn" disabled={f.page <= 1} onClick={() => workspace.setQuery('task_page', String(f.page - 1))}>Previous tasks</button>
                <span>Page {f.page} of {f.tasksQuery.data.meta.totalPages}</span>
                <button type="button" className="doc-btn" disabled={f.page >= f.tasksQuery.data.meta.totalPages} onClick={() => workspace.setQuery('task_page', String(f.page + 1))}>Next tasks</button>
              </div>
            )}

        {/* Row 1 (Sequential 1, 2, 3): Visual Acuity, Refraction, Intraocular Pressure */}
        <div className="oph-exam-grid-3">

        {/* 1. VISUAL ACUITY */}
        <div className="oph-exam-card">
          <div>
            <div className="oph-card-header">
              <h3 className="oph-card-title">
                <span className="oph-card-icon"><i className="ph ph-eye" /></span>
                <span>1. Visual Acuity</span>
              </h3>
              <div className="oph-subtabs">
                <button
                  type="button"
                  className={`oph-subtab-btn ${vaMode === 'without' ? 'active' : ''}`}
                  onClick={() => setVaMode('without')}
                >
                  Without Correction
                </button>
                <button
                  type="button"
                  className={`oph-subtab-btn ${vaMode === 'with' ? 'active' : ''}`}
                  onClick={() => setVaMode('with')}
                >
                  With Correction
                </button>
              </div>
            </div>

            {vaMode === 'without' ? (
              <div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Parameter</th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill od">OD - Right</span></th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill os">OS - Left</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Distance (UCVA)</strong></td>
                      <td>
                        <select value={vaOdUnaided} onChange={(e) => setVaOdUnaided(e.target.value)} style={{ fontWeight: 700, color: '#1e3a8a' }}>
                          <option value="">--</option>
                          <option>6/60</option><option>6/36</option><option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsUnaided} onChange={(e) => setVaOsUnaided(e.target.value)} style={{ fontWeight: 700, color: '#064e3b' }}>
                          <option value="">--</option>
                          <option>6/60</option><option>6/36</option><option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Pinhole (PH)</td>
                      <td>
                        <select value={vaOdPh} onChange={(e) => setVaOdPh(e.target.value)}>
                          <option value="">--</option>
                          <option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>No improve</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsPh} onChange={(e) => setVaOsPh(e.target.value)}>
                          <option value="">--</option>
                          <option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option><option>No improve</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Near Vision (N)</td>
                      <td>
                        <select value={vaOdNearUn} onChange={(e) => setVaOdNearUn(e.target.value)}>
                          <option value="">--</option>
                          <option>N6</option><option>N8</option><option>N10</option><option>N12</option><option>N18</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsNearUn} onChange={(e) => setVaOsNearUn(e.target.value)}>
                          <option value="">--</option>
                          <option>N6</option><option>N8</option><option>N10</option><option>N12</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Color Vision (Ishihara)</label>
                    <select value={vaColorVision} onChange={(e) => setVaColorVision(e.target.value)} className="oph-exam-select">
                      <option value="">Not Tested</option>
                      <option>15/15 Normal OU</option>
                      <option>Deficient (OD)</option>
                      <option>Deficient (OS)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Acuity Notes / Remarks</label>
                    <textarea rows={2} className="oph-exam-textarea" value={vaNotes} onChange={(e) => setVaNotes(e.target.value)} placeholder="Unaided baseline remarks..." />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Correction:</span>
                  <select value={vaCorrType} onChange={(e) => setVaCorrType(e.target.value)} className="oph-exam-select" style={{ width: '180px', padding: '4px 8px' }}>
                    <option>Presenting Spectacles</option>
                    <option>Best Corrected (BCVA)</option>
                    <option>Contact Lenses</option>
                  </select>
                </div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Parameter</th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill od">OD - Right</span></th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill os">OS - Left</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Corrected Distance</strong></td>
                      <td>
                        <select value={vaOdCorr} onChange={(e) => setVaOdCorr(e.target.value)} style={{ fontWeight: 700, color: '#1e3a8a' }}>
                          <option value="">--</option>
                          <option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsCorr} onChange={(e) => setVaOsCorr(e.target.value)} style={{ fontWeight: 700, color: '#064e3b' }}>
                          <option value="">--</option>
                          <option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Near with Add</td>
                      <td>
                        <select value={vaOdNearCorr} onChange={(e) => setVaOdNearCorr(e.target.value)}>
                          <option value="">--</option>
                          <option>N6 (Reading 35cm)</option><option>N8</option><option>N10</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsNearCorr} onChange={(e) => setVaOsNearCorr(e.target.value)}>
                          <option value="">--</option>
                          <option>N6 (Reading 35cm)</option><option>N8</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Lens Worn</td>
                      <td colSpan={2}>
                        <input type="text" value={vaLensWorn} onChange={(e) => setVaLensWorn(e.target.value)} className="oph-exam-input" style={{ fontSize: '0.78rem' }} placeholder="Current spectacles prescription/type..." />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Color Vision (Ishihara)</label>
                    <select value={vaColorVision} onChange={(e) => setVaColorVision(e.target.value)} className="oph-exam-select">
                      <option value="">Not Tested</option>
                      <option>15/15 Normal OU</option>
                      <option>Deficient (OD)</option>
                      <option>Deficient (OS)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Acuity Notes / Remarks</label>
                    <textarea rows={2} className="oph-exam-textarea" value={vaNotes} onChange={(e) => setVaNotes(e.target.value)} placeholder="Corrected acuity remarks..." />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>{vaMode === 'without' ? 'Mode: Unaided' : 'Mode: Habitual Rx'}</span>
            {vaTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', vaTask.id)}>
                Open Task Form ({vaTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> {vaOdUnaided || vaOdCorr ? 'Recorded' : 'Awaiting Entry'}</span>
            )}
          </div>
        </div>

        {/* 2. REFRACTION */}
        <div className="oph-exam-card">
          <div>
            <div className="oph-card-header">
              <h3 className="oph-card-title">
                <span className="oph-card-icon"><i className="ph ph-eyeglasses" /></span>
                <span>2. Refraction</span>
              </h3>
              <div className="oph-subtabs">
                <button type="button" className={`oph-subtab-btn ${refTab === 'ar' ? 'active' : ''}`} onClick={() => setRefTab('ar')}>
                  Auto Refraction
                </button>
                <button type="button" className={`oph-subtab-btn ${refTab === 'subj' ? 'active' : ''}`} onClick={() => setRefTab('subj')}>
                  Subjective
                </button>
                <button type="button" className={`oph-subtab-btn ${refTab === 'final' ? 'active' : ''}`} onClick={() => setRefTab('final')}>
                  Final Rx
                </button>
              </div>
            </div>

            {refTab === 'ar' && (
              <div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th>Eye</th>
                      <th>Sphere (S)</th>
                      <th>Cylinder (C)</th>
                      <th>Axis (°)</th>
                      <th>VA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="oph-eye-pill od">OD</span></td>
                      <td><input type="text" value={arOdSph} onChange={(e) => setArOdSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} placeholder="0.00" /></td>
                      <td><input type="text" value={arOdCyl} onChange={(e) => setArOdCyl(e.target.value)} style={{ textAlign: 'center' }} placeholder="0.00" /></td>
                      <td><input type="text" value={arOdAxis} onChange={(e) => setArOdAxis(e.target.value)} style={{ textAlign: 'center' }} placeholder="0" /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{arOdSph ? '6/9' : '--'}</td>
                    </tr>
                    <tr>
                      <td><span className="oph-eye-pill os">OS</span></td>
                      <td><input type="text" value={arOsSph} onChange={(e) => setArOsSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} placeholder="0.00" /></td>
                      <td><input type="text" value={arOsCyl} onChange={(e) => setArOsCyl(e.target.value)} style={{ textAlign: 'center' }} placeholder="0.00" /></td>
                      <td><input type="text" value={arOsAxis} onChange={(e) => setArOsAxis(e.target.value)} style={{ textAlign: 'center' }} placeholder="0" /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{arOsSph ? '6/9' : '--'}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>PD (Dist)</label>
                    <input type="text" value={arPd} onChange={(e) => setArPd(e.target.value)} className="oph-exam-input" placeholder="e.g. 62 mm" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Capture Instrument &amp; Notes</label>
                    <textarea rows={2} className="oph-exam-textarea" value={arNotes} onChange={(e) => setArNotes(e.target.value)} placeholder="Refractometer details..." />
                  </div>
                </div>
              </div>
            )}

            {refTab === 'subj' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Technique:</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                      <input type="radio" checked={subjType === 'dry'} onChange={() => setSubjType('dry')} /> Dry
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                      <input type="radio" checked={subjType === 'wet'} onChange={() => setSubjType('wet')} /> Cycloplegic
                    </label>
                  </div>
                </div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th>Eye</th>
                      <th>Trial Sph</th>
                      <th>Trial Cyl</th>
                      <th>Axis</th>
                      <th>BCVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="oph-eye-pill od">OD</span></td>
                      <td><input type="text" value={subjOdSph} onChange={(e) => setSubjOdSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} placeholder="0.00" /></td>
                      <td><input type="text" value={subjOdCyl} onChange={(e) => setSubjOdCyl(e.target.value)} style={{ textAlign: 'center' }} placeholder="0.00" /></td>
                      <td><input type="text" value={subjOdAxis} onChange={(e) => setSubjOdAxis(e.target.value)} style={{ textAlign: 'center' }} placeholder="0" /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>{subjOdSph ? '6/6' : '--'}</td>
                    </tr>
                    <tr>
                      <td><span className="oph-eye-pill os">OS</span></td>
                      <td><input type="text" value={subjOsSph} onChange={(e) => setSubjOsSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} placeholder="0.00" /></td>
                      <td><input type="text" value={subjOsCyl} onChange={(e) => setSubjOsCyl(e.target.value)} style={{ textAlign: 'center' }} placeholder="0.00" /></td>
                      <td><input type="text" value={subjOsAxis} onChange={(e) => setSubjOsAxis(e.target.value)} style={{ textAlign: 'center' }} placeholder="0" /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>{subjOsSph ? '6/6' : '--'}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Near Add</label>
                    <input type="text" value={subjAdd} onChange={(e) => setSubjAdd(e.target.value)} className="oph-exam-input" placeholder="e.g. +2.00 D" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Duochrome</label>
                    <select value={subjDuochrome} onChange={(e) => setSubjDuochrome(e.target.value)} className="oph-exam-select">
                      <option value="">--</option>
                      <option>Equal (Balanced OU)</option>
                      <option>Red clearer</option>
                      <option>Green clearer</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {refTab === 'final' && (
              <div>
                <div style={{ padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', marginBottom: '10px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#064e3b', marginBottom: '4px' }}>
                    <span>Approved Balance</span>
                    <span className="oph-badge oph-badge-green">Rx Ready</span>
                  </div>
                  <p style={{ margin: '2px 0', color: '#047857' }}>OD: {subjOdSph || '--'} Dsph {subjOdCyl || '--'} Dcyl @ {subjOdAxis || '--'}° {subjAdd ? `· Add ${subjAdd}` : ''}</p>
                  <p style={{ margin: '2px 0', color: '#047857' }}>OS: {subjOsSph || '--'} Dsph {subjOsCyl || '--'} Dcyl @ {subjOsAxis || '--'}° {subjAdd ? `· Add ${subjAdd}` : ''}</p>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.75rem' }}>PD: {arPd || '--'}</p>
                </div>
                <button
                  type="button"
                  className="doc-btn primary"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '8px' }}
                  onClick={() => {
                    const next = new URLSearchParams(window.location.search);
                    next.delete('area');
                    next.set('section', 'clinical');
                    next.set('care_tab', 'optical');
                    navigate(`${window.location.pathname}?${next.toString()}`);
                  }}
                >
                  <i className="ph ph-receipt" style={{ marginRight: '6px' }} />
                  Transfer to Tab 4 Optical Prescription Slip →
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>Refractometer</span>
            {refTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', refTask.id)}>
                Open Task Form ({refTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> {arOdSph || subjOdSph ? 'Trial Balanced' : 'Awaiting Entry'}</span>
            )}
          </div>
        </div>

        {/* 3. INTRAOCULAR PRESSURE (IOP) */}
        <div className="oph-exam-card">
          <div>
            <div className="oph-card-header">
              <h3 className="oph-card-title">
                <span className="oph-card-icon"><i className="ph ph-gauge" /></span>
                <span>3. Intraocular Pressure (IOP)</span>
              </h3>
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> 10-21 mmHg</span>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Measurement Technique</label>
              <select value={iopMethod} onChange={(e) => setIopMethod(e.target.value)} className="oph-exam-select">
                <option>Applanation Tonometry (Goldmann GAT)</option>
                <option>Non-Contact Air-Puff Tonometry (NCT)</option>
                <option>Tono-Pen / Rebound Tonometry</option>
              </select>
            </div>

            <table className="oph-table">
              <thead>
                <tr>
                  <th>Modality</th>
                  <th style={{ width: '38%' }}><span className="oph-eye-pill od">OD · Right Eye</span></th>
                  <th style={{ width: '38%' }}><span className="oph-eye-pill os">OS · Left Eye</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>IOP (mmHg)</strong></td>
                  <td><input type="number" value={iopOd} onChange={(e) => setIopOd(e.target.value)} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#1e3a8a' }} placeholder="--" /></td>
                  <td><input type="number" value={iopOs} onChange={(e) => setIopOs(e.target.value)} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#064e3b' }} placeholder="--" /></td>
                </tr>
                <tr>
                  <td>CCT Pachymetry</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>--</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>--</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Time Recorded</label>
                <input type="text" value={iopTime} onChange={(e) => setIopTime(e.target.value)} className="oph-exam-input" placeholder="e.g. 10:15 AM" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Clinical Assessment</label>
                <textarea rows={2} className="oph-exam-textarea" value={iopNotes} onChange={(e) => setIopNotes(e.target.value)} placeholder="Tonometry findings..." />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>Fluorescein + Proparacaine GAT</span>
            {iopTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', iopTask.id)}>
                Open Task Form ({iopTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> {iopOd && iopOs ? 'Recorded' : 'Awaiting Entry'}</span>
            )}
          </div>
        </div>

      </div>

      {/* Row 2 (Sequential 4, 5): Slit Lamp Biomicroscopy & Fundus Examination */}
      <div className="oph-exam-grid-2">

        {/* 4. SLIT LAMP EXAMINATION */}
        <div className="oph-exam-card">
          <div>
            <div className="oph-card-header">
              <h3 className="oph-card-title">
                <span className="oph-card-icon"><i className="ph ph-microscope" /></span>
                <span>4. Slit Lamp Examination</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="oph-subtabs">
                  <button type="button" className={`oph-subtab-btn ${slitTab === 'anterior' ? 'active' : ''}`} onClick={() => setSlitTab('anterior')}>
                    Anterior Segment
                  </button>
                  <button type="button" className={`oph-subtab-btn ${slitTab === 'posterior' ? 'active' : ''}`} onClick={() => setSlitTab('posterior')}>
                    Posterior (90D/78D)
                  </button>
                </div>
                <button
                  type="button"
                  style={{ border: 'none', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={setAllSlitNormal}
                >
                  <i className="ph ph-check-circle" style={{ marginRight: '3px' }} /> Quick: All Normal
                </button>
              </div>
            </div>

            {slitTab === 'anterior' ? (
              <div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Structure</th>
                      <th style={{ width: '36%' }}><span className="oph-eye-pill od">OD · Right Eye</span></th>
                      <th style={{ width: '36%' }}><span className="oph-eye-pill os">OS · Left Eye</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Lids / Adnexa</td>
                      <td>
                        <select value={slitOdLids} onChange={(e) => setSlitOdLids(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal / Clear</option><option>Blepharitis / MGD</option><option>Ptosis</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsLids} onChange={(e) => setSlitOsLids(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal / Clear</option><option>Blepharitis</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Conjunctiva</td>
                      <td>
                        <select value={slitOdConj} onChange={(e) => setSlitOdConj(e.target.value)}>
                          <option value="">--</option>
                          <option>Quiet & White</option><option>Ciliary flush</option><option>Subconj heme</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsConj} onChange={(e) => setSlitOsConj(e.target.value)}>
                          <option value="">--</option>
                          <option>Quiet & White</option><option>Congested</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Cornea</td>
                      <td>
                        <select value={slitOdCornea} onChange={(e) => setSlitOdCornea(e.target.value)}>
                          <option value="">--</option>
                          <option>Clear & Lustrous</option><option>SPK</option><option>Corneal Ulcer</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsCornea} onChange={(e) => setSlitOsCornea(e.target.value)}>
                          <option value="">--</option>
                          <option>Clear & Lustrous</option><option>SPK</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>AC Depth &amp; Cells</td>
                      <td>
                        <select value={slitOdAc} onChange={(e) => setSlitOdAc(e.target.value)}>
                          <option value="">--</option>
                          <option>Deep & Quiet (Van Herick Gr IV)</option><option>Shallow (Gr II)</option><option>Cells 1+</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsAc} onChange={(e) => setSlitOsAc(e.target.value)}>
                          <option value="">--</option>
                          <option>Deep & Quiet (Van Herick Gr IV)</option><option>Shallow</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Iris &amp; Pupil</td>
                      <td>
                        <select value={slitOdIris} onChange={(e) => setSlitOdIris(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal architecture, PERRLA</option><option>RAPD Positive</option><option>Synechiae</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsIris} onChange={(e) => setSlitOsIris(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal architecture, PERRLA</option><option>RAPD Negative</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Lens</td>
                      <td>
                        <select value={slitOdLens} onChange={(e) => setSlitOdLens(e.target.value)}>
                          <option value="">--</option>
                          <option>Clear / Physiologic</option><option>Nuclear Cataract Gr 1</option><option>Nuclear Cataract Gr 2</option><option>PCIOL Clear</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsLens} onChange={(e) => setSlitOsLens(e.target.value)}>
                          <option value="">--</option>
                          <option>Clear / Physiologic</option><option>Nuclear Cataract Gr 1</option><option>PCIOL Clear</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Anterior Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={slitAntNotes} onChange={(e) => setSlitAntNotes(e.target.value)} placeholder="Slit lamp anterior segment findings..." />
              </div>
            ) : (
              <div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Biomicroscopy</th>
                      <th style={{ width: '36%' }}><span className="oph-eye-pill od">OD · Right Eye</span></th>
                      <th style={{ width: '36%' }}><span className="oph-eye-pill os">OS · Left Eye</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Vitreous Body</td>
                      <td>
                        <select value={slitOdVitreous} onChange={(e) => setSlitOdVitreous(e.target.value)}>
                          <option value="">--</option>
                          <option>Optically Clear / No cells</option><option>PVD Present</option><option>Mild Syneresis</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsVitreous} onChange={(e) => setSlitOsVitreous(e.target.value)}>
                          <option value="">--</option>
                          <option>Optically Clear / No cells</option><option>PVD Present</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Optic Nerve (ONH)</td>
                      <td>
                        <select value={slitOdOnh} onChange={(e) => setSlitOdOnh(e.target.value)}>
                          <option value="">--</option>
                          <option>C:D 0.40, Healthy Pink, ISNT intact</option><option>C:D 0.65 Temporal thinning</option><option>Disc edema</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsOnh} onChange={(e) => setSlitOsOnh(e.target.value)}>
                          <option value="">--</option>
                          <option>C:D 0.40, Healthy Pink, ISNT intact</option><option>C:D 0.60 Symmetrical</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Macula Reflex</td>
                      <td>
                        <select value={slitOdMacula} onChange={(e) => setSlitOdMacula(e.target.value)}>
                          <option value="">--</option>
                          <option>Sharp foveal reflex, flat & dry</option><option>Blunted reflex</option><option>Drusen</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsMacula} onChange={(e) => setSlitOsMacula(e.target.value)}>
                          <option value="">--</option>
                          <option>Sharp foveal reflex, flat & dry</option><option>Blunted reflex</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Vasculature</td>
                      <td>
                        <select value={slitOdVessels} onChange={(e) => setSlitOdVessels(e.target.value)}>
                          <option value="">--</option>
                          <option>A:V 2:3, Normal caliber & crossing</option><option>Arteriolar narrowing Gr 1</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsVessels} onChange={(e) => setSlitOsVessels(e.target.value)}>
                          <option value="">--</option>
                          <option>A:V 2:3, Normal caliber & crossing</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Posterior Pole</td>
                      <td>
                        <select value={slitOdPole} onChange={(e) => setSlitOdPole(e.target.value)}>
                          <option value="">--</option>
                          <option>Attached 360°, no heme/exudate</option><option>Micro-hemorrhages</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsPole} onChange={(e) => setSlitOsPole(e.target.value)}>
                          <option value="">--</option>
                          <option>Attached 360°, no heme/exudate</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Posterior Biomicroscopy Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={slitPostNotes} onChange={(e) => setSlitPostNotes(e.target.value)} placeholder="90D/78D biomicroscopy notes..." />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>Haag-Streit BQ 900 · Volk 90D</span>
            {slitTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', slitTask.id)}>
                Open Task Form ({slitTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> {slitOdCornea || slitOsCornea ? 'Recorded' : 'Awaiting Entry'}</span>
            )}
          </div>
        </div>

        {/* 5. FUNDUS EXAMINATION */}
        <div className="oph-exam-card">
          <div>
            <div className="oph-card-header">
              <h3 className="oph-card-title">
                <span className="oph-card-icon"><i className="ph ph-camera" /></span>
                <span>5. Fundus Examination</span>
              </h3>
              <div className="oph-subtabs">
                <button type="button" className={`oph-subtab-btn ${fundusTab === 'direct' ? 'active' : ''}`} onClick={() => setFundusTab('direct')}>
                  Direct
                </button>
                <button type="button" className={`oph-subtab-btn ${fundusTab === 'indirect' ? 'active' : ''}`} onClick={() => setFundusTab('indirect')}>
                  Indirect (BIO)
                </button>
                <button type="button" className={`oph-subtab-btn ${fundusTab === 'camera' ? 'active' : ''}`} onClick={() => setFundusTab('camera')}>
                  Fundus Camera
                </button>
              </div>
            </div>

            {fundusTab === 'direct' && (
              <div>
                <table className="oph-table">
                  <thead>
                    <tr>
                      <th style={{ width: '34%' }}>Fundus Structure</th>
                      <th style={{ width: '33%' }}><span className="oph-eye-pill od">OD · Right</span></th>
                      <th style={{ width: '33%' }}><span className="oph-eye-pill os">OS · Left</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Optic Disc (C:D)</strong></td>
                      <td>
                        <select value={fundusOdDisc} onChange={(e) => setFundusOdDisc(e.target.value)}>
                          <option value="">--</option>
                          <option>C:D 0.40 Normal</option><option>C:D 0.65 Cupping</option><option>C:D 0.75 Glaucoma</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsDisc} onChange={(e) => setFundusOsDisc(e.target.value)}>
                          <option value="">--</option>
                          <option>C:D 0.40 Normal</option><option>C:D 0.60 Symmetrical</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Macula</strong></td>
                      <td>
                        <select value={fundusOdMacula} onChange={(e) => setFundusOdMacula(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal reflex</option><option>Blunted reflex</option><option>Drusen</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsMacula} onChange={(e) => setFundusOsMacula(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal reflex</option><option>Blunted reflex</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Vessels</strong></td>
                      <td>
                        <select value={fundusOdVessels} onChange={(e) => setFundusOdVessels(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal A:V 2:3</option><option>Arteriolar narrowing</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsVessels} onChange={(e) => setFundusOsVessels(e.target.value)}>
                          <option value="">--</option>
                          <option>Normal A:V 2:3</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Direct Findings</label>
                <textarea rows={2} className="oph-exam-textarea" value={fundusDirectNotes} onChange={(e) => setFundusDirectNotes(e.target.value)} placeholder="Direct ophthalmoscopy findings..." />
              </div>
            )}

            {fundusTab === 'indirect' && (
              <div>
                <div style={{ padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '8px', fontSize: '0.8rem' }}>
                  <strong>Volk 20D Dilated BIO Examination</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ padding: '8px', background: '#eff6ff', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '4px' }}>OD 360° Quadrants</strong>
                    <div>Periphery assessment pending examination</div>
                  </div>
                  <div style={{ padding: '8px', background: '#ecfdf5', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <strong style={{ color: '#064e3b', display: 'block', marginBottom: '4px' }}>OS 360° Quadrants</strong>
                    <div>Periphery assessment pending examination</div>
                  </div>
                </div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Periphery Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={fundusIndirectNotes} onChange={(e) => setFundusIndirectNotes(e.target.value)} placeholder="Periphery notes..." />
              </div>
            )}

            {fundusTab === 'camera' && (
              <div>
                {/* Hidden Master Camera Feed for Video Element Binding */}
                <video ref={camera.videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

                {/* Hidden File Pickers for Instrument File Import */}
                <input
                  ref={odFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void saveFundusFile('OD', file);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={osFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void saveFundusFile('OS', file);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={generalFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void saveFundusFile('OD', file);
                    e.target.value = '';
                  }}
                />

                {/* Camera Header Bar with Live Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#0f172a', color: '#ffffff', borderRadius: '6px', marginBottom: '8px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-camera" style={{ color: '#38bdf8' }} />
                    <span style={{ fontWeight: 600 }}>Topcon TRC-50DX Fundus Camera</span>
                    {camera.devices.length > 1 && (
                      <select
                        value={camera.selectedDeviceId}
                        onChange={(e) => camera.setSelectedDeviceId(e.target.value)}
                        style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }}
                      >
                        <option value="">Default Camera</option>
                        {camera.devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {camera.status === 'live' ? (
                      <>
                        <span style={{ color: '#34d399', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700 }}>● Camera Live (Ready)</span>
                        <button type="button" className="doc-btn" style={{ fontSize: '0.68rem', padding: '1px 6px', background: '#334155', color: '#fff' }} onClick={camera.stop}>
                          Disconnect
                        </button>
                      </>
                    ) : camera.status === 'connecting' ? (
                      <span style={{ color: '#fbbf24', fontSize: '0.72rem' }}>○ Connecting…</span>
                    ) : camera.status === 'error' ? (
                      <>
                        <span style={{ color: '#f87171', fontSize: '0.72rem' }} title={camera.error ?? undefined}>⚠ {camera.error ? 'Camera Unavailable' : 'Error'}</span>
                        <button type="button" className="doc-btn" style={{ fontSize: '0.68rem', padding: '1px 6px' }} onClick={() => void camera.start()}>
                          Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>○ Standby</span>
                        <button type="button" className="doc-btn primary" style={{ fontSize: '0.68rem', padding: '1px 8px' }} onClick={() => void camera.start()}>
                          Connect Camera
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 2 Viewfinders Side-by-Side: OD and OS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  {/* OD Viewfinder (Right Eye) */}
                  {(() => {
                    const odPhoto = capturedPhotos.find((p) => p.eye === 'OD');
                    const isUploading = uploadingEye === 'OD';
                    return (
                      <div className="oph-camera-box" style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1e293b', background: '#020617' }}>
                        <div className="oph-camera-flash" style={{ opacity: cameraFlashOd ? 0.9 : 0 }} />

                        {odPhoto ? (
                          <div style={{ position: 'relative', width: '100%', height: '85px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelectedModalPhoto(odPhoto)}>
                            <img src={odPhoto.previewUrl} alt="Right Eye (OD) Fundus" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(6,78,59,0.9)', color: '#34d399', fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>
                              ✓ Cloud Stored · {odPhoto.id}
                            </span>
                            <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px' }}>
                              OD
                            </span>
                          </div>
                        ) : (
                          <div style={{ position: 'relative', width: '100%', height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No OD Image Captured</span>
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                              OD · Viewfinder
                            </span>
                          </div>
                        )}

                        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#090d16' }}>
                          <button
                            type="button"
                            className="doc-btn primary"
                            disabled={isUploading || camera.status !== 'live'}
                            style={{ width: '100%', fontSize: '0.72rem', padding: '4px' }}
                            onClick={() => handleCapturePhoto('OD')}
                          >
                            {isUploading ? 'Saving to Cloud Storage…' : camera.status !== 'live' ? 'Camera Not Connected' : odPhoto ? 'Recapture OD Image' : 'Capture OD Image'}
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="doc-btn"
                              style={{ flex: 1, fontSize: '0.65rem', padding: '2px 4px' }}
                              onClick={() => odFileInputRef.current?.click()}
                            >
                              Import OD File
                            </button>
                            {odPhoto && (
                              <button
                                type="button"
                                className="doc-btn"
                                style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                                onClick={() => setSelectedModalPhoto(odPhoto)}
                              >
                                View Full
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* OS Viewfinder (Left Eye) */}
                  {(() => {
                    const osPhoto = capturedPhotos.find((p) => p.eye === 'OS');
                    const isUploading = uploadingEye === 'OS';
                    return (
                      <div className="oph-camera-box" style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1e293b', background: '#020617' }}>
                        <div className="oph-camera-flash" style={{ opacity: cameraFlashOs ? 0.9 : 0 }} />

                        {osPhoto ? (
                          <div style={{ position: 'relative', width: '100%', height: '85px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelectedModalPhoto(osPhoto)}>
                            <img src={osPhoto.previewUrl} alt="Left Eye (OS) Fundus" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(6,78,59,0.9)', color: '#34d399', fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>
                              ✓ Cloud Stored · {osPhoto.id}
                            </span>
                            <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px' }}>
                              OS
                            </span>
                          </div>
                        ) : (
                          <div style={{ position: 'relative', width: '100%', height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No OS Image Captured</span>
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                              OS · Viewfinder
                            </span>
                          </div>
                        )}

                        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#090d16' }}>
                          <button
                            type="button"
                            className="doc-btn primary"
                            disabled={isUploading || camera.status !== 'live'}
                            style={{ width: '100%', fontSize: '0.72rem', padding: '4px' }}
                            onClick={() => handleCapturePhoto('OS')}
                          >
                            {isUploading ? 'Saving to Cloud Storage…' : camera.status !== 'live' ? 'Camera Not Connected' : osPhoto ? 'Recapture OS Image' : 'Capture OS Image'}
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="doc-btn"
                              style={{ flex: 1, fontSize: '0.65rem', padding: '2px 4px' }}
                              onClick={() => osFileInputRef.current?.click()}
                            >
                              Import OS File
                            </button>
                            {osPhoto && (
                              <button
                                type="button"
                                className="doc-btn"
                                style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                                onClick={() => setSelectedModalPhoto(osPhoto)}
                              >
                                View Full
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {cameraStatusMsg && (
                  <div style={{ padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '0.75rem', color: '#047857', textAlign: 'center' }}>
                    <i className="ph ph-check-circle" style={{ marginRight: '4px' }} />
                    {cameraStatusMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>{fundusTab === 'camera' ? 'Topcon Digital Fundus Photography' : 'Ophthalmoscopy'}</span>
            {fundusTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', fundusTask.id)}>
                Open Task Form ({fundusTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> {capturedPhotos.length > 0 || fundusOdDisc ? 'Recorded' : 'Awaiting Entry'}</span>
            )}
          </div>
        </div>

      </div>

      {/* Row 3: Card 6 - Diagnostic Images & Instrument Cloud Attachments */}
      <div className="oph-exam-card">
        <div className="oph-card-header">
          <h3 className="oph-card-title">
            <span className="oph-card-icon"><i className="ph ph-images" /></span>
            <span>6. Diagnostic Images, Fundus Photos &amp; Instrument Attachments</span>
          </h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span className="oph-badge oph-badge-blue">Total: {capturedPhotos.length} Stored</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>

          {/* Upload Box */}
          <div
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
            }}
            onClick={() => generalFileInputRef.current?.click()}
          >
            <i className="ph ph-upload-simple" style={{ fontSize: '1.25rem', color: '#64748b', marginBottom: '4px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Upload Images</span>
            <small style={{ fontSize: '0.68rem', color: '#94a3b8' }}>JPG, PNG, WebP to Cloud</small>
          </div>

          {/* Dynamically Captured & Cloud-Stored Fundus Photos */}
          {capturedPhotos.map((photo) => (
            <div key={photo.id} style={{ background: '#ffffff', border: '2px solid #10b981', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div
                style={{ height: '75px', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                onClick={() => setSelectedModalPhoto(photo)}
              >
                <img src={photo.previewUrl} alt={`${photo.eye} Fundus`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#059669', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>
                  {photo.eye} · Cloud Stored
                </span>
                <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#6ee7b7', fontSize: '0.62rem', fontFamily: 'monospace', padding: '1px 4px', borderRadius: '3px' }}>
                  {photo.id}
                </span>
              </div>
              <div style={{ padding: '6px 8px', background: '#f0fdf4' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#064e3b' }}>Fundus - {photo.eye === 'OD' ? 'Right Eye' : 'Left Eye'}</div>
                  <button type="button" className="doc-btn" style={{ fontSize: '0.62rem', padding: '1px 5px' }} onClick={() => setSelectedModalPhoto(photo)}>View</button>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#047857' }}>{photo.timestamp}</div>
              </div>
            </div>
          ))}

          {capturedPhotos.length === 0 && (
            <div style={{ padding: '16px', color: '#64748b', fontSize: '0.82rem', textAlign: 'center', gridColumn: '2 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No diagnostic images or fundus photographs attached to this encounter yet. Use the upload box or fundus camera tab to attach images.
            </div>
          )}

        </div>
      </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Full Resolution Stored Photos */}
      {selectedModalPhoto && (
        <Modal
          open={Boolean(selectedModalPhoto)}
          title={`Fundus Image: ${selectedModalPhoto.eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'} (${selectedModalPhoto.id})`}
          onClose={() => setSelectedModalPhoto(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <div style={{ maxHeight: '60vh', overflow: 'hidden', borderRadius: '8px', border: '1px solid #334155', background: '#020617' }}>
              <img
                src={selectedModalPhoto.previewUrl}
                alt={`Fundus ${selectedModalPhoto.eye}`}
                style={{ maxWidth: '100%', maxHeight: '58vh', display: 'block', objectFit: 'contain' }}
              />
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
              <div>
                <div><strong>Eye:</strong> {selectedModalPhoto.eye === 'OD' ? 'OD (Right Eye)' : 'OS (Left Eye)'}</div>
                <div><strong>Captured:</strong> {selectedModalPhoto.timestamp}</div>
                {selectedModalPhoto.storageKey && (
                  <div><strong>Cloud Key:</strong> <code style={{ fontSize: '0.7rem' }}>{selectedModalPhoto.storageKey}</code></div>
                )}
              </div>
              <a
                href={selectedModalPhoto.previewUrl}
                download={selectedModalPhoto.fileName || `fundus-${selectedModalPhoto.eye}.jpg`}
                className="doc-btn primary"
                style={{ textDecoration: 'none' }}
              >
                Download Image
              </a>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
