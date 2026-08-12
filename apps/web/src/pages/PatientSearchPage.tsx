import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientListResponse,
  type PatientResponse,
} from '../api/patients';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, patientFullName, patientInitials } from './patient-utils';

type SortColumn = 'patient_number' | 'first_name' | 'last_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const buildSearchUrl = (
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
  return `/patients/search${query ? `?${query}` : ''}`;
};

export function PatientSearchPage() {
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [loadError, setLoadError] = useState('');

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
    const nextUrl = buildSearchUrl(search, statusFilter, genderFilter, currentPage, sortColumn, sortDirection);
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [currentPage, genderFilter, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

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
                <button className="um-add-btn" onClick={() => navigate('/patients/register')} type="button">
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
                            <button
                              className="action-icon-btn"
                              onClick={() => navigate(`/patients/history?id=${encodeURIComponent(patient.id)}`)}
                              title="Open patient history"
                              type="button"
                            >
                              <i className="ph ph-activity" aria-hidden="true" />
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

    </>
  );
}
