import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientPortalApi, type PortalDocument } from '../../api/patient-portal';
import { portalQueryKeys } from '../../api/query-keys';
import { Pagination } from './Pagination';

const PAGE_SIZE = 5;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
const reviewLabel = (status: PortalDocument['review_status']) =>
  status === 'NOT_REQUIRED' ? 'Hospital record' : status.charAt(0) + status.slice(1).toLowerCase();

export function PortalDocuments({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'CLINICAL' | 'INSURANCE' | 'OTHER'>('CLINICAL');
  const [title, setTitle] = useState('');
  const [providerName, setProviderName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [description, setDescription] = useState('');
  const query = useQuery({
    queryKey: portalQueryKeys.documents(patientId),
    queryFn: () => patientPortalApi.documents(patientId),
  });

  const [page, setPage] = useState(1);
  const totalDocuments = query.data?.data.length ?? 0;
  const paginatedDocuments = (query.data?.data ?? []).slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const chooseFile = (next: File | undefined) => {
    if (!next) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(next.type))
      return toast.error('Only PDF, JPG and PNG files are allowed.');
    if (next.size > 10 * 1024 * 1024) return toast.error('The document must be 10 MB or smaller.');
    setFile(next);
    if (!title) setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setProviderName('');
    setDocumentDate('');
    setDescription('');
    setDocumentType('CLINICAL');
    if (fileInput.current) fileInput.current.value = '';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return toast.error('Choose a document to upload.');
    if (!title.trim()) return toast.error('Enter a document title.');
    setSubmitting(true);
    try {
      await patientPortalApi.uploadDocument({
        patientId,
        documentType,
        title: title.trim(),
        providerName: providerName.trim(),
        documentDate,
        description: description.trim(),
        file,
      });
      await queryClient.invalidateQueries({
        queryKey: portalQueryKeys.documents(patientId),
      });
      toast.success('Document uploaded and sent for hospital review.');
      reset();
      setUploadOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Document upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (document: PortalDocument) => {
    try {
      const result = await patientPortalApi.downloadDocument(patientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName ?? document.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Document download failed.');
    }
  };

  const view = async (document: PortalDocument) => {
    try {
      const result = await patientPortalApi.downloadDocument(patientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) toast.error('Allow pop-ups to view this document.');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Document preview failed.');
    }
  };

  return (
    <section className="portal-page-section portal-documents-page">
      <header>
        <div>
          <p>Patient-supplied records</p>
          <div className="portal-documents-title-row">
            <h1>Documents</h1>
            <button
              className="portal-book-action"
              onClick={() => setUploadOpen((open) => !open)}
              type="button"
            >
              <i className={`ph ${uploadOpen ? 'ph-x' : 'ph-upload-simple'}`} />
              {uploadOpen ? 'Close upload' : 'Upload document'}
            </button>
          </div>
          <span>Upload previous reports and records for your hospital care team to review.</span>
        </div>
      </header>
      <div className="portal-document-guidance">
        <i className="ph ph-shield-check" />
        <div>
          <strong>Uploads do not automatically change the medical record</strong>
          <span>
            Patient and guardian uploads remain pending until reviewed by authorised hospital staff.
          </span>
        </div>
      </div>
      {uploadOpen ? (
        <form className="portal-document-upload" onSubmit={submit}>
          <div className="portal-form-divider">
            <strong>Document information</strong>
            <small>PDF, JPG or PNG · Maximum 10 MB</small>
          </div>
          <div className="portal-document-form-grid">
            <label>
              <span>
                Category <b>*</b>
              </span>
              <select
                onChange={(event) => setDocumentType(event.target.value as typeof documentType)}
                value={documentType}
              >
                <option value="CLINICAL">Previous medical record</option>
                <option value="INSURANCE">Insurance document</option>
                <option value="CLINICAL">Clinical / Lab / Imaging</option>
                <option value="INSURANCE">Insurance / Guarantee Letter</option>
                <option value="OTHER">Identification / Other</option>
              </select>
            </label>
            <label>
              <span>Document title *</span>
              <input
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Previous Discharge Summary"
                required
                type="text"
                value={title}
              />
            </label>
            <label>
              <span>Issuing facility / doctor</span>
              <input
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="e.g. Nairobi Hospital"
                type="text"
                value={providerName}
              />
            </label>
            <label>
              <span>Document date</span>
              <input
                onChange={(e) => setDocumentDate(e.target.value)}
                type="date"
                value={documentDate}
              />
            </label>
            <label className="wide">
              <span>Notes / Description</span>
              <textarea
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this record…"
                rows={2}
                value={description}
              />
            </label>
          </div>
          <div className="portal-document-drop">
            <input
              accept=".pdf,image/jpeg,image/png"
              onChange={(e) => chooseFile(e.target.files?.[0])}
              ref={fileInput}
              style={{ display: 'none' }}
              type="file"
            />
            <label onClick={() => fileInput.current?.click()} style={{ cursor: 'pointer' }}>
              <i className="ph ph-file-arrow-up" />
              <strong>{file ? file.name : 'Click to select a file from your device'}</strong>
              <span>{file ? formatSize(file.size) : 'PDF, JPG or PNG up to 10 MB'}</span>
            </label>
          </div>
          <div className="portal-document-actions">
            <button
              onClick={() => {
                reset();
                setUploadOpen(false);
              }}
              type="button"
            >
              Cancel
            </button>
            <button disabled={submitting} type="submit">
              <i className="ph ph-upload-simple" />
              {submitting ? 'Uploading…' : 'Upload for review'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="portal-document-list">
        {query.isLoading ? (
          <div className="portal-empty">
            <div className="portal-spinner" />
            <strong>Loading documents…</strong>
          </div>
        ) : query.isError ? (
          <div className="portal-empty portal-empty--error">
            <i className="ph ph-warning-circle" />
            <strong>Unable to load documents</strong>
            <span>We encountered an issue loading your medical records. Please try again.</span>
            <button onClick={() => void query.refetch()} type="button">
              Try again
            </button>
          </div>
        ) : totalDocuments > 0 ? (
          <>
            {paginatedDocuments.map((document) => (
              <article key={document.id}>
                <div className="portal-document-icon">
                  <i
                    className={`ph ${document.mime_type === 'application/pdf' ? 'ph-file-pdf' : 'ph-file-image'}`}
                  />
                </div>
                <div className="portal-document-main">
                  <div>
                    <h3>{document.title}</h3>
                    <span
                      className={`portal-document-status ${document.review_status.toLowerCase()}`}
                    >
                      {reviewLabel(document.review_status)}
                    </span>
                  </div>
                  <p>
                    {document.provider_name ||
                      (document.source === 'HOSPITAL' ? 'HMS hospital record' : 'Patient supplied')}
                  </p>
                  <small>
                    {document.document_date
                      ? `Document dated ${formatDate(document.document_date)} · `
                      : ''}
                    Uploaded {formatDate(document.created_at)} ·{' '}
                    {formatSize(document.file_size_bytes)}
                  </small>
                  {document.description ? <span>{document.description}</span> : null}
                </div>
                <div className="portal-document-row-actions">
                  <button onClick={() => void view(document)} type="button">
                    <i className="ph ph-eye" /> View
                  </button>
                  <button
                    aria-label={`Download ${document.title}`}
                    className="icon-only"
                    onClick={() => void download(document)}
                    title="Download document"
                    type="button"
                  >
                    <i className="ph ph-download-simple" />
                  </button>
                </div>
              </article>
            ))}
            <Pagination
              currentPage={page}
              onPageChange={setPage}
              pageSize={PAGE_SIZE}
              totalItems={totalDocuments}
            />
          </>
        ) : (
          <div className="portal-empty">
            <i className="ph ph-files" />
            <strong>No documents uploaded</strong>
            <span>Previous medical records and supporting documents will appear here.</span>
          </div>
        )}
      </div>
    </section>
  );
}
