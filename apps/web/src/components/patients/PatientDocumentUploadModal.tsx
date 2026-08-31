import type { FormEventHandler } from 'react';
import type { ApiPatientDocumentType } from '../../api/patients';
import { Modal } from '../ui/Modal';
import { MedicalSpinner } from '../ui/MedicalLoader';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIconClass = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'ph ph-file-pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) return 'ph ph-file-image';
  if (['doc', 'docx'].includes(extension)) return 'ph ph-file-doc';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'ph ph-file-xls';
  return 'ph ph-file-text';
};

type PatientDocumentUploadModalProps = {
  open: boolean;
  uploadMode: 'DOCUMENT' | 'CONSENT';
  stagedFiles: File[];
  docName: string;
  docType: ApiPatientDocumentType;
  docCategory: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFileSelect: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  onDocNameChange: (value: string) => void;
  onDocTypeChange: (value: ApiPatientDocumentType) => void;
  onDocCategoryChange: (value: string) => void;
};

export function PatientDocumentUploadModal({
  open,
  uploadMode,
  stagedFiles,
  docName,
  docType,
  docCategory,
  submitting,
  onClose,
  onSubmit,
  onFileSelect,
  onRemoveFile,
  onDocNameChange,
  onDocTypeChange,
  onDocCategoryChange,
}: PatientDocumentUploadModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Upload ${uploadMode === 'CONSENT' ? 'Consent Form' : 'Patient Document'}`}>
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="lively-upload-dropzone">
          <i className="ph ph-cloud-arrow-up lively-upload-icon" aria-hidden="true" />
          <strong>Choose files to upload</strong>
          <span>Drag and drop or click to browse PDF, image, Word, Excel files</span>
          <input
            className="lively-file-input"
            id="modal-file-input"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
            onChange={(event) => onFileSelect(event.target.files)}
            type="file"
          />
        </div>

        {stagedFiles.length > 0 && (
          <div className="staged-files-list">
            {stagedFiles.map((file, index) => (
              <div className="staged-file-item" key={`${file.name}-${index}`}>
                <div className="staged-file-info">
                  <i className={`${getFileIconClass(file.name)} staged-file-icon`} aria-hidden="true" />
                  <div className="staged-file-details">
                    <span className="staged-file-name" title={file.name}>{file.name}</span>
                    <span className="staged-file-size">{formatFileSize(file.size)}</span>
                  </div>
                </div>
                <button className="staged-file-remove-btn" onClick={() => onRemoveFile(index)} title="Remove file" type="button">
                  <i className="ph ph-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="doc-field">
            <label htmlFor="modal-doc-name">Document Name <span className="required-asterisk">*</span></label>
            <input id="modal-doc-name" onChange={(event) => onDocNameChange(event.target.value)} placeholder="Document Title" type="text" value={docName} />
          </div>
          {uploadMode === 'DOCUMENT' && (
            <div className="doc-field">
              <label htmlFor="modal-doc-type">Document Type <span className="required-asterisk">*</span></label>
              <select id="modal-doc-type" onChange={(event) => onDocTypeChange(event.target.value as ApiPatientDocumentType)} value={docType}>
                <option value="CLINICAL">Clinical</option>
                <option value="IDENTITY">Identity</option>
                <option value="INSURANCE">Insurance</option>
                <option value="CONSENT">Consent</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}
        </div>

        <div className="doc-field" style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="modal-doc-category">Category / File Format (Auto-detected)</label>
          <select id="modal-doc-category" onChange={(event) => onDocCategoryChange(event.target.value)} value={docCategory}>
            <option value="PDF">PDF</option>
            <option value="Image">Image</option>
            <option value="Word">Word</option>
            <option value="Excel">Excel</option>
            <option value="Scanned File">Scanned File</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="doc-btn" onClick={onClose} type="button">Cancel</button>
          <button className="doc-btn primary" disabled={submitting} type="submit">{submitting ? <><MedicalSpinner size="sm" /><span>Uploading...</span></> : 'Upload Document'}</button>
        </div>
      </form>
    </Modal>
  );
}
