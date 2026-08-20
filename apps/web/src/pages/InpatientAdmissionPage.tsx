import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useInpatientAdmissions } from '../hooks/useInpatientAdmissions';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import type { InpatientAdmission } from '../api/inpatient-admissions';

const schema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  ward_id: z.string().min(1, 'Select a ward'),
  bed_id: z.string().min(1, 'Select an available bed'),
  admitting_doctor_id: z.string().min(1, 'Select an admitting doctor'),
  department_id: z.string().min(1, 'Select a department'),
  admission_date: z.string().min(1, 'Admission date is required'),
  admission_type: z.enum(['MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OBSERVATION', 'OTHER']),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  notes: z.string().max(1000)
});
type FormValues = z.infer<typeof schema>;

// Dummy data for missing API fields based on design mockup
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
const mockAge = (id: string) => (parseInt(id.slice(-1), 16) || 0) * 5 + 20; // Pseudo-random age
const mockSource = (id: string) => ['Emergency', 'OPD', 'Referral'][parseInt(id.slice(-1), 16) % 3];

export function InpatientAdmissionPage() {
  const [branchId, setBranchId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InpatientAdmission | null>(null);

  const data = useInpatientAdmissions(branchId, patientSearch);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      admission_type: 'MEDICAL',
      admission_date: new Date().toISOString().slice(0, 16),
      notes: ''
    }
  });

  useEffect(() => {
    if (!branchId && data.branches.data?.data[0]?.id) {
      setBranchId(data.branches.data.data[0].id);
    }
  }, [branchId, data.branches.data]);

  const wardId = watch('ward_id');
  const beds = useMemo(() => (data.beds.data?.data ?? []).filter((bed) => bed.ward_id === wardId), [data.beds.data, wardId]);

  const submit = async (values: FormValues) => {
    try {
      await data.create.mutateAsync({
        ...values,
        branch_id: branchId,
        admission_date: new Date(values.admission_date).toISOString(),
        notes: values.notes || null
      });
      toast.success('Patient admitted and bed assigned.');
      reset({ admission_type: 'MEDICAL', admission_date: new Date().toISOString().slice(0, 16), notes: '' });
      setPatientSearch('');
      setIsModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete admission.');
    }
  };

  const busy = data.branches.isLoading || data.wards.isLoading || data.beds.isLoading || data.doctors.isLoading || data.departments.isLoading;
  const admissionsList = data.admissions.data?.data ?? [];

  // KPIs
  const pendingCount = admissionsList.filter(a => a.status === 'DRAFT').length; // Mocking PENDING
  const approvedCount = admissionsList.filter(a => a.status === 'ADMITTED').length; // Mocking Approved

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Admission Requests</h1>
          <p>Review and action clinical admission requests</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {(data.branches.data?.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            + New Admission Request
          </button>
        </div>
      </div>

      <section className="kpi-grid enhanced">
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>âŒ›</div>
            <span className="kpi-title">Pending</span>
          </div>
          <strong className="kpi-value">{pendingCount}</strong>
          <span className="kpi-subtext">Awaiting decision</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>âœ“</div>
            <span className="kpi-title">Approved Today</span>
          </div>
          <strong className="kpi-value">{approvedCount}</strong>
          <span className="kpi-subtext">Ready for allocation</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>âœ•</div>
            <span className="kpi-title">Rejected Today</span>
          </div>
          <strong className="kpi-value">0</strong>
          <span className="kpi-subtext">Clinical plan returned</span>
        </div>
      </section>

      <div className="filters-toolbar">
        <label>
          <span>Department</span>
          <select><option>All</option></select>
        </label>
        <label>
          <span>Admission Type</span>
          <select><option>All</option></select>
        </label>
        <label>
          <span>Source</span>
          <select><option>All</option></select>
        </label>
        <label>
          <span>Status</span>
          <select><option>All</option></select>
        </label>
        <label>
          <span>Search Patient</span>
          <input type="text" placeholder="Name, MRN or request ID" />
        </label>
      </div>

      <div className="split-layout">
        <div className="split-layout__main">
          <div className="table-scroll" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>MRN</th>
                  <th>Patient</th>
                  <th>Age</th>
                  <th>Requested By</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.admissions.isLoading ? (
                  <tr><td colSpan={8} className="empty-state">Loading...</td></tr>
                ) : admissionsList.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No admission requests found.</td></tr>
                ) : (
                  admissionsList.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRequest(item)}
                      style={{ cursor: 'pointer', backgroundColor: selectedRequest?.id === item.id ? '#f3f4f6' : 'transparent' }}
                    >
                      <td><strong style={{ color: 'var(--text-color)' }}>{item.admission_number}</strong></td>
                      <td className="muted-text">{item.patient_number}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                            {getInitials(item.patient_name)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{item.patient_name}</span>
                        </div>
                      </td>
                      <td>{mockAge(item.id)}</td>
                      <td>{item.admitting_doctor_name}</td>
                      <td>{mockSource(item.id)}</td>
                      <td>
                        <StatusBadge tone={item.status === 'ADMITTED' ? 'green' : 'orange'}>
                          {item.status === 'ADMITTED' ? 'Approved' : 'Pending'}
                        </StatusBadge>
                      </td>
                      <td>
                        <button className="btn-secondary compact" onClick={(e) => { e.stopPropagation(); setSelectedRequest(item); }}>View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedRequest && (
          <div className="split-layout__side">
            <div className="profile-header">
              <div className="profile-circle">{getInitials(selectedRequest.patient_name)}</div>
              <div className="name-group">
                <h3>{selectedRequest.patient_name}</h3>
                <span>{selectedRequest.patient_number}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '-1rem 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {selectedRequest.admission_number}
            </div>

            <div className="details-list">
              <div className="details-list-item">
                <span>Age / Gender</span>
                <span>{mockAge(selectedRequest.id)} / M</span>
              </div>
              <div className="details-list-item">
                <span>Source</span>
                <span>{mockSource(selectedRequest.id)}</span>
              </div>
              <div className="details-list-item">
                <span>Requested By</span>
                <span>{selectedRequest.admitting_doctor_name}</span>
              </div>
              <div className="details-list-item">
                <span>Status</span>
                <StatusBadge tone={selectedRequest.status === 'ADMITTED' ? 'green' : 'orange'}>
                  {selectedRequest.status === 'ADMITTED' ? 'Approved' : 'Pending'}
                </StatusBadge>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)' }}>Clinical Summary</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                Patient requires immediate admission for monitoring and further clinical evaluation.
                Currently assigned to {selectedRequest.ward_name} / Bed {selectedRequest.bed_number}.
              </p>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
               <button className="btn-primary" style={{ width: '100%' }}>Proceed to Allocation</button>
               <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedRequest(null)}>Close</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Admission Request">
        <form className="form-grid" onSubmit={handleSubmit(submit)} style={{ padding: '1rem 0' }}>
          <label>Patient
            <input placeholder="Search by MRN or name" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
            {patientSearch.length >= 2 && (
              <select aria-label="Patient" {...register('patient_id')}>
                <option value="">Select patient</option>
                {(data.patients.data?.data ?? []).map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patient_number} - {[patient.first_name, patient.last_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            )}
            <small className="form-error">{errors.patient_id?.message}</small>
          </label>
          <label>Department
            <select {...register('department_id')}>
              <option value="">Select department</option>
              {(data.departments.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <small className="form-error">{errors.department_id?.message}</small>
          </label>
          <label>Admitting doctor
            <select {...register('admitting_doctor_id')}>
              <option value="">Select doctor</option>
              {(data.doctors.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.display_name}</option>
              ))}
            </select>
            <small className="form-error">{errors.admitting_doctor_id?.message}</small>
          </label>
          <label>Ward
            <select {...register('ward_id')}>
              <option value="">Select ward</option>
              {(data.wards.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name} - {item.ward_type}</option>
              ))}
            </select>
            <small className="form-error">{errors.ward_id?.message}</small>
          </label>
          <label>Available bed
            <select {...register('bed_id')}>
              <option value="">Select bed</option>
              {beds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.bed_number} {item.room_number ? `- Room ${item.room_number}` : ''} ({item.bed_category})
                </option>
              ))}
            </select>
            <small className="form-error">{errors.bed_id?.message}</small>
          </label>
          <label>Admission date and time
            <input type="datetime-local" {...register('admission_date')} />
            <small className="form-error">{errors.admission_date?.message}</small>
          </label>
          <label>Admission type
            <select {...register('admission_type')}>
              <option value="MEDICAL">Medical</option>
              <option value="SURGICAL">Surgical</option>
              <option value="MATERNITY">Maternity</option>
              <option value="PAEDIATRIC">Paediatric</option>
              <option value="OBSERVATION">Observation</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="form-grid__full">Reason
            <textarea {...register('reason')} placeholder="Reason for admission" />
            <small className="form-error">{errors.reason?.message}</small>
          </label>
          <label className="form-grid__full">Notes
            <textarea {...register('notes')} placeholder="Relevant notes" />
          </label>
          <div className="form-grid__full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn-primary" type="submit" disabled={busy || data.create.isPending || !branchId}>Submit Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
