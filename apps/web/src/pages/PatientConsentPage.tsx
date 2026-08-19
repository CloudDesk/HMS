import { useRef, useState, type FormEvent } from 'react';
import {
  type ApiPatientConsentStatus,
  type PatientDocumentResponse,
} from '../api/patients';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, getPatientIdFromSearch, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';
import {
  usePatientsList,
  usePatientDetails,
  usePatientDocuments,
  useUploadPatientDocument,
  useDeletePatientDocument,
  useDownloadPatientDocument,
  useReplacePatientDocument
} from '../hooks/patients/usePatients';
import { toast } from 'sonner';

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

  // Queries
  const { data: listRes } = usePatientsList({ status: 'ACTIVE', limit: 100 });
  const patients = listRes?.data || [];
  const patientId = requestedPatientId || patients[0]?.id || null;

  const { data: patient, isLoading: loadingPatient } = usePatientDetails(patientId);
  const { data: docsRes, isLoading: loadingDocs } = usePatientDocuments(patientId, { document_type: 'CONSENT', limit: 100 });
  const consents = docsRes?.data || [];
  const loading = loadingPatient || loadingDocs;

  // Mutations
  const uploadDoc = useUploadPatientDocument();
  const deleteDoc = useDeletePatientDocument();
  const downloadDoc = useDownloadPatientDocument();
  const replaceDoc = useReplacePatientDocument();

  // State
  const [uploadOpen, setUploadOpen] = useState(false);
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

  const submitConsent = (event: FormEvent) => {
    event.preventDefault();
    if (!patient || !file || !title.trim()) {
      toast.error('Patient, consent title, and consent file are required.');
      return;
    }

    uploadDoc.mutate({
      id: patient.id,
      payload: {
        document_type: 'CONSENT',
        title: title.trim(),
        description: description.trim() || undefined,
        consent_status: status,
        signed_at: signedAt || undefined,
        valid_until: validUntil || undefined,
        signed_by_name: signedByName.trim() || undefined,
        file,
      }
    }, {
      onSuccess: () => {
        setUploadOpen(false);
        setFile(null);
        setTitle('');
        setDescription('');
        toast.success('Consent file uploaded successfully.');
      }
    });
  };

  const viewConsent = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await downloadDoc.mutateAsync({ patientId: patient.id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const downloadConsent = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await downloadDoc.mutateAsync({ patientId: patient.id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const handleDeleteConsent = () => {
    if (!patient || !deleting) return;
    deleteDoc.mutate({ id: patient.id, documentId: deleting.id }, {
      onSuccess: () => {
        toast.success('Consent file deleted.');
        setDeleting(null);
      }
    });
  };

  const handleReplaceConsent = (replacementFile: File) => {
    if (!patient || !replacing) return;
    replaceDoc.mutate({
      id: patient.id,
      documentId: replacing.id,
      payload: {
        document_type: 'CONSENT',
        title: replacing.title,
        description: replacing.description,
        consent_status: replacing.consent_status ?? 'PENDING',
        signed_at: replacing.signed_at ?? undefined,
        valid_until: replacing.valid_until ?? undefined,
        signed_by_name: replacing.signed_by_name ?? undefined,
        file: replacementFile,
      }
    }, {
      onSuccess: () => {
        toast.success('Consent file replaced successfully.');
        setReplacing(null);
        if (replacementInput.current) replacementInput.current.value = '';
      }
    });
  };

  const count = (target: ApiPatientConsentStatus) => consents.filter((document) => document.consent_status === target).length;
  const isSubmitting = uploadDoc.isPending || replaceDoc.isPending;

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
            <button className="doc-btn primary" disabled={!patient} onClick={() => { setUploadOpen(true); setSignedByName(patient ? patientFullName(patient) : ''); }} type="button">
              <i className="ph ph-upload-simple" aria-hidden="true" /> Upload Consent
            </button>
          </div>
        </section>

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
              <tr key={document.id}><td><strong>{document.title}</strong><br /><small>{document.description}</small></td><td>{document.file_name}</td><td>{document.signed_by_name ?? 'Not recorded'}</td><td>{document.signed_at ? formatDate(document.signed_at) : 'Not recorded'}</td><td>{document.valid_until ? formatDate(document.valid_until) : 'No expiry'}</td><td><span className="doc-status active">{document.consent_status ? statusLabels[document.consent_status] : 'Pending'}</span></td><td><div className="table-actions"><button className="doc-icon-action" onClick={() => void viewConsent(document)} title="View" type="button"><i className="ph ph-eye" /></button><button className="doc-icon-action" onClick={() => void downloadConsent(document)} title="Download" type="button"><i className="ph ph-download-simple" /></button><button className="doc-icon-action" disabled={isSubmitting} onClick={() => { setReplacing(document); window.setTimeout(() => replacementInput.current?.click(), 0); }} title="Replace" type="button"><i className="ph ph-arrows-clockwise" /></button><button className="doc-icon-action" onClick={() => setDeleting(document)} title="Delete" type="button"><i className="ph ph-trash" /></button></div></td></tr>
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
          <div className="modal-actions"><button className="doc-btn" onClick={() => setUploadOpen(false)} type="button">Cancel</button><button className="doc-btn primary" disabled={isSubmitting} type="submit">{isSubmitting ? 'Uploading...' : 'Upload Consent'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog confirmLabel="Delete Consent" message={`Delete ${deleting?.title ?? 'this consent file'}?`} onCancel={() => setDeleting(null)} onConfirm={() => void handleDeleteConsent()} open={Boolean(deleting)} title="Delete Consent File" />
      <input accept={fileAccept} hidden onChange={(event) => { const replacementFile = event.target.files?.[0]; if (replacementFile) void handleReplaceConsent(replacementFile); }} ref={replacementInput} type="file" />
    </>
  );
}

