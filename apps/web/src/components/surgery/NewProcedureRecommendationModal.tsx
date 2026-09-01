import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { surgeryApi } from '../../api/surgery';
import { usePatientsList } from '../../hooks/patients/usePatients';
import { Modal } from '../ui/Modal';

const recommendationSchema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  department_id: z.string().min(1, 'Select a department'),
  recommending_doctor_id: z.string().min(1, 'Select a doctor'),
  service_id: z.string().min(1, 'Select a procedure'),
  encounter_id: z
    .string()
    .optional()
    .refine((val) => !val || /^[a-f\d]{24}$/i.test(val), 'Enter a valid 24-character OPD visit ID'),
  clinical_reason: z.string().trim().min(3, 'Clinical reason is required').max(1000),
  notes: z.string().max(2000).optional(),
});

type RecommendationValues = z.infer<typeof recommendationSchema>;

export type InitialProcedureContext = {
  patient: {
    id: string;
    patient_number: string;
    name: string;
  };
  department_id?: string;
  recommending_doctor_id?: string;
  encounter_id?: string | null;
  clinical_reason?: string | null;
  notes?: string | null;
  sourceContext?: string;
};

type NewProcedureRecommendationModalProps = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  departments: Array<{ id: string; name: string; isClinical?: boolean }>;
  doctors: Array<{ id: string; display_name: string; department_id?: string }>;
  services: Array<{ id: string; name: string; department_id?: string }>;
  initialContext?: InitialProcedureContext | null;
  onCreateSuccess?: () => void;
};

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '2px', display: 'block' }}>
      {text}
    </span>
  );
}

export function NewProcedureRecommendationModal({
  open,
  onClose,
  branchId,
  departments,
  doctors,
  services,
  initialContext,
  onCreateSuccess,
}: NewProcedureRecommendationModalProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [isManualPatientMode, setIsManualPatientMode] = useState(!initialContext?.patient);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patientsQuery = usePatientsList(
    { search: patientSearch, status: 'ACTIVE', page: 1, limit: 20 },
    patientSearch.trim().length >= 2
  );
  const loadedPatients = patientsQuery.data?.data ?? [];

  const form = useForm<RecommendationValues>({
    resolver: zodResolver(recommendationSchema),
    defaultValues: {
      patient_id: '',
      department_id: '',
      recommending_doctor_id: '',
      service_id: '',
      encounter_id: '',
      clinical_reason: '',
      notes: '',
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const watchedDepartmentId = watch('department_id');

  useEffect(() => {
    if (open) {
      if (initialContext?.patient) {
        setIsManualPatientMode(false);
        setPatientSearch('');
        reset({
          patient_id: initialContext.patient.id,
          department_id: initialContext.department_id || '',
          recommending_doctor_id: initialContext.recommending_doctor_id || '',
          service_id: '',
          encounter_id: initialContext.encounter_id || '',
          clinical_reason: initialContext.clinical_reason?.trim() || '',
          notes: initialContext.notes?.trim() || '',
        });
      } else {
        setIsManualPatientMode(true);
        setPatientSearch('');
        reset({
          patient_id: '',
          department_id: '',
          recommending_doctor_id: '',
          service_id: '',
          encounter_id: '',
          clinical_reason: '',
          notes: '',
        });
      }
    }
  }, [open, initialContext, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!branchId) {
      toast.error('Branch ID is required to create a procedure recommendation.');
      return;
    }
    try {
      setIsSubmitting(true);
      await surgeryApi.createRecommendation({
        patient_id: values.patient_id,
        branch_id: branchId,
        department_id: values.department_id,
        recommending_doctor_id: values.recommending_doctor_id,
        service_id: values.service_id,
        encounter_type: values.encounter_id ? 'OPD_VISIT' : 'DIRECT',
        encounter_id: values.encounter_id || null,
        clinical_reason: values.clinical_reason.trim(),
        notes: values.notes?.trim() || null,
      });
      toast.success('Procedure recommendation created successfully.');
      onClose();
      onCreateSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to create procedure recommendation.'
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const headerElement = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="ph ph-stethoscope" style={{ fontSize: '1.2rem', color: '#2563eb' }} />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
          New Procedure Recommendation
        </h3>
      </div>
      {initialContext?.sourceContext ? (
        <span style={{ fontSize: '0.76rem', color: '#64748b', marginLeft: '26px' }}>
          From {initialContext.sourceContext} · <strong>{initialContext.patient.name}</strong>
        </span>
      ) : null}
    </div>
  );

  const footerElement = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button
        type="submit"
        form="procedure-recommendation-form"
        className="btn-primary"
        disabled={isSubmitting || !branchId}
      >
        <i className="ph ph-check-circle" />{' '}
        {isSubmitting ? 'Creating...' : 'Create Recommendation'}
      </button>
    </div>
  );

  const initials = (name?: string) =>
    (name || 'PT')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={headerElement}
      size="large"
      layer="top"
      footer={footerElement}
      className="surgery-recommendation-modal"
    >
      <form
        id="procedure-recommendation-form"
        onSubmit={onSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '4px 0' }}
      >
        {/* Patient Selection Card */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ph ph-user-circle" style={{ fontSize: '1.1rem', color: '#0284c7' }} />
              <span>
                Patient Selection <span style={{ color: '#ef4444' }}>*</span>
              </span>
            </div>
          </div>

          {!isManualPatientMode && initialContext?.patient ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    flexShrink: 0,
                  }}
                >
                  {initials(initialContext.patient.name)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                      {initialContext.patient.name}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Selected
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    MRN: {initialContext.patient.patient_number}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => {
                  setIsManualPatientMode(true);
                  setValue('patient_id', '');
                }}
                style={{ fontSize: '0.76rem', padding: '4px 10px', height: 'auto' }}
              >
                Change Patient
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#64748b',
                    display: 'block',
                    marginBottom: '3px',
                  }}
                >
                  Search Patient
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                    placeholder="MRN, name or phone..."
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '0 8px 0 28px',
                      fontSize: '0.82rem',
                    }}
                  />
                  <i
                    className="ph ph-magnifying-glass"
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '10px',
                      color: '#94a3b8',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#64748b',
                    display: 'block',
                    marginBottom: '3px',
                  }}
                >
                  Select Matched Patient <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  {...register('patient_id')}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '6px',
                    border: errors.patient_id ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    padding: '0 8px',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="">-- Choose Patient ({loadedPatients.length} loaded) --</option>
                  {loadedPatients.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.patient_number} · {item.first_name} {item.last_name}
                    </option>
                  ))}
                </select>
                <FieldError text={errors.patient_id?.message} />
              </div>
            </div>
          )}
        </div>

        {/* Clinical Assignment Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Clinical &amp; Procedure Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Department <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                {...register('department_id')}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: errors.department_id ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">Select Department</option>
                {departments
                  .filter((item) => item.isClinical === true)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <FieldError text={errors.department_id?.message} />
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Recommending Doctor <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                {...register('recommending_doctor_id')}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: errors.recommending_doctor_id
                    ? '1px solid #ef4444'
                    : '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">Select Doctor</option>
                {doctors
                  .filter(
                    (item) =>
                      !watchedDepartmentId ||
                      !item.department_id ||
                      item.department_id === watchedDepartmentId
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.display_name}
                    </option>
                  ))}
              </select>
              <FieldError text={errors.recommending_doctor_id?.message} />
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                Procedure / Surgery Service <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                {...register('service_id')}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: errors.service_id ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              >
                <option value="">Select Procedure</option>
                {services
                  .filter(
                    (item) =>
                      !watchedDepartmentId ||
                      !item.department_id ||
                      item.department_id === watchedDepartmentId
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <FieldError text={errors.service_id?.message} />
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '3px',
                }}
              >
                OPD Visit ID <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                {...register('encounter_id')}
                placeholder="Leave empty for direct procedure recommendation"
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: errors.encounter_id ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  padding: '0 8px',
                  fontSize: '0.82rem',
                }}
              />
              <FieldError text={errors.encounter_id?.message} />
            </div>
          </div>
        </div>

        {/* Clinical Indications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              Clinical Reason &amp; Indication <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              {...register('clinical_reason')}
              rows={2}
              placeholder="Indicate diagnosis, necessity, urgency or planned clinical objective..."
              style={{
                width: '100%',
                borderRadius: '6px',
                border: errors.clinical_reason ? '1px solid #ef4444' : '1px solid #cbd5e1',
                padding: '8px',
                fontSize: '0.82rem',
              }}
            />
            <FieldError text={errors.clinical_reason?.message} />
          </div>

          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 500,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              Additional Clinical Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Anesthesia requirements, patient risk alerts, special instruments..."
              style={{
                width: '100%',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                padding: '8px',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
