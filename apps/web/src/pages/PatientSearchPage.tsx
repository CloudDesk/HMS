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
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  notes: z.string().optional(),
});
type UpdatePatientForm = z.infer<typeof updatePatientSchema>;

export function PatientSearchPage() {
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
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(defaultColumns);

  // Actions context menu state
  const [, setActiveMenuId] = useState<string | null>(null);
  // Edit Patient Modal State
  const [editingPatient, setEditingPatient] = useState<PatientResponse | null>(null);
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
    const statusColor = p.status === 'ACTIVE' ? '#16a34a' : p.status === 'DECEASED' ? '#6b7280' : '#dc2626';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Patient Card â€” ${fullName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .card { width: 85mm; height: 54mm; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; position: relative; display: flex; flex-direction: column; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 12px 16px; color: white; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; }
    .name-block { display: flex; flex-direction: column; gap: 2px; }
    .name { font-size: 14px; font-weight: 800; line-height: 1.1; }
    .mrn { font-size: 9px; font-weight: 600; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; align-self: flex-start; }
    .logo-mark { width: 24px; height: 24px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; }
    .body-grid { padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; flex: 1; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 7px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; }
    .info-value { font-size: 10px; font-weight: 600; color: #0f172a; }
    .status-val { color: ${statusColor}; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 6px 16px; display: flex; justify-content: space-between; font-size: 7px; color: #64748b; font-weight: 500; }
    @media print {
      @page { size: 85mm 54mm; margin: 0; }
      body { background: white; }
      .card { box-shadow: none; border: none; border-radius: 0; width: 100vw; height: 100vh; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-left">
        <div class="avatar">${initials}</div>
        <div class="name-block">
          <div class="name">${fullName}</div>
          <div class="mrn">MRN-${p.patient_number}</div>
        </div>
      </div>
      <div class="logo-mark">H</div>
    </div>
    <div class="body-grid">
      <div class="info-item"><span class="info-label">Date of Birth</span><span class="info-value">${dob}</span></div>
      <div class="info-item"><span class="info-label">Age / Gender</span><span class="info-value">${age} yrs Â· ${p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}</span></div>
      <div class="info-item"><span class="info-label">Phone</span><span class="info-value">${p.phone || 'Not recorded'}</span></div>
      <div class="info-item"><span class="info-label">Status</span><span class="info-value status-val">${p.status}</span></div>
      <div class="info-item"><span class="info-label">Registered</span><span class="info-value">${registered}</span></div>
      <div class="info-item"><span class="info-label">Blood Group</span><span class="info-value">${p.blood_group || 'N/A'}</span></div>
    </div>
    <div class="footer">
      <span>HMS Enterprise</span>
      <span>Non-transferable</span>
    </div>
  </div>
  <script>
    window.onload = () => { window.print(); };
  </script>
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
    reset({
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      status: patient.status,
      notes: patient.notes ?? '',
    });
    setActiveMenuId(null);
  };

  const onSubmitEdit = async (data: UpdatePatientForm) => {
    if (!editingPatient) return;
    try {
      await updatePatient({
        id: editingPatient.id,
        payload: {
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          status: data.status,
          notes: data.notes?.trim() || null,
        },
      });
      setEditingPatient(null);
    } catch {
      // Error is handled in the mutation by toast
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
      {/* Patient Search Form Card (Compact 5 Basic Filters + Advanced Toggle) */}
      <section className="doc-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyFilters();
          }}
        >
          {/* 5 Basic Filters Row */}
          <div className="doc-form-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="doc-field">
              <label htmlFor="search-mrn">MRN / Patient ID</label>
              <input
                id="search-mrn"
                onChange={(e) => setMrnInput(e.target.value)}
                placeholder="Enter MRN or patient ID"
                type="text"
                value={mrnInput}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="search-name">Patient Name</label>
              <input
                id="search-name"
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="First or last name"
                type="text"
                value={nameInput}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="search-mobile">Mobile Number</label>
              <input
                id="search-mobile"
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="+254..."
                type="text"
                value={mobileInput}
              />
            </div>
            <div className="doc-field">
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
            <div className="doc-field">
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
          </div>

          {/* Expanded 5 Advanced Filters Row */}
          {showAdvancedFilters ? (
            <div className="doc-form-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="doc-field">
                <label htmlFor="search-natid">National ID / Passport</label>
                <input
                  id="search-natid"
                  onChange={(e) => setNationalIdInput(e.target.value)}
                  placeholder="ID or passport"
                  type="text"
                  value={nationalIdInput}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="search-dob">Date of Birth</label>
                <input
                  id="search-dob"
                  onChange={(e) => setDobInput(e.target.value)}
                  type="date"
                  value={dobInput}
                />
              </div>
              <div className="doc-field">
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
              <div className="doc-field">
                <label htmlFor="search-type">Patient Type</label>
                <select
                  id="search-type"
                  onChange={(e) => setPatientTypeFilter(e.target.value)}
                  value={patientTypeFilter}
                >
                  <option value="">All Patient Types</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Self-Pay">Self-Pay</option>
                </select>
              </div>
              <div className="doc-field">
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

          {/* Form Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              className="doc-btn"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              type="button"
            >
              <i className="ph ph-funnel" aria-hidden="true" />
              {showAdvancedFilters ? 'Hide Advanced Filters' : 'Advanced Filters'}
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="doc-btn" onClick={handleResetFilters} type="button">
                <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
                Reset Filters
              </button>
              <button className="doc-btn primary" type="submit">
                <i className="ph ph-magnifying-glass" aria-hidden="true" />
                Search
              </button>
            </div>
          </div>
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
              <button
                className="doc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColumnSelector(!showColumnSelector);
                }}
                type="button"
              >
                <i className="ph ph-columns" aria-hidden="true" />
                Columns
              </button>
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
                            â€¢ {patient.status}
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
            <div className="locked-notice-banner">
              <i className="ph ph-lock-key" aria-hidden="true" />
              <span>
                Core identity attributes (Name, Date of Birth, Gender, Blood Group) are locked to preserve clinical record integrity.
              </span>
            </div>

            <section className="doctor-onboarding-section">
              <header>
                <span><i className="ph ph-user" aria-hidden="true" /></span>
                <div>
                  <h3>Identity Information</h3>
                  <p>Immutable patient identification and demographic attributes.</p>
                </div>
              </header>
              <div className="form-grid">
                <div className="form-group locked">
                  <label htmlFor="search-edit-first">
                    First name <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-first" readOnly value={editingPatient.first_name} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-last">
                    Last name <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-last" readOnly value={editingPatient.last_name} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-dob">
                    Date of birth <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-dob" readOnly type="date" value={editingPatient.date_of_birth.slice(0, 10)} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-gender">
                    Gender <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <select disabled id="search-edit-gender" value={editingPatient.gender}>
                    <option value="UNKNOWN">Unknown</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-blood">
                    Blood group <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-blood" readOnly value={editingPatient.blood_group || 'Not recorded'} />
                </div>
              </div>
            </section>

            <section className="doctor-onboarding-section">
              <header>
                <span><i className="ph ph-phone" aria-hidden="true" /></span>
                <div>
                  <h3>Contact & Operations</h3>
                  <p>Editable communication details, status, and clinical notes.</p>
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
                  <label htmlFor="search-edit-notes">Registration Notes</label>
                  <textarea disabled={isSubmitting} id="search-edit-notes" rows={3} {...register('notes')} />
                  {errors.notes && <span className="field-error">{errors.notes.message}</span>}
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

      {/* Print Patient Card â€” preview modal */}
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
                    ['Age / Gender', `${new Date().getFullYear() - new Date(cardPatient.date_of_birth).getFullYear()} yrs Â· ${cardPatient.gender.charAt(0) + cardPatient.gender.slice(1).toLowerCase()}`],
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
