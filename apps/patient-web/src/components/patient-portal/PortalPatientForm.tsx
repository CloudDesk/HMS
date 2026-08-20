import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import { patientPortalApi, type PortalPatientInput } from '../../api/patient-portal';
import { PortalLinkDependentForm } from './PortalLinkDependentForm';

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required.'),
  last_name: z.string().trim().min(1, 'Last name is required.'),
  date_of_birth: z.string().min(1, 'Date of birth is required.'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  preferred_branch_id: z.string().min(1, 'Select a preferred hospital branch.'),
  blood_group: z.string().trim().optional(),
  line1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postal_code: z.string().trim().optional(),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
});
type FormValues = z.infer<typeof schema>;

export function PortalPatientForm({
  mode,
  onSaved,
  onCancel,
}: {
  mode: 'SELF' | 'DEPENDENT';
  onSaved: (patientId: string) => void;
  onCancel?: () => void;
}) {
  const [linkExisting, setLinkExisting] = useState(false);
  const branches = useQuery({ queryKey: ['public-branches'], queryFn: () => patientPortalApi.publicBranches({ limit: 24 }) });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', date_of_birth: '', gender: 'UNKNOWN', preferred_branch_id: '', blood_group: '',
      line1: '', city: '', state: '', country: '', postal_code: '', relationship: 'PARENT',
    },
  });

  const submit = async (values: FormValues) => {
    const patient: PortalPatientInput = {
      first_name: values.first_name,
      last_name: values.last_name,
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      preferred_branch_id: values.preferred_branch_id,
      blood_group: values.blood_group || null,
      address: {
        line1: values.line1 || null,
        city: values.city || null,
        state: values.state || null,
        country: values.country || null,
        postal_code: values.postal_code || null,
      },
    };
    try {
      const result = mode === 'SELF'
        ? await patientPortalApi.completeProfile(patient)
        : await patientPortalApi.addDependent({ ...patient, relationship: values.relationship });
      onSaved(result.patientId);
    } catch (error) {
      setError('root', { message: error instanceof ApiError ? error.message : 'Patient details could not be saved.' });
    }
  };

  if (mode === 'DEPENDENT' && linkExisting) return <><div className="portal-onboarding-choice"><button onClick={() => setLinkExisting(false)} type="button">Register new dependent</button><button className="active" type="button">Link existing MRN</button></div><PortalLinkDependentForm onCancel={onCancel} onSaved={onSaved} /></>;

  return (
    <>{mode === 'DEPENDENT' ? <div className="portal-onboarding-choice"><button className="active" type="button">Register new dependent</button><button onClick={() => setLinkExisting(true)} type="button">Link existing MRN</button></div> : null}
    <form className="portal-onboarding-form" onSubmit={handleSubmit(submit)} noValidate>
      {errors.root ? <div className="auth-alert auth-alert--error" role="alert">{errors.root.message}</div> : null}
      <div className="portal-form-section">
        <div className="portal-form-section-title"><span>1</span><div><strong>Patient information</strong><small>Identity details used for the medical record.</small></div></div>
        <div className="portal-form-grid">
          <label><span>First name <b>*</b></span><input {...register('first_name')} />{errors.first_name ? <small>{errors.first_name.message}</small> : null}</label>
          <label><span>Last name <b>*</b></span><input {...register('last_name')} />{errors.last_name ? <small>{errors.last_name.message}</small> : null}</label>
          <label><span>Date of birth <b>*</b></span><input max={new Date().toISOString().slice(0, 10)} type="date" {...register('date_of_birth')} />{errors.date_of_birth ? <small>{errors.date_of_birth.message}</small> : null}</label>
          <label><span>Gender <b>*</b></span><select {...register('gender')}><option value="UNKNOWN">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></label>
          <label><span>Blood group</span><select {...register('blood_group')}><option value="">Not known</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((value) => <option key={value}>{value}</option>)}</select></label>
          {mode === 'DEPENDENT' ? <label><span>Your relationship <b>*</b></span><select {...register('relationship')}><option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal guardian</option></select></label> : null}
          <label className="wide"><span>Preferred hospital branch <b>*</b></span><select disabled={branches.isLoading} {...register('preferred_branch_id')}><option value="">{branches.isLoading ? 'Loading branches…' : 'Select a branch'}</option>{branches.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` · ${branch.city}` : ''}</option>)}</select>{errors.preferred_branch_id ? <small>{errors.preferred_branch_id.message}</small> : null}</label>
        </div>
      </div>
      <div className="portal-form-section">
        <div className="portal-form-section-title"><span>2</span><div><strong>Address</strong><small>Optional residential information.</small></div></div>
        <div className="portal-form-grid">
          <label className="wide"><span>Address line</span><input {...register('line1')} /></label>
          <label><span>City</span><input {...register('city')} /></label>
          <label><span>State</span><input {...register('state')} /></label>
          <label><span>Country</span><input {...register('country')} /></label>
          <label><span>Postal code</span><input {...register('postal_code')} /></label>
        </div>
      </div>
      <div className="portal-form-actions">{onCancel ? <button disabled={isSubmitting} onClick={onCancel} type="button">Cancel</button> : null}<button className="primary" disabled={isSubmitting} type="submit">{isSubmitting ? 'Saving…' : mode === 'SELF' ? 'Complete patient profile' : 'Add dependent'}</button></div>
    </form></>
  );
}
