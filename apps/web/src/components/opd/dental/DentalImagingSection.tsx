import React, { useRef, useState } from 'react';
import { useDentalImagingFeature, type DentalImagingFeatureInput } from '../../../hooks/opd/useDentalImagingFeature';
import { useDentalChairsideImaging } from '../../../hooks/opd/useDentalChairsideImaging';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { imagingApi, type ImagingAttachment } from '../../../api/imaging';
import { getAuthenticatedMediaUrl } from '../../../api/client';
import { opdApi, type DentalChairsideImage } from '../../../api/opd';
import type { PatientDocumentResponse } from '../../../api/patients';
import { getToothName, isDentalImagingService, PERMANENT_QUADRANTS, PRIMARY_QUADRANTS } from '../../../pages/dental-utils';
import styles from './DentalClinicalOrders.module.css';
import { Modal } from '../../ui/Modal';
import { DentalImageViewerModal, type ViewerAttachmentItem } from './DentalImageViewerModal';
import { AuthenticatedMediaImage } from '../../ui/AuthenticatedMediaImage';

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
  const [selectedToothNumber, setSelectedToothNumber] = useState<number | null>(selectedTooth ?? null);
  const [chairsideToothFilter, setChairsideToothFilter] = useState<'ALL' | 'GENERAL' | number>('ALL');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
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

  const formatCurrency = useCurrencyFormatter();
  const feature = useDentalImagingFeature(input);
  const chairside = useDentalChairsideImaging({
    visitId: input.visitId,
    episodeId: input.episodeId,
    selectedTooth: null,
    enabled: feature.canView,
  });

  const { order, report, form, catalogue } = feature;

  if (!feature.canView) {
    return <section className={styles.imagingPanel}>You do not have permission to view imaging requests.</section>;
  }

  const allVisitChairsideImages = chairside.allVisitImages;
  const selectedServiceId = form.watch('serviceId');
  const rawServices = catalogue.data?.data ?? [];
  const dentalImagingServices = rawServices.filter(isDentalImagingService);

  const allTeeth = [
    ...Object.values(PERMANENT_QUADRANTS).flat(),
    ...Object.values(PRIMARY_QUADRANTS).flat(),
  ];

  const filteredChairsideImages = allVisitChairsideImages.filter((img) => {
    if (chairsideToothFilter === 'ALL') return true;
    if (chairsideToothFilter === 'GENERAL') return !img.tooth_number;
    return img.tooth_number === chairsideToothFilter;
  });

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
          fileName: selectedToothNumber ? `Tooth_${selectedToothNumber}_${Date.now()}.png` : `Scan_${Date.now()}.png`,
          toothNumber: selectedToothNumber,
        });
      } catch {
        // toast handled in hook
      }
    }, 'image/png');
  };
  const otherEpisodeOrders = feature.episodeOrders.filter((epOrder) => epOrder.id !== order.data?.id);
  const formalOrderRows = [
    ...(order.data?.items ?? []).map((item, index) => ({ order: order.data!, item, index })),
    ...otherEpisodeOrders.flatMap((episodeOrder) =>
      (episodeOrder.items ?? []).map((item, index) => ({ order: episodeOrder, item, index })),
    ),
  ];
  const visibleFormalOrderRows = formalOrderRows.filter(({ order: rowOrder, item }) => {
    const statusGroup: 'PENDING' | 'COMPLETED' = ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(rowOrder.status)
      ? 'COMPLETED'
      : 'PENDING';
    const query = orderSearch.trim().toLowerCase();
    const matchesFilter = orderFilter === 'ALL' || orderFilter === statusGroup;
    const matchesSearch = !query || [
      item.investigation_name,
      item.tooth_number ? `tooth ${item.tooth_number}` : 'full mouth',
      rowOrder.doctor_name,
      rowOrder.status,
    ].some((value) => value.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

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

  const handleOpenReportDocument = async (document: PatientDocumentResponse) => {
    const activeOrder = feature.activeReportOrder;
    if (!activeOrder) return;
    const download = await feature.downloadReportDocument.mutateAsync({
      patientId: activeOrder.patient_id,
      docId: document.id,
    });
    const fileUrl = URL.createObjectURL(download.blob);
    setActiveViewerItem({
      attachment: {
        id: document.id,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size_bytes: document.file_size_bytes,
        uploaded_at: document.uploaded_at,
        file_url: fileUrl,
      },
      attachments: [{
        id: document.id,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size_bytes: document.file_size_bytes,
        uploaded_at: document.uploaded_at,
        file_url: fileUrl,
      }],
      directDownloadUrl: fileUrl,
      investigationName: activeOrder.items[0]?.investigation_name || 'Radiology Investigation',
      toothNumber: activeOrder.dental_context?.tooth_number ?? activeOrder.items[0]?.tooth_number ?? null,
    });
  };

  const handleDownloadReportDocument = async (document: PatientDocumentResponse) => {
    const activeOrder = feature.activeReportOrder;
    if (!activeOrder) return;
    const download = await feature.downloadReportDocument.mutateAsync({
      patientId: activeOrder.patient_id,
      docId: document.id,
    });
    const url = URL.createObjectURL(download.blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = download.fileName ?? document.file_name;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const closeImageViewer = () => {
    if (activeViewerItem?.directDownloadUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(activeViewerItem.directDownloadUrl);
    }
    setActiveViewerItem(null);
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
        <AuthenticatedMediaImage
          src={img.file_url || opdApi.getDentalChairsideImageDownloadUrl(img.id)}
          alt={img.file_name}
          className={styles.chairsideThumb}
        />
        <div className={styles.chairsideMeta}>
          <span className={styles.chairsideFileName} title={img.file_name}>
            {img.file_name}
          </span>
          <span className={styles.chairsideDoctor}>{img.doctor_name.startsWith('Dr.') ? img.doctor_name : `Dr. ${img.doctor_name}`}</span>
          <span className={styles.chairsideDoctor}>
            {formatFileSize(img.file_size_bytes)} · {new Date(img.created_at).toLocaleDateString()}
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
      <header className={styles.imagingPageHeader}>
        <h2><i className="ph ph-image-square" /> Imaging</h2>
        <p>View images taken during this visit and radiology reports for this patient.</p>
      </header>
      {/* =========================================================
          1. IMMEDIATE CHAIRSIDE IMAGING (ALL CONSULTATION SCANS)
          ========================================================= */}
      <div className={styles.chairsideContainer} role="region" aria-label="Immediate Chairside Imaging">
        <div className={styles.chairsideHeader}>
          <div>
            <h3 className={styles.chairsideTitle}>
              <i className="ph ph-camera" style={{ color: '#2563eb' }} />
              Chairside Images
            </h3>
            <p>Images captured by the dental team during this consultation.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={styles.imageCountBadge}>{allVisitChairsideImages.length} {allVisitChairsideImages.length === 1 ? 'Image' : 'Images'}</span>
            {input.canEdit && !input.consultationCompleted && (
              <>
                <select
                  value={selectedToothNumber ?? ''}
                  onChange={(e) => setSelectedToothNumber(e.target.value ? Number(e.target.value) : null)}
                  className={styles.toothSelect}
                  title="Target tooth for image capture, upload, or radiology order"
                  aria-label="Target Tooth"
                >
                  <option value="">General / Full Mouth</option>
                  {allTeeth.map((tooth) => (
                    <option key={tooth} value={tooth}>
                      Tooth #{tooth} - {getToothName(tooth)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={styles.btnCaptureAction}
                  onClick={openCamera}
                  disabled={chairside.isUploading}
                  title="Capture image from device camera"
                >
                  <i className="ph ph-camera" /> Capture Image
                </button>

                <button
                  type="button"
                  className={styles.btnUploadAction}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chairside.isUploading}
                  title="Upload scan/photo from file"
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
              </>
            )}

            {feature.canAdd && (
              <button
                type="button"
                className={styles.btnAddAction}
                onClick={() => feature.openRequest(selectedToothNumber)}
                disabled={chairside.isUploading}
                title="Order formal radiology X-Ray or Scan"
              >
                + Order X-Ray / Scan
              </button>
            )}
          </div>
        </div>

        {allVisitChairsideImages.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '8px 0 12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Filter:</span>
            <button
              type="button"
              className={chairsideToothFilter === 'ALL' ? styles.orderFilterActive : ''}
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '14px', border: '1px solid #cbd5e1' }}
              onClick={() => setChairsideToothFilter('ALL')}
            >
              All ({allVisitChairsideImages.length})
            </button>
            <button
              type="button"
              className={chairsideToothFilter === 'GENERAL' ? styles.orderFilterActive : ''}
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '14px', border: '1px solid #cbd5e1' }}
              onClick={() => setChairsideToothFilter('GENERAL')}
            >
              General / Full Mouth
            </button>
            {Array.from(new Set(allVisitChairsideImages.map((img) => img.tooth_number).filter(Boolean))).map((t) => (
              <button
                key={t!}
                type="button"
                className={chairsideToothFilter === t ? styles.orderFilterActive : ''}
                style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '14px', border: '1px solid #cbd5e1' }}
                onClick={() => setChairsideToothFilter(t!)}
              >
                Tooth #{t}
              </button>
            ))}
          </div>
        )}

        {chairside.isLoading && <p role="status">Loading chairside images...</p>}

        {allVisitChairsideImages.length === 0 && !chairside.isLoading && (
          <div className={styles.chairsideEmpty}>
            <i className="ph ph-image" style={{ fontSize: '1.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }} />
            No chairside images recorded for this visit.
          </div>
        )}

        {/* All Consultation Chairside Images */}
        {filteredChairsideImages.length > 0 && (
          <div className={styles.chairsideGrid}>
            {filteredChairsideImages.map(renderChairsideCard)}
          </div>
        )}

        {filteredChairsideImages.length === 0 && allVisitChairsideImages.length > 0 && (
          <div className={styles.chairsideEmpty}>
            No chairside images match this tooth filter.
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
                    <AuthenticatedMediaImage src={img.file_url || opdApi.getDentalChairsideImageDownloadUrl(img.id)} alt={img.file_name} className={styles.chairsideThumb} />
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
      <div className={styles.formalOrdersCard}>
        <div className={styles.imagingHeader}>
          <div>
            <h3><i className="ph ph-file-text" /> Formal Imaging Orders</h3>
            <p>Formal Radiology Department investigations and diagnostic orders.</p>
          </div>
        </div>

        <div className={styles.orderToolbar}>
          <div className={styles.orderFilters} aria-label="Filter imaging orders">
            {(['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={orderFilter === filter ? styles.orderFilterActive : ''}
                onClick={() => setOrderFilter(filter)}
              >
                {filter === 'ALL' ? 'All Orders' : filter[0] + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <label className={styles.orderSearch}>
            <i className="ph ph-magnifying-glass" />
            <span className={styles.srOnly}>Search imaging orders</span>
            <input
              type="search"
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder="Search by order, tooth, or modality..."
            />
          </label>
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
        {order.isSuccess && formalOrderRows.length === 0 && <p className={styles.ordersEmpty}>No formal radiology requests for this visit.</p>}

        {formalOrderRows.length > 0 && (
          <div className={styles.ordersTableWrap}>
            <table className={styles.ordersTable}>
              <thead>
                <tr><th>#</th><th>Imaging Type</th><th>Tooth / Region</th><th>Order Date</th><th>Status</th><th>Report</th><th>Ordered By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibleFormalOrderRows.map(({ order: rowOrder, item, index }, rowIndex) => {
                  const result = getResultAvailability(rowOrder.status);
                  return (
                    <tr key={`${rowOrder.id}-${item.id ?? index}`}>
                      <td>{rowIndex + 1}</td>
                      <td>
                        <strong>{item.investigation_name}</strong>
                        {rowOrder.clinical_notes && <small className={styles.orderClinicalNote}>{rowOrder.clinical_notes}</small>}
                      </td>
                      <td>{item.tooth_number ? `Tooth #${item.tooth_number}` : 'Full Mouth'}</td>
                      <td>{new Date(rowOrder.created_at).toLocaleDateString()}</td>
                      <td><span className={`${styles.orderStatus} ${styles[`orderStatus${rowOrder.status}`] ?? ''}`}>{rowOrder.status.replaceAll('_', ' ')}</span></td>
                      <td><span className={`${styles.resultBadge} ${result.available ? styles.resultAvailable : styles.resultPending}`}>{result.available ? 'Report Available' : result.label}</span></td>
                      <td>{rowOrder.doctor_name}</td>
                      <td>
                        {result.available ? (
                          <button type="button" className={styles.tableAction} onClick={() => feature.openOrderReport(rowOrder.id)}>
                            <i className="ph ph-eye" /> View Report
                          </button>
                        ) : <span>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleFormalOrderRows.length === 0 && <p className={styles.ordersEmpty}>No imaging orders match this filter.</p>}
          </div>
        )}
      </div>

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

      {/* Formal Order Radiology Modal */}
      {feature.open && (
        <Modal
          open
          title="Order Dental Imaging / Scan"
          className={styles.imagingDialog}
          onClose={() => feature.setOpen(false)}
          footer={
            <div className={styles.dialogFooterActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => feature.setOpen(false)}
                disabled={feature.saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnAddAction}
                onClick={() => void feature.saveRequest()}
                disabled={feature.saving || catalogue.isLoading}
              >
                {feature.saving ? 'Saving...' : 'Save & Add to Order'}
              </button>
            </div>
          }
        >
          <form className={styles.dialogForm} onSubmit={feature.saveRequest}>
            {catalogue.isLoading && <p role="status">Loading available imaging procedures…</p>}
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
              Tooth / Region
              <select {...form.register('tooth')} disabled={feature.saving}>
                <option value="">General / Full Mouth</option>
                {allTeeth.map((tooth) => (
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
                placeholder="e.g. Suspected apical periodontitis / caries evaluation"
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
          title={`Capture Chairside Image ${selectedToothNumber ? `· Tooth #${selectedToothNumber}` : '· General / Full Mouth'}`}
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

      <Modal
        open={feature.reportOpen}
        title="Imaging Report"
        className={styles.reportModal}
        onClose={() => feature.setReportOpen(false)}
        footer={
          <button type="button" className={styles.reportCloseButton} onClick={() => feature.setReportOpen(false)}>
            Close
          </button>
        }
      >
        <div className={styles.imagingReport} aria-label="Imaging report">
          <p className={styles.reportIntro}>Radiology findings and diagnostic details for this imaging order.</p>
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
              {feature.reportDocumentsLoading && <p role="status">Loading uploaded study files…</p>}
              {feature.reportDocumentsError && <p role="alert">Uploaded study files could not be loaded.</p>}
              {feature.reportDocuments.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <h4>Uploaded Study Images &amp; Files ({feature.reportDocuments.length})</h4>
                  <ul className={styles.attachmentList}>
                    {feature.reportDocuments.map((document) => (
                      <li key={document.id} className={styles.attachmentItem}>
                        <div className={styles.attachmentInfo}>
                          <strong>{document.file_name}</strong>
                          <span className={styles.attachmentMeta}>
                            {document.mime_type} • {formatFileSize(document.file_size_bytes)} • {new Date(document.uploaded_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className={styles.attachmentActions}>
                          {document.mime_type.startsWith('image/') && (
                            <button
                              type="button"
                              className={styles.viewImageBtn}
                              onClick={() => void handleOpenReportDocument(document)}
                              aria-label={`View uploaded study ${document.file_name}`}
                            >
                              View Image
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.downloadBtn}
                            onClick={() => void handleDownloadReportDocument(document)}
                          >
                            Download
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
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
      </Modal>

      {/* Shared Image Viewer Modal for both Chairside & Radiology Report Attachments */}
      <DentalImageViewerModal
        open={Boolean(activeViewerItem)}
        onClose={closeImageViewer}
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
