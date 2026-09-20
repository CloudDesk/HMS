import { useState, useEffect } from 'react';
import type { ImagingAttachment } from '../../../api/imaging';
import { imagingApi } from '../../../api/imaging';
import styles from './DentalImageViewerModal.module.css';

export type DentalImageViewerModalProps = {
  open: boolean;
  onClose: () => void;
  attachment: ImagingAttachment | null;
  attachments?: ImagingAttachment[];
  orderId: string;
  investigationName?: string;
  toothNumber?: number | null;
  canDownload?: boolean;
  onSelectAttachment?: (attachment: ImagingAttachment) => void;
};

const BROWSER_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const BROWSER_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export function isBrowserViewableImage(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (BROWSER_IMAGE_MIMES.some((m) => lower.includes(m))) {
      return true;
    }
  }
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext && BROWSER_IMAGE_EXTS.includes(ext)) {
      return true;
    }
  }
  return false;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function DentalImageViewerModal({
  open,
  onClose,
  attachment,
  attachments = [],
  orderId,
  investigationName,
  toothNumber,
  canDownload = true,
  onSelectAttachment,
}: DentalImageViewerModalProps) {
  const [zoom, setZoom] = useState(1);

  // Reset zoom whenever active attachment changes or modal opens
  useEffect(() => {
    if (open) {
      setZoom(1);
    }
  }, [open, attachment?.id]);

  if (!open || !attachment) return null;

  const isImage = isBrowserViewableImage(attachment.mime_type, attachment.file_name);
  const downloadUrl = imagingApi.getAttachmentDownloadUrl(orderId, attachment.id);
  const formattedSize = formatBytes(attachment.file_size_bytes);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.25, Math.round((prev - 0.25) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleFitToView = () => {
    setZoom(1);
  };

  return (
    <div
      className={styles.viewerModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dental-image-viewer-title"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1050,
      }}
    >
      {/* Header with metadata */}
      <div className={styles.viewerHeader}>
        <div className={styles.viewerTitleArea}>
          <div className={styles.viewerTitleRow}>
            <span id="dental-image-viewer-title" className={styles.viewerFileName}>
              {attachment.file_name}
            </span>
            {investigationName && (
              <span className={styles.typeBadge}>{investigationName}</span>
            )}
            {toothNumber !== undefined && toothNumber !== null && (
              <span className={styles.toothBadge}>Tooth #{toothNumber}</span>
            )}
          </div>
          <div className={styles.viewerMetaRow}>
            {attachment.mime_type && <span>{attachment.mime_type}</span>}
            {formattedSize && <span>• {formattedSize}</span>}
            {attachment.uploaded_at && (
              <span>• {new Date(attachment.uploaded_at).toLocaleString()}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close image viewer"
        >
          ✕
        </button>
      </div>

      {/* Multiple attachments switcher */}
      {attachments.length > 1 && (
        <div className={styles.attachmentTabs} role="tablist" aria-label="Study attachments">
          {attachments.map((att, idx) => {
            const isActive = att.id === attachment.id;
            return (
              <button
                key={att.id || idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.attachmentTab} ${isActive ? styles.attachmentTabActive : ''}`}
                onClick={() => onSelectAttachment?.(att)}
              >
                {att.file_name}
              </button>
            );
          })}
        </div>
      )}

      {/* Viewport: Actual image or non-image fallback */}
      <div className={styles.viewportContainer}>
        {isImage ? (
          <div
            className={styles.imageCanvas}
            style={{ transform: `scale(${zoom})` }}
            data-testid="dental-image-canvas"
          >
            <img
              src={downloadUrl}
              alt={attachment.file_name}
              className={styles.viewerImage}
              data-testid="dental-viewer-image"
              draggable={false}
            />
          </div>
        ) : (
          <div className={styles.fallbackCard} data-testid="dental-viewer-fallback">
            <div className={styles.fallbackIcon}>📄</div>
            <strong>Preview Not Available</strong>
            <p className={styles.fallbackText}>
              This file format (<code>{attachment.mime_type || 'unrecognized'}</code>) cannot be
              rendered as an image in the viewer.
            </p>
            {canDownload && (
              <a
                href={downloadUrl}
                download={attachment.file_name}
                className={styles.downloadBtnPrimary}
                data-testid="fallback-download-btn"
              >
                Download File ({formattedSize || 'file'})
              </a>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={handleZoomOut}
            disabled={!isImage || zoom <= 0.25}
            aria-label="Zoom out"
            title="Zoom Out"
          >
            － Zoom Out
          </button>
          <span className={styles.zoomLevel} aria-label="Current zoom level">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={handleZoomIn}
            disabled={!isImage || zoom >= 4}
            aria-label="Zoom in"
            title="Zoom In"
          >
            ＋ Zoom In
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={handleResetZoom}
            disabled={!isImage || zoom === 1}
            title="Reset to 100%"
          >
            1:1 Reset
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={handleFitToView}
            disabled={!isImage}
            title="Fit to view"
          >
            Fit to View
          </button>
        </div>

        <div className={styles.actionGroup}>
          {canDownload && (
            <a
              href={downloadUrl}
              download={attachment.file_name}
              className={styles.downloadBtnPrimary}
              data-testid="toolbar-download-btn"
            >
              ⬇ Download
            </a>
          )}
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
