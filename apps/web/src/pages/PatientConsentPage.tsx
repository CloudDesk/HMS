import { useRef, useState, type FormEvent } from 'react';
import { type PatientDocumentResponse } from '../api/patients';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { formatDate, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';
import { toast } from 'sonner';
import { usePatientConsentFeature } from '../hooks/patients/usePatientConsentFeature';

const statusLabels: Record<string, string> = {
  NOT_REQUIRED: 'Not Required',
  SIGNED: 'Signed',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
  ATTACHED: 'Attached',
  VERIFIED: 'Verified',
};

const fileAccept = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx';

export function PatientConsentPage() {
  const {
    state: { patient, patients, consents, templates, loading, isSubmitting },
    capabilities: { canCreate, canDelete, canView, canEdit, canVerify },
    actions: {
      handlePatientChange,
      handleUpload,
      handleDownload,
      handleView,
      handleDelete,
      handleReplace,
      handleVerify,
    }
  } = usePatientConsentFeature();

  // Local UI State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [contextType, setContextType] = useState<'PATIENT' | 'PROCEDURE' | 'ADMISSION'>('PATIENT');
  const [contextId, setContextId] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [signedByName, setSignedByName] = useState('');

  const [deleting, setDeleting] = useState<PatientDocumentResponse | null>(null);
  const [replacing, setReplacing] = useState<PatientDocumentResponse | null>(null);
  const replacementInput = useRef<HTMLInputElement>(null);

  const submitConsent = async (event: FormEvent) => {
    event.preventDefault();
    if (!patient || !file || !title.trim()) {
      toast.error('Patient, consent title, and consent file are required.');
      return;
    }
    try {
      await handleUpload(file, title, description, 'ATTACHED', signedAt, validUntil, signedByName, templateId, contextType, contextId);
      setUploadOpen(false);
      setFile(null);
      setTitle('');
      setDescription('');
    } catch {
      // Handled in feature hook or silently fails
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await handleDelete(deleting.id);
    setDeleting(null);
  };

  const confirmReplace = async (replacementFile: File) => {
    if (!replacing) return;
    await handleReplace(replacing, replacementFile);
    setReplacing(null);
    if (replacementInput.current) replacementInput.current.value = '';
  };

  const count = (target: string) => consents.filter((document) => document.consent_status === target).length;

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title"><h2>Consent Management</h2><p>Manage stored patient authorization files</p></div>
          <div className="appointment-page-actions">
            <select
              aria-label="Switch patient"
              onChange={(event) => handlePatientChange(event.target.value)}
              value={patient?.id ?? ''}
            >
              <option value="">Select patient</option>
              {patients.map((item) => <option key={item.id} value={item.id}>{patientFullName(item)} - {item.patient_number}</option>)}
            </select>
            <button className="doc-btn primary" disabled={!patient || !canCreate} onClick={() => { setUploadOpen(true); setSignedByName(patient ? patientFullName(patient) : ''); }} type="button">
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
          {([['Total', consents.length], ['Pending', count('PENDING')], ['Signed', count('SIGNED')], ['Verified', count('VERIFIED')]] as const).map(([label, value]) => (
            <article className="doc-card consent-kpi-card" key={label}><div><span>{label}</span><strong>{loading ? '-' : value}</strong></div></article>
          ))}
        </section>

        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="doc-card-header"><div><h3>Consent Files</h3><p>Stored in Patient Documents with originating context</p></div></div>
          <div className="table-responsive"><table className="data-table"><thead><tr><th>CONSENT</th><th>CONSENT DOCUMENT ID</th><th>ORIGINATING CONTEXT</th><th>VERSION</th><th>UPLOADED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
            {loading ? <tr><td className="um-state-cell" colSpan={7}>Loading consent files...</td></tr> : consents.length === 0 ? <tr><td className="um-state-cell" colSpan={7}>No consent files are stored for this patient.</td></tr> : consents.map((document) => (
              <tr key={document.id}>
                <td><strong>{document.title}</strong><br /><small>{document.consent_category ?? document.description}</small></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <code style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      {document.id}
                    </code>
                    <button
                      className="doc-icon-action"
                      onClick={() => {
                        void navigator.clipboard.writeText(document.id);
                        toast.success('Consent Document ID copied!');
                      }}
                      title="Copy Consent Document ID"
                      type="button"
                    >
                      <i className="ph ph-copy" />
                    </button>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{document.context_type ?? 'PATIENT'}</span>
                  <br />
                  <small style={{ color: '#64748b' }}>Ref: {document.context_id ?? document.patient_id}</small>
                </td>
                <td>{document.consent_version ? `v${document.consent_version}` : '-'}</td>
                <td>{document.uploaded_by_name ?? 'Unknown'}<br /><small>{formatDate(document.uploaded_at)}</small></td>
                <td><span className="doc-status active">{document.consent_status ? statusLabels[document.consent_status] : 'Pending'}</span></td>
                <td>
                  <div className="table-actions">
                    {canView ? <><button className="doc-icon-action" onClick={() => void handleView(document)} title="View" type="button"><i className="ph ph-eye" /></button><button className="doc-icon-action" onClick={() => void handleDownload(document)} title="Download" type="button"><i className="ph ph-download-simple" /></button></> : null}
                    {canVerify && document.consent_status === 'ATTACHED' ? <button className="doc-icon-action" onClick={() => void handleVerify(document.id)} title="Verify" type="button"><i className="ph ph-check-circle" /></button> : null}
                    {canEdit ? <button className="doc-icon-action" disabled={isSubmitting} onClick={() => { setReplacing(document); window.setTimeout(() => replacementInput.current?.click(), 0); }} title="Replace" type="button"><i className="ph ph-arrows-clockwise" /></button> : null}
                    {canDelete ? <button className="doc-icon-action" onClick={() => setDeleting(document)} title="Delete" type="button"><i className="ph ph-trash" /></button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Consent File">
        <form className="modal-form" onSubmit={submitConsent}>
          <div className="doc-field"><label htmlFor="consent-title">Consent Title</label><input id="consent-title" onChange={(event) => setTitle(event.target.value)} required value={title} /></div>
          <div className="doc-field"><label htmlFor="consent-file">Consent File</label><input accept={fileAccept} id="consent-file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" /></div>
          <div className="doc-field"><label htmlFor="consent-description">Description</label><textarea id="consent-description" onChange={(event) => setDescription(event.target.value)} value={description} /></div>
          <div className="doc-form-grid"><div className="doc-field"><label htmlFor="consent-template">Template</label><select id="consent-template" onChange={(event) => setTemplateId(event.target.value)} required value={templateId}><option value="">Select template</option>{templates.filter((item) => item.context_type === contextType).map((item) => <option key={item.id} value={item.id}>{item.name} (v{item.version}){item.mandatory ? ' — Mandatory' : ''}</option>)}</select></div><div className="doc-field"><label htmlFor="consent-context">Context</label><select id="consent-context" onChange={(event) => { setContextType(event.target.value as typeof contextType); setTemplateId(''); setContextId(''); }} value={contextType}><option value="PATIENT">Patient / EMR</option><option value="PROCEDURE">Procedure encounter</option><option value="ADMISSION">IP admission</option></select></div>{contextType !== 'PATIENT' ? <div className="doc-field"><label htmlFor="consent-context-id">{contextType === 'ADMISSION' ? 'Admission ID' : 'Procedure Encounter ID'}</label><input id="consent-context-id" onChange={(event) => setContextId(event.target.value)} required value={contextId} /></div> : null}<div className="doc-field"><label>Status</label><input disabled value="Attached on upload" /></div><div className="doc-field"><label htmlFor="consent-signer">Signed By</label><input id="consent-signer" onChange={(event) => setSignedByName(event.target.value)} value={signedByName} /></div><div className="doc-field"><label htmlFor="consent-signed-at">Signed Date</label><input id="consent-signed-at" onChange={(event) => setSignedAt(event.target.value)} type="date" value={signedAt} /></div><div className="doc-field"><label htmlFor="consent-valid-until">Valid Until</label><input id="consent-valid-until" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></div></div>
          <div className="modal-actions"><button className="doc-btn" onClick={() => setUploadOpen(false)} type="button">Cancel</button><button className="doc-btn primary" disabled={isSubmitting} type="submit">{isSubmitting ? 'Uploading...' : 'Upload Consent'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog confirmLabel="Delete Consent" message={`Delete ${deleting?.title ?? 'this consent file'}?`} onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete()} open={Boolean(deleting)} title="Delete Consent File" />
      <input accept={fileAccept} hidden onChange={(event) => { const replacementFile = event.target.files?.[0]; if (replacementFile) void confirmReplace(replacementFile); }} ref={replacementInput} type="file" />
    </>
  );
}

