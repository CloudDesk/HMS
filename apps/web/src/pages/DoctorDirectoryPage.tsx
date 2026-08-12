import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import {
  doctorsApi,
  type ApiDoctorStatus,
  type DoctorListResponse,
  type DoctorResponse,
  type SaveDoctorPayload,
} from '../api/doctors';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
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
  status: ApiDoctorStatus;
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
  status: 'ACTIVE',
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
  status: doctor.status,
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
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
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
      const [branchResponse, departmentResponse] = await Promise.all([
        branchesApi.list({ status: 'ACTIVE', limit: 100 }),
        departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
      ]);
      setBranches(branchResponse.data);
      setDepartments(departmentResponse.data);
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

    setSubmitting(true);
    setFormError('');

    try {
      if (editingDoctor) {
        await doctorsApi.update(editingDoctor.id, toPayload(form));
        showToast('Doctor updated successfully.');
      } else {
        await doctorsApi.create(toPayload(form));
        showToast('Doctor created successfully.');
      }
      closeModal();
      await loadDoctors();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
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
                            onClick={() => navigate(`/doctors/schedule?doctor_id=${encodeURIComponent(doctor.id)}`)}
                            title="View schedule"
                            type="button"
                          >
                            <i className="ph ph-calendar-check" aria-hidden="true" />
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

      <Modal open={modalOpen} onClose={closeModal} title={editingDoctor ? 'Edit Doctor' : 'Add Doctor'}>
        <form className="modal-form patient-form" onSubmit={handleSave}>
          {formError && (
            <div className="form-error-banner" role="alert">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="doctor-first-name">First name *</label>
              <input
                disabled={submitting}
                id="doctor-first-name"
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                required
                value={form.firstName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-last-name">Last name *</label>
              <input
                disabled={submitting}
                id="doctor-last-name"
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                required
                value={form.lastName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-specialization">Specialization *</label>
              <input
                disabled={submitting}
                id="doctor-specialization"
                onChange={(event) => setForm({ ...form, specialization: event.target.value })}
                required
                value={form.specialization}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-qualification">Qualification</label>
              <input
                disabled={submitting}
                id="doctor-qualification"
                onChange={(event) => setForm({ ...form, qualification: event.target.value })}
                value={form.qualification}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-registration-number">Registration number</label>
              <input
                disabled={submitting}
                id="doctor-registration-number"
                onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
                value={form.registrationNumber}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-experience">Experience years</label>
              <input
                disabled={submitting}
                id="doctor-experience"
                min="0"
                onChange={(event) => setForm({ ...form, experienceYears: event.target.value })}
                type="number"
                value={form.experienceYears}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-branch">Branch *</label>
              <select
                disabled={submitting}
                id="doctor-branch"
                onChange={(event) => setForm({ ...form, branchId: event.target.value, departmentId: '' })}
                required
                value={form.branchId}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="doctor-department">Department *</label>
              <select
                disabled={submitting || !form.branchId}
                id="doctor-department"
                onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                required
                value={form.departmentId}
              >
                <option value="">Select department</option>
                {departmentsForForm.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="doctor-room">Consultation room</label>
              <input
                disabled={submitting}
                id="doctor-room"
                onChange={(event) => setForm({ ...form, consultationRoom: event.target.value })}
                value={form.consultationRoom}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-status">Status</label>
              <select
                disabled={submitting}
                id="doctor-status"
                onChange={(event) => setForm({ ...form, status: event.target.value as ApiDoctorStatus })}
                value={form.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="doctor-phone">Phone</label>
              <input
                disabled={submitting}
                id="doctor-phone"
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                type="tel"
                value={form.phone}
              />
            </div>
            <div className="form-group">
              <label htmlFor="doctor-email">Email</label>
              <input
                disabled={submitting}
                id="doctor-email"
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                type="email"
                value={form.email}
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="doctor-notes">Notes</label>
              <textarea
                disabled={submitting}
                id="doctor-notes"
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
                value={form.notes}
              />
            </div>
          </div>

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
