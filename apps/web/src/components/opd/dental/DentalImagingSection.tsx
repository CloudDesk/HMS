import { useRef, useState } from 'react';
import { useDentalImagingFeature, type DentalImagingFeatureInput } from '../../../hooks/opd/useDentalImagingFeature';
import { useDentalChairsideImaging } from '../../../hooks/opd/useDentalChairsideImaging';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { PERMANENT_QUADRANTS, PRIMARY_QUADRANTS, isDentalImagingService, getToothName } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { imagingApi, type ImagingAttachment } from '../../../api/imaging';
import { getAuthenticatedMediaUrl } from '../../../api/client';
import { opdApi, type DentalChairsideImage } from '../../../api/opd';
import styles from './DentalClinicalOrders.module.css';
import { Modal } from '../../ui/Modal';
import { DentalImageViewerModal, type ViewerAttachmentItem } from './DentalImageViewerModal';

type Props = DentalImagingFeatureInput & { selectedTooth: number | null };

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getResultAvailability = (status?: string | null) => {
  if (status && ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(status)) {
    return { label: status === 'VERIFIED' ? 'Verified Report' : 'Report Available', available: true };
  }
  if (status === 'IN_PROGRESS') return { label: 'In Progress', available: false };
  if (status === 'RECEIVED') return { label: 'Received', available: false };
  if (status === 'SUBMITTED') return { label: 'Submitted', available: false };
  return { label: 'Draft', available: false };
};

export function DentalImagingSection({ selectedTooth, ...input }: Props) {
  const [activeViewerItem, setActiveViewerItem] = useState<{
    attachment: ImagingAttachment | ViewerAttachmentItem;
    attachments: (ImagingAttachment | ViewerAttachmentItem)[];
    orderId?: string;
    directDownloadUrl?: string;
    investigationName: string;
    toothNumber?: number | null;
  } | null>(null);

  const [uploadToothNumber, setUploadToothNumber] = useState<number | null>(selectedTooth ?? null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const feature = useDentalImagingFeature(input);
  const chairside = useDentalChairsideImaging({
    visitId: input.visitId,
    episodeId: input.episodeId,
    selectedTooth: null,
    enabled: feature.canView,
  });

  const formatCurrency = useCurrencyFormatter();
  const { order, form, catalogue, report } = feature;

  if (!feature.canView) {
    return <section className={styles.imagingPanel}>You do not have permission to view imaging requests.</section>;
  }

  const allVisitChairsideImages = chairside.allVisitImages;
  const allOrderItems = order.data?.items ?? [];

  const selectedServiceId = form.watch('serviceId');
  const selectedToothVal = form.watch('tooth');
  const rawServices = catalogue.data?.data ?? [];
  const dentalImagingServices = rawServices.filter(isDentalImagingService);
  const currentResultInfo = getResultAvailability(order.data?.status);
  const otherEpisodeOrders = feature.episodeOrders.filter((epOrder) => epOrder.id !== order.data?.id);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await chairside.uploadImage({
        file,
        fileName: file.name ? file.name : (uploadToothNumber ? `Tooth_${uploadToothNumber}_${Date.now()}.png` : `Tooth_Image_${Date.now()}.png`),
        toothNumber: uploadToothNumber,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      // toast is already displayed by hook
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
        setCameraError('Camera access is not supported by your browser. Please use the Upload option.');
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
          fileName: uploadToothNumber ? `Tooth_${uploadToothNumber}_${Date.now()}.png` : `Tooth_Image_${Date.now()}.png`,
          toothNumber: uploadToothNumber,
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
      attachments: allVisitChairsideImages.map((img) => ({
        id: img.id,
        file_name: img.file_name,
        mime_type: img.mime_type,
        file_size_bytes: img.file_size_bytes,
        uploaded_at: img.created_at,
        file_url: getAuthenticatedMediaUrl(img.file_url || opdApi.getDentalChairsideImageDownloadUrl(img.id)),
      })),
      directDownloadUrl: downloadUrl,
      investigationName: image.tooth_number ? `Chairside Imaging · Tooth #${image.tooth_number}` : 'Immediate Chairside Imaging',
      toothNumber: image.tooth_number,
    });
  };

  const handleOpenReportViewer = (att: ImagingAttachment, orderId: string, toothNum?: number | null) => {
    const activeOrder = order.data?.id === orderId ? order.data : otherEpisodeOrders.find((o) => o.id === orderId);
    const investigationName = activeOrder?.items?.[0]?.investigation_name || 'Radiology Investigation';
    setActiveViewerItem({
      attachment: att,
      attachments: report.data?.attachments ?? [att],
      orderId,
      investigationName,
      toothNumber: toothNum,
    });
  };

  const renderChairsideCard = (img: DentalChairsideImage) => (
    <div key={img.id} className={styles.chairsideCard}>
      <div className={styles.chairsideCardTop}>
        <span className={styles.chairsideCardTooth}>
          {img.tooth_number ? `Tooth #${img.tooth_number}` : 'General / Full Mouth'}
        </span>
        <span className={styles.chairsideCardDate}>
          {new Date(img.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className={styles.chairsideCardBody}>
        <img
          src={getAuthenticatedMediaUrl(img.file_url)}
          alt={img.file_name}
          className={styles.chairsideThumb}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
        <div className={styles.chairsideMeta}>
          <span className={styles.chairsideFileName} title={img.file_name}>
            {img.file_name}
          </span>
          <span className={styles.chairsideDoctor}>
            Dr. {img.doctor_name} · {formatFileSize(img.file_size_bytes)}
          </span>
          {img.notes && <span className={styles.chairsideNotes}>{img.notes}</span>}
        </div>
      </div>

      <div className={styles.chairsideCardActions}>
        <button
          type="button"
          className={styles.viewImageBtn}
          onClick={() => handleOpenChairsideViewer(img)}
          aria-label={`View image ${img.file_name}`}
        >
          <i className="ph ph-eye" />
          View Image
        </button>

        {input.canEdit && !input.consultationCompleted && (
          <button
            type="button"
            className={styles.btnDeleteMini}
            onClick={() => void chairside.deleteImage(img.id)}
            disabled={chairside.isDeleting}
            title="Delete this chairside image"
            aria-label="Delete chairside image"
          >
            <i className="ph ph-trash" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className={styles.section} aria-label="Dental imaging">
      {/* =========================================================
          1. IMMEDIATE CHAIRSIDE IMAGING (ALL CONSULTATION SCANS)
          ========================================================= */}
      <div className={styles.chairsideContainer} role="region" aria-label="Immediate Chairside Imaging">
        <div className={styles.chairsideHeader}>
          <div>
            <h3 className={styles.chairsideTitle}>
              <i className="ph ph-camera" style={{ color: '#2563eb' }} />
              Immediate Chairside Imaging
            </h3>
            <p>Immediate chairside image capture during dental consultation.</p>
          </div>

          <div className={styles.chairsideActionRow}>
            {input.canEdit && (
              <>
                <select
                  value={uploadToothNumber ?? ''}
                  onChange={(e) => setUploadToothNumber(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                  aria-label="Tooth association for chairside image"
                  title="Select tooth to associate with chairside image"
                >
                  <option value="">General / Full Mouth</option>
                  <optgroup label="Permanent Dentition (FDI)">
                    {[
                      ...PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.slice().reverse(),
                      ...PERMANENT_QUADRANTS.Q2_UPPER_LEFT,
                      ...PERMANENT_QUADRANTS.Q3_LOWER_LEFT,
                      ...PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.slice().reverse(),
                    ].map((num) => (
                      <option key={num} value={num}>
                        Tooth #{num} — {getToothName(num)}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <button
                  type="button"
                  className={styles.btnCaptureAction}
                  onClick={openCamera}
                  disabled={chairside.isUploading}
                  title="Capture image from device camera"
                >
                  <i className="ph ph-camera" />
                  Capture Image
                </button>

                <button
                  type="button"
                  className={styles.btnUploadAction}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chairside.isUploading}
                  title="Upload chairside scan/photo"
                >
                  <i className="ph ph-upload-simple" />
                  {chairside.isUploading ? 'Uploading...' : 'Upload Chairside Image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleFileUpload(e)}
                />
              </>
            )}
          </div>
        </div>

        {chairside.isLoading && <p role="status">Loading chairside images...</p>}

        {allVisitChairsideImages.length === 0 && !chairside.isLoading && (
          <div className={styles.chairsideEmpty}>
            <i className="ph ph-image" style={{ fontSize: '1.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }} />
            No chairside images recorded for this visit.
            {input.canEdit && ' Click Capture or Upload to save immediate chairside scans.'}
          </div>
        )}

        {/* All Consultation Chairside Images */}
        {allVisitChairsideImages.length > 0 && (
          <div className={styles.chairsideGrid}>
            {allVisitChairsideImages.map(renderChairsideCard)}
          </div>
        )}

        {/* Other Episode Chairside Images (from prior visits in the same journey) */}
        {chairside.episodeImages.length > 0 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', fontWeight: 600 }}>
              <i className="ph ph-clock-counter-clockwise" style={{ marginRight: '4px' }} />
              Prior Visit Chairside Images ({chairside.episodeImages.length})
            </h4>
            <div className={styles.chairsideGrid}>
              {chairside.episodeImages.map((img) => (
                <div key={img.id} className={styles.chairsideCard} style={{ background: '#f8fafc' }}>
                  <div className={styles.chairsideCardTop}>
                    <span className={styles.chairsideCardTooth}>
                      {img.tooth_number ? `Tooth #${img.tooth_number}` : 'General / Full Mouth'}
                    </span>
                    <span className={styles.chairsideCardDate}>
                      {new Date(img.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.chairsideCardBody}>
                    <img src={getAuthenticatedMediaUrl(img.file_url)} alt={img.file_name} className={styles.chairsideThumb} />
                    <div className={styles.chairsideMeta}>
                      <span className={styles.chairsideFileName}>{img.file_name}</span>
                      <span className={styles.chairsideDoctor}>Visit {img.visit_number} · Dr. {img.doctor_name}</span>
                    </div>
                  </div>
                  <div className={styles.chairsideCardActions}>
                    <button
                      type="button"
                      className={styles.viewImageBtn}
                      onClick={() => handleOpenChairsideViewer(img)}
                    >
                      <i className="ph ph-eye" />
                      View Image
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <hr className={styles.sectionDivider} />

      {/* =========================================================
          2. FORMAL IMAGING ORDERS (RADIOLOGY DEPARTMENT WORKFLOW)
          ========================================================= */}
      <div className={styles.imagingHeader}>
        <div>
          <h3>Formal Imaging Orders</h3>
          <p>Formal Radiology Department investigations and diagnostic orders.</p>
        </div>
        <div className={styles.imagingActions}>
          <button
            type="button"
            disabled={order.isFetching || feature.saving}
            onClick={() => {
              void order.refetch();
            }}
          >
            Refresh status
          </button>
          {feature.canAdd && (
            <button
              type="button"
              className={styles.btnAddAction}
              onClick={() => feature.openRequest(uploadToothNumber ?? selectedTooth ?? null)}
            >
              + Add X-Ray / Scan
            </button>
          )}
        </div>
      </div>

      {order.isLoading && <p role="status">Loading imaging requests…</p>}
      {order.isError && (
        <p role="alert">
          {getOpdErrorMessage(order.error)}{' '}
          <button
            type="button"
            onClick={() => {
              void order.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      {order.isSuccess && allOrderItems.length === 0 && (
        <p>No formal radiology requests for this visit.</p>
      )}

      {/* All Visit Radiology Orders */}
      {allOrderItems.length > 0 && (
        <ul className={styles.imagingList}>
          {allOrderItems.map((item, idx) => (
            <li key={item.id ?? `${item.service_id}-${item.tooth_number ?? 'gen'}-${idx}`}>
              <strong>{item.investigation_name}</strong>
              <span style={{ fontWeight: 600, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                {item.tooth_number ? `Tooth #${item.tooth_number}` : 'General / Full Mouth'}
              </span>
              <span className={styles.contextBadge}>{order.data?.status.replaceAll('_', ' ')}</span>
              <span className={`${styles.resultBadge} ${currentResultInfo.available ? styles.resultAvailable : styles.resultPending}`}>
                {currentResultInfo.label}
              </span>
              {order.data?.clinical_notes && (
                <span style={{ width: '100%', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                  Indication: {order.data.clinical_notes}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {otherEpisodeOrders.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.4rem' }}>Other Episode Imaging Orders</h4>
          <ul className={styles.imagingList}>
            {otherEpisodeOrders.flatMap((epOrder) =>
              epOrder.items.map((item, idx) => {
                const epResult = getResultAvailability(epOrder.status);
                return (
                  <li key={`${epOrder.id}-${item.id ?? idx}`}>
                    <strong>{item.investigation_name}</strong>
                    <span>{item.tooth_number ? `Tooth #${item.tooth_number}` : 'General / Full Mouth'}</span>
                    <span className={styles.contextBadge}>{epOrder.status.replaceAll('_', ' ')}</span>
                    <span className={`${styles.resultBadge} ${epResult.available ? styles.resultAvailable : styles.resultPending}`}>
                      {epResult.label}
                    </span>
                    {epOrder.clinical_notes && (
                      <span style={{ width: '100%', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                        Indication: {epOrder.clinical_notes}
                      </span>
                    )}
                    {epResult.available && (
                      <button type="button" onClick={() => feature.openOrderReport(epOrder.id)}>
                        View Image
                      </button>
                    )}
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      )}

      {order.data?.status === 'DRAFT' && (
        <p>Saved draft. Radiology receives the request after consultation completion and submission.</p>
      )}
      {input.consultationCompleted && input.canEdit && order.data?.status === 'DRAFT' && (
        <button
          type="button"
          disabled={feature.saving}
          onClick={() => {
            void feature.submitRequest();
          }}
        >
          Submit imaging request
        </button>
      )}
      {feature.saveError && !feature.open && <p role="alert">{feature.saveError}</p>}
      {feature.reportAvailable && (
        <button
          type="button"
          onClick={() => {
            if (feature.reportOpen) {
              feature.setReportOpen(false);
            } else {
              feature.openOrderReport(order.data?.id);
            }
          }}
        >
          {feature.reportOpen ? 'Hide report' : 'View report'}
        </button>
      )}

      {feature.reportOpen && (
        <div className={styles.imagingReport} aria-label="Imaging report">
          <h4>Visit imaging report</h4>
          <p>This report covers the original visit imaging order.</p>
          {report.isLoading && <p role="status">Loading report…</p>}
          {report.isError && (
            <p role="alert">
              {getOpdErrorMessage(report.error)}{' '}
              <button
                type="button"
                onClick={() => {
                  void report.refetch();
                }}
              >
                Retry report
              </button>
            </p>
          )}
          {report.data && (
            <>
              <p>{report.data.verified_at ? 'Verified report' : 'Report entered — awaiting verification'}</p>
              <h4>Findings</h4>
              <p>{report.data.findings}</p>
              <h4>Impression</h4>
              <p>{report.data.impression}</p>
              {report.data.recommendations && (
                <>
                  <h4>Recommendations</h4>
                  <p>{report.data.recommendations}</p>
                </>
              )}
              {report.data.attachments && report.data.attachments.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <h4>Attached Images &amp; Files ({report.data.attachments.length})</h4>
                  <ul className={styles.attachmentList}>
                    {report.data.attachments.map((att) => (
                      <li key={att.id} className={styles.attachmentItem}>
                        <div className={styles.attachmentInfo}>
                          <strong>{att.file_name}</strong>
                          <span className={styles.attachmentMeta}>
                            {att.mime_type} {att.file_size_bytes ? `• ${formatFileSize(att.file_size_bytes)}` : ''}
                          </span>
                        </div>
                        <div className={styles.attachmentActions}>
                          {feature.canView && (
                            <button
                              type="button"
                              className={styles.viewImageBtn}
                              onClick={() => handleOpenReportViewer(att, report.data!.order_id)}
                              aria-label={`View image ${att.file_name}`}
                            >
                              View Image
                            </button>
                          )}
                          <a
                            href={imagingApi.getAttachmentDownloadUrl(report.data!.order_id, att.id)}
                            className={styles.downloadBtn}
                            target="_blank"
                            rel="noreferrer"
                            download={att.file_name}
                          >
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add X-Ray / Scan Modal for Normal Radiology Order */}
      {feature.open && (
        <Modal
          open
          title="Add X-Ray / Scan"
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
                form="dental-imaging-form"
                disabled={feature.saving || !feature.canAdd || catalogue.isFetching || !selectedServiceId}
              >
                {feature.saving ? 'Saving…' : 'Add X-Ray / Scan'}
              </button>
            </div>
          }
        >
          <form
            id="dental-imaging-form"
            className={styles.dialogForm}
            onSubmit={(event) => {
              void feature.saveRequest(event);
            }}
          >
            <div className={styles.toothContextCard}>
              <span>Selected Context:</span>
              <strong>
                {selectedToothVal
                  ? `Tooth #${selectedToothVal} (${getToothName(Number(selectedToothVal))})`
                  : 'General / Full Mouth Imaging'}
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
              Tooth (optional)
              <select {...form.register('tooth')} disabled={feature.saving}>
                <option value="">General / Full Mouth</option>
                {[...Object.values(PERMANENT_QUADRANTS).flat(), ...Object.values(PRIMARY_QUADRANTS).flat()].map((tooth) => (
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
                placeholder="e.g. Suspected deep pulp involvement"
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
          title={`Capture Chairside Image ${selectedTooth ? `· Tooth #${selectedTooth}` : ''}`}
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
                <i className="ph ph-camera" />
                Capture &amp; Save
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

      {/* Shared Image Viewer Modal for both Chairside & Radiology Report Attachments */}
      <DentalImageViewerModal
        open={Boolean(activeViewerItem)}
        onClose={() => setActiveViewerItem(null)}
        attachment={activeViewerItem?.attachment ?? null}
        attachments={activeViewerItem?.attachments ?? []}
        orderId={activeViewerItem?.orderId ?? ''}
        directDownloadUrl={activeViewerItem?.directDownloadUrl}
        investigationName={activeViewerItem?.investigationName ?? 'Dental Imaging'}
        toothNumber={activeViewerItem?.toothNumber ?? null}
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
    </section>
  );
}
