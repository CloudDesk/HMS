import type { PatientDocumentResponse } from '../../api/patients';

type Props = {
  attachments: PatientDocumentResponse[];
  canView: boolean;
  canUpload: boolean;
  isLoading: boolean;
  isError: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onDownload: (document: PatientDocumentResponse) => Promise<void>;
};

const fileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ImagingAttachmentsPanel({
  attachments, canView, canUpload, isLoading, isError, isUploading, isDownloading, onUpload, onDownload,
}: Props) {
  return <section className="card diagnostic-panel">
    <div className="form-section-title">Study Attachments</div>
    <p className="muted-cell">Images and external reports are stored in Patient Documents and linked to this encounter and imaging order.</p>

    {canUpload ? <label className="form-field">
      <span>Upload JPG, PNG, WebP or PDF</span>
      <input
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={isUploading}
        multiple
        type="file"
        onChange={(event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files ?? []);
          void onUpload(files).then(() => { input.value = ''; }, () => { input.value = ''; });
        }}
      />
      <small>{isUploading ? 'Uploading attachments...' : 'Existing Patient Document storage limits and file validation apply.'}</small>
    </label> : <div className="diagnostic-readonly"><i className="ph ph-lock" /> Patient Document Create permission is required to upload attachments.</div>}

    {!canView ? <div className="diagnostic-readonly"><i className="ph ph-lock" /> Patient Document View permission is required to list attachments.</div> : null}
    {canView && isLoading ? <div className="um-state-cell"><span className="loading-spinner" /> Loading attachments...</div> : null}
    {canView && isError ? <div className="um-state-cell"><i className="ph ph-warning" /> Attachments could not be loaded.</div> : null}
    {canView && !isLoading && !isError && attachments.length === 0 ? <div className="um-state-cell"><i className="ph ph-image" /> No attachments are linked to this imaging order.</div> : null}
    {canView && attachments.length > 0 ? <div className="table-responsive"><table className="data-table">
      <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Action</th></tr></thead>
      <tbody>{attachments.map((document) => <tr key={document.id}>
        <td><strong>{document.title}</strong><span className="muted-cell">{document.file_name}</span></td>
        <td>{document.mime_type}</td><td>{fileSize(document.file_size_bytes)}</td>
        <td>{new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(document.created_at))}</td>
        <td><button className="action-icon-btn" disabled={isDownloading} title="Download attachment" type="button" onClick={() => { void onDownload(document); }}><i className="ph ph-download-simple" /></button></td>
      </tr>)}</tbody>
    </table></div> : null}
  </section>;
}
