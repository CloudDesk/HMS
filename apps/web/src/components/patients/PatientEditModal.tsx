import type { SubmitHandler, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { PatientResponse } from '../../api/patients';
import { Modal } from '../ui/Modal';
import { MedicalSpinner } from '../ui/MedicalLoader';

export const updatePatientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  gender: z.enum(['UNKNOWN', 'MALE', 'FEMALE', 'OTHER']),
  bloodGroup: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdatePatientForm = z.infer<typeof updatePatientSchema>;

type PatientEditModalProps = {
  open: boolean;
  patient: PatientResponse;
  canEditAllDetails: boolean;
  submitting: boolean;
  form: UseFormReturn<UpdatePatientForm>;
  onClose: () => void;
  onSubmit: SubmitHandler<UpdatePatientForm>;
};

export function PatientEditModal({ open, patient, canEditAllDetails, submitting, form, onClose, onSubmit }: PatientEditModalProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <Modal onClose={onClose} open={open} size="large" title="Edit Patient">
      <form className="modal-form patient-form doctor-onboarding-form" onSubmit={handleSubmit(onSubmit)}>
        {canEditAllDetails ? (
          <div className="locked-notice-banner" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
            <i className="ph ph-shield-check" aria-hidden="true" style={{ color: '#16a34a' }} />
            <span>Administrator Access: You have full permissions to edit patient identity attributes, demographics, address, and status.</span>
          </div>
        ) : (
          <div className="locked-notice-banner">
            <i className="ph ph-lock-key" aria-hidden="true" />
            <span>Core identity attributes (Name, Date of Birth, Gender, Blood Group) are locked to preserve clinical record integrity.</span>
          </div>
        )}

        <section className="doctor-onboarding-section">
          <header>
            <span><i className="ph ph-user" aria-hidden="true" /></span>
            <div>
              <h3>Identity Information</h3>
              <p>{canEditAllDetails ? 'Patient identification and demographic attributes.' : 'Immutable patient identification and demographic attributes.'}</p>
            </div>
          </header>
          <div className="form-grid">
            <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
              <label htmlFor="profile-first">First name {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}</label>
              <input disabled={!canEditAllDetails || submitting} id="profile-first" readOnly={!canEditAllDetails} {...register('firstName')} />
            </div>
            <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
              <label htmlFor="profile-last">Last name {canEditAllDetails ? <span className="required-asterisk" style={{ color: '#ef4444' }}>*</span> : <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}</label>
              <input disabled={!canEditAllDetails || submitting} id="profile-last" readOnly={!canEditAllDetails} required={canEditAllDetails} {...register('lastName')} />
            </div>
            <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
              <label htmlFor="profile-dob">Date of birth {canEditAllDetails ? <span className="required-asterisk" style={{ color: '#ef4444' }}>*</span> : <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}</label>
              <input disabled={!canEditAllDetails || submitting} id="profile-dob" readOnly={!canEditAllDetails} required={canEditAllDetails} type="date" {...register('dateOfBirth')} />
            </div>
            <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
              <label htmlFor="profile-gender">Gender {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}</label>
              <select disabled={!canEditAllDetails || submitting} id="profile-gender" {...register('gender')}>
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
              <label htmlFor="profile-blood">Blood group {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}</label>
              {canEditAllDetails ? (
                <select disabled={submitting} id="profile-blood" {...register('bloodGroup')}>
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                </select>
              ) : (
                <input disabled id="profile-blood" readOnly value={patient.blood_group || 'Not recorded'} />
              )}
            </div>
          </div>
        </section>

        <section className="doctor-onboarding-section">
          <header>
            <span><i className="ph ph-phone" aria-hidden="true" /></span>
            <div><h3>Contact &amp; Address Details</h3><p>Editable communication details, physical address, status, and clinical notes.</p></div>
          </header>
          <div className="form-grid">
            <div className={`form-group ${errors.phone ? 'has-error' : ''}`}>
              <label htmlFor="search-edit-phone">Phone</label>
              <input disabled={submitting} id="search-edit-phone" {...register('phone')} />
              {errors.phone && <span className="field-error-msg">{errors.phone.message}</span>}
            </div>
            <div className={`form-group ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="search-edit-email">Email</label>
              <input disabled={submitting} id="search-edit-email" type="email" {...register('email')} />
              {errors.email && <span className="field-error-msg">{errors.email.message}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="search-edit-status">Status</label>
              <select disabled={submitting} id="search-edit-status" {...register('status')}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="DECEASED">Deceased</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label htmlFor="profile-address">Address / Street</label>
              <input disabled={submitting} id="profile-address" placeholder="e.g. 123 Healthcare Ave, Suite 400" {...register('addressLine1')} />
            </div>
            <div className="form-group"><label htmlFor="profile-city">City</label><input disabled={submitting} id="profile-city" placeholder="City" {...register('city')} /></div>
            <div className="form-group"><label htmlFor="profile-postal">Postal Code</label><input disabled={submitting} id="profile-postal" placeholder="Postal Code" {...register('postalCode')} /></div>
            <div className="form-group full-width"><label htmlFor="profile-notes">Registration Notes</label><textarea disabled={submitting} id="profile-notes" {...register('notes')} rows={2} /></div>
          </div>
        </section>

        <div className="modal-actions">
          <button className="secondary-action" disabled={submitting} onClick={onClose} type="button">Cancel</button>
          <button className="primary-action" disabled={submitting} type="submit">{submitting ? <><MedicalSpinner size="sm" /><span>Saving...</span></> : 'Save Profile'}</button>
        </div>
      </form>
    </Modal>
  );
}
