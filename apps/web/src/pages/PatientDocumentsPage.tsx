import { useRef, useState } from 'react';
import { type ApiPatientDocumentType } from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { patientFullName } from './patient-utils';
import { navigate } from '../routing/navigation';
import { patientInitials } from './opd-utils';
import { toast } from 'sonner';
import { usePatientDocumentsFeature, type PatientDocumentRecord } from '../hooks/patients/usePatientDocumentsFeature';


const toDocumentRecord = (document: PatientDocumentResponse): PatientDocumentRecord => ({
  id: document.id,
  name: document.title || document.file_name,
  type: document.document_type,
  category: detectCategoryFromFileName(document.file_name),
  uploadedBy: document.uploaded_by_name ?? 'Unknown user',
  uploadedDate: formatDate(document.created_at),
  status: document.review_status === 'REJECTED' ? 'Rejected' : document.review_status === 'PENDING' ? 'Pending' : 'Verified',
  fileName: document.file_name,
  createdAt: document.created_at,
});

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};



const getFileIconClass = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'ph ph-file-pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'ph ph-file-image';
  if (['doc', 'docx'].includes(ext)) return 'ph ph-file-doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'ph ph-file-xls';
  return 'ph ph-file-text';
};

export function PatientDocumentsPage() {
  const {
    state: {
      patient,
      patientList,
      activePatientId,
      documents,
      loading,
      loadError,
    },
    actions: {
      handlePatientChange,
      handleDownloadDocument,
      handleViewDocument,
      handleDeleteDocument,
      handleReplaceFile,
      handleUploadFiles,
      detectCategoryFromFileName,
    },
  } = usePatientDocumentsFeature();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Filters State
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadedByFilter, setUploadedByFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeInput, setDateRangeInput] = useState('');

  // Upload Form & Multi-file Staging State
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<ApiPatientDocumentType>('CLINICAL');
  const [docCategory, setDocCategory] = useState('PDF');
  const [submittingUpload, setSubmittingUpload] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<PatientDocumentRecord | null>(null);
  const [documentToReplace, setDocumentToReplace] = useState<PatientDocumentRecord | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);



  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setStagedFiles((prev) => [...prev, ...newFiles]);

    const firstFile = newFiles[0];
    if (firstFile) {
      const autoCategory = detectCategoryFromFileName(firstFile.name);
      setDocCategory(autoCategory);
      if (!docName.trim()) {
        const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        setDocName(baseName);
      }
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      toast.error('Please select at least one document to upload.');
      return;
    }
    if (!docName.trim()) {
      toast.error('Please enter a document name.');
      return;
    }

    if (!activePatientId) {
      toast.error('Select a patient before uploading documents.');
      return;
    }

    setSubmittingUpload(true);
    try {
      await handleUploadFiles(stagedFiles, docName, docType);
      setUploadModalOpen(false);
      setStagedFiles([]);
      setDocName('');
    } finally {
      setSubmittingUpload(false);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    await handleDeleteDocument(documentToDelete);
    setDocumentToDelete(null);
  };

  const onFileReplace = async (file: File | undefined) => {
    if (!file || !documentToReplace) return;
    await handleReplaceFile(documentToReplace, file);
    setDocumentToReplace(null);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  };

  const resetFilters = () => {
    setSearchInput('');
    setTypeFilter('');
    setCategoryFilter('');
    setUploadedByFilter('');
    setStatusFilter('');
    setDateRangeInput('');
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchInput ||
      doc.name.toLowerCase().includes(searchInput.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(searchInput.toLowerCase());
    const matchesType = !typeFilter || doc.type === typeFilter;
    const matchesCategory = !categoryFilter || doc.category === categoryFilter;
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    const matchesUploader = !uploadedByFilter || doc.uploadedBy === uploadedByFilter;
    const matchesDate = !dateRangeInput || doc.createdAt.slice(0, 10) === dateRangeInput;
    return matchesSearch && matchesType && matchesCategory && matchesStatus && matchesUploader && matchesDate;
  });

  return (
    <>
      <div className="appointment-page">
        {/* Header & Switcher */}
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Patient Documents</h2>
            <p>Manage verified clinical and administrative files</p>
          </div>
          <div className="appointment-page-actions" style={{ gap: '0.75rem' }}>
            <div className="doc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <label htmlFor="documents-patient-switcher" style={{ whiteSpace: 'nowrap', margin: 0 }}>
                Switch Patient
              </label>
              <select
                id="documents-patient-switcher"
                onChange={(e) => handlePatientChange(e.target.value)}
                style={{ width: '220px', maxWidth: '220px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', padding: '0.4rem 0.6rem' }}
                title={patient ? `${patientFullName(patient)} - ${patient.patient_number}` : 'Select Patient'}
                value={activePatientId}
              >
                {patientList.map((p) => (
                  <option key={p.id} title={`${patientFullName(p)} - ${p.patient_number}`} value={p.id}>
                    {patientFullName(p)} - {p.patient_number}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '0.6rem', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }} aria-hidden="true" />
              <input
                onChange={(e) => {
                  const query = e.target.value.toLowerCase();
                  const matched = patientList.find(
                    (p) =>
                      patientFullName(p).toLowerCase().includes(query) ||
                      p.patient_number.toLowerCase().includes(query)
                  );
                  if (matched) {
                    handlePatientChange(matched.id);
                  }
                }}
                placeholder="Search patient in-page..."
                style={{ width: '190px', padding: '0.4rem 0.6rem 0.4rem 1.8rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                type="search"
              />
            </div>

            <button
              className="doc-btn primary"
              onClick={() => {
                setStagedFiles([]);
                setDocName('');
                setUploadModalOpen(true);
              }}
              type="button"
            >
              <i className="ph ph-plus" aria-hidden="true" />
              Upload Document
            </button>
          </div>
        </section>

        {/* Hero Banner */}
        <section className="doc-card opd-patient-banner" style={{ marginBottom: '1.25rem' }}>
          <div className="opd-patient-avatar-box">
            <span>{patient ? patientInitials(patientFullName(patient)) : '--'}</span>
          </div>
          <div className="opd-patient-banner-info">
            <div className="opd-patient-banner-title">
              <h3>{patient ? patientFullName(patient) : 'No patient selected'}</h3>
              <span className="opd-mrn-chip">{patient?.patient_number || 'No MRN'}</span>
              <span className={`doc-status ${patient?.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                {patient?.status || 'Active'}
              </span>
            </div>
            <div className="opd-patient-meta-line">
              <span>Gender: {patient?.gender || 'Not recorded'}{patient ? `, ${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years` : ''}</span>
              <span className="divider">•</span>
              <span>{patient?.phone || 'Phone not recorded'}</span>
              <span className="divider">•</span>
              <span>Blood Group: {patient?.blood_group || 'Not recorded'}</span>
              <span className="divider">•</span>
              <span>Document records: {documents.length}</span>
            </div>
          </div>
          <div className="opd-patient-banner-actions">
            <button
              className="doc-btn"
              onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(activePatientId)}`)}
              type="button"
            >
              View Profile
            </button>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="doc-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
          <div className="emr-filter-row" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
            <div className="doc-field">
              <label htmlFor="doc-search">Search</label>
              <input
                id="doc-search"
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Document name or uploader"
                type="text"
                value={searchInput}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="doc-type">Document Type</label>
              <select id="doc-type" onChange={(e) => setTypeFilter(e.target.value)} value={typeFilter}>
                <option value="">All Types</option>
                <option value="CLINICAL">Clinical</option>
                <option value="IDENTITY">Identity</option>
                <option value="INSURANCE">Insurance</option>
                <option value="CONSENT">Consent</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-cat">Category</label>
              <select id="doc-cat" onChange={(e) => setCategoryFilter(e.target.value)} value={categoryFilter}>
                <option value="">All Categories</option>
                <option value="PDF">PDF</option>
                <option value="Image">Image</option>
                <option value="Word">Word</option>
                <option value="Excel">Excel</option>
                <option value="Scanned File">Scanned File</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-uploader">Uploaded By</label>
              <select id="doc-uploader" onChange={(e) => setUploadedByFilter(e.target.value)} value={uploadedByFilter}>
                <option value="">All Users</option>
                {[...new Set(documents.map((document) => document.uploadedBy))].map((uploader) => (
                  <option key={uploader} value={uploader}>{uploader}</option>
                ))}
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-status">Status</label>
              <select id="doc-status" onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}>
                <option value="">All Statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="doc-date">Date Range</label>
              <input id="doc-date" onChange={(e) => setDateRangeInput(e.target.value)} type="date" value={dateRangeInput} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="doc-btn" onClick={resetFilters} type="button">
              <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
              Reset
            </button>
          </div>
        </section>

        {/* Documents Table */}
        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Documents</h3>
              <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Supported: PDF • Images • Word • Excel • Scanned Files
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DOCUMENT NAME</th>
                  <th>TYPE</th>
                  <th>CATEGORY</th>
                  <th>UPLOADED BY</th>
                  <th>UPLOADED DATE</th>
                  <th>STATUS</th>
                  <th className="align-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      Loading patient documents...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr><td className="um-state-cell" colSpan={7}>{loadError}</td></tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      No documents found for this patient. Click [+ Upload Document] to add one.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <i
                            className={getFileIconClass(doc.name)}
                            style={{ fontSize: '1.25rem', color: '#2563eb' }}
                          />
                          <strong style={{ color: '#0f172a' }}>{doc.name}</strong>
                        </div>
                      </td>
                      <td>{doc.type}</td>
                      <td>{doc.category}</td>
                      <td>{doc.uploadedBy}</td>
                      <td>{doc.uploadedDate}</td>
                      <td>
                        <span
                          className={`doc-status ${
                            doc.status === 'Verified' ? 'verified' : doc.status === 'Pending' ? 'pending' : 'rejected'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="align-right">
                        <div className="table-actions">
                          <button
                            className="doc-icon-action"
                            onClick={() => void handleViewDocument(doc)}
                            title="View document in new window"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => void handleDownloadDocument(doc)}
                            title="Download document file"
                            type="button"
                          >
                            <i className="ph ph-download-simple" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => {
                              setDocumentToReplace(doc);
                              replaceFileInputRef.current?.click();
                            }}
                            title="Replace document file"
                            type="button"
                          >
                            <i className="ph ph-arrows-clockwise" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => setDocumentToDelete(doc)}
                            title="Delete document"
                            type="button"
                          >
                            <i className="ph ph-trash" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Upload Patient Document Modal with Lively Multi-file Staging */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Patient Document">
        <form className="modal-form" onSubmit={handleUploadSubmit}>
          <div className="lively-upload-dropzone">
            <i className="ph ph-cloud-arrow-up lively-upload-icon" aria-hidden="true" />
            <strong>Choose files to upload</strong>
            <span>Drag and drop or click to browse PDF, image, Word, Excel files</span>
            <input
              className="lively-file-input"
              id="modal-file-input"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFileSelect(e.target.files)}
              type="file"
            />
          </div>

          {stagedFiles.length > 0 && (
            <div className="staged-files-list">
              {stagedFiles.map((file, idx) => (
                <div className="staged-file-item" key={`${file.name}-${idx}`}>
                  <div className="staged-file-info">
                    <i className={`${getFileIconClass(file.name)} staged-file-icon`} aria-hidden="true" />
                    <div className="staged-file-details">
                      <span className="staged-file-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="staged-file-size">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    className="staged-file-remove-btn"
                    onClick={() => removeStagedFile(idx)}
                    title="Remove file"
                    type="button"
                  >
                    <i className="ph ph-trash" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-doc-name">
                Document Name <span className="required-asterisk">*</span>
              </label>
              <input
                id="modal-doc-name"
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Document Title"
                type="text"
                value={docName}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-doc-type">
                Document Type <span className="required-asterisk">*</span>
              </label>
              <select
                id="modal-doc-type"
                onChange={(e) => setDocType(e.target.value as ApiPatientDocumentType)}
                value={docType}
              >
                <option value="CLINICAL">Clinical</option>
                <option value="IDENTITY">Identity</option>
                <option value="INSURANCE">Insurance</option>
                <option value="CONSENT">Consent</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="doc-field" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="modal-doc-category">Category / File Format (Auto-detected)</label>
            <select
              id="modal-doc-category"
              onChange={(e) => setDocCategory(e.target.value)}
              value={docCategory}
            >
              <option value="PDF">PDF</option>
              <option value="Image">Image</option>
              <option value="Word">Word</option>
              <option value="Excel">Excel</option>
              <option value="Scanned File">Scanned File</option>
            </select>
          </div>

          <div className="modal-actions">
            <button className="doc-btn" onClick={() => setUploadModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={submittingUpload} type="submit">
              {submittingUpload ? 'Uploading to Database...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </Modal>

      <input
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
        hidden
        onChange={(event) => void onFileReplace(event.target.files?.[0])}
        ref={replaceFileInputRef}
        type="file"
      />
      <ConfirmDialog
        confirmLabel="Delete Document"
        message={`Delete ${documentToDelete?.name ?? 'this document'}? The stored backend file will also be removed.`}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={() => void confirmDeleteDocument()}
        open={Boolean(documentToDelete)}
        title="Delete Patient Document"
      />

      
    </>
  );
}



