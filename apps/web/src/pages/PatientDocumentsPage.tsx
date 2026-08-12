import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  patientsApi,
  type ApiPatientDocumentType,
  type PatientDocumentResponse,
  type PatientResponse,
} from '../api/patients';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatDateTime,
  getPatientErrorMessage,
  getPatientIdFromSearch,
  patientFullName,
} from './patient-utils';

type DocumentFormState = {
  documentType: ApiPatientDocumentType;
  title: string;
  file: File | null;
  description: string;
};

const emptyDocumentForm = (documentType: ApiPatientDocumentType): DocumentFormState => ({
  documentType,
  title: '',
  file: null,
  description: '',
});

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes.toLocaleString()} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

type PatientDocumentsPageProps = {
  mode?: 'documents' | 'consents';
};

function NoPatientSelected({ mode }: { mode: 'documents' | 'consents' }) {
  return (
    <div className="um-grid">
      <div className="card patient-empty-panel">
        <i className={mode === 'consents' ? 'ph ph-signature' : 'ph ph-file-text'} aria-hidden="true" />
        <h3>Select a patient record</h3>
        <p>Open a patient from search before managing {mode === 'consents' ? 'consents' : 'documents'}.</p>
        <button className="primary-action" onClick={() => navigate('/patients/search')} type="button">
          Search Patients
        </button>
      </div>
    </div>
  );
}

export function PatientDocumentsPage({ mode = 'documents' }: PatientDocumentsPageProps) {
  const { search } = useAppLocation();
  const patientId = getPatientIdFromSearch(search);
  const consentMode = mode === 'consents';
  const fixedDocumentType: ApiPatientDocumentType | undefined = consentMode ? 'CONSENT' : undefined;
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [documents, setDocuments] = useState<PatientDocumentResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DocumentFormState>(emptyDocumentForm(fixedDocumentType ?? 'CLINICAL'));
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PatientDocumentResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadDocuments = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setLoadError('');

    try {
      const [patientResponse, documentResponse] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.documents(patientId, fixedDocumentType),
      ]);
      setPatient(patientResponse);
      setDocuments(documentResponse);
    } catch (error) {
      setPatient(null);
      setDocuments([]);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [fixedDocumentType, patientId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  if (!patientId) {
    return <NoPatientSelected mode={mode} />;
  }

  const openModal = () => {
    setForm(emptyDocumentForm(fixedDocumentType ?? 'CLINICAL'));
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setFormError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    if (!form.file) {
      setFormError('Select a document file to upload.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await patientsApi.uploadDocument(patientId, {
        document_type: form.documentType,
        title: form.title.trim(),
        file: form.file,
        description: nullable(form.description),
      });
      showToast(consentMode ? 'Consent uploaded successfully.' : 'Document uploaded successfully.');
      closeModal();
      await loadDocuments();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (document: PatientDocumentResponse) => {
    setDownloadingId(document.id);

    try {
      const response = await patientsApi.downloadDocument(patientId, document.id);
      triggerBrowserDownload(response.blob, response.fileName ?? document.file_name);
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);

    try {
      await patientsApi.deleteDocument(patientId, deleteTarget.id);
      showToast(`${deleteTarget.title} removed successfully.`);
      setDeleteTarget(null);
      await loadDocuments();
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="um-grid">
        <section className="card patient-summary-strip">
          <div>
            <span className="emp-id">{patient?.patient_number ?? 'Patient record'}</span>
            <h2>{patient ? patientFullName(patient) : consentMode ? 'Patient Consents' : 'Patient Documents'}</h2>
          </div>
          <div className="patient-summary-actions">
            <button className="secondary-action" onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`)} type="button">
              Profile
            </button>
            <button className="primary-action" onClick={openModal} type="button">
              <i className={consentMode ? 'ph ph-signature' : 'ph ph-file-plus'} aria-hidden="true" />
              {consentMode ? 'Add Consent' : 'Add Document'}
            </button>
          </div>
        </section>

        <section className="um-table-section card">
          <div className="um-toolbar">
            <div className="um-toolbar-row1">
              <h3>{consentMode ? 'Consent Management' : 'Patient Documents'}</h3>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  {!consentMode && <th>Type</th>}
                  <th>File</th>
                  <th>MIME</th>
                  <th>Size</th>
                  <th>Linked</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={consentMode ? 6 : 7}>
                      Loading {consentMode ? 'consents' : 'documents'}...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td className="um-state-cell" colSpan={consentMode ? 6 : 7}>
                      {loadError}
                      <div>
                        <button className="secondary-action mt-4" onClick={loadDocuments} type="button">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={consentMode ? 6 : 7}>
                      No {consentMode ? 'consents' : 'documents'} linked to this patient.
                    </td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <strong>{document.title}</strong>
                        <div className="muted-cell">{document.description || 'No description recorded'}</div>
                      </td>
                      {!consentMode && <td>{document.document_type}</td>}
                      <td>{document.file_name}</td>
                      <td>{document.mime_type}</td>
                      <td>{formatFileSize(document.file_size_bytes)}</td>
                      <td>{formatDateTime(document.created_at)}</td>
                      <td className="align-right">
                        <button
                          className="action-icon-btn"
                          disabled={downloadingId === document.id}
                          onClick={() => {
                            void handleDownload(document);
                          }}
                          title="Download document"
                          type="button"
                        >
                          <i className="ph ph-download-simple" aria-hidden="true" />
                        </button>
                        <button
                          className="action-icon-btn danger"
                          disabled={downloadingId === document.id}
                          onClick={() => setDeleteTarget(document)}
                          title="Remove document"
                          type="button"
                        >
                          <i className="ph ph-trash" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={consentMode ? 'Add Patient Consent' : 'Add Patient Document'}>
        <form className="modal-form patient-form" onSubmit={handleSave}>
          {formError && (
            <div className="form-error-banner" role="alert">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid">
            {!consentMode && (
              <div className="form-group">
                <label htmlFor="document-type">Document type *</label>
                <select
                  disabled={submitting}
                  id="document-type"
                  onChange={(event) => setForm({ ...form, documentType: event.target.value as ApiPatientDocumentType })}
                  value={form.documentType}
                >
                  <option value="CLINICAL">Clinical</option>
                  <option value="IDENTITY">Identity</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="CONSENT">Consent</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="document-title">Title *</label>
              <input
                disabled={submitting}
                id="document-title"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
                type="text"
                value={form.title}
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="document-file">File *</label>
              <label className="patient-upload-zone" htmlFor="document-file">
                <i className="ph ph-cloud-arrow-up" aria-hidden="true" />
                <span>{form.file ? form.file.name : 'Choose a PDF, image, or text document'}</span>
                {form.file && <small>{formatFileSize(form.file.size)}</small>}
              </label>
              <input
                className="sr-only"
                disabled={submitting}
                id="document-file"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })}
                required
                type="file"
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="document-description">Description</label>
              <textarea
                disabled={submitting}
                id="document-description"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                value={form.description}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="secondary-action" disabled={submitting} onClick={closeModal} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={submitting} type="submit">
              {submitting ? 'Saving...' : consentMode ? 'Save Consent' : 'Save Document'}
            </button>
          </div>
        </form>
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          confirmLabel={submitting ? 'Removing...' : 'Remove'}
          message={`Remove ${deleteTarget.title} from this patient record?`}
          onCancel={() => {
            if (!submitting) setDeleteTarget(null);
          }}
          onConfirm={handleDelete}
          open={Boolean(deleteTarget)}
          title={consentMode ? 'Remove Consent' : 'Remove Document'}
        />
      )}

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}

