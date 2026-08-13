import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import {
  doctorsApi,
  type ApiDoctorStatus,
  type CreateDoctorPayload,
  type DoctorListResponse,
  type DoctorResponse,
  type DoctorUserOption,
  type SaveDoctorPayload,
} from '../api/doctors';
import { useAuth } from '../auth/useAuth';
import {
  DoctorAvailabilityEditor,
  createDefaultDoctorAvailability,
  doctorAvailabilityToForm,
  type AvailabilityDayForm,
} from '../components/doctors/DoctorAvailabilityEditor';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { downloadBlob } from '../utils/download';
import { formatDate, getPatientErrorMessage } from './patient-utils';

type SortColumn = 'doctor_number' | 'display_name' | 'specialization' | 'created_at';
type SortDirection = 'asc' | 'desc';

type DoctorFormState = {
  firstName: string;
  lastName: string;
  specialization: string;
  qualification: string;
  registrationNumber: string;
  experienceYears: string;
  branchId: string;
  departmentId: string;
  consultationRoom: string;
  phone: string;
  email: string;
  userId: string;
  createLoginAccount: boolean;
  employeeCode: string;
  username: string;
  loginEmail: string;
  temporaryPassword: string;
  confirmTemporaryPassword: string;
  availability: AvailabilityDayForm[];
  status: ApiDoctorStatus;
  statusReason: string;
  notes: string;
};

const emptyForm = (): DoctorFormState => ({
  firstName: '',
  lastName: '',
  specialization: '',
  qualification: '',
  registrationNumber: '',
  experienceYears: '',
  branchId: '',
  departmentId: '',
  consultationRoom: '',
  phone: '',
  email: '',
  userId: '',
  createLoginAccount: false,
  employeeCode: '',
  username: '',
  loginEmail: '',
  temporaryPassword: '',
  confirmTemporaryPassword: '',
  availability: createDefaultDoctorAvailability(),
  status: 'ACTIVE',
  statusReason: '',
  notes: '',
});

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toForm = (doctor: DoctorResponse): DoctorFormState => ({
  firstName: doctor.first_name,
  lastName: doctor.last_name,
  specialization: doctor.specialization,
  qualification: doctor.qualification ?? '',
  registrationNumber: doctor.registration_number ?? '',
  experienceYears: doctor.experience_years === null ? '' : String(doctor.experience_years),
  branchId: doctor.branch_id,
  departmentId: doctor.department_id,
  consultationRoom: doctor.consultation_room ?? '',
  phone: doctor.phone ?? '',
  email: doctor.email ?? '',
  userId: doctor.user_id ?? '',
  createLoginAccount: false,
  employeeCode: '',
  username: '',
  loginEmail: '',
  temporaryPassword: '',
  confirmTemporaryPassword: '',
  availability: doctorAvailabilityToForm(doctor),
  status: doctor.status,
  statusReason: '',
  notes: doctor.notes ?? '',
});

const toPayload = (form: DoctorFormState): SaveDoctorPayload => ({
  first_name: form.firstName.trim(),
  last_name: form.lastName.trim(),
  specialization: form.specialization.trim(),
  qualification: nullable(form.qualification),
  registration_number: nullable(form.registrationNumber),
  experience_years: form.experienceYears ? Number(form.experienceYears) : null,
  branch_id: form.branchId,
  department_id: form.departmentId,
  consultation_room: nullable(form.consultationRoom),
  phone: nullable(form.phone),
  email: nullable(form.email),
  status: form.status,
  notes: nullable(form.notes),
});

const toCreatePayload = (form: DoctorFormState): CreateDoctorPayload => ({
  ...toPayload(form),
  availability: form.availability,
  account_access: form.createLoginAccount
    ? {
        create_login_account: true,
        employee_code: form.employeeCode.trim(),
        username: form.username.trim(),
        email: form.loginEmail.trim(),
        temporary_password: form.temporaryPassword,
      }
    : { create_login_account: false },
});

const buildDirectoryUrl = (
  search: string,
  status: ApiDoctorStatus | '',
  branchId: string,
  departmentId: string,
  page: number,
  sortColumn: SortColumn | null,
  sortDirection: SortDirection,
) => {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (branchId) params.set('branch_id', branchId);
  if (departmentId) params.set('department_id', departmentId);
  if (page > 1) params.set('page', String(page));
  if (sortColumn) {
    params.set('sortBy', sortColumn);
    params.set('sortOrder', sortDirection);
  }

  const query = params.toString();
  return `/doctors/directory${query ? `?${query}` : ''}`;
};

const statusClass = (status: ApiDoctorStatus) => {
  if (status === 'ACTIVE') return 'status-active';
  if (status === 'ON_LEAVE') return 'status-warning';
  return 'status-inactive';
};

const doctorInitials = (doctor: DoctorResponse) =>
  `${doctor.first_name.charAt(0)}${doctor.last_name.charAt(0)}`.toUpperCase();

export function DoctorDirectoryPage() {
  const { user } = useAuth();
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [userOptions, setUserOptions] = useState<DoctorUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<ApiDoctorStatus | ''>(
    (initialParams.get('status') as ApiDoctorStatus | null) ?? '',
  );
  const [branchFilter, setBranchFilter] = useState(initialParams.get('branch_id') ?? '');
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(
    (initialParams.get('sortBy') as SortColumn | null) ?? null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
  );
  const [currentPage, setCurrentPage] = useState(Number(initialParams.get('page')) || 1);
  const [meta, setMeta] = useState<DoctorListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorResponse | null>(null);
  const [form, setForm] = useState<DoctorFormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const canProvisionLogin = useMemo(
    () =>
      Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) ||
      Boolean(
        user?.permissions.some(
          (permission) =>
            permission.module === 'Doctors' &&
            permission.screen === 'Doctor Directory' &&
            permission.action === 'Provision Login',
        ),
      ),
    [user],
  );

  const departmentsForForm = useMemo(
    () => departments.filter((department) => !form.branchId || department.branch_id === form.branchId),
    [departments, form.branchId],
  );

  const departmentsForFilter = useMemo(
    () => departments.filter((department) => !branchFilter || department.branch_id === branchFilter),
    [branchFilter, departments],
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadLookups = useCallback(async () => {
    setLookupLoading(true);

    try {
      const [branchResponse, departmentResponse, userResponse] = await Promise.all([
        branchesApi.list({ status: 'ACTIVE', limit: 100 }),
        departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
        doctorsApi.userOptions(),
      ]);
      setBranches(branchResponse.data);
      setDepartments(departmentResponse.data);
      setUserOptions(userResponse);
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await doctorsApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        branch_id: branchFilter || undefined,
        department_id: departmentFilter || undefined,
        page: currentPage,
        limit: 10,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      });
      setDoctors(response.data);
      setMeta(response.meta);
    } catch (error) {
      setDoctors([]);
      setMeta({ limit: 10, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, currentPage, departmentFilter, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    const nextUrl = buildDirectoryUrl(
      search,
      statusFilter,
      branchFilter,
      departmentFilter,
      currentPage,
      sortColumn,
      sortDirection,
    );
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [branchFilter, currentPage, departmentFilter, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  const openCreate = () => {
    setEditingDoctor(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (doctor: DoctorResponse) => {
    setEditingDoctor(doctor);
    setForm(toForm(doctor));
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditingDoctor(null);
    setFormError('');
  };

  const handleSort = (column: SortColumn) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.specialization.trim()) {
      setFormError('First name, last name, and specialization are required.');
      return;
    }

    if (!form.branchId || !form.departmentId) {
      setFormError('Branch and department are required.');
      return;
    }

    if (editingDoctor && form.status !== editingDoctor.status && !form.statusReason.trim()) {
      setFormError('A reason is required when changing doctor status.');
      return;
    }

    if (!editingDoctor && form.availability.some((day) => day.is_available && day.working_blocks.length === 0)) {
      setFormError('Every available day must contain at least one working block.');
      return;
    }

    if (!editingDoctor && form.createLoginAccount) {
      if (!canProvisionLogin) {
        setFormError('You do not have permission to provision a doctor login account.');
        return;
      }
      if (!form.employeeCode.trim() || !form.username.trim() || !form.loginEmail.trim()) {
        setFormError('Employee code, username, and login email are required for account creation.');
        return;
      }
      if (!form.temporaryPassword) {
        setFormError('A temporary password is required for account creation.');
        return;
      }
      if (form.temporaryPassword !== form.confirmTemporaryPassword) {
        setFormError('Temporary password and confirmation do not match.');
        return;
      }
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingDoctor) {
        const { status, ...details } = toPayload(form);
        await doctorsApi.update(editingDoctor.id, details);
        if (status && status !== editingDoctor.status) {
          await doctorsApi.updateStatus(editingDoctor.id, status, form.statusReason.trim());
        }
        if ((form.userId || null) !== editingDoctor.user_id) {
          await doctorsApi.mapUser(editingDoctor.id, form.userId || null);
        }
        showToast('Doctor updated successfully.');
      } else {
        const result = await doctorsApi.create(toCreatePayload(form));
        showToast(
          result.account.created
            ? `Doctor and login account ${result.account.username ?? ''} created successfully.`
            : 'Doctor created successfully without a login account.',
        );
      }
      closeModal();
      await loadDoctors();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const exportDoctors = async () => {
    try {
      const blob = await doctorsApi.export({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        branch_id: branchFilter || undefined,
        department_id: departmentFilter || undefined,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      });
      downloadBlob(blob, 'hms-doctors.csv');
      showToast('Doctor export downloaded.');
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setBranchFilter('');
    setDepartmentFilter('');
    setSortColumn(null);
    setSortDirection('desc');
    setCurrentPage(1);
  };

  return (
    <>
      <div className="doctor-page">
        <section className="doctor-page-header">
          <div className="doctor-page-title">
            <h2>Doctor Directory</h2>
            <p>Maintain practitioner profiles, branch context, departments, and OPD setup.</p>
          </div>
          <div className="doctor-page-actions">
            <button className="doc-btn" onClick={() => void exportDoctors()} type="button">
              <i className="ph ph-download-simple" aria-hidden="true" />
              Export CSV
            </button>
            <button className="doc-btn primary" disabled={lookupLoading} onClick={openCreate} type="button">
              <i className="ph ph-plus" aria-hidden="true" />
              Add Doctor
            </button>
          </div>
        </section>

        <section className="doc-toolbar">
          <div className="doc-field grow doc-search">
            <label htmlFor="doctor-search">Search Doctor</label>
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              id="doctor-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name, number, specialization, phone, or email"
              type="search"
              value={search}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="doctor-branch-filter">Branch</label>
            <select
              id="doctor-branch-filter"
              onChange={(event) => {
                setBranchFilter(event.target.value);
                setDepartmentFilter('');
                setCurrentPage(1);
              }}
              value={branchFilter}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="doctor-department-filter">Department</label>
            <select
              id="doctor-department-filter"
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setCurrentPage(1);
              }}
              value={departmentFilter}
            >
              <option value="">All departments</option>
              {departmentsForFilter.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="doctor-status-filter">Status</label>
            <select
              id="doctor-status-filter"
              onChange={(event) => {
                setStatusFilter(event.target.value as ApiDoctorStatus | '');
                setCurrentPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          {(search || statusFilter || branchFilter || departmentFilter || sortColumn) && (
            <button className="doc-btn" onClick={resetFilters} type="button">
              Reset
            </button>
          )}
        </section>

        <section className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Doctor Directory</h3>
              <p>{loading ? 'Loading doctors...' : `${meta.total} doctor records found`}</p>
            </div>
          </div>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('doctor_number')}>Doctor</th>
                  <th onClick={() => handleSort('specialization')}>Specialization</th>
                  <th>Department</th>
                  <th>Branch</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th onClick={() => handleSort('created_at')}>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      Loading doctors...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      {loadError}
                      <div>
                        <button className="doc-btn mt-4" onClick={loadDoctors} type="button">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : doctors.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      No doctor records found.
                    </td>
                  </tr>
                ) : (
                  doctors.map((doctor) => (
                    <tr key={doctor.id}>
                      <td>
                        <div className="doc-person">
                          <span className="doc-avatar">{doctorInitials(doctor)}</span>
                          <div>
                            <strong>{doctor.display_name}</strong>
                            <span>{doctor.doctor_number}</span>
                          </div>
                        </div>
                      </td>
                      <td>{doctor.specialization}</td>
                      <td>{departments.find((department) => department.id === doctor.department_id)?.name ?? '-'}</td>
                      <td>{branches.find((branch) => branch.id === doctor.branch_id)?.name ?? '-'}</td>
                      <td>
                        <strong>{doctor.phone || '-'}</strong>
                        <br />
                        <small>{doctor.email || 'No email recorded'}</small>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass(doctor.status)}`}>{doctor.status.replace('_', ' ')}</span>
                      </td>
                      <td>{formatDate(doctor.created_at)}</td>
                      <td>
                        <div className="doc-actions">
                          <button className="doc-action" onClick={() => openEdit(doctor)} title="Edit doctor" type="button">
                            <i className="ph ph-pencil-simple" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action"
                            onClick={() => navigate(`/doctors/profile?id=${encodeURIComponent(doctor.id)}`)}
                            title="View doctor profile"
                            type="button"
                          >
                            <i className="ph ph-user-circle" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action"
                            onClick={() => navigate(`/doctors/schedule?doctor_id=${encodeURIComponent(doctor.id)}`)}
                            title="View schedule"
                            type="button"
                          >
                            <i className="ph ph-calendar-check" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action"
                            onClick={() => navigate(`/doctors/availability?doctor_id=${encodeURIComponent(doctor.id)}`)}
                            title="Manage availability"
                            type="button"
                          >
                            <i className="ph ph-clock" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="um-pagination">
            <span>
              Showing {doctors.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} doctors
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
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="large"
        title={editingDoctor ? 'Edit Doctor' : 'Onboard Doctor'}
      >
        <form className="modal-form patient-form doctor-onboarding-form" onSubmit={handleSave}>
          {formError && (
            <div className="form-error-banner" role="alert">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <section className="doctor-onboarding-section">
            <header>
              <span><i className="ph ph-stethoscope" aria-hidden="true" /></span>
              <div><h3>Doctor Information</h3><p>Clinical identity, assignment, contact details, and operational status.</p></div>
            </header>
            <div className="form-grid">
              <div className="form-group"><label htmlFor="doctor-first-name">First name *</label><input disabled={submitting} id="doctor-first-name" onChange={(event) => setForm({ ...form, firstName: event.target.value })} required value={form.firstName} /></div>
              <div className="form-group"><label htmlFor="doctor-last-name">Last name *</label><input disabled={submitting} id="doctor-last-name" onChange={(event) => setForm({ ...form, lastName: event.target.value })} required value={form.lastName} /></div>
              <div className="form-group"><label htmlFor="doctor-registration-number">Registration number</label><input disabled={submitting} id="doctor-registration-number" onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })} value={form.registrationNumber} /></div>
              <div className="form-group"><label htmlFor="doctor-qualification">Qualification</label><input disabled={submitting} id="doctor-qualification" onChange={(event) => setForm({ ...form, qualification: event.target.value })} value={form.qualification} /></div>
              <div className="form-group"><label htmlFor="doctor-experience">Experience years</label><input disabled={submitting} id="doctor-experience" max="80" min="0" onChange={(event) => setForm({ ...form, experienceYears: event.target.value })} type="number" value={form.experienceYears} /></div>
              <div className="form-group"><label htmlFor="doctor-specialization">Specialization *</label><input disabled={submitting} id="doctor-specialization" onChange={(event) => setForm({ ...form, specialization: event.target.value })} required value={form.specialization} /></div>
              <div className="form-group"><label htmlFor="doctor-branch">Branch *</label><select disabled={submitting} id="doctor-branch" onChange={(event) => setForm({ ...form, branchId: event.target.value, departmentId: '' })} required value={form.branchId}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
              <div className="form-group"><label htmlFor="doctor-department">Department *</label><select disabled={submitting || !form.branchId} id="doctor-department" onChange={(event) => setForm({ ...form, departmentId: event.target.value })} required value={form.departmentId}><option value="">Select department</option>{departmentsForForm.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
              <div className="form-group"><label htmlFor="doctor-room">Consultation room</label><input disabled={submitting} id="doctor-room" onChange={(event) => setForm({ ...form, consultationRoom: event.target.value })} value={form.consultationRoom} /></div>
              <div className="form-group"><label htmlFor="doctor-phone">Phone</label><input disabled={submitting} id="doctor-phone" onChange={(event) => setForm({ ...form, phone: event.target.value })} type="tel" value={form.phone} /></div>
              <div className="form-group"><label htmlFor="doctor-email">Clinical email</label><input disabled={submitting} id="doctor-email" onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} /></div>
              <div className="form-group"><label htmlFor="doctor-status">Status</label><select disabled={submitting} id="doctor-status" onChange={(event) => setForm({ ...form, status: event.target.value as ApiDoctorStatus })} value={form.status}><option value="ACTIVE">Active</option><option value="ON_LEAVE">On leave</option><option value="INACTIVE">Inactive</option></select></div>
              {editingDoctor && form.status !== editingDoctor.status ? <div className="form-group full-width"><label htmlFor="doctor-status-reason">Status change reason *</label><input disabled={submitting} id="doctor-status-reason" onChange={(event) => setForm({ ...form, statusReason: event.target.value })} required value={form.statusReason} /></div> : null}
              <div className="form-group full-width"><label htmlFor="doctor-notes">Notes</label><textarea disabled={submitting} id="doctor-notes" onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} value={form.notes} /></div>
            </div>
          </section>

          {!editingDoctor ? (
            <section className="doctor-onboarding-section">
              <header><span><i className="ph ph-calendar-dots" aria-hidden="true" /></span><div><h3>Availability</h3><p>Initialize recurring working blocks and appointment slot duration.</p></div></header>
              <DoctorAvailabilityEditor disabled={submitting} onChange={(availability) => setForm({ ...form, availability })} value={form.availability} />
            </section>
          ) : null}

          {!editingDoctor ? (
            <section className="doctor-onboarding-section">
              <header><span><i className="ph ph-key" aria-hidden="true" /></span><div><h3>Account Access</h3><p>Optionally provision a secure login with the fixed DOCTOR role.</p></div></header>
              <div className="doctor-account-toggle">
                <div><strong>Create Login Account: {form.createLoginAccount ? 'Yes' : 'No'}</strong><p>{canProvisionLogin ? 'Creates and links the User account in the same transaction.' : 'Additional permission is required to provision login accounts.'}</p></div>
                <label className="doctor-switch"><input checked={form.createLoginAccount} disabled={submitting || !canProvisionLogin} onChange={(event) => setForm({ ...form, createLoginAccount: event.target.checked, loginEmail: event.target.checked ? form.loginEmail || form.email : form.loginEmail })} type="checkbox" /><span /></label>
              </div>
              {form.createLoginAccount ? (
                <div className="form-grid doctor-account-fields">
                  <div className="form-group"><label htmlFor="doctor-employee-code">Employee code *</label><input autoComplete="off" disabled={submitting} id="doctor-employee-code" onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} required value={form.employeeCode} /></div>
                  <div className="form-group"><label htmlFor="doctor-username">Username *</label><input autoComplete="off" disabled={submitting} id="doctor-username" onChange={(event) => setForm({ ...form, username: event.target.value })} required value={form.username} /></div>
                  <div className="form-group"><label htmlFor="doctor-login-email">Login email *</label><input autoComplete="off" disabled={submitting} id="doctor-login-email" onChange={(event) => setForm({ ...form, loginEmail: event.target.value })} required type="email" value={form.loginEmail} /></div>
                  <div className="form-group"><label htmlFor="doctor-temporary-password">Temporary password *</label><input autoComplete="new-password" disabled={submitting} id="doctor-temporary-password" onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} required type="password" value={form.temporaryPassword} /></div>
                  <div className="form-group"><label htmlFor="doctor-confirm-password">Confirm password *</label><input autoComplete="new-password" disabled={submitting} id="doctor-confirm-password" onChange={(event) => setForm({ ...form, confirmTemporaryPassword: event.target.value })} required type="password" value={form.confirmTemporaryPassword} /></div>
                  <div className="doctor-account-role"><span>Assigned role</span><strong>DOCTOR</strong><small>Role selection is fixed and cannot be changed during onboarding.</small></div>
                </div>
              ) : <div className="doctor-account-notice"><i className="ph ph-info" aria-hidden="true" /><span>The Doctor will be created without system login access. An authorized administrator can map a legacy account later.</span></div>}
            </section>
          ) : (
            <section className="doctor-onboarding-section">
              <header><span><i className="ph ph-link" aria-hidden="true" /></span><div><h3>Legacy User Mapping</h3><p>Retained for explicit remediation of Doctor records created before onboarding integration.</p></div></header>
              <div className="form-grid"><div className="form-group full-width"><label htmlFor="doctor-user">Linked user account</label><select disabled={submitting} id="doctor-user" onChange={(event) => setForm({ ...form, userId: event.target.value })} value={form.userId}><option value="">No linked user</option>{userOptions.filter((option) => !option.mapped_doctor_id || option.mapped_doctor_id === editingDoctor.id).map((option) => <option key={option.id} value={option.id}>{option.full_name} ({option.username})</option>)}</select></div></div>
            </section>
          )}

          <div className="modal-actions">
            <button className="secondary-action" disabled={submitting} onClick={closeModal} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={submitting} type="submit">
              {submitting ? 'Saving...' : 'Save Doctor'}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
