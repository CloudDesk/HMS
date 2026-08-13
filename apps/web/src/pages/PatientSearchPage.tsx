import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientListResponse,
  type PatientResponse,
} from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';

type SortColumn = 'patient_number' | 'first_name' | 'last_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

type ColumnVisibility = {
  photo: boolean;
  gender: boolean;
  age: boolean;
  phone: boolean;
  lastVisit: boolean;
  registeredDate: boolean;
  patientType: boolean;
  status: boolean;
};

const defaultColumns: ColumnVisibility = {
  photo: true,
  gender: true,
  age: true,
  phone: true,
  lastVisit: true,
  registeredDate: true,
  patientType: true,
  status: true,
};

export function PatientSearchPage() {
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Toggle for Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 5 Basic Filter Fields
  const [mrnInput, setMrnInput] = useState(initialParams.get('mrn') ?? '');
  const [nameInput, setNameInput] = useState(initialParams.get('search') ?? '');
  const [mobileInput, setMobileInput] = useState('');
  const [genderFilter, setGenderFilter] = useState<ApiPatientGender | ''>(
    (initialParams.get('gender') as ApiPatientGender | null) ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<ApiPatientStatus | ''>(
    (initialParams.get('status') as ApiPatientStatus | null) ?? '',
  );

  // 5 Advanced Filter Fields
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [dobInput, setDobInput] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [patientTypeFilter, setPatientTypeFilter] = useState('');
  const [regDateInput, setRegDateInput] = useState('');

  // Column Selector Dropdown state
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(defaultColumns);

  // Actions context menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Edit Patient Modal State
  const [editingPatient, setEditingPatient] = useState<PatientResponse | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE' as ApiPatientGender,
    phone: '',
    email: '',
    bloodGroup: '',
    status: 'ACTIVE' as ApiPatientStatus,
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  };

  const openEditModal = (patient: PatientResponse) => {
    setEditingPatient(patient);
    setEditForm({
      firstName: patient.first_name,
      lastName: patient.last_name,
      dateOfBirth: patient.date_of_birth.slice(0, 10),
      gender: patient.gender,
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      bloodGroup: patient.blood_group ?? '',
      status: patient.status,
      notes: patient.notes ?? '',
    });
    setEditFormError('');
    setActiveMenuId(null);
  };

  const handleSaveEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    setEditSubmitting(true);
    setEditFormError('');

    try {
      await patientsApi.update(editingPatient.id, {
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
      });
      setEditingPatient(null);
      showToast(`${editingPatient.first_name} ${editingPatient.last_name} updated successfully.`);
      await loadPatients();
    } catch (error) {
      setEditFormError(getPatientErrorMessage(error));
    } finally {
      setEditSubmitting(false);
    }
  };

  const [sortColumn] = useState<SortColumn | null>('created_at');
  const [sortDirection] = useState<SortDirection>('desc');

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const searchTerms = [mrnInput, nameInput, mobileInput, nationalIdInput].filter(Boolean).join(' ');
      const res = await patientsApi.list({
        search: searchTerms.trim() || undefined,
        status: statusFilter || undefined,
        gender: genderFilter || undefined,
        page: currentPage,
        limit: 10,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      });
      setPatients(res.data);
      setMeta(res.meta);
    } catch (error) {
      setPatients([]);
      setMeta({ limit: 10, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [currentPage, genderFilter, mobileInput, mrnInput, nameInput, nationalIdInput, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

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
      {/* Top Header */}
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Search Patients</h2>
          <p>Find, review and manage patient records</p>
        </div>
        <div className="appointment-page-actions" style={{ position: 'relative' }}>
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

          {/* Column Selector */}
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
              Column Selector
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
      </section>

      {/* Patient Search Form Card (Compact 5 Basic Filters + Advanced Toggle) */}
      <section className="doc-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentPage(1);
            void loadPatients();
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

      {/* Patient Directory Table Card (Fixed Full Height down to bottom of page as in Image 5) */}
      <section className="doc-card patient-directory-full-card">
        <div className="doc-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Directory</h3>
            <p style={{ margin: '0.15rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
              {meta.total} patients found
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>MRN</th>
                {columns.photo ? <th>PHOTO</th> : null}
                <th>PATIENT NAME</th>
                {columns.gender ? <th>GENDER</th> : null}
                {columns.age ? <th>AGE</th> : null}
                {columns.phone ? <th>PHONE</th> : null}
                {columns.lastVisit ? <th>LAST VISIT</th> : null}
                {columns.registeredDate ? <th>REGISTERED DATE</th> : null}
                {columns.patientType ? <th>PATIENT TYPE</th> : null}
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
                    {loadError}
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
                  const initials = patientInitials(fullName);
                  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();

                  return (
                    <tr key={patient.id}>
                      <td className="emp-id">{patient.patient_number}</td>
                      {columns.photo ? (
                        <td>
                          <div className="opd-patient-avatar-box" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                            <span>{initials}</span>
                          </div>
                        </td>
                      ) : null}
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
                      {columns.patientType ? (
                        <td>
                          <span className="doc-status draft">Not recorded</span>
                        </td>
                      ) : null}
                      {columns.status ? (
                        <td>
                          <span
                            className={`doc-status ${
                              patient.status === 'ACTIVE' ? 'active' : patient.status === 'DECEASED' ? 'deceased' : 'inactive'
                            }`}
                          >
                            • {patient.status}
                          </span>
                        </td>
                      ) : null}
                      <td className="align-right" style={{ position: 'relative' }}>
                        <button
                          className="doc-icon-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === patient.id ? null : patient.id);
                          }}
                          type="button"
                        >
                          <i className="ph ph-dots-three-vertical" aria-hidden="true" />
                        </button>

                        {/* Context Menu */}
                        {activeMenuId === patient.id ? (
                          <div className="table-context-menu" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`)}
                              type="button"
                            >
                              <i className="ph ph-user" aria-hidden="true" /> View Patient
                            </button>
                            <button
                              onClick={() => openEditModal(patient)}
                              type="button"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Patient
                            </button>
                            <button
                              onClick={() => navigate(`/opd/visit?patient_id=${encodeURIComponent(patient.id)}`)}
                              type="button"
                            >
                              <i className="ph ph-clipboard-text" aria-hidden="true" /> Register Visit
                            </button>
                            <button
                              onClick={() => navigate(`/patients/emr?id=${encodeURIComponent(patient.id)}`)}
                              type="button"
                            >
                              <i className="ph ph-clock-counter-clockwise" aria-hidden="true" /> Open EMR
                            </button>
                            <button
                              onClick={() => navigate(`/patients/documents?id=${encodeURIComponent(patient.id)}`)}
                              type="button"
                            >
                              <i className="ph ph-file-text" aria-hidden="true" /> View Documents
                            </button>
                            <button
                              onClick={() => navigate(`/patients/consent?id=${encodeURIComponent(patient.id)}`)}
                              type="button"
                            >
                              <i className="ph ph-signature" aria-hidden="true" /> Consent
                            </button>
                            <button onClick={() => window.print()} type="button">
                              <i className="ph ph-printer" aria-hidden="true" /> Print Patient Card
                            </button>
                          </div>
                        ) : null}
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
          <form className="modal-form patient-form doctor-onboarding-form" onSubmit={handleSaveEditPatient}>
            {editFormError ? <div className="form-error-banner" role="alert">{editFormError}</div> : null}

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
                  <input disabled id="search-edit-first" readOnly value={editForm.firstName} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-last">
                    Last name <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-last" readOnly value={editForm.lastName} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-dob">
                    Date of birth <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="search-edit-dob" readOnly type="date" value={editForm.dateOfBirth} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="search-edit-gender">
                    Gender <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <select disabled id="search-edit-gender" value={editForm.gender}>
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
                  <input disabled id="search-edit-blood" readOnly value={editForm.bloodGroup || 'Not recorded'} />
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
                  <input disabled={editSubmitting} id="search-edit-phone" onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} value={editForm.phone} />
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-email">Email</label>
                  <input disabled={editSubmitting} id="search-edit-email" onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} type="email" value={editForm.email} />
                </div>
                <div className="form-group">
                  <label htmlFor="search-edit-status">Status</label>
                  <select disabled={editSubmitting} id="search-edit-status" onChange={(event) => setEditForm({ ...editForm, status: event.target.value as ApiPatientStatus })} value={editForm.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DECEASED">Deceased</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="search-edit-notes">Registration Notes</label>
                  <textarea disabled={editSubmitting} id="search-edit-notes" onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} rows={3} value={editForm.notes} />
                </div>
              </div>
            </section>

            <div className="modal-actions">
              <button className="secondary-action" disabled={editSubmitting} onClick={() => setEditingPatient(null)} type="button">
                Cancel
              </button>
              <button className="primary-action" disabled={editSubmitting} type="submit">
                {editSubmitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}
