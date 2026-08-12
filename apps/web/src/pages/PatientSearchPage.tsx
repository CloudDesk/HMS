import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientListResponse,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, patientFullName, patientInitials } from './patient-utils';

type PatientFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: ApiPatientGender;
  phone: string;
  email: string;
  bloodGroup: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  notes: string;
};

type SortColumn = 'patient_number' | 'first_name' | 'last_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const emptyPatientForm: PatientFormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'UNKNOWN',
  phone: '',
  email: '',
  bloodGroup: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  notes: '',
};

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPatientPayload = (form: PatientFormState): SavePatientPayload => ({
  first_name: form.firstName.trim(),
  middle_name: nullable(form.middleName),
  last_name: form.lastName.trim(),
  date_of_birth: form.dateOfBirth,
  gender: form.gender,
  phone: nullable(form.phone),
  email: nullable(form.email),
  blood_group: nullable(form.bloodGroup),
  address: {
    line1: nullable(form.addressLine1),
    line2: nullable(form.addressLine2),
    city: nullable(form.city),
    state: nullable(form.state),
    country: nullable(form.country),
    postal_code: nullable(form.postalCode),
  },
  emergency_contact: {
    name: nullable(form.emergencyName),
    relationship: nullable(form.emergencyRelationship),
    phone: nullable(form.emergencyPhone),
  },
  notes: nullable(form.notes),
});

const buildSearchUrl = (
  basePath: string,
  search: string,
  status: ApiPatientStatus | '',
  gender: ApiPatientGender | '',
  page: number,
  sortColumn: SortColumn | null,
  sortDirection: SortDirection,
) => {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (gender) params.set('gender', gender);
  if (page > 1) params.set('page', String(page));
  if (sortColumn) {
    params.set('sortBy', sortColumn);
    params.set('sortOrder', sortDirection);
  }
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}`;
};

export function PatientSearchPage() {
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<ApiPatientStatus | ''>(
    (initialParams.get('status') as ApiPatientStatus | null) ?? '',
  );
  const [genderFilter, setGenderFilter] = useState<ApiPatientGender | ''>(
    (initialParams.get('gender') as ApiPatientGender | null) ?? '',
  );
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(
    (initialParams.get('sortBy') as SortColumn | null) ?? null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
  );
  const [currentPage, setCurrentPage] = useState(Number(initialParams.get('page')) || 1);
  const [meta, setMeta] = useState<PatientListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [form, setForm] = useState<PatientFormState>(emptyPatientForm);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const res = await patientsApi.list({
        search: search.trim() || undefined,
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
  }, [currentPage, genderFilter, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    const basePath = location.pathname === '/patients/register' ? '/patients/register' : '/patients/search';
    const nextUrl = buildSearchUrl(basePath, search, statusFilter, genderFilter, currentPage, sortColumn, sortDirection);
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [currentPage, genderFilter, location.pathname, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (location.pathname === '/patients/register') {
      setRegistrationOpen(true);
    }
  }, [location.pathname]);

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

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setGenderFilter('');
    setSortColumn(null);
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const openRegistration = () => {
    setForm(emptyPatientForm);
    setFormError('');
    setRegistrationOpen(true);
  };

  const closeRegistration = () => {
    if (submitting) return;
    setRegistrationOpen(false);
    setFormError('');
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.firstName.trim()) {
      setFormError('First name is required.');
      return;
    }
    if (!form.lastName.trim()) {
      setFormError('Last name is required.');
      return;
    }
    if (!form.dateOfBirth) {
      setFormError('Date of birth is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const patient = await patientsApi.create(toPatientPayload(form));
      showToast(`Patient ${patient.patient_number} registered successfully.`);
      closeRegistration();
      await loadPatients();
      navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`);
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <i className="ph ph-arrows-down-up sort-icon" aria-hidden="true" />;
    return sortDirection === 'asc' ? (
      <i className="ph ph-arrow-up sort-icon active" aria-hidden="true" />
    ) : (
      <i className="ph ph-arrow-down sort-icon active" aria-hidden="true" />
    );
  };

  return (
    <>
      <div className="um-grid">
        <div className="um-body patient-body">
          <div className="um-table-section card">
            <div className="um-toolbar">
              <div className="um-toolbar-row1">
                <div className="um-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search MRN, name, phone, or email..."
                    type="search"
                    value={search}
                  />
                </div>
                <button className="um-add-btn" onClick={openRegistration} type="button">
                  <i className="ph ph-user-plus" aria-hidden="true" /> Register Patient
                </button>
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filters</span>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setStatusFilter(event.target.value as ApiPatientStatus | '');
                    setCurrentPage(1);
                  }}
                  value={statusFilter}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="DECEASED">Deceased</option>
                </select>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setGenderFilter(event.target.value as ApiPatientGender | '');
                    setCurrentPage(1);
                  }}
                  value={genderFilter}
                >
                  <option value="">All genders</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
                {(search || statusFilter || genderFilter || sortColumn) && (
                  <button className="um-clear-btn" onClick={resetFilters} type="button">
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('patient_number')}>
                      MRN {renderSortIcon('patient_number')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('first_name')}>
                      Patient {renderSortIcon('first_name')}
                    </th>
                    <th>Contact</th>
                    <th>Gender</th>
                    <th>DOB</th>
                    <th>Status</th>
                    <th className="sortable" onClick={() => handleSort('created_at')}>
                      Registered {renderSortIcon('created_at')}
                    </th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={8}>
                        Loading patients...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={8}>
                        {loadError}
                        <div>
                          <button className="secondary-action mt-4" onClick={loadPatients} type="button">
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : patients.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={8}>
                        No patient records found.
                      </td>
                    </tr>
                  ) : (
                    patients.map((patient) => (
                      <tr key={patient.id}>
                        <td className="emp-id">{patient.patient_number}</td>
                        <td>
                          <div className="user-cell">
                            <span className="table-avatar table-avatar-initials">{patientInitials(patient)}</span>
                            <div className="user-cell-info">
                              <span className="user-cell-name">{patientFullName(patient)}</span>
                              <span className="muted-cell">{patient.email || 'No email recorded'}</span>
                            </div>
                          </div>
                        </td>
                        <td>{patient.phone || '-'}</td>
                        <td>{patient.gender}</td>
                        <td>{formatDate(patient.date_of_birth)}</td>
                        <td>
                          <span className={`status-badge ${patient.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                            {patient.status}
                          </span>
                        </td>
                        <td>{formatDate(patient.created_at)}</td>
                        <td className="align-right">
                          <div className="table-actions">
                            <button
                              className="action-icon-btn"
                              onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`)}
                              title="Open profile"
                              type="button"
                            >
                              <i className="ph ph-user" aria-hidden="true" />
                            </button>
                            <button
                              className="action-icon-btn"
                              onClick={() => navigate(`/patients/emr?id=${encodeURIComponent(patient.id)}`)}
                              title="Open EMR timeline"
                              type="button"
                            >
                              <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
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
          </div>
        </div>
      </div>

      <Modal open={registrationOpen} onClose={closeRegistration} title="Register Patient">
        <form className="modal-form patient-form" onSubmit={handleRegister}>
          {formError && (
            <div className="form-error-banner" role="alert">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-section-title">Identity</div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="patient-first-name">First name *</label>
              <input
                disabled={submitting}
                id="patient-first-name"
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                required
                type="text"
                value={form.firstName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-middle-name">Middle name</label>
              <input
                disabled={submitting}
                id="patient-middle-name"
                onChange={(event) => setForm({ ...form, middleName: event.target.value })}
                type="text"
                value={form.middleName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-last-name">Last name *</label>
              <input
                disabled={submitting}
                id="patient-last-name"
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                required
                type="text"
                value={form.lastName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-dob">Date of birth *</label>
              <input
                disabled={submitting}
                id="patient-dob"
                onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                required
                type="date"
                value={form.dateOfBirth}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-gender">Gender *</label>
              <select
                disabled={submitting}
                id="patient-gender"
                onChange={(event) => setForm({ ...form, gender: event.target.value as ApiPatientGender })}
                required
                value={form.gender}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="patient-blood-group">Blood group</label>
              <input
                disabled={submitting}
                id="patient-blood-group"
                onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })}
                type="text"
                value={form.bloodGroup}
              />
            </div>
          </div>

          <div className="form-section-title">Contact</div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="patient-phone">Phone</label>
              <input
                disabled={submitting}
                id="patient-phone"
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                type="tel"
                value={form.phone}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-email">Email</label>
              <input
                disabled={submitting}
                id="patient-email"
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                type="email"
                value={form.email}
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="patient-address-line1">Address line 1</label>
              <input
                disabled={submitting}
                id="patient-address-line1"
                onChange={(event) => setForm({ ...form, addressLine1: event.target.value })}
                type="text"
                value={form.addressLine1}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-city">City</label>
              <input
                disabled={submitting}
                id="patient-city"
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                type="text"
                value={form.city}
              />
            </div>
            <div className="form-group">
              <label htmlFor="patient-country">Country</label>
              <input
                disabled={submitting}
                id="patient-country"
                onChange={(event) => setForm({ ...form, country: event.target.value })}
                type="text"
                value={form.country}
              />
            </div>
          </div>

          <div className="form-section-title">Emergency Contact</div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="emergency-name">Name</label>
              <input
                disabled={submitting}
                id="emergency-name"
                onChange={(event) => setForm({ ...form, emergencyName: event.target.value })}
                type="text"
                value={form.emergencyName}
              />
            </div>
            <div className="form-group">
              <label htmlFor="emergency-relationship">Relationship</label>
              <input
                disabled={submitting}
                id="emergency-relationship"
                onChange={(event) => setForm({ ...form, emergencyRelationship: event.target.value })}
                type="text"
                value={form.emergencyRelationship}
              />
            </div>
            <div className="form-group">
              <label htmlFor="emergency-phone">Phone</label>
              <input
                disabled={submitting}
                id="emergency-phone"
                onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })}
                type="tel"
                value={form.emergencyPhone}
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="patient-notes">Registration notes</label>
              <textarea
                disabled={submitting}
                id="patient-notes"
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
                value={form.notes}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="secondary-action" disabled={submitting} onClick={closeRegistration} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={submitting} type="submit">
              {submitting ? 'Registering...' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
