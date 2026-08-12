import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  patientsApi,
  type ApiPatientDocumentType,
  type PatientDocumentResponse,
  type PatientResponse,
  type SavePatientDocumentPayload,
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
  fileName: string;
  mimeType: string;
  fileSizeBytes: string;
  storageKey: string;
  description: string;
};

const emptyDocumentForm = (documentType: ApiPatientDocumentType): DocumentFormState => ({
  documentType,
  title: '',
  fileName: '',
  mimeType: '',
  fileSizeBytes: '',
  storageKey: '',
  description: '',
});

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPayload = (form: DocumentFormState): SavePatientDocumentPayload => ({
  document_type: form.documentType,
  title: form.title.trim(),
  file_name: form.fileName.trim(),
  mime_type: form.mimeType.trim(),
  file_size_bytes: Number(form.fileSizeBytes),
  storage_key: form.storageKey.trim(),
  description: nullable(form.description),
});

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

    if (!form.title.trim() || !form.fileName.trim() || !form.mimeType.trim() || !form.storageKey.trim()) {
      setFormError('Title, file name, MIME type, and storage key are required.');
      return;
    }

    if (!Number.isInteger(Number(form.fileSizeBytes)) || Number(form.fileSizeBytes) <= 0) {
      setFormError('File size must be a positive number of bytes.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await patientsApi.createDocument(patientId, toPayload(form));
      showToast(consentMode ? 'Consent linked successfully.' : 'Document linked successfully.');
      closeModal();
      await loadDocuments();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
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
                      <td>{document.file_size_bytes.toLocaleString()} bytes</td>
                      <td>{formatDateTime(document.created_at)}</td>
                      <td className="align-right">
                        <button
                          className="action-icon-btn danger"
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
            <div className="form-group">
              <label htmlFor="document-file-name">File name *</label>
              <input
                disabled={submitting}
                id="document-file-name"
                onChange={(event) => setForm({ ...form, fileName: event.target.value })}
                required
                type="text"
                value={form.fileName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="document-mime">MIME type *</label>
              <input
                disabled={submitting}
                id="document-mime"
                onChange={(event) => setForm({ ...form, mimeType: event.target.value })}
                placeholder="application/pdf"
                required
                type="text"
                value={form.mimeType}
              />
            </div>
            <div className="form-group">
              <label htmlFor="document-size">File size bytes *</label>
              <input
                disabled={submitting}
                id="document-size"
                min="1"
                onChange={(event) => setForm({ ...form, fileSizeBytes: event.target.value })}
                required
                type="number"
                value={form.fileSizeBytes}
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="document-storage-key">Storage key *</label>
              <input
                disabled={submitting}
                id="document-storage-key"
                onChange={(event) => setForm({ ...form, storageKey: event.target.value })}
                placeholder="patients/{patientId}/documents/file.pdf"
                required
                type="text"
                value={form.storageKey}
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

