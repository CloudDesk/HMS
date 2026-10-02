import type {
  PatientPortalContext,
  PatientPortalOverview,
  PortalDocument,
  PublicList,
} from '../../../api/patient-portal';
import { date, fullName, label } from '../../../utils/formatters';
import type { PortalTab } from '../../../hooks/usePatientPortal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientPortalApi } from '../../../api/patient-portal';
import { portalQueryKeys } from '../../../api/query-keys';
import { PatientAvatar } from '../PatientAvatar';
import { Modal } from '../../ui/Modal';

type ProfileTabProps = {
  data: PatientPortalOverview;
  portalContext: PatientPortalContext;
  selectedPatientContext?: PatientPortalContext['patients'][number];
  patientAge: number;
  initials: string;
  patientId: string;
  setTab: (tab: PortalTab) => void;
  setPatientCardOpen: (open: boolean) => void;
  setEditPersonalInformationOpen: (open: boolean) => void;
};

export function ProfileTab({
  data,
  portalContext,
  selectedPatientContext,
  patientAge,
  initials,
  patientId,
  setTab,
  setPatientCardOpen,
  setEditPersonalInformationOpen,
}: ProfileTabProps) {
  const queryClient = useQueryClient();
  const uploadInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const patient = data.patient;
  const patientAddress = Object.values(patient.address).filter(Boolean).join(', ');
  const emergencyContact = patient.emergency_contact;
  const isMinor = patientAge < 15;
  const guardianProfile = portalContext.account.guardian_profile;
  const guardianAddress = guardianProfile
    ? [
        guardianProfile.address.line1,
        guardianProfile.address.city,
        guardianProfile.address.state,
        guardianProfile.address.country,
        guardianProfile.address.postalCode ?? guardianProfile.address.postal_code,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const showGuardianDetails = Boolean(
    isMinor && selectedPatientContext && selectedPatientContext.relationship !== 'SELF',
  );
  const patientEmailDisplay =
    showGuardianDetails && patient.email === portalContext.account.email
      ? 'Managed through guardian'
      : patient.email || 'Not recorded';
  const patientPhoneDisplay =
    showGuardianDetails && patient.phone === portalContext.account.phone
      ? 'Managed through guardian'
      : patient.phone || 'Not recorded';

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    void videoRef.current.play();
  }, [cameraStream]);

  useEffect(() => stopCamera, [stopCamera]);

  const openCamera = async () => {
    setCameraOpen(true);
    setCameraStarting(true);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraError('Camera access is not supported by this browser or device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      const permissionDenied =
        error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name);
      setCameraError(
        permissionDenied
          ? 'Camera permission was denied. Allow camera access in your browser and try again.'
          : 'The camera could not be started. Check that it is connected and not used by another app.',
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('The photo must be 10 MB or smaller.');
      return;
    }
    setPhotoUploading(true);
    try {
      const uploaded = await patientPortalApi.uploadProfilePhoto(patientId, file);
      const documentsKey = portalQueryKeys.documents(patientId);
      queryClient.setQueryData<PublicList<PortalDocument>>(documentsKey, (current) => {
        const alreadyPresent = current?.data.some((item) => item.id === uploaded.id) ?? false;
        const total = current ? current.meta.total + (alreadyPresent ? 0 : 1) : 1;
        const limit = current?.meta.limit ?? 100;
        return {
          data: [uploaded, ...(current?.data ?? []).filter((item) => item.id !== uploaded.id)],
          meta: {
            page: current?.meta.page ?? 1,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        };
      });
      queryClient.setQueryData(
        ['patient-portal-profile-photo', patientId, uploaded.id],
        { blob: file, fileName: file.name },
      );
      void queryClient.invalidateQueries({ queryKey: documentsKey, refetchType: 'none' });
      toast.success('Profile photo updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile photo upload failed.');
    } finally {
      setPhotoUploading(false);
      if (uploadInput.current) uploadInput.current.value = '';
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Wait for the camera preview, then try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      toast.error('The photo could not be captured.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) {
      toast.error('The photo could not be captured.');
      return;
    }
    const file = new File([blob], `profile-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    stopCamera();
    await uploadPhoto(file);
  };

  return (
    <section className="portal-page-section">
      <header>
        <div>
          <p>Patient identity</p>
          <h1>My profile</h1>
          <span>
            Review and maintain personal, contact, address and emergency information.
          </span>
        </div>
        <div className="portal-section-actions">
          <button
            className="portal-book-action secondary"
            onClick={() => setPatientCardOpen(true)}
            type="button"
          >
            <i className="ph ph-identification-card" /> View patient card
          </button>
          <button
            className="portal-book-action secondary"
            onClick={() => setTab('documents')}
            type="button"
          >
            <i className="ph ph-upload-simple" /> Upload previous record
          </button>
          <button
            className="portal-book-action"
            onClick={() => setEditPersonalInformationOpen(true)}
            type="button"
          >
            <i className="ph ph-pencil-simple" /> Edit personal information
          </button>
        </div>
      </header>

      <article className="portal-profile-card">
        <div className="portal-profile-head">
          <div className="portal-profile-photo-control">
            <PatientAvatar initials={initials} large patientId={patientId} />
            <div>
              <button disabled={photoUploading} onClick={() => void openCamera()} type="button">
                <i className="ph ph-camera" /> Take photo
              </button>
              <button disabled={photoUploading} onClick={() => uploadInput.current?.click()} type="button">
                <i className="ph ph-image-square" /> Upload photo
              </button>
            </div>
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void uploadPhoto(event.target.files?.[0])}
              ref={uploadInput}
              type="file"
            />
          </div>
          <div>
            <h2>{fullName(patient)}</h2>
            <span>
              {patient.patient_number} · {patientAge} {patientAge === 1 ? 'yr' : 'yrs'} old ·{' '}
              {label(patient.gender)}
            </span>
          </div>
          <span className="portal-status confirmed">Active patient</span>
        </div>

        <div className="portal-profile-grid">
          <div>
            <small>Date of birth</small>
            <strong>{date(patient.date_of_birth)}</strong>
          </div>
          <div>
            <small>Gender</small>
            <strong>{label(patient.gender)}</strong>
          </div>
          <div>
            <small>Blood group</small>
            <strong>{patient.blood_group || 'Not recorded'}</strong>
          </div>
          <div>
            <small>Email</small>
            <strong>{patientEmailDisplay}</strong>
          </div>
          <div>
            <small>Phone</small>
            <strong>{patientPhoneDisplay}</strong>
          </div>
          <div>
            <small>Preferred branch</small>
            <strong>
              {selectedPatientContext?.preferred_branch?.name || 'Not recorded'}
            </strong>
          </div>
          <div>
            <small>Address</small>
            <strong>{patientAddress || 'Not recorded'}</strong>
          </div>
          <div>
            <small>Emergency contact</small>
            <strong>
              {emergencyContact?.name
                ? `${emergencyContact.name}${emergencyContact.relationship ? ` · ${emergencyContact.relationship}` : ''}`
                : 'Not recorded'}
            </strong>
          </div>
          <div>
            <small>Emergency phone</small>
            <strong>{emergencyContact?.phone || 'Not recorded'}</strong>
          </div>
        </div>

        <div className="portal-profile-note">
          <i className="ph ph-info" />
          <span>
            Changes are saved to this patient’s HMS record and recorded in the audit history.
          </span>
        </div>
      </article>

      <Modal
        footer={
          <>
            <button className="portal-camera-cancel" onClick={stopCamera} type="button">
              Cancel
            </button>
            <button
              className="portal-camera-capture"
              disabled={!cameraStream || cameraStarting}
              onClick={() => void capturePhoto()}
              type="button"
            >
              <i className="ph ph-camera" /> Capture photo
            </button>
          </>
        }
        icon="ph-camera"
        onClose={stopCamera}
        open={cameraOpen}
        title="Take profile photo"
      >
        <div className="portal-camera-stage">
          {cameraStarting ? (
            <div className="portal-camera-state">
              <div className="portal-spinner" />
              <strong>Starting camera…</strong>
              <span>Your browser may ask for camera permission.</span>
            </div>
          ) : cameraError ? (
            <div className="portal-camera-state portal-camera-state--error">
              <i className="ph ph-camera-slash" />
              <strong>Camera unavailable</strong>
              <span>{cameraError}</span>
              <button onClick={() => void openCamera()} type="button">Try again</button>
            </div>
          ) : (
            <video aria-label="Live camera preview" autoPlay muted playsInline ref={videoRef} />
          )}
        </div>
      </Modal>

      {showGuardianDetails ? (
        <article className="portal-guardian-card">
          <header>
            <span>
              <i className="ph ph-users-three" />
            </span>
            <div>
              <p>Responsible adult</p>
              <h2>Parent / guardian details</h2>
              <small>These details belong to the adult managing this child’s care.</small>
            </div>
            <span className="portal-relationship-badge">
              {label(
                selectedPatientContext?.relationship ||
                  guardianProfile?.relationship ||
                  'PARENT',
              )}
            </span>
          </header>

          <div className="portal-guardian-grid">
            <div>
              <small>Full name</small>
              <strong>{portalContext.account.full_name}</strong>
            </div>
            <div>
              <small>Mobile number</small>
              <strong>{portalContext.account.phone || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Email</small>
              <strong>{portalContext.account.email || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Address</small>
              <strong>{guardianAddress || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Identification</small>
              <strong>
                {guardianProfile?.identification.type || guardianProfile?.identification.number
                  ? [
                      guardianProfile.identification.type,
                      guardianProfile.identification.number,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Not recorded'}
              </strong>
            </div>
            <div>
              <small>Guardian consent</small>
              <strong
                className={
                  guardianProfile?.legal_consent_accepted
                    ? 'guardian-consent-verified'
                    : ''
                }
              >
                {guardianProfile?.legal_consent_accepted ? 'Confirmed' : 'Not recorded'}
              </strong>
            </div>
          </div>

          <footer>
            <i className="ph ph-shield-check" />
            Guardian contact information is stored separately and is not treated as the child’s own contact information.
          </footer>
        </article>
      ) : null}
    </section>
  );
}
