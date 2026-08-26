import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/api-error';
import { patientPortalApi } from '../../api/patient-portal';

export function PortalLinkDependentForm({ onSaved, onCancel }: { onSaved: (patientId: string) => void; onCancel?: () => void }) {
  const [patientNumber, setPatientNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [relationship, setRelationship] = useState<'PARENT' | 'LEGAL_GUARDIAN'>('PARENT');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!patientNumber || !dateOfBirth || !consent) { setError('MRN, date of birth and guardian consent are required.'); return; }
    setSubmitting(true);
    try {
      const result = await patientPortalApi.linkDependent({ patient_number: patientNumber, date_of_birth: dateOfBirth, relationship, legal_consent_accepted: true });
      onSaved(result.patientId);
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : 'The existing patient record could not be linked.'); }
    finally { setSubmitting(false); }
  };
  return <form className="portal-onboarding-form" onSubmit={submit}>
    {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
    <div className="portal-form-section"><div className="portal-form-section-title"><span>1</span><div><strong>Existing dependent record</strong><small>Match the patient without creating another MRN.</small></div></div><div className="portal-form-grid">
      <label><span>Patient MRN <b>*</b></span><input onChange={(event) => setPatientNumber(event.target.value.toUpperCase())} placeholder="HMS-2026-000007" value={patientNumber} /></label>
      <label><span>Date of birth <b>*</b></span><input onChange={(event) => setDateOfBirth(event.target.value)} type="date" value={dateOfBirth} /></label>
      <label><span>Your relationship <b>*</b></span><select onChange={(event) => setRelationship(event.target.value as typeof relationship)} value={relationship}><option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal guardian</option></select></label>
      <label className="wide portal-consent"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" /><span>I confirm that I am authorised to access and manage this patient’s care.</span></label>
    </div></div>
    <div className="portal-form-actions">{onCancel ? <button onClick={onCancel} type="button">Cancel</button> : null}<button className="primary" disabled={submitting} type="submit">{submitting ? 'Linking…' : 'Link existing patient'}</button></div>
  </form>;
}
