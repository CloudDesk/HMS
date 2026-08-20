import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { patientPortalApi } from '../api/patient-portal';
import type { PublicBranch } from '../api/patient-portal';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from '../routing/navigation';

type RegistrationMode = 'new' | 'guardian';
type VerifiedMobile = { phone: string; otp: string; mode: RegistrationMode; verifiedAt: number };
const VERIFIED_MOBILE_KEY = 'hms_patient_verified_mobile';
const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.'), email: z.string().trim().email('Enter a valid email address.'),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']), line1: z.string().trim().optional(), city: z.string().trim().optional(),
  state: z.string().trim().optional(), country: z.string().trim().optional(), postal_code: z.string().trim().optional(),
  identification_type: z.string().trim().optional(), identification_number: z.string().trim().optional(), legal_consent: z.boolean(),
  child_first_name: z.string().trim().optional(), child_last_name: z.string().trim().optional(), child_date_of_birth: z.string().optional(),
  child_gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']), child_blood_group: z.string().optional(), child_preferred_branch_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function PatientSignupPage() {
  const { status, user, loginWithOtp, activateGuardian } = useAuth();
  const { search } = useAppLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [verified] = useState<VerifiedMobile | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(VERIFIED_MOBILE_KEY) ?? 'null') as VerifiedMobile | null;
      return value?.phone && value?.otp && Date.now() - value.verifiedAt < 15 * 60 * 1000 ? value : null;
    } catch { return null; }
  });
  const guardianRequired = verified?.mode === 'guardian';
  const [mode, setMode] = useState<RegistrationMode>(guardianRequired || params.get('mode') === 'guardian' ? 'guardian' : 'new');
  const [requestError, setRequestError] = useState('');
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const registrationStarted = useRef(false);
  const guardianAccountReady = useRef(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', relationship: 'PARENT', line1: '', city: '', state: '', country: '', postal_code: '', identification_type: '', identification_number: '', legal_consent: false, child_first_name: '', child_last_name: '', child_date_of_birth: '', child_gender: 'UNKNOWN', child_blood_group: '', child_preferred_branch_id: '' },
  });
  const requestedPath = params.get('return');
  const safeReturnPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : null;

  useEffect(() => {
    const isPortalUser = Boolean(user?.patientId || user?.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'));
    if (status === 'authenticated' && isPortalUser && (!registrationStarted.current || registrationComplete)) {
      sessionStorage.removeItem(VERIFIED_MOBILE_KEY);
      navigate(safeReturnPath ?? '/portal', { replace: true });
    }
  }, [registrationComplete, safeReturnPath, status, user]);

  useEffect(() => {
    let active = true;
    void patientPortalApi.publicBranches({ limit: 100 }).then((response) => {
      if (active) setBranches(response.data);
    }).catch(() => {
      if (active) setRequestError('Hospital branches could not be loaded. Please try again.');
    }).finally(() => {
      if (active) setBranchesLoading(false);
    });
    return () => { active = false; };
  }, []);

  const submit = async (values: FormValues) => {
    if (!verified) return;
    setRequestError(''); clearErrors();
    if (mode === 'guardian' && !values.legal_consent) {
      setError('legal_consent', { message: 'Guardian confirmation and consent are required.' }); return;
    }
    if (mode === 'guardian' && !guardianRequired) {
      let childValid = true;
      if (!values.child_first_name?.trim()) { setError('child_first_name', { message: 'Enter the child’s first name.' }); childValid = false; }
      if (!values.child_last_name?.trim()) { setError('child_last_name', { message: 'Enter the child’s last name.' }); childValid = false; }
      if (!values.child_date_of_birth) { setError('child_date_of_birth', { message: 'Enter the child’s date of birth.' }); childValid = false; }
      if (!values.child_preferred_branch_id) { setError('child_preferred_branch_id', { message: 'Select the child’s preferred branch.' }); childValid = false; }
      if (!childValid) return;
      const adultDate = new Date(values.child_date_of_birth!);
      adultDate.setFullYear(adultDate.getFullYear() + 18);
      if (adultDate <= new Date()) { setError('child_date_of_birth', { message: 'Manage a child is only for patients under 18.' }); return; }
    }
    registrationStarted.current = true;
    try {
      if (mode === 'guardian' && guardianRequired) {
        await activateGuardian({
          phone: verified.phone, otp: verified.otp, fullName: values.full_name, email: values.email, relationship: values.relationship,
          address: { line1: values.line1 || null, city: values.city || null, state: values.state || null, country: values.country || null, postal_code: values.postal_code || null },
          identification: { type: values.identification_type || null, number: values.identification_number || null }, legalConsentAccepted: true,
        });
      } else {
        if (!guardianAccountReady.current) {
          await patientPortalApi.signup({
            account_type: mode === 'guardian' ? 'GUARDIAN' : 'PATIENT', full_name: values.full_name, email: values.email,
            phone: verified.phone, otp: verified.otp,
            guardian_profile: mode === 'guardian' ? {
              relationship: values.relationship,
              address: { line1: values.line1 || null, city: values.city || null, state: values.state || null, country: values.country || null, postal_code: values.postal_code || null },
              identification: { type: values.identification_type || null, number: values.identification_number || null }, legal_consent_accepted: true,
            } : undefined,
          });
          await loginWithOtp(verified.phone, verified.otp);
          guardianAccountReady.current = mode === 'guardian';
        }
        if (mode === 'guardian') {
          await patientPortalApi.addDependent({
            first_name: values.child_first_name!.trim(), last_name: values.child_last_name!.trim(),
            date_of_birth: values.child_date_of_birth!, gender: values.child_gender,
            preferred_branch_id: values.child_preferred_branch_id!, blood_group: values.child_blood_group || null,
            address: { line1: values.line1 || null, city: values.city || null, state: values.state || null, country: values.country || null, postal_code: values.postal_code || null },
            relationship: values.relationship,
          });
        }
      }
      setRegistrationComplete(true);
    } catch (error) { setRequestError(error instanceof ApiError ? error.message : 'Your portal account could not be created.'); }
  };

  if (!verified) return <main className="patient-login-page patient-signup-page">
    <section className="patient-login-brand"><div className="patient-login-brand__inner"><div className="patient-login-logo"><i className="ph ph-heartbeat" /></div><p className="patient-login-kicker">HMS Patient Portal</p><h1>Verify once, then register.</h1><p>Your mobile number is used to find an existing record safely before any new MRN is created.</p></div></section>
    <section className="patient-login-panel"><div className="patient-login-form-wrap"><p className="patient-login-kicker">Mobile verification required</p><h2>Start with your mobile number</h2><p className="patient-login-subtitle">Return to sign in and verify your number first.</p><button className="patient-login-submit" onClick={() => navigate(`/login${safeReturnPath ? `?return=${encodeURIComponent(safeReturnPath)}` : ''}`)} type="button">Verify mobile number<i className="ph ph-arrow-right" /></button></div></section>
  </main>;

  return <main className="patient-login-page patient-signup-page">
    <section className="patient-login-brand"><div className="patient-login-brand__inner"><div className="patient-login-logo"><i className="ph ph-heartbeat" /></div><p className="patient-login-kicker">HMS Patient Portal</p><h1>One account for your family’s care.</h1><p>Complete the account holder’s details. Patient medical information is captured separately inside the portal.</p><ul><li><i className="ph ph-identification-card" /> Every patient record has one unique MRN</li><li><i className="ph ph-users-three" /> Guardian and child information stay separate</li><li><i className="ph ph-lock-key" /> Access is limited to linked records</li></ul></div></section>
    <section className="patient-login-panel" aria-labelledby="patient-signup-title"><div className="patient-login-form-wrap patient-signup-form-wrap">
      <p className="patient-login-kicker">Mobile number verified</p><h2 id="patient-signup-title">Complete portal access</h2><p className="patient-login-subtitle">Verified mobile: <strong>{verified.phone}</strong></p>
      <div className="portal-registration-modes portal-registration-modes--two">
        {!guardianRequired ? <button className={mode === 'new' ? 'active' : ''} onClick={() => { setMode('new'); setRequestError(''); }} type="button"><i className="ph ph-user-plus" /><span><strong>Register myself</strong><small>Create my patient record</small></span></button> : null}
        <button className={mode === 'guardian' ? 'active' : ''} onClick={() => { setMode('guardian'); setRequestError(''); }} type="button"><i className="ph ph-users-three" /><span><strong>Manage a child</strong><small>Create guardian access</small></span></button>
      </div>
      {guardianRequired ? <div className="patient-login-help"><i className="ph ph-info" /><span>This number matches a minor patient, so an adult parent or guardian account is required.</span></div> : null}
      {requestError ? <div className="auth-alert auth-alert--error" role="alert">{requestError}</div> : null}
      <form autoComplete="off" className="patient-login-form" onSubmit={handleSubmit(submit)} noValidate>
        <Field error={errors.full_name?.message} icon="ph-user" label={mode === 'guardian' ? 'Parent / guardian full name' : 'Full name'}><input autoComplete="name" {...register('full_name')} /></Field>
        <Field error={errors.email?.message} icon="ph-envelope" label="Email"><input autoComplete="email" type="email" {...register('email')} /></Field>
        {mode === 'guardian' ? <><div className="portal-form-divider"><strong>Guardian profile</strong><small>These details belong to the adult, not the child.</small></div>
          <Field icon="ph-users-three" label="Relationship"><select {...register('relationship')}><option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal guardian</option></select></Field>
          <Field icon="ph-map-pin" label="Address"><input placeholder="Address line" {...register('line1')} /></Field>
          <div className="patient-inline-fields"><label><span>City</span><input {...register('city')} /></label><label><span>State</span><input {...register('state')} /></label></div>
          <div className="patient-inline-fields"><label><span>Country</span><input {...register('country')} /></label><label><span>Postal code</span><input {...register('postal_code')} /></label></div>
          <div className="patient-inline-fields"><label><span>ID type</span><input placeholder="National ID / Passport" {...register('identification_type')} /></label><label><span>ID number</span><input {...register('identification_number')} /></label></div>
          {!guardianRequired ? <><div className="portal-form-divider"><strong>Child patient details</strong><small>These details create the child’s separate HMS patient record and MRN.</small></div>
            <div className="patient-inline-fields"><label><span>Child’s first name <b>*</b></span><input autoComplete="off" {...register('child_first_name')} />{errors.child_first_name ? <small className="portal-field-error">{errors.child_first_name.message}</small> : null}</label><label><span>Child’s last name <b>*</b></span><input autoComplete="off" {...register('child_last_name')} />{errors.child_last_name ? <small className="portal-field-error">{errors.child_last_name.message}</small> : null}</label></div>
            <div className="patient-inline-fields"><label><span>Date of birth <b>*</b></span><input type="date" {...register('child_date_of_birth')} />{errors.child_date_of_birth ? <small className="portal-field-error">{errors.child_date_of_birth.message}</small> : null}</label><label><span>Gender <b>*</b></span><select {...register('child_gender')}><option value="UNKNOWN">Prefer not to say</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label></div>
            <div className="patient-inline-fields"><label><span>Blood group</span><select {...register('child_blood_group')}><option value="">Not known</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((group) => <option key={group} value={group}>{group}</option>)}</select></label><label><span>Preferred branch <b>*</b></span><select disabled={branchesLoading} {...register('child_preferred_branch_id')}><option value="">{branchesLoading ? 'Loading branches…' : 'Select a branch'}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` · ${branch.city}` : ''}</option>)}</select>{errors.child_preferred_branch_id ? <small className="portal-field-error">{errors.child_preferred_branch_id.message}</small> : null}</label></div>
            <div className="patient-login-help"><i className="ph ph-map-pin" /><span>The guardian address above will be used as the child’s initial address. It can be updated later from My profile.</span></div>
          </> : null}
          <label className="portal-consent"><input type="checkbox" {...register('legal_consent')} /><span>I confirm that I am authorised to manage this patient’s care and consent to linking their medical record.</span></label>{errors.legal_consent ? <small className="portal-field-error">{errors.legal_consent.message}</small> : null}
        </> : null}
        <button className="patient-login-submit" disabled={isSubmitting} type="submit">{isSubmitting ? 'Please wait…' : mode === 'guardian' ? 'Create guardian access' : 'Continue to personal information'}<i className="ph ph-arrow-right" /></button>
      </form>
      <div className="patient-signup-prompt"><button onClick={() => { sessionStorage.removeItem(VERIFIED_MOBILE_KEY); navigate('/login'); }} type="button">Use a different mobile number</button></div>
    </div></section>
  </main>;
}

function Field({ label, icon, error, children }: { label: string; icon: string; error?: string; children: React.ReactNode }) {
  return <label><span>{label} <b>*</b></span><div className="patient-login-input"><i className={`ph ${icon}`} />{children}</div>{error ? <small className="portal-field-error">{error}</small> : null}</label>;
}
