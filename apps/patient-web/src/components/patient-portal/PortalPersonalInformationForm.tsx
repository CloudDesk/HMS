import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import { patientPortalApi, type PatientPortalOverview, type PortalGuardianUpdateInput, type PortalPatientUpdateInput } from '../../api/patient-portal';

const optionalPhone = z.string().trim().refine((value) => !value || value.replace(/\D/g, '').length >= 7, 'Enter a valid mobile number.');
const schema = z.object({
  manage_guardian: z.boolean(),
  first_name: z.string().trim().min(1, 'First name is required.'),
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().min(1, 'Last name is required.'),
  date_of_birth: z.string().min(1, 'Date of birth is required.'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address.')]),
  phone: optionalPhone,
  preferred_branch_id: z.string().min(1, 'Select a preferred hospital branch.'),
  blood_group: z.string().trim().optional(),
  line1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postal_code: z.string().trim().optional(),
  emergency_name: z.string().trim().optional(),
  emergency_relationship: z.string().trim().optional(),
  emergency_phone: optionalPhone,
  guardian_full_name: z.string().trim().optional(),
  guardian_relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']).optional(),
  guardian_line1: z.string().trim().optional(),
  guardian_city: z.string().trim().optional(),
  guardian_state: z.string().trim().optional(),
  guardian_country: z.string().trim().optional(),
  guardian_postal_code: z.string().trim().optional(),
  guardian_identification_type: z.string().trim().optional(),
  guardian_identification_number: z.string().trim().optional(),
}).superRefine((values, context) => {
  if (!values.manage_guardian) return;
  if (!values.guardian_full_name || values.guardian_full_name.length < 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['guardian_full_name'], message: 'Parent or guardian name is required.' });
  }
  if (!values.guardian_relationship) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['guardian_relationship'], message: 'Select the relationship.' });
  }
});
type FormValues = z.infer<typeof schema>;

type GuardianDetails = {
  full_name: string;
  email: string | null;
  phone: string | null;
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address: Record<string, string | null>;
  identification: { type?: string | null; number?: string | null };
  legal_consent_accepted: boolean;
};

const dateValue = (value: string) => value.slice(0, 10);

export function PortalPersonalInformationForm({
  patient,
  preferredBranchId,
  guardian,
  onSaved,
  onCancel,
}: {
  patient: PatientPortalOverview['patient'];
  preferredBranchId: string;
  guardian?: GuardianDetails;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const branches = useQuery({ queryKey: ['public-branches'], queryFn: () => patientPortalApi.publicBranches({ limit: 24 }) });
  const address = patient.address ?? {};
  const emergency = patient.emergency_contact ?? {};
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      manage_guardian: Boolean(guardian),
      first_name: patient.first_name,
      middle_name: patient.middle_name ?? '',
      last_name: patient.last_name,
      date_of_birth: dateValue(patient.date_of_birth),
      gender: patient.gender as FormValues['gender'],
      email: guardian && patient.email === guardian.email ? '' : patient.email ?? '',
      phone: guardian && patient.phone === guardian.phone ? '' : patient.phone ?? '',
      preferred_branch_id: preferredBranchId,
      blood_group: patient.blood_group ?? '',
      line1: address.line1 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      country: address.country ?? '',
      postal_code: address.postalCode ?? address.postal_code ?? '',
      emergency_name: emergency.name ?? '',
      emergency_relationship: emergency.relationship ?? '',
      emergency_phone: emergency.phone ?? '',
      guardian_full_name: guardian?.full_name ?? '',
      guardian_relationship: guardian?.relationship,
      guardian_line1: guardian?.address.line1 ?? '',
      guardian_city: guardian?.address.city ?? '',
      guardian_state: guardian?.address.state ?? '',
      guardian_country: guardian?.address.country ?? '',
      guardian_postal_code: guardian?.address.postalCode ?? guardian?.address.postal_code ?? '',
      guardian_identification_type: guardian?.identification.type ?? '',
      guardian_identification_number: guardian?.identification.number ?? '',
    },
  });

  const submit = async (values: FormValues) => {
    const input: PortalPatientUpdateInput = {
      first_name: values.first_name,
      middle_name: values.middle_name || null,
      last_name: values.last_name,
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      email: values.email || null,
      phone: values.phone || null,
      preferred_branch_id: values.preferred_branch_id,
      blood_group: values.blood_group || null,
      address: {
        line1: values.line1 || null,
        city: values.city || null,
        state: values.state || null,
        country: values.country || null,
        postal_code: values.postal_code || null,
      },
      emergency_contact: {
        name: values.emergency_name || null,
        relationship: values.emergency_relationship || null,
        phone: values.emergency_phone || null,
      },
    };
    try {
      const updates: Array<Promise<unknown>> = [patientPortalApi.updatePatient(patient.id, input)];
      if (guardian) {
        const guardianInput: PortalGuardianUpdateInput = {
          full_name: values.guardian_full_name!,
          relationship: values.guardian_relationship!,
          address: {
            line1: values.guardian_line1 || null,
            city: values.guardian_city || null,
            state: values.guardian_state || null,
            country: values.guardian_country || null,
            postal_code: values.guardian_postal_code || null,
          },
          identification: {
            type: values.guardian_identification_type || null,
            number: values.guardian_identification_number || null,
          },
        };
        updates.push(patientPortalApi.updateGuardian(patient.id, guardianInput));
      }
      await Promise.all(updates);
      onSaved();
    } catch (error) {
      setError('root', { message: error instanceof ApiError ? error.message : 'Personal information could not be updated.' });
    }
  };

  return <form className="portal-onboarding-form" onSubmit={handleSubmit(submit)} noValidate>
    {errors.root ? <div className="auth-alert auth-alert--error" role="alert">{errors.root.message}</div> : null}
    <div className="portal-form-section"><div className="portal-form-section-title"><span>1</span><div><strong>Personal and contact information</strong><small>Details stored in the selected HMS patient record.</small></div></div><div className="portal-form-grid">
      <label><span>First name <b>*</b></span><input {...register('first_name')} />{errors.first_name ? <small>{errors.first_name.message}</small> : null}</label>
      <label><span>Middle name</span><input {...register('middle_name')} /></label>
      <label><span>Last name <b>*</b></span><input {...register('last_name')} />{errors.last_name ? <small>{errors.last_name.message}</small> : null}</label>
      <label><span>Date of birth <b>*</b></span><input max={new Date().toISOString().slice(0, 10)} type="date" {...register('date_of_birth')} />{errors.date_of_birth ? <small>{errors.date_of_birth.message}</small> : null}</label>
      <label><span>Gender <b>*</b></span><select {...register('gender')}><option value="UNKNOWN">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></label>
      <label><span>Blood group</span><select {...register('blood_group')}><option value="">Not known</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>{guardian ? 'Child email (optional)' : 'Patient email'}</span><input autoComplete="email" type="email" {...register('email')} />{errors.email ? <small>{errors.email.message}</small> : null}</label>
      <label><span>{guardian ? 'Child mobile number (optional)' : 'Patient mobile number'}</span><input autoComplete="tel" inputMode="tel" {...register('phone')} />{errors.phone ? <small>{errors.phone.message}</small> : null}</label>
      <label className="wide"><span>Preferred hospital branch <b>*</b></span><select disabled={branches.isLoading} {...register('preferred_branch_id')}><option value="">{branches.isLoading ? 'Loading branches…' : 'Select a branch'}</option>{branches.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` · ${branch.city}` : ''}</option>)}</select>{errors.preferred_branch_id ? <small>{errors.preferred_branch_id.message}</small> : null}</label>
    </div><p className="portal-form-note"><i className="ph ph-info" /> {guardian ? 'Leave child contact fields empty when the child does not have their own phone or email. Guardian contacts are maintained separately below.' : 'Patient contact details do not change the mobile number or email used to sign in.'}</p></div>
    <div className="portal-form-section"><div className="portal-form-section-title"><span>2</span><div><strong>Address</strong><small>Residential and postal information.</small></div></div><div className="portal-form-grid">
      <label className="wide"><span>Address line</span><input {...register('line1')} /></label><label><span>City</span><input {...register('city')} /></label><label><span>State</span><input {...register('state')} /></label><label><span>Country</span><input {...register('country')} /></label><label><span>Postal code</span><input {...register('postal_code')} /></label>
    </div></div>
    <div className="portal-form-section"><div className="portal-form-section-title"><span>3</span><div><strong>Emergency contact</strong><small>Who the hospital should contact when urgent assistance is needed.</small></div></div><div className="portal-form-grid">
      <label><span>Contact name</span><input {...register('emergency_name')} /></label><label><span>Relationship</span><input placeholder="Parent, spouse, sibling…" {...register('emergency_relationship')} /></label><label className="wide"><span>Mobile number</span><input inputMode="tel" {...register('emergency_phone')} />{errors.emergency_phone ? <small>{errors.emergency_phone.message}</small> : null}</label>
    </div></div>
    {guardian ? <div className="portal-form-section portal-guardian-edit-section"><div className="portal-form-section-title"><span>4</span><div><strong>Parent / guardian information</strong><small>Responsible adult details stored separately from the child’s patient record.</small></div></div><div className="portal-form-grid">
      <label><span>Full name <b>*</b></span><input autoComplete="name" {...register('guardian_full_name')} />{errors.guardian_full_name ? <small>{errors.guardian_full_name.message}</small> : null}</label>
      <label><span>Relationship <b>*</b></span><select {...register('guardian_relationship')}><option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal guardian</option></select>{errors.guardian_relationship ? <small>{errors.guardian_relationship.message}</small> : null}</label>
      <label><span>Verified login mobile</span><input readOnly value={guardian.phone || 'Not recorded'} /></label>
      <label><span>Account email</span><input readOnly value={guardian.email || 'Not recorded'} /></label>
      <label className="wide"><span>Address line</span><input {...register('guardian_line1')} /></label>
      <label><span>City</span><input {...register('guardian_city')} /></label><label><span>State</span><input {...register('guardian_state')} /></label>
      <label><span>Country</span><input {...register('guardian_country')} /></label><label><span>Postal code</span><input {...register('guardian_postal_code')} /></label>
      <label><span>Identification type</span><input placeholder="National ID, passport…" {...register('guardian_identification_type')} /></label>
      <label><span>Identification number</span><input {...register('guardian_identification_number')} /></label>
      <div className="portal-guardian-consent-field wide"><i className="ph ph-shield-check" /><span><strong>Legal guardian consent</strong><small>{guardian.legal_consent_accepted ? 'Confirmed and recorded' : 'Not recorded'}</small></span></div>
    </div><p className="portal-form-note"><i className="ph ph-lock-key" /> Changing the verified login mobile or account email requires a separate verification process.</p></div> : null}
    <div className="portal-form-actions"><button disabled={isSubmitting} onClick={onCancel} type="button">Cancel</button><button className="primary" disabled={isSubmitting} type="submit">{isSubmitting ? 'Saving…' : 'Save personal information'}</button></div>
  </form>;
}
