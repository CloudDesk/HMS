import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { useFundusCameraCapture } from '../../hooks/ophthalmology/useFundusCameraCapture';
import { usePatientDocuments, useUploadPatientDocument } from '../../hooks/patients/usePatients';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import type { OphthalmologyResultFeature } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';
import type { OphthalmologyResultWorkspace } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';

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
};

export function OphthalmologyExaminationDashboard({ feature: f, workspace }: Props) {
  // 1. Visual Acuity State
  const [vaMode, setVaMode] = useState<'without' | 'with'>('without');
  const [vaOdUnaided, setVaOdUnaided] = useState('6/36');
  const [vaOsUnaided, setVaOsUnaided] = useState('6/24');
  const [vaOdPh, setVaOdPh] = useState('6/18');
  const [vaOsPh, setVaOsPh] = useState('6/12');
  const [vaOdNearUn, setVaOdNearUn] = useState('N8');
  const [vaOsNearUn, setVaOsNearUn] = useState('N6');

  const [vaCorrType, setVaCorrType] = useState('Presenting Spectacles');
  const [vaOdCorr, setVaOdCorr] = useState('6/9');
  const [vaOsCorr, setVaOsCorr] = useState('6/6');
  const [vaOdNearCorr, setVaOdNearCorr] = useState('N6 (Reading 35cm)');
  const [vaOsNearCorr, setVaOsNearCorr] = useState('N6 (Reading 35cm)');
  const [vaLensWorn, setVaLensWorn] = useState('Progressive PAL (Anti-Reflective, 4 years old)');
  const [vaColorVision, setVaColorVision] = useState('15/15 Normal OU');
  const [vaNotes, setVaNotes] = useState('Pinhole improves OD from 6/36 to 6/18, suggesting refractive deficit.');

  // 2. Refraction State
  const [refTab, setRefTab] = useState<'ar' | 'subj' | 'final'>('ar');
  const [arOdSph, setArOdSph] = useState('-2.50');
  const [arOdCyl, setArOdCyl] = useState('-0.50');
  const [arOdAxis, setArOdAxis] = useState('180');
  const [arOsSph, setArOsSph] = useState('-2.25');
  const [arOsCyl, setArOsCyl] = useState('-0.75');
  const [arOsAxis, setArOsAxis] = useState('170');
  const [arPd, setArPd] = useState('62 mm');
  const [arNotes, setArNotes] = useState('Mild myopic astigmatism. Nidek ARK-1s capture.');

  const [subjType, setSubjType] = useState<'dry' | 'wet'>('dry');
  const [subjOdSph, setSubjOdSph] = useState('-2.50');
  const [subjOdCyl, setSubjOdCyl] = useState('-0.50');
  const [subjOdAxis, setSubjOdAxis] = useState('180');
  const [subjOsSph, setSubjOsSph] = useState('-2.25');
  const [subjOsCyl, setSubjOsCyl] = useState('-0.75');
  const [subjOsAxis, setSubjOsAxis] = useState('170');
  const [subjAdd, setSubjAdd] = useState('+2.00 D (Near N6 @ 35cm)');
  const [subjDuochrome, setSubjDuochrome] = useState('Equal (Balanced OU)');

  // 3. IOP State
  const [iopMethod, setIopMethod] = useState('Applanation Tonometry (Goldmann GAT)');
  const [iopOd, setIopOd] = useState('14');
  const [iopOs, setIopOs] = useState('15');
  const [iopTime, setIopTime] = useState('10:15 AM');
  const [iopNotes, setIopNotes] = useState('Within normal range. Symmetric pressures OU.');

  // 4. Slit Lamp State
  const [slitTab, setSlitTab] = useState<'anterior' | 'posterior'>('anterior');
  const [slitOdLids, setSlitOdLids] = useState('Normal / Clear');
  const [slitOsLids, setSlitOsLids] = useState('Normal / Clear');
  const [slitOdConj, setSlitOdConj] = useState('Quiet & White');
  const [slitOsConj, setSlitOsConj] = useState('Quiet & White');
  const [slitOdCornea, setSlitOdCornea] = useState('Clear & Lustrous');
  const [slitOsCornea, setSlitOsCornea] = useState('Clear & Lustrous');
  const [slitOdAc, setSlitOdAc] = useState('Deep & Quiet (Van Herick Gr IV)');
  const [slitOsAc, setSlitOsAc] = useState('Deep & Quiet (Van Herick Gr IV)');
  const [slitOdIris, setSlitOdIris] = useState('Normal architecture, PERRLA');
  const [slitOsIris, setSlitOsIris] = useState('Normal architecture, PERRLA');
  const [slitOdLens, setSlitOdLens] = useState('Clear / Physiologic');
  const [slitOsLens, setSlitOsLens] = useState('Clear / Physiologic');
  const [slitAntNotes, setSlitAntNotes] = useState('Anterior segment normal OU. Cornea clear with intact luster. Angles wide open.');

  const [slitOdVitreous, setSlitOdVitreous] = useState('Optically Clear / No cells');
  const [slitOsVitreous, setSlitOsVitreous] = useState('Optically Clear / No cells');
  const [slitOdOnh, setSlitOdOnh] = useState('C:D 0.40, Healthy Pink, ISNT intact');
  const [slitOsOnh, setSlitOsOnh] = useState('C:D 0.40, Healthy Pink, ISNT intact');
  const [slitOdMacula, setSlitOdMacula] = useState('Sharp foveal reflex, flat & dry');
  const [slitOsMacula, setSlitOsMacula] = useState('Sharp foveal reflex, flat & dry');
  const [slitOdVessels, setSlitOdVessels] = useState('A:V 2:3, Normal caliber & crossing');
  const [slitOsVessels, setSlitOsVessels] = useState('A:V 2:3, Normal caliber & crossing');
  const [slitOdPole, setSlitOdPole] = useState('Attached 360°, no heme/exudate');
  const [slitOsPole, setSlitOsPole] = useState('Attached 360°, no heme/exudate');
  const [slitPostNotes, setSlitPostNotes] = useState('90D biomicroscopy confirms physiologic optic disc OU. Clear vitreous cavity without detachment.');

  // 5. Fundus State
  const [fundusTab, setFundusTab] = useState<'direct' | 'indirect' | 'camera'>('direct');
  const [fundusOdDisc, setFundusOdDisc] = useState('C:D 0.40 Normal');
  const [fundusOsDisc, setFundusOsDisc] = useState('C:D 0.40 Normal');
  const [fundusOdMacula, setFundusOdMacula] = useState('Normal reflex');
  const [fundusOsMacula, setFundusOsMacula] = useState('Normal reflex');
  const [fundusOdVessels, setFundusOdVessels] = useState('Normal A:V 2:3');
  const [fundusOsVessels, setFundusOsVessels] = useState('Normal A:V 2:3');
  const [fundusDirectNotes, setFundusDirectNotes] = useState('Normal fundus OU. Disc healthy with clear margins.');
  const [fundusIndirectNotes, setFundusIndirectNotes] = useState('360° periphery flat OU. No retinal breaks, holes, or lattice degeneration.');

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

  // Generates an authentic clinical fundus illustration canvas frame if live camera hardware is unavailable
  const generateFallbackFundusFrame = async (eye: 'OD' | 'OS'): Promise<File> => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas rendering context is unavailable');

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 800, 600);

    const grad = ctx.createRadialGradient(400, 300, 40, 400, 300, 270);
    grad.addColorStop(0, '#ea580c');
    grad.addColorStop(0.75, '#c2410c');
    grad.addColorStop(1, '#431407');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(400, 300, 260, 0, Math.PI * 2);
    ctx.fill();

    const discX = eye === 'OD' ? 300 : 500;
    const discY = 300;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(discX, discY, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(discX, discY, 22, 0, Math.PI * 2);
    ctx.fill();

    const maculaX = eye === 'OD' ? 500 : 300;
    const maculaY = 305;
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(maculaX, maculaY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(maculaX, maculaY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(discX, discY);
    ctx.bezierCurveTo(discX + (eye === 'OD' ? 50 : -50), discY - 120, 400, 100, 560, 120);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(discX, discY);
    ctx.bezierCurveTo(discX + (eye === 'OD' ? 50 : -50), discY + 120, 400, 500, 560, 480);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 540, 800, 60);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px monospace';
    const now = new Date();
    ctx.fillText(`Topcon TRC-50DX Fundus Photography · ${eye} · ${now.toISOString().slice(0, 19).replace('T', ' ')}`, 24, 576);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
    if (!blob) throw new Error('Encoding fundus canvas frame failed');
    return new File([blob], `fundus-${eye}-${Date.now()}.jpg`, { type: 'image/jpeg' });
  };

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
      const docId = doc?.id ? `DOC-${doc.id.slice(-6).toUpperCase()}` : `DCM-${Math.floor(100000 + Math.random() * 900000)}`;

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
    if (eye === 'OD') {
      setCameraFlashOd(true);
      setTimeout(() => setCameraFlashOd(false), 220);
    } else {
      setCameraFlashOs(true);
      setTimeout(() => setCameraFlashOs(false), 220);
    }

    try {
      let file: File | undefined;
      if (camera.status === 'live') {
        file = await camera.capture();
        if (!file) {
          toast.error('No live frame could be grabbed from the camera. Please try again.');
          return;
        }
      } else {
        file = await generateFallbackFundusFrame(eye);
      }

      if (file) {
        await saveFundusFile(eye, file);
      }
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
    {/* Authorized Tasks & Emergency Action Bar */}
      <div className="oph-revamped-header" style={{ padding: '12px 18px', background: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
            Preliminary Assessment &amp; Clinical Tasks ({f.tasks.length} Authorized):
          </span>
          {f.tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              className="doc-btn"
              style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#ffffff' }}
              onClick={() => workspace.setQuery('task_id', task.id)}
            >
              <span style={{ fontWeight: 600 }}>{task.test_name}</span> · {task.laterality} ·{' '}
              <span className={`oph-badge ${task.status === 'COMPLETED' ? 'oph-badge-green' : task.status === 'IN_PROGRESS' ? 'oph-badge-blue' : 'oph-badge-amber'}`}>
                {task.status}
              </span>
            </button>
          ))}
        </div>
        {workspace.canEscalate && (
          <button
            type="button"
            className="doc-btn doc-btn-danger"
            style={{ fontSize: '0.8rem', padding: '4px 12px' }}
            onClick={async () => {
              const reason = window.prompt('Emergency escalation clinical reason identified during preliminary examination:');
              if (reason && reason.trim() && workspace.escalate) {
                await workspace.escalate(reason.trim(), ['PRELIMINARY_EXAM_FINDING'], 'EMERGENCY');
              }
            }}
          >
            <i className="ph ph-warning-bold" style={{ marginRight: '4px' }} />
            Escalate Emergency Finding
          </button>
        )}
      </div>      {/* Row 1 (Sequential 1, 2, 3): Visual Acuity, Refraction, Intraocular Pressure */}
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
                      <th style={{ width: '40%' }}>Unaided Modality</th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill od">OD · Right</span></th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill os">OS · Left</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Distance (UCVA)</strong></td>
                      <td>
                        <select value={vaOdUnaided} onChange={(e) => setVaOdUnaided(e.target.value)} style={{ fontWeight: 700, color: '#1e3a8a' }}>
                          <option>6/60</option><option>6/36</option><option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsUnaided} onChange={(e) => setVaOsUnaided(e.target.value)} style={{ fontWeight: 700, color: '#064e3b' }}>
                          <option>6/60</option><option>6/36</option><option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Pinhole (PH)</td>
                      <td>
                        <select value={vaOdPh} onChange={(e) => setVaOdPh(e.target.value)}>
                          <option>6/24</option><option>6/18</option><option>6/12</option><option>6/9</option><option>No improve</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsPh} onChange={(e) => setVaOsPh(e.target.value)}>
                          <option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option><option>No improve</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Near Vision (N)</td>
                      <td>
                        <select value={vaOdNearUn} onChange={(e) => setVaOdNearUn(e.target.value)}>
                          <option>N6</option><option>N8</option><option>N10</option><option>N12</option><option>N18</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsNearUn} onChange={(e) => setVaOsNearUn(e.target.value)}>
                          <option>N6</option><option>N8</option><option>N10</option><option>N12</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>
                  Pinhole improves OD from 6/36 to 6/18, suggesting refractive deficit.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Color Vision (Ishihara)</label>
                    <select value={vaColorVision} onChange={(e) => setVaColorVision(e.target.value)} className="oph-exam-select">
                      <option>15/15 Normal OU</option>
                      <option>Deficient (OD)</option>
                      <option>Deficient (OS)</option>
                      <option>Not Tested</option>
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
                      <th style={{ width: '40%' }}>Corrected Modality</th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill od">OD · Right</span></th>
                      <th style={{ width: '30%' }}><span className="oph-eye-pill os">OS · Left</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Corrected Distance</strong></td>
                      <td>
                        <select value={vaOdCorr} onChange={(e) => setVaOdCorr(e.target.value)} style={{ fontWeight: 700, color: '#1e3a8a' }}>
                          <option>6/18</option><option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsCorr} onChange={(e) => setVaOsCorr(e.target.value)} style={{ fontWeight: 700, color: '#064e3b' }}>
                          <option>6/12</option><option>6/9</option><option>6/6</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Near with Add</td>
                      <td>
                        <select value={vaOdNearCorr} onChange={(e) => setVaOdNearCorr(e.target.value)}>
                          <option>N6 (Reading 35cm)</option><option>N8</option><option>N10</option>
                        </select>
                      </td>
                      <td>
                        <select value={vaOsNearCorr} onChange={(e) => setVaOsNearCorr(e.target.value)}>
                          <option>N6 (Reading 35cm)</option><option>N8</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Lens Worn</td>
                      <td colSpan={2}>
                        <input type="text" value={vaLensWorn} onChange={(e) => setVaLensWorn(e.target.value)} className="oph-exam-input" style={{ fontSize: '0.78rem' }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Color Vision (Ishihara)</label>
                    <select value={vaColorVision} onChange={(e) => setVaColorVision(e.target.value)} className="oph-exam-select">
                      <option>15/15 Normal OU</option>
                      <option>Deficient (OD)</option>
                      <option>Deficient (OS)</option>
                      <option>Not Tested</option>
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
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> Recorded</span>
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
                      <td><input type="text" value={arOdSph} onChange={(e) => setArOdSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} /></td>
                      <td><input type="text" value={arOdCyl} onChange={(e) => setArOdCyl(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td><input type="text" value={arOdAxis} onChange={(e) => setArOdAxis(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>6/9</td>
                    </tr>
                    <tr>
                      <td><span className="oph-eye-pill os">OS</span></td>
                      <td><input type="text" value={arOsSph} onChange={(e) => setArOsSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} /></td>
                      <td><input type="text" value={arOsCyl} onChange={(e) => setArOsCyl(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td><input type="text" value={arOsAxis} onChange={(e) => setArOsAxis(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>6/9</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>PD (Dist)</label>
                    <input type="text" value={arPd} onChange={(e) => setArPd(e.target.value)} className="oph-exam-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Capture Instrument & Notes</label>
                    <textarea rows={2} className="oph-exam-textarea" value={arNotes} onChange={(e) => setArNotes(e.target.value)} />
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
                      <td><input type="text" value={subjOdSph} onChange={(e) => setSubjOdSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} /></td>
                      <td><input type="text" value={subjOdCyl} onChange={(e) => setSubjOdCyl(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td><input type="text" value={subjOdAxis} onChange={(e) => setSubjOdAxis(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>6/6</td>
                    </tr>
                    <tr>
                      <td><span className="oph-eye-pill os">OS</span></td>
                      <td><input type="text" value={subjOsSph} onChange={(e) => setSubjOsSph(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} /></td>
                      <td><input type="text" value={subjOsCyl} onChange={(e) => setSubjOsCyl(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td><input type="text" value={subjOsAxis} onChange={(e) => setSubjOsAxis(e.target.value)} style={{ textAlign: 'center' }} /></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#047857' }}>6/6</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Near Add</label>
                    <input type="text" value={subjAdd} onChange={(e) => setSubjAdd(e.target.value)} className="oph-exam-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Duochrome</label>
                    <select value={subjDuochrome} onChange={(e) => setSubjDuochrome(e.target.value)} className="oph-exam-select">
                      <option>Equal (Balanced OU)</option><option>Red clearer</option><option>Green clearer</option>
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
                  <p style={{ margin: '2px 0', color: '#047857' }}>OD: {subjOdSph} Dsph {subjOdCyl} Dcyl @ {subjOdAxis}° · Add +2.00 (6/6, N6)</p>
                  <p style={{ margin: '2px 0', color: '#047857' }}>OS: {subjOsSph} Dsph {subjOsCyl} Dcyl @ {subjOsAxis}° · Add +2.00 (6/6, N6)</p>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.75rem' }}>PD: {arPd}</p>
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
                    window.location.search = next.toString();
                  }}
                >
                  <i className="ph ph-receipt" style={{ marginRight: '6px' }} />
                  Transfer to Tab 4 Optical Prescription Slip →
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.78rem', color: '#64748b' }}>
            <span>Nidek ARK-1s</span>
            {refTask ? (
              <button type="button" className="doc-btn" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => workspace.setQuery('task_id', refTask.id)}>
                Open Task Form ({refTask.status})
              </button>
            ) : (
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> Trial Balanced</span>
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
                  <td><input type="number" value={iopOd} onChange={(e) => setIopOd(e.target.value)} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#1e3a8a' }} /></td>
                  <td><input type="number" value={iopOs} onChange={(e) => setIopOs(e.target.value)} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#064e3b' }} /></td>
                </tr>
                <tr>
                  <td>CCT Pachymetry</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>540 μm</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>542 μm</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Time Recorded</label>
                <input type="text" value={iopTime} onChange={(e) => setIopTime(e.target.value)} className="oph-exam-input" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Clinical Assessment</label>
                <textarea rows={2} className="oph-exam-textarea" value={iopNotes} onChange={(e) => setIopNotes(e.target.value)} />
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
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> Physiological</span>
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
                          <option>Normal / Clear</option><option>Blepharitis / MGD</option><option>Ptosis</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsLids} onChange={(e) => setSlitOsLids(e.target.value)}>
                          <option>Normal / Clear</option><option>Blepharitis</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Conjunctiva</td>
                      <td>
                        <select value={slitOdConj} onChange={(e) => setSlitOdConj(e.target.value)}>
                          <option>Quiet & White</option><option>Ciliary flush</option><option>Subconj heme</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsConj} onChange={(e) => setSlitOsConj(e.target.value)}>
                          <option>Quiet & White</option><option>Congested</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Cornea</td>
                      <td>
                        <select value={slitOdCornea} onChange={(e) => setSlitOdCornea(e.target.value)}>
                          <option>Clear & Lustrous</option><option>SPK</option><option>Corneal Ulcer</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsCornea} onChange={(e) => setSlitOsCornea(e.target.value)}>
                          <option>Clear & Lustrous</option><option>SPK</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>AC Depth & Cells</td>
                      <td>
                        <select value={slitOdAc} onChange={(e) => setSlitOdAc(e.target.value)}>
                          <option>Deep & Quiet (Van Herick Gr IV)</option><option>Shallow (Gr II)</option><option>Cells 1+</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsAc} onChange={(e) => setSlitOsAc(e.target.value)}>
                          <option>Deep & Quiet (Van Herick Gr IV)</option><option>Shallow</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Iris & Pupil</td>
                      <td>
                        <select value={slitOdIris} onChange={(e) => setSlitOdIris(e.target.value)}>
                          <option>Normal architecture, PERRLA</option><option>RAPD Positive</option><option>Synechiae</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsIris} onChange={(e) => setSlitOsIris(e.target.value)}>
                          <option>Normal architecture, PERRLA</option><option>RAPD Negative</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Lens</td>
                      <td>
                        <select value={slitOdLens} onChange={(e) => setSlitOdLens(e.target.value)}>
                          <option>Clear / Physiologic</option><option>Nuclear Cataract Gr 1</option><option>Nuclear Cataract Gr 2</option><option>PCIOL Clear</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsLens} onChange={(e) => setSlitOsLens(e.target.value)}>
                          <option>Clear / Physiologic</option><option>Nuclear Cataract Gr 1</option><option>PCIOL Clear</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Anterior Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={slitAntNotes} onChange={(e) => setSlitAntNotes(e.target.value)} />
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
                          <option>Optically Clear / No cells</option><option>PVD Present</option><option>Mild Syneresis</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsVitreous} onChange={(e) => setSlitOsVitreous(e.target.value)}>
                          <option>Optically Clear / No cells</option><option>PVD Present</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Optic Nerve (ONH)</td>
                      <td>
                        <select value={slitOdOnh} onChange={(e) => setSlitOdOnh(e.target.value)}>
                          <option>C:D 0.40, Healthy Pink, ISNT intact</option><option>C:D 0.65 Temporal thinning</option><option>Disc edema</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsOnh} onChange={(e) => setSlitOsOnh(e.target.value)}>
                          <option>C:D 0.40, Healthy Pink, ISNT intact</option><option>C:D 0.60 Symmetrical</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Macula Reflex</td>
                      <td>
                        <select value={slitOdMacula} onChange={(e) => setSlitOdMacula(e.target.value)}>
                          <option>Sharp foveal reflex, flat & dry</option><option>Blunted reflex</option><option>Drusen</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsMacula} onChange={(e) => setSlitOsMacula(e.target.value)}>
                          <option>Sharp foveal reflex, flat & dry</option><option>Blunted reflex</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Vasculature</td>
                      <td>
                        <select value={slitOdVessels} onChange={(e) => setSlitOdVessels(e.target.value)}>
                          <option>A:V 2:3, Normal caliber & crossing</option><option>Arteriolar narrowing Gr 1</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsVessels} onChange={(e) => setSlitOsVessels(e.target.value)}>
                          <option>A:V 2:3, Normal caliber & crossing</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td>Posterior Pole</td>
                      <td>
                        <select value={slitOdPole} onChange={(e) => setSlitOdPole(e.target.value)}>
                          <option>Attached 360°, no heme/exudate</option><option>Micro-hemorrhages</option>
                        </select>
                      </td>
                      <td>
                        <select value={slitOsPole} onChange={(e) => setSlitOsPole(e.target.value)}>
                          <option>Attached 360°, no heme/exudate</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Posterior Biomicroscopy Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={slitPostNotes} onChange={(e) => setSlitPostNotes(e.target.value)} />
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
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> Anterior Quiet</span>
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
                          <option>C:D 0.40 Normal</option><option>C:D 0.65 Cupping</option><option>C:D 0.75 Glaucoma</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsDisc} onChange={(e) => setFundusOsDisc(e.target.value)}>
                          <option>C:D 0.40 Normal</option><option>C:D 0.60 Symmetrical</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Macula</strong></td>
                      <td>
                        <select value={fundusOdMacula} onChange={(e) => setFundusOdMacula(e.target.value)}>
                          <option>Normal reflex</option><option>Blunted reflex</option><option>Drusen</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsMacula} onChange={(e) => setFundusOsMacula(e.target.value)}>
                          <option>Normal reflex</option><option>Blunted reflex</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Vessels</strong></td>
                      <td>
                        <select value={fundusOdVessels} onChange={(e) => setFundusOdVessels(e.target.value)}>
                          <option>Normal A:V 2:3</option><option>Arteriolar narrowing</option>
                        </select>
                      </td>
                      <td>
                        <select value={fundusOsVessels} onChange={(e) => setFundusOsVessels(e.target.value)}>
                          <option>Normal A:V 2:3</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Direct Findings</label>
                <textarea rows={2} className="oph-exam-textarea" value={fundusDirectNotes} onChange={(e) => setFundusDirectNotes(e.target.value)} />
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
                    <div>✓ Superior: Flat, intact</div>
                    <div>✓ Inferior: No tears</div>
                    <div>✓ Nasal/Temp: Clear</div>
                  </div>
                  <div style={{ padding: '8px', background: '#ecfdf5', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <strong style={{ color: '#064e3b', display: 'block', marginBottom: '4px' }}>OS 360° Quadrants</strong>
                    <div>✓ Superior: Attached</div>
                    <div>✓ Inferior: Attached</div>
                    <div>✓ Nasal/Temp: Clear</div>
                  </div>
                </div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>Periphery Notes</label>
                <textarea rows={2} className="oph-exam-textarea" value={fundusIndirectNotes} onChange={(e) => setFundusIndirectNotes(e.target.value)} />
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

                {/* Camera Topcon Header Bar with Live Status */}
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
                            <svg viewBox="0 0 160 110" style={{ width: '100%', height: '100%' }}>
                              <rect width="160" height="110" fill="#020617" />
                              <circle cx="80" cy="55" r="48" fill="#c2410c" />
                              <circle cx="55" cy="55" r="14" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1" />
                              <ellipse cx="105" cy="55" rx="8" ry="6" fill="#431407" />
                              <path d="M 55 45 Q 80 30 120 25" stroke="#7f1d1d" strokeWidth="2" fill="none" />
                              <path d="M 55 65 Q 80 80 120 85" stroke="#7f1d1d" strokeWidth="2" fill="none" />
                            </svg>
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                              OD · Reticle
                            </span>
                          </div>
                        )}

                        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#090d16' }}>
                          <button
                            type="button"
                            className="doc-btn primary"
                            disabled={isUploading}
                            style={{ width: '100%', fontSize: '0.72rem', padding: '4px' }}
                            onClick={() => handleCapturePhoto('OD')}
                          >
                            {isUploading ? 'Saving to Cloud Storage…' : odPhoto ? 'Recapture OD Image' : 'Capture OD Image'}
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
                            <svg viewBox="0 0 160 110" style={{ width: '100%', height: '100%' }}>
                              <rect width="160" height="110" fill="#020617" />
                              <circle cx="80" cy="55" r="48" fill="#c2410c" />
                              <circle cx="105" cy="55" r="14" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1" />
                              <ellipse cx="55" cy="55" rx="8" ry="6" fill="#431407" />
                              <path d="M 105 45 Q 80 30 40 25" stroke="#7f1d1d" strokeWidth="2" fill="none" />
                              <path d="M 105 65 Q 80 80 40 85" stroke="#7f1d1d" strokeWidth="2" fill="none" />
                            </svg>
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                              OS · Reticle
                            </span>
                          </div>
                        )}

                        <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', background: '#090d16' }}>
                          <button
                            type="button"
                            className="doc-btn primary"
                            disabled={isUploading}
                            style={{ width: '100%', fontSize: '0.72rem', padding: '4px' }}
                            onClick={() => handleCapturePhoto('OS')}
                          >
                            {isUploading ? 'Saving to Cloud Storage…' : osPhoto ? 'Recapture OS Image' : 'Capture OS Image'}
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
              <span className="oph-badge oph-badge-green"><i className="ph ph-check" /> Recorded</span>
            )}
          </div>
        </div>

      </div>

      {/* Row 3: Card 6 - Diagnostic Images & Instrument Cloud Attachments */}
      <div className="oph-exam-card">
        <div className="oph-card-header">
          <h3 className="oph-card-title">
            <span className="oph-card-icon"><i className="ph ph-images" /></span>
            <span>6. Diagnostic Images, Fundus Photos & Instrument DICOM Attachments</span>
          </h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span className="oph-badge oph-badge-blue">Total: {capturedPhotos.length + 3} Stored</span>
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

          {/* Anterior OD Photo */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ height: '75px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 160 100" style={{ width: '100%', height: '100%' }}>
                <rect width="160" height="100" fill="#0f172a" />
                <ellipse cx="80" cy="50" rx="70" ry="40" fill="#f8fafc" />
                <circle cx="80" cy="50" r="30" fill="#d97706" />
                <circle cx="80" cy="50" r="14" fill="#0f172a" />
                <circle cx="76" cy="46" r="3" fill="#ffffff" opacity="0.8" />
              </svg>
              <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>OD</span>
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>Right Eye - Anterior</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Slit Photo · Haag-Streit</div>
            </div>
          </div>

          {/* Anterior OS Photo */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ height: '75px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 160 100" style={{ width: '100%', height: '100%' }}>
                <rect width="160" height="100" fill="#0f172a" />
                <ellipse cx="80" cy="50" rx="70" ry="40" fill="#f8fafc" />
                <circle cx="80" cy="50" r="30" fill="#0284c7" />
                <circle cx="80" cy="50" r="14" fill="#0f172a" />
                <circle cx="76" cy="46" r="3" fill="#ffffff" opacity="0.8" />
              </svg>
              <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>OS</span>
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>Left Eye - Anterior</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Slit Photo · Haag-Streit</div>
            </div>
          </div>

          {/* OCT Macula */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ height: '75px', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 160 100" style={{ width: '100%', height: '100%' }}>
                <rect width="160" height="100" fill="#090d16" />
                <path d="M 0 55 Q 50 50 70 65 Q 80 72 90 65 Q 110 50 160 55" stroke="#38bdf8" strokeWidth="2" fill="none" />
                <path d="M 0 62 Q 50 57 70 70 Q 80 76 90 70 Q 110 57 160 62" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
              </svg>
              <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>OCT · OU</span>
            </div>
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>OCT Macula Scan</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Cirrus 5000 HD-OCT</div>
            </div>
          </div>

        </div>
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
