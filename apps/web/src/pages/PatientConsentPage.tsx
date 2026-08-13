import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  patientsApi,
  type ApiPatientConsentStatus,
  type PatientDocumentResponse,
  type PatientResponse,
} from '../api/patients';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, getPatientIdFromSearch, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';

const statusLabels: Record<ApiPatientConsentStatus, string> = {
  SIGNED: 'Signed',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
};

const fileAccept = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx';

export function PatientConsentPage() {
  const { search } = useAppLocation();
  const requestedPatientId = getPatientIdFromSearch(search);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [consents, setConsents] = useState<PatientDocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ApiPatientConsentStatus>('SIGNED');
  const [signedAt, setSignedAt] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [signedByName, setSignedByName] = useState('');
  const [deleting, setDeleting] = useState<PatientDocumentResponse | null>(null);
  const [replacing, setReplacing] = useState<PatientDocumentResponse | null>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const patientResponse = await patientsApi.list({ status: 'ACTIVE', limit: 100 });
      setPatients(patientResponse.data);
      const patientId = requestedPatientId || patientResponse.data[0]?.id;
      if (!patientId) {
        setPatient(null);
        setConsents([]);
        return;
      }
      const [patientRecord, documentResponse] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.documents(patientId, { document_type: 'CONSENT', limit: 100 }),
      ]);
      setPatient(patientRecord);
      setSignedByName(patientFullName(patientRecord));
      setConsents(documentResponse.data);
    } catch (error) {
      setPatient(null);
      setConsents([]);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [requestedPatientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitConsent = async (event: FormEvent) => {
    event.preventDefault();
    if (!patient || !file || !title.trim()) {
      showToast('Patient, consent title, and consent file are required.');
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await patientsApi.uploadDocument(patient.id, {
        document_type: 'CONSENT',
        title: title.trim(),
        description: description.trim() || undefined,
        consent_status: status,
        signed_at: signedAt || undefined,
        valid_until: validUntil || undefined,
        signed_by_name: signedByName.trim() || undefined,
        file,
      });
      setConsents((current) => [uploaded, ...current]);
      setUploadOpen(false);
      setFile(null);
      setTitle('');
      setDescription('');
      showToast('Consent file uploaded successfully.');
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const viewConsent = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await patientsApi.downloadDocument(patient.id, document.id);
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    }
  };

  const downloadConsent = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await patientsApi.downloadDocument(patient.id, document.id);
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    }
  };

  const deleteConsent = async () => {
    if (!patient || !deleting) return;
    try {
      await patientsApi.deleteDocument(patient.id, deleting.id);
      setConsents((current) => current.filter((document) => document.id !== deleting.id));
      showToast('Consent file deleted.');
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setDeleting(null);
    }
  };

  const replaceConsent = async (replacementFile: File) => {
    if (!patient || !replacing) return;
    setSubmitting(true);
    try {
      const replacement = await patientsApi.replaceDocument(patient.id, replacing.id, {
        document_type: 'CONSENT',
        title: replacing.title,
        description: replacing.description,
        consent_status: replacing.consent_status ?? 'PENDING',
        signed_at: replacing.signed_at ?? undefined,
        valid_until: replacing.valid_until ?? undefined,
        signed_by_name: replacing.signed_by_name ?? undefined,
        file: replacementFile,
      });
      setConsents((current) => current.map((document) => document.id === replacement.id ? replacement : document));
      showToast('Consent file replaced successfully.');
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
      setReplacing(null);
      if (replacementInput.current) replacementInput.current.value = '';
    }
  };

  const count = (target: ApiPatientConsentStatus) => consents.filter((document) => document.consent_status === target).length;

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title"><h2>Consent Management</h2><p>Manage stored patient authorization files</p></div>
          <div className="appointment-page-actions">
            <select
              aria-label="Switch patient"
              onChange={(event) => navigate(`/patients/consent?id=${encodeURIComponent(event.target.value)}`)}
              value={patient?.id ?? ''}
            >
              <option value="">Select patient</option>
              {patients.map((item) => <option key={item.id} value={item.id}>{patientFullName(item)} - {item.patient_number}</option>)}
            </select>
            <button className="doc-btn primary" disabled={!patient} onClick={() => setUploadOpen(true)} type="button">
              <i className="ph ph-upload-simple" aria-hidden="true" /> Upload Consent
            </button>
          </div>
        </section>

        {loadError ? <div className="form-error-banner">{loadError}</div> : null}
        {patient ? (
          <section className="doc-card opd-patient-banner">
            <div className="opd-patient-avatar-box"><span>{patientInitials(patientFullName(patient))}</span></div>
            <div className="opd-patient-banner-info"><div className="opd-patient-banner-title"><h3>{patientFullName(patient)}</h3><span className="opd-mrn-chip">{patient.patient_number}</span></div><div className="opd-patient-meta-line"><span>{patient.gender}</span><span>{patient.phone ?? 'Phone not recorded'}</span></div></div>
          </section>
        ) : null}

        <section className="consent-kpi-grid">
          {([['Total', consents.length], ['Signed', count('SIGNED')], ['Pending', count('PENDING')], ['Expired', count('EXPIRED')], ['Rejected', count('REJECTED')]] as const).map(([label, value]) => (
            <article className="doc-card consent-kpi-card" key={label}><div><span>{label}</span><strong>{loading ? '-' : value}</strong></div></article>
          ))}
        </section>

        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="doc-card-header"><div><h3>Consent Files</h3><p>Only files stored by the backend are shown</p></div></div>
          <div className="table-responsive"><table className="data-table"><thead><tr><th>CONSENT</th><th>FILE</th><th>SIGNED BY</th><th>SIGNED DATE</th><th>VALID UNTIL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
            {loading ? <tr><td className="um-state-cell" colSpan={7}>Loading consent files...</td></tr> : consents.length === 0 ? <tr><td className="um-state-cell" colSpan={7}>No consent files are stored for this patient.</td></tr> : consents.map((document) => (
              <tr key={document.id}><td><strong>{document.title}</strong><br /><small>{document.description}</small></td><td>{document.file_name}</td><td>{document.signed_by_name ?? 'Not recorded'}</td><td>{document.signed_at ? formatDate(document.signed_at) : 'Not recorded'}</td><td>{document.valid_until ? formatDate(document.valid_until) : 'No expiry'}</td><td><span className="doc-status active">{document.consent_status ? statusLabels[document.consent_status] : 'Pending'}</span></td><td><div className="table-actions"><button className="doc-icon-action" onClick={() => void viewConsent(document)} title="View" type="button"><i className="ph ph-eye" /></button><button className="doc-icon-action" onClick={() => void downloadConsent(document)} title="Download" type="button"><i className="ph ph-download-simple" /></button><button className="doc-icon-action" disabled={submitting} onClick={() => { setReplacing(document); window.setTimeout(() => replacementInput.current?.click(), 0); }} title="Replace" type="button"><i className="ph ph-arrows-clockwise" /></button><button className="doc-icon-action" onClick={() => setDeleting(document)} title="Delete" type="button"><i className="ph ph-trash" /></button></div></td></tr>
            ))}
          </tbody></table></div>
        </section>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Consent File">
        <form className="modal-form" onSubmit={submitConsent}>
          <div className="doc-field"><label htmlFor="consent-title">Consent Title</label><input id="consent-title" onChange={(event) => setTitle(event.target.value)} required value={title} /></div>
          <div className="doc-field"><label htmlFor="consent-file">Consent File</label><input accept={fileAccept} id="consent-file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" /></div>
          <div className="doc-field"><label htmlFor="consent-description">Description</label><textarea id="consent-description" onChange={(event) => setDescription(event.target.value)} value={description} /></div>
          <div className="doc-form-grid"><div className="doc-field"><label htmlFor="consent-status">Status</label><select id="consent-status" onChange={(event) => setStatus(event.target.value as ApiPatientConsentStatus)} value={status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="doc-field"><label htmlFor="consent-signer">Signed By</label><input id="consent-signer" onChange={(event) => setSignedByName(event.target.value)} value={signedByName} /></div><div className="doc-field"><label htmlFor="consent-signed-at">Signed Date</label><input id="consent-signed-at" onChange={(event) => setSignedAt(event.target.value)} type="date" value={signedAt} /></div><div className="doc-field"><label htmlFor="consent-valid-until">Valid Until</label><input id="consent-valid-until" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></div></div>
          <div className="modal-actions"><button className="doc-btn" onClick={() => setUploadOpen(false)} type="button">Cancel</button><button className="doc-btn primary" disabled={submitting} type="submit">{submitting ? 'Uploading...' : 'Upload Consent'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog confirmLabel="Delete Consent" message={`Delete ${deleting?.title ?? 'this consent file'}?`} onCancel={() => setDeleting(null)} onConfirm={() => void deleteConsent()} open={Boolean(deleting)} title="Delete Consent File" />
      <input accept={fileAccept} hidden onChange={(event) => { const replacementFile = event.target.files?.[0]; if (replacementFile) void replaceConsent(replacementFile); }} ref={replacementInput} type="file" />
      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
