import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientResponse,
} from '../api/patients';
import { usePatientSearchFeature } from '../hooks/patients/usePatientSearchFeature';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { navigate, useAppLocation } from '../routing/navigation';
import { useAuth } from '../auth/useAuth';
import { hasPermission, isSuperAdministrator } from '../auth/access-control';
import { formatDate, patientFullName, calculatePatientAge } from './patient-utils';
import { PatientAvatar } from '../components/patients/PatientAvatar';
import { executePrintPatientCard } from '../components/patients/PatientPrintHelper';
import { useHospitalSettings } from '../hooks/settings/useSettings';
import { PatientRegistrationPage } from './PatientRegistrationPage';
import { PatientEditModal, updatePatientSchema, type UpdatePatientForm } from '../components/patients/PatientEditModal';

type ColumnVisibility = {
  gender: boolean;
  age: boolean;
  phone: boolean;
  status: boolean;
};

const defaultColumns: ColumnVisibility = {
  gender: true,
  age: true,
  phone: true,
  status: true,
};

export function PatientSearchPage() {
  const { user } = useAuth();
  const canEditAllDetails = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Patients', screen: 'Patient Records', action: 'Edit' })
  ));
  const canCreatePatient = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Patients', screen: 'Patient Records', action: 'Create' })
  ));
  const canBookAppointment = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' })
  ));

  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const pageParam = Number(initialParams.get('page') ?? '1');
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const setCurrentPage = (page: number) => {
    const params = new URLSearchParams(location.search);
    params.set('page', String(page));
    navigate(`${location.pathname}?${params}`);
  };

  // Filter Fields (Input state)
  const [mrnInput, setMrnInput] = useState(initialParams.get('mrn') ?? '');
  const [nameInput, setNameInput] = useState(initialParams.get('search') ?? '');
  const [mobileInput, setMobileInput] = useState(initialParams.get('mobile') ?? '');
  const [genderFilter, setGenderFilter] = useState<ApiPatientGender | ''>(
    initialParams.get('gender') === 'MALE' ? 'MALE' : initialParams.get('gender') === 'FEMALE' ? 'FEMALE' : initialParams.get('gender') === 'OTHER' ? 'OTHER' : initialParams.get('gender') === 'UNKNOWN' ? 'UNKNOWN' : '',
  );
  const [statusFilter, setStatusFilter] = useState<ApiPatientStatus | ''>(
    initialParams.get('status') === 'ACTIVE' ? 'ACTIVE' : initialParams.get('status') === 'INACTIVE' ? 'INACTIVE' : initialParams.get('status') === 'DECEASED' ? 'DECEASED' : '',
  );

  // Applied query state survives pagination, refresh and browser history.
  const urlGender = initialParams.get('gender');
  const urlStatus = initialParams.get('status');
  const appliedFilters: { searchTerms: string; status: ApiPatientStatus | ''; gender: ApiPatientGender | '' } = {
    searchTerms: ['mrn', 'search', 'mobile'].map((key) => initialParams.get(key) ?? '').filter(Boolean).join(' ').trim(),
    status: urlStatus === 'ACTIVE' || urlStatus === 'INACTIVE' || urlStatus === 'DECEASED' ? urlStatus : '',
    gender: urlGender === 'MALE' || urlGender === 'FEMALE' || urlGender === 'OTHER' || urlGender === 'UNKNOWN' ? urlGender : '',
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setMrnInput(params.get('mrn') ?? '');
    setNameInput(params.get('search') ?? '');
    setMobileInput(params.get('mobile') ?? '');
    const gender = params.get('gender');
    const status = params.get('status');
    setGenderFilter(gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER' || gender === 'UNKNOWN' ? gender : '');
    setStatusFilter(status === 'ACTIVE' || status === 'INACTIVE' || status === 'DECEASED' ? status : '');
  }, [location.search]);

  // Column Selector Dropdown state
  const [showColumnSelector] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(defaultColumns);

  // Actions context menu state
  const [, setActiveMenuId] = useState<string | null>(null);
  // Edit Patient Modal State
  const [editingPatient, setEditingPatient] = useState<PatientResponse | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const editForm = useForm<UpdatePatientForm>({
    resolver: zodResolver(updatePatientSchema),
  });

  const [cardPatient, setCardPatient] = useState<PatientResponse | null>(null);
  const { hospitalName, phone: hospitalPhone, address: hospitalAddress, logoUrl: hospitalLogoUrl } = useHospitalSettings();
  const hospitalSubText = [hospitalAddress, hospitalPhone].filter(Boolean).join(' · ') || 'Hospital Management System';

  const { state: { patients, meta, loading, loadError }, mutations: { updatePatient }, actions: { retry } } = usePatientSearchFeature({ appliedFilters, currentPage });

  const printPatientCard = (p: PatientResponse) => { executePrintPatientCard(p); };

  const openEditModal = (patient: PatientResponse) => {
    setEditingPatient(patient);
    editForm.reset({
      firstName: patient.first_name ?? '',
      lastName: patient.last_name,
      dateOfBirth: patient.date_of_birth ? patient.date_of_birth.slice(0, 10) : '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      status: patient.status,
      gender: patient.gender,
      bloodGroup: patient.blood_group ?? '',
      addressLine1: patient.address?.line1 ?? '',
      city: patient.address?.city ?? '',
      postalCode: patient.address?.postal_code ?? '',
      notes: patient.notes ?? '',
    });
  };

  const onSubmitEdit = async (data: UpdatePatientForm) => {
    if (!editingPatient) return;
    try {
      setEditSubmitting(true);
      await updatePatient({
        id: editingPatient.id,
        payload: {
          first_name: (data.firstName || '').trim(),
          last_name: (data.lastName || '').trim(),
          date_of_birth: data.dateOfBirth,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          status: data.status,
          gender: data.gender,
          blood_group: data.bloodGroup?.trim() || null,
          address: {
            line1: data.addressLine1?.trim() || null,
            city: data.city?.trim() || null,
            postal_code: data.postalCode?.trim() || null,
          },
          notes: data.notes?.trim() || null,
        },
      });
      setEditingPatient(null);
    } catch (error) {
      console.error(error);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams(location.search);
    const filters = { mrn: mrnInput, search: nameInput, mobile: mobileInput, status: statusFilter, gender: genderFilter };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set('page', '1');
    navigate(`${location.pathname}?${params}`);
  };

  const handleResetFilters = () => {
    setMrnInput('');
    setNameInput('');
    setMobileInput('');
    setGenderFilter('');
    setStatusFilter('');
    const params = new URLSearchParams(location.search);
    ['mrn', 'search', 'mobile', 'nationalId', 'status', 'gender', 'page'].forEach((key) => params.delete(key));
    navigate(`${location.pathname}${params.size ? `?${params}` : ''}`);
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
    <div className="appointment-page full-height-layout patient-directory-page" onClick={() => setActiveMenuId(null)}>
      {/* Patient Search Form Card */}
      <section className="doc-card patient-search-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyFilters();
          }}
        >
          <div className="patient-search-form-grid">
            {/* Row 1: Primary Demographic Inputs */}
            <div className="doc-field patient-search-compact-field">
              <label htmlFor="search-mrn">MRN / Patient ID</label>
              <input
                id="search-mrn"
                onChange={(e) => setMrnInput(e.target.value)}
                placeholder="Enter MRN or ID"
                type="text"
                value={mrnInput}
              />
            </div>
            <div className="doc-field patient-search-compact-field">
              <label htmlFor="search-name">Patient Name</label>
              <input
                id="search-name"
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="First or last name"
                type="text"
                value={nameInput}
              />
            </div>
            <div className="doc-field patient-search-compact-field">
              <label htmlFor="search-mobile">Mobile Number</label>
              <input
                id="search-mobile"
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="+254..."
                type="text"
                value={mobileInput}
              />
            </div>

            {/* Row 2: Secondary Filters & Action Buttons */}
            <div className="doc-field patient-search-compact-field">
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
                {genderFilter === 'UNKNOWN' ? <option value="UNKNOWN">Unknown</option> : null}
              </select>
            </div>
            <div className="doc-field patient-search-compact-field">
              <label htmlFor="search-status">Status</label>
              <select
                id="search-status"
                onChange={(e) => setStatusFilter(e.target.value as ApiPatientStatus | '')}
                value={statusFilter}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                {statusFilter === 'DECEASED' ? <option value="DECEASED">Deceased</option> : null}
              </select>
            </div>

            <div className="patient-search-actions-group">
              <button
                aria-label="Reset filters"
                className="doc-btn"
                onClick={handleResetFilters}
                type="button"
              >
                <i className="ph ph-x" aria-hidden="true" />
                Reset
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
        <div className="doc-card-header patient-directory-header">
          <div>
            <h3>Patient Directory</h3>
            <p aria-live="polite">
              {loading ? 'Loading patients...' : loadError ? 'Patient count unavailable' : `${meta.total} patients found`}
            </p>
          </div>
          {/* Table toolbar */}
          <div className="patient-directory-toolbar">
            {canCreatePatient ? (
              <button
                className="doc-btn primary"
                onClick={() => setRegistrationOpen(true)}
                type="button"
              >
                <i className="ph ph-plus" aria-hidden="true" />
                Register Patient
              </button>
            ) : null}
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

        <div className="table-responsive" tabIndex={0} role="region" aria-label="Patient directory" aria-busy={loading}>
          <table className="data-table responsive-table patient-directory-table">
            <thead>
              <tr>
                <th>MRN</th>
                <th className="patient-directory-name-cell">PATIENT NAME</th>
                {columns.gender ? <th>GENDER</th> : null}
                {columns.age ? <th>AGE</th> : null}
                {columns.phone ? <th>PHONE</th> : null}
                {columns.status ? <th>STATUS</th> : null}
                <th className="align-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3 + Object.values(columns).filter(Boolean).length} style={{ padding: '2rem 1rem' }}>
                    <MedicalLoader
                      text="Searching patient directory..."
                      subtext="Retrieving patient demographic & encounter records"
                    />
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td className="um-state-cell" colSpan={3 + Object.values(columns).filter(Boolean).length}>
                    Failed to load patient directory. <button className="doc-btn" type="button" onClick={() => void retry()}>Retry</button>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td className="um-state-cell" colSpan={3 + Object.values(columns).filter(Boolean).length}>
                    No patient records found.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  const fullName = patientFullName(patient);
                  const age = calculatePatientAge(patient.date_of_birth);

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="emp-id" data-label="MRN">{patient.patient_number}</td>
                      <td className="patient-directory-name-cell" data-label="Patient name">
                        <div className="user-cell">
                          <PatientAvatar
                            patientId={patient.id}
                            fullName={fullName}
                            photoUrl={patient.photo_url}
                            size="table"
                          />
                          <div className="user-cell-info">
                            <strong className="user-cell-name patient-directory-name" title={fullName}>{fullName}</strong>
                          </div>
                        </div>
                      </td>
                      {columns.gender ? <td data-label="Gender">{patient.gender}</td> : null}
                      {columns.age ? <td data-label="Age">{age}</td> : null}
                      {columns.phone ? <td data-label="Phone">{patient.phone || 'Not recorded'}</td> : null}
                      {columns.status ? (
                        <td data-label="Status">
                          <span
                            className={`doc-status ${
                              patient.status === 'ACTIVE' ? 'active' : patient.status === 'DECEASED' ? 'deceased' : 'inactive'
                            }`}
                          >
                            {patient.status}
                          </span>
                        </td>
                      ) : null}
                      <td className="align-right" data-label="Actions">
                        <div className="patient-directory-actions" onClick={(e) => e.stopPropagation()}>
                          {canEditAllDetails ? (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(patient)}
                              type="button"
                              title="Edit Patient" aria-label="Edit Patient"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" />
                            </button>
                          ) : null}
                          {canBookAppointment ? (
                            <button
                              className="doc-btn"
                              onClick={() => navigate(`/appointments/book?patient=${encodeURIComponent(patient.id)}`)}
                              type="button"
                              title="Book Appointment" aria-label="Book Appointment"
                            >
                              <i className="ph ph-calendar-plus" aria-hidden="true" />
                            </button>
                          ) : null}
                          <button
                            className="doc-btn"
                            onClick={() => setCardPatient(patient)}
                            type="button"
                            title="View Patient Card" aria-label="View Patient Card"
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
        <div className="um-pagination patient-directory-pagination">
          <span aria-live="polite">
            {loading ? 'Loading patients...' : loadError ? 'Results unavailable' : <>Showing {patients.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
            {patients.length === 0 ? 0 : Math.min(meta.page * meta.limit, meta.total)} of {meta.total} patients</>}
          </span>
          <div className="um-page-controls" role="navigation" aria-label="Patient pagination">
            <button
              className="pg-btn"
              aria-label="Previous page"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              type="button"
            >
              <i className="ph ph-caret-left" aria-hidden="true" />
            </button>
            <span className="pg-btn active" aria-current="page" aria-label={`Page ${currentPage}`}>{currentPage}</span>
            <button
              className="pg-btn"
              aria-label="Next page"
              disabled={currentPage >= meta.totalPages || loading || Boolean(loadError)}
              onClick={() => setCurrentPage(currentPage + 1)}
              type="button"
            >
              <i className="ph ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <Modal
        className="patient-registration-modal"
        onClose={() => setRegistrationOpen(false)}
        open={registrationOpen}
        size="xlarge"
        title="Register Patient"
      >
        {registrationOpen ? (
          <PatientRegistrationPage
            embedded
            onCancel={() => setRegistrationOpen(false)}
            onRegistered={(patient) => {
              setRegistrationOpen(false);
              navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`);
            }}
          />
        ) : null}
      </Modal>

      {/* Edit Patient Modal */}
      {editingPatient ? (
        <PatientEditModal
          canEditAllDetails={canEditAllDetails}
          form={editForm}
          onClose={() => setEditingPatient(null)}
          onSubmit={onSubmitEdit}
          open={Boolean(editingPatient)}
          patient={editingPatient}
          submitting={editSubmitting}
        />
      ) : null}

      {/* Print Patient Card - preview modal */}
      {cardPatient ? (
        <Modal onClose={() => setCardPatient(null)} open={Boolean(cardPatient)} size="default" title="Patient ID Card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 0 0.25rem' }}>
            <div style={{ width: '340px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {/* Gradient header */}
              <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)', padding: '20px 20px 24px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  {hospitalLogoUrl ? (
                    <img alt={hospitalName} src={hospitalLogoUrl} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain', background: 'rgba(255,255,255,0.2)' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '13px' }}>{hospitalName.charAt(0) || 'H'}</div>
                  )}
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>{hospitalName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px' }}>{hospitalSubText}</div>
                  </div>
                </div>
                <span style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', padding: '3px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>Patient ID</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <PatientAvatar
                    fullName={patientFullName(cardPatient)}
                    photoUrl={cardPatient.photo_url}
                    size="card"
                  />
                  <div>
                    <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>{patientFullName(cardPatient)}</div>
                    <span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px' }}>{cardPatient.patient_number}</span>
                  </div>
                </div>
              </div>
              {/* Info grid */}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  {([
                    ['Date of Birth', formatDate(cardPatient.date_of_birth)],
                    ['Age / Gender', `${calculatePatientAge(cardPatient.date_of_birth)} • ${cardPatient.gender.charAt(0) + cardPatient.gender.slice(1).toLowerCase()}`],
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

