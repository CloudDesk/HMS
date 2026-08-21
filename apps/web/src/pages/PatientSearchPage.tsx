import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientResponse,
} from '../api/patients';
import { usePatientSearchFeature } from '../hooks/patients/usePatientSearchFeature';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import { useAuth } from '../auth/useAuth';
import { patientInitials } from './opd-utils';
import { formatDate, patientFullName } from './patient-utils';


type ColumnVisibility = {
  gender: boolean;
  age: boolean;
  phone: boolean;
  lastVisit: boolean;
  registeredDate: boolean;
  status: boolean;
};

const defaultColumns: ColumnVisibility = {
  gender: true,
  age: true,
  phone: true,
  lastVisit: true,
  registeredDate: true,
  status: true,
};

const updatePatientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['UNKNOWN', 'MALE', 'FEMALE', 'OTHER']),
  bloodGroup: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  notes: z.string().optional(),
});
type UpdatePatientForm = z.infer<typeof updatePatientSchema>;

export function PatientSearchPage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const isAdmin = Boolean(user?.roles.some((role) => role.code === 'ADMINISTRATOR' || role.code === 'ADMIN' || role.name.toLowerCase().includes('admin')));
  const canEditAllDetails = isSuperAdmin || isAdmin;

  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle for Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 5 Basic Filter Fields (Input state)
  const [mrnInput, setMrnInput] = useState(initialParams.get('mrn') ?? '');
  const [nameInput, setNameInput] = useState(initialParams.get('search') ?? '');
  const [mobileInput, setMobileInput] = useState('');
  const [genderFilter, setGenderFilter] = useState<ApiPatientGender | ''>(
    (initialParams.get('gender') as ApiPatientGender | null) ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<ApiPatientStatus | ''>(
    (initialParams.get('status') as ApiPatientStatus | null) ?? '',
  );

  // 5 Advanced Filter Fields (Input state)
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [dobInput, setDobInput] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [patientTypeFilter, setPatientTypeFilter] = useState('');
  const [regDateInput, setRegDateInput] = useState('');

  // Applied Filters State (triggers query)
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerms: [mrnInput, nameInput].filter(Boolean).join(' '),
    status: statusFilter,
    gender: genderFilter,
  });

  // Column Selector Dropdown state
  const [showColumnSelector] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(defaultColumns);

  // Actions context menu state
  const [, setActiveMenuId] = useState<string | null>(null);
  // Edit Patient Modal State
  const [editingPatient, setEditingPatient] = useState<PatientResponse | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE' as ApiPatientGender,
    phone: '',
    email: '',
    addressLine1: '',
    city: '',
    postalCode: '',
    bloodGroup: '',
    status: 'ACTIVE' as ApiPatientStatus,
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  
  
  
  const [cardPatient, setCardPatient] = useState<PatientResponse | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpdatePatientForm>({
    resolver: zodResolver(updatePatientSchema),
  });


  const printPatientCard = (p: PatientResponse) => {
    const fullName = patientFullName(p);
    const initials = patientInitials(fullName);
    const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
    const dob = formatDate(p.date_of_birth);
    const registered = formatDate(p.created_at);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Patient ID Card - ${fullName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; }
  .card { width: 340px; background: #fff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; border: 1px solid #e2e8f0; }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 20px; color: #fff; position: relative; }
  .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .logo { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
  .title { font-size: 13px; font-weight: 700; }
  .subtitle { font-size: 10px; opacity: 0.8; }
  .tag { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); font-size: 9px; font-weight: 700; letter-spacing: 1px; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }
  .hero { display: flex; align-items: center; gap: 14px; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 3px solid rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; }
  .hero-info h2 { font-size: 17px; font-weight: 800; line-height: 1.2; margin-bottom: 4px; }
  .mrn-pill { font-size: 10px; background: rgba(255,255,255,0.25); padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.5px; }
  .body { padding: 18px 20px; }
  .field-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; }
  .field-row .label { color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
  .field-row .val { color: #0f172a; font-weight: 700; text-align: right; }
  .barcode-strip { margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .barcode-text { font-family: monospace; font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 2px; }
  .footer-note { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 10px; }
  @media print { body { background: #fff; } .card { box-shadow: none; } }
</style>
</head>
<body>
<div className="card">
  <div className="header">
    <div className="brand">
      <div className="logo">H</div>
      <div><div className="title">HMS Enterprise</div><div className="subtitle">Hospital Management System</div></div>
    </div>
    <span className="tag">Patient ID</span>
    <div className="hero">
      <div className="avatar">${initials}</div>
      <div className="hero-info">
        <h2>${fullName}</h2>
        <span className="mrn-pill">${p.patient_number}</span>
      </div>
    </div>
  </div>
  <div className="body">
    <div className="field-row"><span className="label">Date of Birth</span><span className="val">${dob} (${age} yrs)</span></div>
    <div className="field-row"><span className="label">Gender</span><span className="val">${p.gender}</span></div>
    <div className="field-row"><span className="label">Phone</span><span className="val">${p.phone || 'Not recorded'}</span></div>
    <div className="field-row"><span className="label">Blood Group</span><span className="val">${p.blood_group || 'Not recorded'}</span></div>
    <div className="field-row"><span className="label">Registered</span><span className="val">${registered}</span></div>
    <div className="barcode-strip">
      <span className="barcode-text">||||| | |||| ||| ||||</span>
      <span className="barcode-text">${p.patient_number}</span>
    </div>
    <p className="footer-note">Valid for healthcare services at all HMS facilities</p>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=480,height=700,top=100,left=100');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  const openEditModal = (patient: PatientResponse) => {
    setEditingPatient(patient);
    setEditForm({
      firstName: patient.first_name ?? '',
      lastName: patient.last_name ?? '',
      dateOfBirth: patient.date_of_birth ? patient.date_of_birth.slice(0, 10) : '',
      gender: patient.gender ?? 'MALE',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      addressLine1: patient.address?.line1 ?? '',
      city: patient.address?.city ?? '',
      postalCode: patient.address?.postal_code ?? '',
      bloodGroup: patient.blood_group ?? '',
      status: patient.status,
      notes: patient.notes ?? '',
    });
    setEditFormError('');
    setActiveMenuId(null);
  };

  const onSubmitEdit = async () => {
    if (!editingPatient) return;
    try {
      const updatePayload: Record<string, unknown> = {
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
        address: {
          line1: editForm.addressLine1.trim() || null,
          city: editForm.city.trim() || null,
          postal_code: editForm.postalCode.trim() || null,
        },
      };

      if (canEditAllDetails) {
        if (!editForm.lastName.trim()) {
          setEditFormError('Last name is required.');
          setEditSubmitting(false);
          return;
        }
        if (!editForm.dateOfBirth) {
          setEditFormError('Date of birth is required.');
          setEditSubmitting(false);
          return;
        }
        updatePayload.first_name = editForm.firstName.trim() || null;
        updatePayload.last_name = editForm.lastName.trim();
        updatePayload.date_of_birth = editForm.dateOfBirth;
        updatePayload.gender = editForm.gender;
        updatePayload.blood_group = editForm.bloodGroup || null;
      }

      await updatePatient({ id: editingPatient.id, payload: updatePayload });
      setEditingPatient(null);
      console.log('Patient updated successfully.');
    } catch (error) {
      setEditFormError(String(error));
      console.log(String(error), 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const { state: { patients, meta, loading, loadError }, mutations: { updatePatient } } = usePatientSearchFeature({ appliedFilters, currentPage });

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setAppliedFilters({
      searchTerms: [mrnInput, nameInput, mobileInput, nationalIdInput].filter(Boolean).join(' ').trim(),
      status: statusFilter,
      gender: genderFilter,
    });
  };

  const handleResetFilters = () => {
    setMrnInput('');
    setNationalIdInput('');
    setNameInput('');
    setMobileInput('');
    setDobInput('');
    setGenderFilter('');
    setBloodGroupFilter('');
    setPatientTypeFilter('');
    setRegDateInput('');
    setStatusFilter('');
    setCurrentPage(1);
    setAppliedFilters({ searchTerms: '', status: '', gender: '' });
  };

  const exportCsv = () => {
    const rows = [
      ['MRN', 'Patient Name', 'Gender', 'DOB', 'Phone', 'Email', 'Status', 'Registered'],
      ...patients.map((p) => [
        p.patient_number,
        patientFullName(p),
        p.gender,
        p.date_of_birth,
        p.phone || '',
        p.email || '',
        p.status,
        p.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `patients-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="appointment-page full-height-layout" onClick={() => setActiveMenuId(null)}>
      {/* Patient Search Form Card (Compact Streamlined Toolbar) */}
      <section className="doc-card patient-search-card-compact">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyFilters();
          }}
        >
          {/* Main Search & Filters Row with Inline Actions */}
          <div className="patient-search-top-grid">
            <div className="patient-search-compact-field">
              <label htmlFor="search-mrn">MRN / Patient ID</label>
              <input
                id="search-mrn"
                onChange={(e) => setMrnInput(e.target.value)}
                placeholder="Enter MRN or ID"
                type="text"
                value={mrnInput}
              />
            </div>
            <div className="patient-search-compact-field">
              <label htmlFor="search-name">Patient Name</label>
              <input
                id="search-name"
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="First or last name"
                type="text"
                value={nameInput}
              />
            </div>
            <div className="patient-search-compact-field">
              <label htmlFor="search-mobile">Mobile Number</label>
              <input
                id="search-mobile"
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="+254..."
                type="text"
                value={mobileInput}
              />
            </div>
            <div className="patient-search-compact-field">
              <label htmlFor="search-gender">Gender</label>
              <select
                id="search-gender"
                onChange={(e) => setGenderFilter(e.target.value as ApiPatientGender | '')}
                value={genderFilter}
              >
                <option value="">All Genders</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="patient-search-compact-field">
              <label htmlFor="search-status">Status</label>
              <select
                id="search-status"
                onChange={(e) => setStatusFilter(e.target.value as ApiPatientStatus | '')}
                value={statusFilter}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="patient-search-actions-group">
              <button
                className="patient-search-btn-secondary"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                title={showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
                type="button"
              >
                <i className="ph ph-funnel" aria-hidden="true" />
                {showAdvancedFilters ? 'Less' : 'Filters'}
              </button>
              <button
                className="patient-search-btn-secondary"
                onClick={handleResetFilters}
                title="Reset Filters"
                type="button"
              >
                <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
                Reset
              </button>
              <button className="patient-search-btn-search" type="submit">
                <i className="ph ph-magnifying-glass" aria-hidden="true" />
                Search
              </button>
            </div>
          </div>

          {/* Expanded Advanced Filters Row */}
          {showAdvancedFilters ? (
            <div className="doc-form-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.65rem', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
              <div className="patient-search-compact-field">
                <label htmlFor="search-natid">National ID / Passport</label>
                <input
                  id="search-natid"
                  onChange={(e) => setNationalIdInput(e.target.value)}
                  placeholder="ID or passport"
                  type="text"
                  value={nationalIdInput}
                />
              </div>
              <div className="patient-search-compact-field">
                <label htmlFor="search-dob">Date of Birth</label>
                <input
                  id="search-dob"
                  onChange={(e) => setDobInput(e.target.value)}
                  type="date"
                  value={dobInput}
                />
              </div>
              <div className="patient-search-compact-field">
                <label htmlFor="search-blood">Blood Group</label>
                <select
                  id="search-blood"
                  onChange={(e) => setBloodGroupFilter(e.target.value)}
                  value={bloodGroupFilter}
                >
                  <option value="">All Blood Groups</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                </select>
              </div>
              <div className="patient-search-compact-field">
                <label htmlFor="search-regdate">Registration Date</label>
                <input
                  id="search-regdate"
                  onChange={(e) => setRegDateInput(e.target.value)}
                  type="date"
                  value={regDateInput}
                />
              </div>
            </div>
          ) : null}
        </form>
      </section>

      {/* Patient Directory Table Card */}
      <section className="doc-card patient-directory-full-card">
        <div className="doc-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Directory</h3>
            <p style={{ margin: '0.15rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
              {meta.total} patients found
            </p>
          </div>
          {/* Table toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', position: 'relative' }}>
            <button
              className="doc-btn primary"
              onClick={() => navigate('/patients/register')}
              type="button"
            >
              <i className="ph ph-plus" aria-hidden="true" />
              Register Patient
            </button>
            <button className="doc-btn" onClick={exportCsv} type="button">
              <i className="ph ph-download-simple" aria-hidden="true" />
              Export
            </button>
            <div style={{ position: 'relative' }}>
              {showColumnSelector ? (
                <div className="column-selector-dropdown" onClick={(e) => e.stopPropagation()}>
                  {Object.entries(columns).map(([col, val]) => (
                    <label key={col}>
                      <input
                        checked={val}
                        onChange={(e) => setColumns({ ...columns, [col]: e.target.checked })}
                        type="checkbox"
                      />
                      <span>{col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1')}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>PATIENT NAME</th>
                {columns.gender ? <th>GENDER</th> : null}
                {columns.age ? <th>AGE</th> : null}
                {columns.phone ? <th>PHONE</th> : null}
                {columns.lastVisit ? <th>LAST VISIT</th> : null}
                {columns.registeredDate ? <th>REGISTERED DATE</th> : null}
                {columns.status ? <th>STATUS</th> : null}
                <th className="align-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="um-state-cell" colSpan={11}>
                    Loading patient directory...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td className="um-state-cell" colSpan={11}>
                    Failed to load patient directory.
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td className="um-state-cell" colSpan={11}>
                    No patient records found.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  const fullName = patientFullName(patient);
                  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="emp-id">{patient.patient_number}</td>
                      <td>
                        <div className="user-cell-info">
                          <strong style={{ color: '#0f172a' }}>{fullName}</strong>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {patient.email || 'Email not recorded'}
                          </span>
                        </div>
                      </td>
                      {columns.gender ? <td>{patient.gender}</td> : null}
                      {columns.age ? <td>{age} yrs</td> : null}
                      {columns.phone ? <td>{patient.phone || 'Not recorded'}</td> : null}
                      {columns.lastVisit ? <td>Not available</td> : null}
                      {columns.registeredDate ? <td>{formatDate(patient.created_at)}</td> : null}
                      {columns.status ? (
                        <td>
                          <span
                            className={`doc-status ${
                              patient.status === 'ACTIVE' ? 'active' : patient.status === 'DECEASED' ? 'deceased' : 'inactive'
                            }`}
                          >
                            {patient.status}
                          </span>
                        </td>
                      ) : null}
                      <td className="align-right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="doc-btn"
                            onClick={() => openEditModal(patient)}
                            type="button"
                            title="Edit Patient"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <i className="ph ph-pencil-simple" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-btn"
                            onClick={() => navigate(`/appointments/book?patient=${encodeURIComponent(patient.id)}`)}
                            type="button"
                            title="Book Appointment"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <i className="ph ph-calendar-plus" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-btn"
                            onClick={() => setCardPatient(patient)}
                            type="button"
                            title="View Patient Card"
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            <i className="ph ph-identification-card" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination anchored at bottom */}
        <div className="um-pagination" style={{ borderTop: '1px solid #e2e8f0' }}>
          <span>
            Showing {patients.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} patients
          </span>
          <div className="um-page-controls">
            <button
              className="pg-btn"
              disabled={meta.page <= 1 || loading}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              <i className="ph ph-caret-left" aria-hidden="true" />
            </button>
            <button className="pg-btn active" disabled type="button">
              {meta.page}
            </button>
            <button
              className="pg-btn"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => setCurrentPage((page) => page + 1)}
              type="button"
            >
              <i className="ph ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Edit Patient Modal */}
      <Modal onClose={() => setEditingPatient(null)} open={Boolean(editingPatient)} size="large" title="Edit Patient">
        {editingPatient ? (
          <form className="modal-form patient-form doctor-onboarding-form" onSubmit={handleSubmit(onSubmitEdit)}>
            {editFormError ? <div className="form-error-banner" role="alert">{editFormError}</div> : null}

            {canEditAllDetails ? (
              <div className="locked-notice-banner" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                <i className="ph ph-shield-check" aria-hidden="true" style={{ color: '#16a34a' }} />
                <span>
                  Administrator Access: You have full permissions to edit patient identity attributes, demographics, address, and status.
                </span>
              </div>
            ) : (
              <div className="locked-notice-banner">
                <i className="ph ph-lock-key" aria-hidden="true" />
                <span>
                  Core identity attributes (Name, Date of Birth, Gender, Blood Group) are locked to preserve clinical record integrity.
                </span>
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
                  <label htmlFor="search-edit-first">
                    First name {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}
                  </label>
                  <input
                    disabled={!canEditAllDetails || editSubmitting}
                    id="search-edit-first"
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    readOnly={!canEditAllDetails}
                    value={editForm.firstName}
                  />
                </div>
                <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
                  <label htmlFor="search-edit-last">
                    Last name {canEditAllDetails ? <span className="required-asterisk" style={{ color: '#ef4444' }}>*</span> : <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}
                  </label>
                  <input
                    disabled={!canEditAllDetails || editSubmitting}
                    id="search-edit-last"
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    readOnly={!canEditAllDetails}
                    required={canEditAllDetails}
                    value={editForm.lastName}
                  />
                </div>
                <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
                  <label htmlFor="search-edit-dob">
                    Date of birth {canEditAllDetails ? <span className="required-asterisk" style={{ color: '#ef4444' }}>*</span> : <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}
                  </label>
                  <input
                    disabled={!canEditAllDetails || editSubmitting}
                    id="search-edit-dob"
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    readOnly={!canEditAllDetails}
                    required={canEditAllDetails}
                    type="date"
                    value={editForm.dateOfBirth}
                  />
                </div>
                <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
                  <label htmlFor="search-edit-gender">
                    Gender {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}
                  </label>
                  <select
                    disabled={!canEditAllDetails || editSubmitting}
                    id="search-edit-gender"
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as ApiPatientGender })}
                    value={editForm.gender}
                  >
                    <option value="UNKNOWN">Unknown</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className={`form-group${canEditAllDetails ? '' : ' locked'}`}>
                  <label htmlFor="search-edit-blood">
                    Blood group {!canEditAllDetails && <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>}
                  </label>
                  {canEditAllDetails ? (
                    <select
                      disabled={editSubmitting}
                      id="search-edit-blood"
                      onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                      value={editForm.bloodGroup}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  ) : (
                    <input disabled id="search-edit-blood" readOnly value={editForm.bloodGroup || 'Not recorded'} />
                  )}
                </div>
              </div>
            </section>

            <section className="doctor-onboarding-section">
              <header>
                <span><i className="ph ph-phone" aria-hidden="true" /></span>
                <div>
                  <h3>Contact &amp; Address Details</h3>
                  <p>Editable communication details, physical address, status, and clinical notes.</p>
                </div>
              </header>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="search-edit-phone">Phone</label>
                  <input disabled={isSubmitting} id="search-edit-phone" {...register('phone')} />
                  {errors.phone && <span className="field-error">{errors.phone.message}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-email">Email</label>
                  <input disabled={isSubmitting} id="search-edit-email" type="email" {...register('email')} />
                  {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-status">Status</label>
                  <select disabled={isSubmitting} id="search-edit-status" {...register('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DECEASED">Deceased</option>
                  </select>
                  {errors.status && <span className="field-error">{errors.status.message}</span>}
                </div>
                <div className="form-group full-width">
                  <label htmlFor="search-edit-address">Address / Street</label>
                  <input
                    disabled={editSubmitting}
                    id="search-edit-address"
                    onChange={(event) => setEditForm({ ...editForm, addressLine1: event.target.value })}
                    placeholder="e.g. 123 Healthcare Ave, Suite 400"
                    value={editForm.addressLine1}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-city">City</label>
                  <input
                    disabled={editSubmitting}
                    id="search-edit-city"
                    onChange={(event) => setEditForm({ ...editForm, city: event.target.value })}
                    placeholder="City"
                    value={editForm.city}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-postal">Postal Code</label>
                  <input
                    disabled={editSubmitting}
                    id="search-edit-postal"
                    onChange={(event) => setEditForm({ ...editForm, postalCode: event.target.value })}
                    placeholder="Postal Code"
                    value={editForm.postalCode}
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="search-edit-notes">Registration Notes</label>
                  <textarea disabled={editSubmitting} id="search-edit-notes" onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} rows={2} value={editForm.notes} />
                </div>
              </div>
            </section>

            <div className="modal-actions">
              <button className="secondary-action" disabled={isSubmitting} onClick={() => setEditingPatient(null)} type="button">
                Cancel
              </button>
              <button className="primary-action" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Print Patient Card Ã¢â‚¬â€ preview modal */}
      {cardPatient ? (
        <Modal onClose={() => setCardPatient(null)} open={Boolean(cardPatient)} size="default" title="Patient ID Card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 0 0.25rem' }}>
            <div style={{ width: '340px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {/* Gradient header */}
              <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)', padding: '20px 20px 24px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '13px' }}>H</div>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>HMS Enterprise</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px' }}>Hospital Management System</div>
                  </div>
                </div>
                <span style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', padding: '3px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>Patient ID</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {patientInitials(patientFullName(cardPatient))}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>{patientFullName(cardPatient)}</div>
                    <span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px' }}>MRN-{cardPatient.patient_number}</span>
                  </div>
                </div>
              </div>
              {/* Info grid */}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  {([
                    ['Date of Birth', formatDate(cardPatient.date_of_birth)],
                    ['Age / Gender', `${new Date().getFullYear() - new Date(cardPatient.date_of_birth).getFullYear()} yrs Ã‚Â· ${cardPatient.gender.charAt(0) + cardPatient.gender.slice(1).toLowerCase()}`],
                    ['Phone', cardPatient.phone || 'Not recorded'],
                    ['Status', cardPatient.status],
                    ['Registered', formatDate(cardPatient.created_at)],
                    ['Blood Group', cardPatient.blood_group || 'Not recorded'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: label === 'Status' ? (cardPatient.status === 'ACTIVE' ? '#16a34a' : '#dc2626') : '#0f172a' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
                      {([24,18,28,14,22,28,16,24,12,28,20,16,28,18,24,28,14,20,28,16,24,12,28,18,24,16,28,22] as number[]).map((h, i) => (
                        <div key={i} style={{ width: `${i % 3 === 0 ? 3 : 1.5}px`, height: `${h}px`, background: '#1e293b', borderRadius: '1px' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, marginTop: '4px' }}>{cardPatient.patient_number}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Valid For</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>All Departments</div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9px', color: '#94a3b8' }}>This card is non-transferable</span>
                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Generated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="doc-btn" onClick={() => setCardPatient(null)} type="button">Close</button>
              <button className="doc-btn primary" onClick={() => printPatientCard(cardPatient)} type="button">
                <i className="ph ph-printer" aria-hidden="true" /> Print Card
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}