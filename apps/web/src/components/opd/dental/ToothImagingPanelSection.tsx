import React, { useRef, useState } from 'react';
import { useDentalChairsideImaging } from '../../../hooks/opd/useDentalChairsideImaging';
import { useDentalImagingFeature, type DentalImagingFeatureInput } from '../../../hooks/opd/useDentalImagingFeature';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { getAuthenticatedMediaUrl } from '../../../api/client';
import { opdApi, type DentalChairsideImage } from '../../../api/opd';
import { type ImagingAttachment } from '../../../api/imaging';
import { getToothName, isDentalImagingService, PERMANENT_QUADRANTS, PRIMARY_QUADRANTS } from '../../../pages/dental-utils';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { Modal } from '../../ui/Modal';
import { DentalImageViewerModal, type ViewerAttachmentItem } from './DentalImageViewerModal';
import styles from './DentalClinicalOrders.module.css';

interface ToothImagingPanelSectionProps {
  selectedToothNumber: number;
  visitId?: string;
  episodeId?: string | null;
  canEdit?: boolean;
  consultationCompleted?: boolean;
  disabled?: boolean;
}

const getResultAvailability = (status?: string | null) => {
  if (status && ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(status)) {
    return { label: status === 'VERIFIED' ? 'Verified Report' : 'Report Available', available: true };
  }
  if (status === 'IN_PROGRESS') return { label: 'In Progress', available: false };
  if (status === 'RECEIVED') return { label: 'Received', available: false };
  if (status === 'SUBMITTED') return { label: 'Submitted', available: false };
  return { label: 'Draft', available: false };
};

export const ToothImagingPanelSection: React.FC<ToothImagingPanelSectionProps> = ({
  selectedToothNumber,
  visitId = '',
  episodeId = null,
  canEdit = true,
  consultationCompleted = false,
  disabled = false,
}) => {
  const [activeViewerItem, setActiveViewerItem] = useState<{
    attachment: ImagingAttachment | ViewerAttachmentItem;
    attachments: (ImagingAttachment | ViewerAttachmentItem)[];
    orderId?: string;
    directDownloadUrl?: string;
    investigationName: string;
    toothNumber?: number | null;
  } | null>(null);

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const featureInput: DentalImagingFeatureInput = {
    visitId,
    episodeId,
    active: true,
    canEdit: canEdit && !disabled,
    consultationCompleted,
    draft: { priority: 'ROUTINE', items: [] },
  };

  const feature = useDentalImagingFeature(featureInput);
  const chairside = useDentalChairsideImaging({
    visitId,
    episodeId,
    selectedTooth: selectedToothNumber,
    enabled: Boolean(visitId && feature.canView),
  });

  const formatCurrency = useCurrencyFormatter();
  const { order, form, catalogue } = feature;

  // Filter chairside images strictly for the selected tooth
  const toothChairsideImages = chairside.allVisitImages.filter(
    (img) => img.tooth_number === selectedToothNumber,
  );

  // Filter formal radiology orders for this tooth
  const toothRadiologyItems = (order.data?.items ?? []).filter(
    (item) => item.tooth_number === selectedToothNumber,
  );

  const selectedServiceId = form.watch('serviceId');
  const selectedToothVal = form.watch('tooth');
  const rawServices = catalogue.data?.data ?? [];
  const dentalImagingServices = rawServices.filter(isDentalImagingService);
  const currentResultInfo = getResultAvailability(order.data?.status);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await chairside.uploadImage({
        file,
        toothNumber: selectedToothNumber,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      // toast is displayed by hook
    }
  };

  // Camera capture modal open / start stream
  const openCamera = async () => {
    setCameraError(null);
    setCameraModalOpen(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError('Camera access is not supported by your browser. Please use Upload.');
      }
    } catch {
      setCameraError('Unable to access device camera. Please check camera permissions or use Upload.');
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
  };

  const captureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      try {
        await chairside.uploadImage({
          file: blob,
          fileName: `Tooth_${selectedToothNumber}_${Date.now()}.png`,
          toothNumber: selectedToothNumber,
        });
      } catch {
        // toast handled in hook
      }
    }, 'image/png');
  };

  const handleOpenChairsideViewer = (image: DentalChairsideImage) => {
    const rawUrl = image.file_url || opdApi.getDentalChairsideImageDownloadUrl(image.id);
    const downloadUrl = getAuthenticatedMediaUrl(rawUrl);
    const viewerItem: ViewerAttachmentItem = {
      id: image.id,
      file_name: image.file_name,
      mime_type: image.mime_type,
      file_size_bytes: image.file_size_bytes,
      uploaded_at: image.created_at,
      file_url: downloadUrl,
    };
    setActiveViewerItem({
      attachment: viewerItem,
      attachments: toothChairsideImages.map((img) => ({
        id: img.id,
        file_name: img.file_name,
        mime_type: img.mime_type,
        file_size_bytes: img.file_size_bytes,
        uploaded_at: img.created_at,
        file_url: getAuthenticatedMediaUrl(img.file_url || opdApi.getDentalChairsideImageDownloadUrl(img.id)),
      })),
      directDownloadUrl: downloadUrl,
      investigationName: `Immediate Chairside Imaging · Tooth #${selectedToothNumber}`,
      toothNumber: image.tooth_number,
    });
  };

  if (!visitId) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '12px 14px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
      role="region"
      aria-label={`Tooth ${selectedToothNumber} Imaging`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ph ph-camera" style={{ color: '#2563eb', fontSize: '1.1rem' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
            Imaging · Tooth #{selectedToothNumber}
          </span>
        </div>
        {feature.canAdd && (
          <button
            type="button"
            className={styles.btnAddAction}
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            onClick={() => feature.openRequest(selectedToothNumber)}
            disabled={disabled}
            title="Order formal radiology X-Ray or Scan for this tooth"
          >
            + Order X-Ray / Scan
          </button>
        )}
      </div>

      {/* Chairside Imaging Section */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
        {canEdit && !disabled && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.btnCaptureAction}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={openCamera}
              disabled={chairside.isUploading}
              title="Capture image from device camera"
            >
              <i className="ph ph-camera" /> Capture Image
            </button>
            <button
              type="button"
              className={styles.btnUploadAction}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={chairside.isUploading}
              title="Upload scan/photo"
            >
              <i className="ph ph-upload-simple" /> {chairside.isUploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e)}
            />
          </div>
        )}

        {chairside.isLoading && <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Loading images...</p>}

        {toothChairsideImages.length === 0 && !chairside.isLoading && (
          <div style={{ textAlign: 'center', padding: '8px 6px', color: '#94a3b8', fontSize: '0.78rem' }}>
            <i className="ph ph-image" style={{ fontSize: '1.2rem', display: 'block', marginBottom: '2px', color: '#cbd5e1' }} />
            No images recorded for Tooth #{selectedToothNumber}
          </div>
        )}

        {toothChairsideImages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginTop: '6px' }}>
            {toothChairsideImages.map((img) => (
              <div
                key={img.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  position: 'relative',
                }}
              >
                <img
                  src={getAuthenticatedMediaUrl(img.file_url)}
                  alt={img.file_name}
                  style={{
                    width: '100%',
                    height: '75px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: '#f1f5f9',
                  }}
                  onClick={() => handleOpenChairsideViewer(img)}
                  title="Click to view full resolution"
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '85px',
                    }}
                    title={img.file_name}
                  >
                    {img.file_name}
                  </span>
                  {canEdit && !disabled && !consultationCompleted && (
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '0.75rem',
                      }}
                      onClick={() => void chairside.deleteImage(img.id)}
                      disabled={chairside.isDeleting}
                      title="Delete image"
                    >
                      <i className="ph ph-trash" />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {new Date(img.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Dr. {img.doctor_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formal Radiology Section for this Tooth */}
      {toothRadiologyItems.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
            Formal Radiology Requests ({toothRadiologyItems.length})
          </span>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {toothRadiologyItems.map((item, idx) => (
              <li
                key={item.id ?? `${item.service_id}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <strong style={{ color: '#0f172a' }}>{item.investigation_name}</strong>
                  <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#64748b' }}>
                    {order.data?.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    background: currentResultInfo.available ? '#dcfce7' : '#fef3c7',
                    color: currentResultInfo.available ? '#166534' : '#b45309',
                  }}
                >
                  {currentResultInfo.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add X-Ray / Scan Modal for Normal Radiology Order */}
      {feature.open && (
        <Modal
          open
          title={`Order Dental Imaging · Tooth #${selectedToothNumber}`}
          className={`${styles.imagingPanel} ${styles.imagingDialog}`}
          onClose={() => {
            if (!feature.saving) feature.setOpen(false);
          }}
          footer={
            <div className={styles.dialogFooterActions}>
              <button
                type="button"
                disabled={feature.saving}
                onClick={() => feature.setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="dental-tooth-imaging-form"
                disabled={feature.saving || !feature.canAdd || catalogue.isFetching || !selectedServiceId}
              >
                {feature.saving ? 'Saving…' : 'Add X-Ray / Scan'}
              </button>
            </div>
          }
        >
          <form
            id="dental-tooth-imaging-form"
            className={styles.dialogForm}
            onSubmit={(event) => {
              void feature.saveRequest(event);
            }}
          >
            <div className={styles.toothContextCard}>
              <span>Selected Context:</span>
              <strong>
                Tooth #{selectedToothVal || selectedToothNumber} ({getToothName(Number(selectedToothVal || selectedToothNumber))})
              </strong>
            </div>

            <label>
              Search catalogue
              <input
                type="search"
                placeholder="Search dental imaging..."
                value={feature.searchTerm}
                onChange={(event) => feature.changeSearch(event.target.value)}
              />
            </label>
            {catalogue.isLoading && <p role="status">Loading imaging services…</p>}
            {catalogue.isError && (
              <p role="alert">
                {getOpdErrorMessage(catalogue.error)}{' '}
                <button
                  type="button"
                  onClick={() => {
                    void catalogue.refetch();
                  }}
                >
                  Retry catalogue
                </button>
              </p>
            )}

            <label>
              Select Dental Imaging Service <span className={styles.required}>*</span>
            </label>
            {catalogue.isSuccess && dentalImagingServices.length === 0 && (
              <div className={styles.emptyServiceState}>
                <p>No active dental imaging services match this search.</p>
              </div>
            )}

            {dentalImagingServices.length > 0 && (
              <div className={styles.serviceCardList} role="radiogroup" aria-label="Dental imaging services">
                {dentalImagingServices.map((service) => (
                  <label
                    key={service.id}
                    className={`${styles.serviceCard} ${selectedServiceId === service.id ? styles.serviceCardSelected : ''}`}
                  >
                    <input
                      type="radio"
                      value={service.id}
                      {...form.register('serviceId')}
                      disabled={feature.saving || catalogue.isFetching}
                    />
                    <div className={styles.serviceCardInfo}>
                      <strong>{service.name}</strong>
                      <span className={styles.serviceCardCategory}>{service.category || 'Dental Imaging'}</span>
                    </div>
                    <span className={styles.serviceCardPrice}>{formatCurrency(service.standard_price)}</span>
                  </label>
                ))}
              </div>
            )}
            {form.formState.errors.serviceId && <p role="alert">{form.formState.errors.serviceId.message}</p>}

            <label>
              Tooth
              <select {...form.register('tooth')} disabled={feature.saving}>
                <option value={selectedToothNumber}>
                  Tooth #{selectedToothNumber} - {getToothName(selectedToothNumber)} (Selected)
                </option>
                <option value="">General / Full Mouth</option>
                {[...Object.values(PERMANENT_QUADRANTS).flat(), ...Object.values(PRIMARY_QUADRANTS).flat()]
                  .filter((t) => t !== selectedToothNumber)
                  .map((tooth) => (
                    <option key={tooth} value={tooth}>
                      Tooth #{tooth} - {getToothName(tooth)}
                    </option>
                  ))}
              </select>
            </label>
            {form.formState.errors.tooth && <p role="alert">{form.formState.errors.tooth.message}</p>}

            <label>
              Clinical Indication / Reason (optional)
              <input
                type="text"
                placeholder="e.g. Suspected apical periodontitis"
                {...form.register('clinicalNotes')}
                disabled={feature.saving}
              />
            </label>

            {feature.saveError && (
              <p role="alert">
                {feature.saveError}{' '}
                <button
                  type="button"
                  onClick={() => {
                    void order.refetch();
                  }}
                >
                  Refresh order
                </button>
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Camera Capture Modal */}
      {cameraModalOpen && (
        <Modal
          open
          title={`Capture Chairside Image · Tooth #${selectedToothNumber}`}
          className={styles.cameraModal}
          onClose={closeCamera}
          footer={
            <div className={styles.dialogFooterActions}>
              <button type="button" onClick={closeCamera}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnCaptureAction}
                onClick={() => void captureSnapshot()}
                disabled={Boolean(cameraError)}
              >
                <i className="ph ph-camera" /> Capture &amp; Save
              </button>
            </div>
          }
        >
          <div className={styles.cameraViewport}>
            {cameraError ? (
              <p style={{ color: '#f87171', padding: '1rem', textAlign: 'center' }}>{cameraError}</p>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.cameraVideo}
                onLoadedMetadata={() => {
                  void videoRef.current?.play();
                }}
              />
            )}
          </div>
        </Modal>
      )}

      {/* Shared Image Viewer Modal */}
      <DentalImageViewerModal
        open={Boolean(activeViewerItem)}
        onClose={() => setActiveViewerItem(null)}
        attachment={activeViewerItem?.attachment ?? null}
        attachments={activeViewerItem?.attachments ?? []}
        orderId={activeViewerItem?.orderId ?? ''}
        directDownloadUrl={activeViewerItem?.directDownloadUrl}
        investigationName={activeViewerItem?.investigationName ?? `Dental Imaging · Tooth #${selectedToothNumber}`}
        toothNumber={activeViewerItem?.toothNumber ?? selectedToothNumber}
        canDownload={feature.canView}
        onSelectAttachment={(att) => {
          if (activeViewerItem) {
            setActiveViewerItem({
              ...activeViewerItem,
              attachment: att,
              directDownloadUrl: 'file_url' in att && att.file_url ? att.file_url : undefined,
            });
          }
        }}
      />
    </div>
  );
};
