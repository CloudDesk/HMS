import type { PatientDocumentResponse } from '../../api/patients';

export type OpdDocumentsTabProps = {
  handleFileUpload: (e: React.FormEvent) => Promise<void>;
  setSelectedFile: (file: File | null) => void;
  uploadFileType: string;
  setUploadFileType: (type: string) => void;
  updating: string;
  documents: PatientDocumentResponse[];
  viewDocument: (doc: PatientDocumentResponse) => Promise<void>;
  downloadDocument: (doc: PatientDocumentResponse) => Promise<void>;
  deleteDocument: (doc: PatientDocumentResponse) => Promise<void>;
  canEdit: boolean;
};

export function OpdDocumentsTab({
  handleFileUpload,
  setSelectedFile,
  uploadFileType,
  setUploadFileType,
  updating,
  documents,
  viewDocument,
  downloadDocument,
  deleteDocument,
  canEdit,
}: OpdDocumentsTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      {/* Upload Form */}
      {canEdit && (
        <section className="opd-form-section">
          <div className="opd-form-section-head">
            <div>
              <h3>Upload Documents</h3>
              <p>Add encounter documents and attachments</p>
            </div>
          </div>
          <form className="opd-document-upload-form" onSubmit={handleFileUpload}>
            <div className="opd-doc-upload-grid">
              <div className="doc-field">
                <label htmlFor="document-file-input">Document File</label>
                <div className="opd-file-chooser">
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
                    id="document-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setSelectedFile(file ?? null);
                    }}
                    type="file"
                  />
                </div>
              </div>
              <div className="doc-field">
                <label htmlFor="document-type-select">Document Type</label>
                <select
                  id="document-type-select"
                  onChange={(e) => setUploadFileType(e.target.value)}
                  value={uploadFileType}
                >
                  <option value="Consultation Document">Consultation Document</option>
                  <option value="Lab Report">Lab Report</option>
                  <option value="Imaging Result">Imaging Result</option>
                  <option value="Referral Letter">Referral Letter</option>
                  <option value="Consent Form">Consent Form</option>
                  <option value="Identification">Identification</option>
                </select>
              </div>
              <div className="opd-upload-btn-wrap">
                <button
                  className="doc-btn primary upload-btn"
                  disabled={updating === 'document-upload'}
                  type="submit"
                >
                  <i aria-hidden="true" className="ph ph-upload-simple" />
                  {updating === 'document-upload' ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Consultation Documents & History */}
      <section className="opd-form-section" style={{ marginTop: canEdit ? '1.5rem' : '0' }}>
        <div className="opd-form-section-head">
          <div>
            <h3>Consultation Documents &amp; Document History</h3>
            <p>Prescriptions, reports, consent forms and referral letters</p>
          </div>
        </div>

        <div className="opd-documents-cards-grid">
          {documents.length === 0 ? (
            <div className="um-state-cell">No files are stored for this OPD visit.</div>
          ) : (
            documents.map((doc) => (
              <div className="opd-document-card" key={doc.id}>
                <div className="opd-document-icon">
                  <i aria-hidden="true" className="ph ph-file-text" />
                </div>
                <div className="opd-document-details">
                  <strong>{doc.title}</strong>
                  <span>
                    {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="opd-document-actions">
                  <button
                    aria-label={`View ${doc.title}`}
                    className="doc-icon-action"
                    onClick={() => void viewDocument(doc)}
                    title="View Document"
                    type="button"
                  >
                    <i aria-hidden="true" className="ph ph-eye" />
                  </button>
                  <button
                    aria-label={`Download ${doc.title}`}
                    className="doc-icon-action"
                    onClick={() => void downloadDocument(doc)}
                    title="Download Document"
                    type="button"
                  >
                    <i aria-hidden="true" className="ph ph-download-simple" />
                  </button>
                  {canEdit && (
                    <button
                      aria-label={`Delete ${doc.title}`}
                      className="doc-icon-action"
                      onClick={() => void deleteDocument(doc)}
                      title="Delete Document"
                      type="button"
                    >
                      <i aria-hidden="true" className="ph ph-trash" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </article>
  );
}
