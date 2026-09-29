import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import type { PortalDocument } from '../../../api/patient-portal';
import { patientPortalApi } from '../../../api/patient-portal';

interface PortalConsentFormModalProps {
  open: boolean;
  onClose: () => void;
  consent: PortalDocument | null;
  signature: PortalDocument | null;
  patientId: string;
  patientName?: string;
  onUploadSignature: (consent: PortalDocument, file: File) => Promise<void>;
  uploadingSignature?: boolean;
}

const formatDate = (value: string | undefined | null) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—';

const formatDateTime = (value: string | undefined | null) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';

export function PortalConsentFormModal({
  open,
  onClose,
  consent,
  signature,
  patientId,
  patientName,
  onUploadSignature,
  uploadingSignature = false,
}: PortalConsentFormModalProps) {
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(false);

  useEffect(() => {
    if (!open || !consent) {
      setConsentUrl(null);
      setSignatureUrl(null);
      return;
    }

    let isMounted = true;
    let createdConsentUrl: string | null = null;
    let createdSigUrl: string | null = null;

    setConsentLoading(true);
    patientPortalApi
      .downloadDocument(patientId, consent.id)
      .then((res) => {
        if (!isMounted) return;
        createdConsentUrl = URL.createObjectURL(res.blob);
        setConsentUrl(createdConsentUrl);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err instanceof Error ? err.message : 'Failed to load consent form');
      })
      .finally(() => {
        if (isMounted) setConsentLoading(false);
      });

    if (signature) {
      setSignatureLoading(true);
      patientPortalApi
        .downloadDocument(patientId, signature.id)
        .then((res) => {
          if (!isMounted) return;
          createdSigUrl = URL.createObjectURL(res.blob);
          setSignatureUrl(createdSigUrl);
        })
        .catch(() => {
          // Signature preview unavailable
        })
        .finally(() => {
          if (isMounted) setSignatureLoading(false);
        });
    } else {
      setSignatureUrl(null);
    }

    return () => {
      isMounted = false;
      if (createdConsentUrl) URL.revokeObjectURL(createdConsentUrl);
      if (createdSigUrl) URL.revokeObjectURL(createdSigUrl);
    };
  }, [open, consent, signature, patientId]);

  if (!consent) return null;

  const isPdf =
    consent.mime_type === 'application/pdf' ||
    consent.file_name?.toLowerCase().endsWith('.pdf');
  const isImage =
    consent.mime_type?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(consent.file_name ?? '');
  const isHtml =
    consent.mime_type === 'text/html' ||
    consent.file_name?.toLowerCase().endsWith('.html');

  return (
    <Modal
      icon="ph-file-text"
      onClose={onClose}
      open={open}
      size="large"
      title={consent.title}
    >
      <div className="portal-consent-modal-wrapper">
        {/* Banner summary */}
        <div className="portal-consent-modal-banner">
          <div>
            <span className="portal-consent-type-tag">Consent Form</span>
            <h3>{consent.title}</h3>
            <span className="portal-consent-meta-text">
              <i className="ph ph-calendar-blank" /> Uploaded on {formatDate(consent.document_date || consent.created_at)}
            </span>
          </div>
          <div className="portal-consent-status-wrap">
            {signature ? (
              <span className="portal-consent-badge portal-consent-badge--signed">
                <i className="ph ph-check-circle" /> Signature Captured &amp; Attached
              </span>
            ) : (
              <span className="portal-consent-badge portal-consent-badge--pending">
                <i className="ph ph-clock" /> Signature Required
              </span>
            )}
          </div>
        </div>

        {/* Document view area */}
        <div className="portal-consent-doc-container">
          <div className="portal-consent-doc-header">
            <span>
              <i className="ph ph-file-text" /> Consent Document
            </span>
            {consentUrl ? (
              <a
                className="portal-consent-ext-link"
                href={consentUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <i className="ph ph-arrow-square-out" /> Full screen
              </a>
            ) : null}
          </div>

          <div className="portal-consent-doc-body">
            {consentLoading ? (
              <div className="portal-consent-loading-box">
                <div className="portal-spinner" />
                <p>Loading consent document…</p>
              </div>
            ) : consentUrl ? (
              isPdf || isHtml ? (
                <iframe
                  className="portal-consent-iframe"
                  src={consentUrl}
                  title={consent.title}
                />
              ) : isImage ? (
                <div className="portal-consent-image-box">
                  <img alt={consent.title} src={consentUrl} />
                </div>
              ) : (
                <div className="portal-consent-generic-box">
                  <i className="ph ph-file-pdf" />
                  <p>{consent.file_name}</p>
                  <a
                    className="portal-consent-download-btn"
                    download={consent.file_name}
                    href={consentUrl}
                  >
                    <i className="ph ph-download-simple" /> Download Document
                  </a>
                </div>
              )
            ) : (
              <div className="portal-consent-error-box">
                <i className="ph ph-warning-circle" />
                <p>Unable to load document preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Captured Patient Signature Section */}
        <section aria-label="Captured Consent Signature" className="portal-consent-signature-box">
          <div className="portal-consent-signature-header">
            <div className="portal-consent-signature-title-group">
              <span className="portal-consent-sig-icon">
                <i className="ph ph-signature" />
              </span>
              <div>
                <h4>Patient Signature &amp; Acknowledgment</h4>
                <p>Formal patient consent signature captured for this medical document.</p>
              </div>
            </div>
            {signature ? (
              <label className={`portal-consent-replace-sig-btn ${uploadingSignature ? 'disabled' : ''}`}>
                <i className="ph ph-arrows-clockwise" />
                {uploadingSignature ? 'Updating…' : 'Replace Signature'}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingSignature}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadSignature(consent, f);
                  }}
                  type="file"
                />
              </label>
            ) : null}
          </div>

          {signature ? (
            <div className="portal-consent-signature-card">
              <div className="portal-consent-signature-image-container">
                <div className="portal-consent-sig-banner-label">Captured Signature</div>
                <div className="portal-consent-sig-image-holder">
                  {signatureLoading ? (
                    <div className="portal-spinner portal-spinner--sm" />
                  ) : signatureUrl ? (
                    <img alt="Patient Signature" src={signatureUrl} />
                  ) : (
                    <span className="portal-consent-sig-fallback">Signature Attached</span>
                  )}
                </div>
                <div className="portal-consent-sig-line">
                  <span>Signee Signature</span>
                </div>
              </div>

              <div className="portal-consent-signature-details-grid">
                <div className="portal-consent-sig-item">
                  <small>Signed By</small>
                  <strong>{signature.signed_by_name || patientName || 'Patient'}</strong>
                </div>
                <div className="portal-consent-sig-item">
                  <small>Signature Date &amp; Time</small>
                  <strong>{formatDateTime(signature.signed_at || signature.created_at)}</strong>
                </div>
                <div className="portal-consent-sig-item">
                  <small>Legal Verification</small>
                  <strong className="portal-consent-verified-badge">
                    <i className="ph ph-seal-check" /> Verified &amp; Recorded
                  </strong>
                </div>
                <div className="portal-consent-sig-item">
                  <small>Consent Document Status</small>
                  <strong style={{ color: '#0f172a' }}>Signed &amp; Legally Binding</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="portal-consent-signature-empty-card">
              <div className="portal-consent-empty-sig-content">
                <i className="ph ph-pen-nib" />
                <div>
                  <strong>Signature has not been uploaded yet</strong>
                  <p>Upload a clear image of your signature (PNG, JPG, or WebP) to complete and sign this form.</p>
                </div>
              </div>
              <label className={`portal-consent-upload-cta ${uploadingSignature ? 'disabled' : ''}`}>
                <i className="ph ph-upload-simple" />
                {uploadingSignature ? 'Uploading…' : 'Upload Signature'}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingSignature}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadSignature(consent, f);
                  }}
                  type="file"
                />
              </label>
            </div>
          )}
        </section>

        {/* Modal actions footer */}
        <div className="portal-consent-modal-actions">
          <div className="portal-consent-modal-actions-left">
            <button
              className="portal-consent-btn-outline"
              onClick={() => window.print()}
              type="button"
            >
              <i className="ph ph-printer" /> Print Form
            </button>
          </div>
          <div className="portal-consent-modal-actions-right">
            <button
              className="portal-consent-btn-primary"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
