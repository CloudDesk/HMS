import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type ApiDoctorStatus,
  type CreateDoctorPayload,
  type DoctorResponse,
  type SaveDoctorPayload,
} from '../api/doctors';
import {
  DoctorAvailabilityEditor,
  createDefaultDoctorAvailability,
  doctorAvailabilityToForm,
} from '../components/doctors/DoctorAvailabilityEditor';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import {
  useDoctorDirectory,
  type DoctorDirectorySortColumn,
  type DoctorDirectorySortDirection,
} from '../hooks/doctors/useDoctorDirectory';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate } from './patient-utils';

const doctorStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const;
const availabilityDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().regex(timePattern, 'Enter a valid time in HH:mm format.');

const workingBlockSchema = z.object({
  start_time: timeSchema,
  end_time: timeSchema,
  slot_duration_minutes: z.number().int().min(5).max(240),
});

const availabilityDaySchema = z.object({
  day_of_week: z.enum(availabilityDays),
  is_available: z.boolean(),
  working_blocks: z.array(workingBlockSchema).max(8),
});

const doctorFormSchema = z
  .object({
    mode: z.enum(['create', 'edit']),
    originalStatus: z.enum(doctorStatuses),
    firstName: z.string().trim().min(1, 'First name, last name, and specialization are required.'),
    lastName: z.string().trim().min(1, 'First name, last name, and specialization are required.'),
    specialization: z.string().trim().min(1, 'First name, last name, and specialization are required.'),
    qualification: z.string(),
    registrationNumber: z.string(),
    experienceYears: z
      .string()
      .refine(
        (value) =>
          value === '' ||
          (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 80),
        'Experience years must be a whole number between 0 and 80.',
      ),
    branchId: z.string().min(1, 'Branch and department are required.'),
    departmentId: z.string().min(1, 'Branch and department are required.'),
    consultationRoom: z.string(),
    phone: z.string(),
    email: z.union([z.literal(''), z.string().trim().email('Enter a valid clinical email address.')]),
    userId: z.string(),
    createLoginAccount: z.boolean(),
    employeeCode: z.string(),
    username: z.string(),
    loginEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid login email address.')]),
    temporaryPassword: z.string(),
    confirmTemporaryPassword: z.string(),
    availability: z.array(availabilityDaySchema).length(7),
    status: z.enum(doctorStatuses),
    statusReason: z.string().max(500, 'Status reason cannot exceed 500 characters.'),
    notes: z.string(),
  })
  .superRefine((form, context) => {
    if (
      form.mode === 'edit' &&
      form.status !== form.originalStatus &&
      form.statusReason.trim().length < 3
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Status change reason must contain at least 3 characters.',
        path: ['statusReason'],
      });
    }

    if (
      form.mode === 'create' &&
      form.availability.some(
        (day) => day.is_available && day.working_blocks.length === 0,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Every available day must contain at least one working block.',
        path: ['availability'],
      });
    }

    if (form.mode === 'create' && form.createLoginAccount) {
      if (
        !form.employeeCode.trim() ||
        !form.username.trim() ||
        !form.loginEmail.trim()
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Employee code, username, and login email are required for account creation.',
          path: ['employeeCode'],
        });
      }
      if (!form.temporaryPassword) {
        context.addIssue({
          code: 'custom',
          message: 'A temporary password is required for account creation.',
          path: ['temporaryPassword'],
        });
      } else if (form.temporaryPassword !== form.confirmTemporaryPassword) {
        context.addIssue({
          code: 'custom',
          message: 'Temporary password and confirmation do not match.',
          path: ['confirmTemporaryPassword'],
        });
      }
    }
  });

type DoctorFormValues = z.infer<typeof doctorFormSchema>;

const emptyForm = (): DoctorFormValues => ({
  mode: 'create',
  originalStatus: 'ACTIVE',
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

const toForm = (doctor: DoctorResponse): DoctorFormValues => ({
  mode: 'edit',
  originalStatus: doctor.status,
  firstName: doctor.first_name,
  lastName: doctor.last_name,
  specialization: doctor.specialization,
  qualification: doctor.qualification ?? '',
  registrationNumber: doctor.registration_number ?? '',
  experienceYears:
    doctor.experience_years === null ? '' : String(doctor.experience_years),
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

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPayload = (form: DoctorFormValues): SaveDoctorPayload => ({
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

const toCreatePayload = (form: DoctorFormValues): CreateDoctorPayload => ({
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

const parseDoctorStatus = (value: string | null): ApiDoctorStatus | '' =>
  doctorStatuses.find((status) => status === value) ?? '';

const parsePositivePage = (value: string | null): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const sortableColumns: DoctorDirectorySortColumn[] = [
  'doctor_number',
  'display_name',
  'specialization',
  'created_at',
];

const parseSortColumn = (value: string | null): DoctorDirectorySortColumn | null =>
  sortableColumns.find((column) => column === value) ?? null;

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
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<ApiDoctorStatus | ''>(
    parseDoctorStatus(initialParams.get('status')),
  );
  const [branchFilter, setBranchFilter] = useState(
    initialParams.get('branch_id') ?? '',
  );
  const [departmentFilter, setDepartmentFilter] = useState(
    initialParams.get('department_id') ?? '',
  );
  const [sortColumn, setSortColumn] = useState<DoctorDirectorySortColumn | null>(
    parseSortColumn(initialParams.get('sortBy')),
  );
  const [sortDirection, setSortDirection] =
    useState<DoctorDirectorySortDirection>(
      initialParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    );
  const [currentPage, setCurrentPage] = useState(
    parsePositivePage(initialParams.get('page')),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorResponse | null>(null);


  const directoryFilters = useMemo(
    () => ({
      search,
      status: statusFilter,
      branchId: branchFilter,
      departmentId: departmentFilter,
      page: currentPage,
      sortColumn,
      sortDirection,
    }),
    [
      branchFilter,
      currentPage,
      departmentFilter,
      search,
      sortColumn,
      sortDirection,
      statusFilter,
    ],
  );
  const directory = useDoctorDirectory(directoryFilters, editingDoctor?.id ?? null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: emptyForm(),
  });

  const form = watch();
  const submitting = isSubmitting || directory.isSaving;
  const departmentsForForm = useMemo(
    () =>
      directory.departments.filter(
        (department) =>
          (!form.branchId || department.branch_ids.includes(form.branchId)) &&
          department.isClinical,
      ),
    [directory.departments, form.branchId],
  );
  const departmentsForFilter = useMemo(
    () =>
      directory.departments.filter(
        (department) =>
          (!branchFilter || department.branch_ids.includes(branchFilter)) &&
          department.isClinical,
      ),
    [branchFilter, directory.departments],
  );

  const formError =
    errors.root?.message ??
    errors.firstName?.message ??
    errors.lastName?.message ??
    errors.specialization?.message ??
    errors.branchId?.message ??
    errors.departmentId?.message ??
    errors.experienceYears?.message ??
    errors.email?.message ??
    errors.statusReason?.message ??
    errors.availability?.message ??
    errors.employeeCode?.message ??
    errors.loginEmail?.message ??
    errors.temporaryPassword?.message ??
    errors.confirmTemporaryPassword?.message ??
    directory.mappingOptionsError;

  const openCreate = () => {
    if (!directory.canCreate) return;
    setEditingDoctor(null);
    reset(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (doctor: DoctorResponse) => {
    if (!directory.canEdit) return;
    setEditingDoctor(doctor);
    reset(toForm(doctor));
    setModalOpen(true);
  };

  const closeModal = (force = false) => {
    if (submitting && !force) return;
    setModalOpen(false);
    setEditingDoctor(null);
    reset(emptyForm());
  };

  const handleSort = (column: DoctorDirectorySortColumn) => {
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

  const handleSave = handleSubmit(async (values) => {
    try {
      if (editingDoctor) {
        const { status, ...details } = toPayload(values);
        await directory.saveDoctor({
          mode: 'edit',
          doctor: editingDoctor,
          payload: details,
          status: status ?? editingDoctor.status,
          statusReason: values.statusReason.trim(),
          userId: values.userId || null,
        });
      } else {
        await directory.saveDoctor({
          mode: 'create',
          payload: toCreatePayload(values),
        });
      }
      closeModal(true);
    } catch (error) {
      setError('root', {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save the doctor record.',
      });
    }
  });

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
            {directory.canExport ? (
              <button
                className="doc-btn"
                disabled={directory.isExporting}
                onClick={() => void directory.exportDoctors()}
                type="button"
              >
                <i className="ph ph-download-simple" aria-hidden="true" />
                {directory.isExporting ? 'Exporting...' : 'Export CSV'}
              </button>
            ) : null}
            {directory.canCreate ? (
              <button className="doc-btn primary" onClick={openCreate} type="button">
                <i className="ph ph-plus" aria-hidden="true" />
                Add Doctor
              </button>
            ) : null}
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
              disabled={!directory.canViewBranches}
              id="doctor-branch-filter"
              onChange={(event) => {
                setBranchFilter(event.target.value);
                setDepartmentFilter('');
                setCurrentPage(1);
              }}
              value={branchFilter}
            >
              <option value="">All branches</option>
              {directory.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="doctor-department-filter">Department</label>
            <select
              disabled={!directory.canViewDepartments}
              id="doctor-department-filter"
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setCurrentPage(1);
              }}
              value={departmentFilter}
            >
              <option value="">All departments</option>
              {departmentsForFilter.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="doctor-status-filter">Status</label>
            <select
              id="doctor-status-filter"
              onChange={(event) => {
                setStatusFilter(parseDoctorStatus(event.target.value));
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
            <button className="doc-btn" onClick={resetFilters} type="button">Reset</button>
          )}
        </section>

        <section className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Doctor Directory</h3>
              <p>{directory.isLoading ? 'Loading doctors...' : `${directory.meta.total} doctor records found`}</p>
            </div>
          </div>
          <div className="doc-table-wrap">
            <table className="doc-table responsive-table">
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
                {directory.isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem 1rem' }}>
                      <MedicalLoader
                        text="Loading doctor directory..."
                        subtext="Retrieving hospital clinician records"
                      />
                    </td>
                  </tr>
                ) : directory.loadError ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      {directory.loadError}
                      <div>
                        <button className="doc-btn mt-4" onClick={() => void directory.retry()} type="button">Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : directory.doctors.length === 0 ? (
                  <tr><td className="um-state-cell" colSpan={8}>No doctor records found.</td></tr>
                ) : (
                  directory.doctors.map((doctor) => (
                    <tr key={doctor.id}>
                      <td data-label="Doctor">
                        <div className="doc-person">
                          <span className="doc-avatar">{doctorInitials(doctor)}</span>
                          <div><strong>{doctor.display_name}</strong><span>{doctor.doctor_number}</span></div>
                        </div>
                      </td>
                      <td data-label="Specialization">{doctor.specialization}</td>
                      <td data-label="Department">{directory.departments.find((department) => department.id === doctor.department_id)?.name ?? '-'}</td>
                      <td data-label="Branch">{directory.branches.find((branch) => branch.id === doctor.branch_id)?.name ?? '-'}</td>
                      <td data-label="Contact"><strong>{doctor.phone || '-'}</strong><br /><small>{doctor.email || 'No email recorded'}</small></td>
                      <td data-label="Status"><span className={`status-badge ${statusClass(doctor.status)}`}>{doctor.status.replace('_', ' ')}</span></td>
                      <td data-label="Created">{formatDate(doctor.created_at)}</td>
                      <td data-label="Actions">
                        <div className="doc-actions">
                          {directory.canEdit ? (
                            <button className="doc-action" onClick={() => openEdit(doctor)} title="Edit doctor" type="button">
                              <i className="ph ph-pencil-simple" aria-hidden="true" />
                            </button>
                          ) : null}
                          <button className="doc-action" onClick={() => navigate(`/doctors/profile?id=${encodeURIComponent(doctor.id)}`)} title="View doctor profile" type="button">
                            <i className="ph ph-user-circle" aria-hidden="true" />
                          </button>
                          {directory.canViewSchedule ? (
                            <button className="doc-action" onClick={() => navigate(`/doctors/schedule?doctor_id=${encodeURIComponent(doctor.id)}`)} title="View schedule" type="button">
                              <i className="ph ph-calendar-check" aria-hidden="true" />
                            </button>
                          ) : null}
                          {directory.canViewAvailability ? (
                            <button className="doc-action" onClick={() => navigate(`/doctors/availability?doctor_id=${encodeURIComponent(doctor.id)}`)} title="Manage availability" type="button">
                              <i className="ph ph-clock" aria-hidden="true" />
                            </button>
                          ) : null}
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
              Showing {directory.doctors.length === 0 ? 0 : (directory.meta.page - 1) * directory.meta.limit + 1}-
              {Math.min(directory.meta.page * directory.meta.limit, directory.meta.total)} of {directory.meta.total} doctors
            </span>
            <div className="um-page-controls">
              <button className="pg-btn" disabled={directory.meta.page <= 1 || directory.isLoading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">
                <i className="ph ph-caret-left" aria-hidden="true" />
              </button>
              <button className="pg-btn active" disabled type="button">{directory.meta.page}</button>
              <button className="pg-btn" disabled={directory.meta.page >= directory.meta.totalPages || directory.isLoading} onClick={() => setCurrentPage((page) => page + 1)} type="button">
                <i className="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onClose={() => closeModal()} size="large" title={editingDoctor ? 'Edit Doctor' : 'Onboard Doctor'}>
        <form className="modal-form patient-form doctor-onboarding-form" onSubmit={handleSave}>
          <input {...register('mode')} type="hidden" />
          <input {...register('originalStatus')} type="hidden" />
          {formError ? (
            <div className="form-error-banner" role="alert">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          {directory.isMappingOptionsLoading ? (
            <div className="um-state-cell">Loading user mapping options...</div>
          ) : (
            <>
              <section className="doctor-onboarding-section">
                <header>
                  <span><i className="ph ph-stethoscope" aria-hidden="true" /></span>
                  <div><h3>Doctor Information</h3><p>Clinical identity, assignment, contact details, and operational status.</p></div>
                </header>
                <div className="form-grid">
                  <div className={`form-group ${editingDoctor ? 'locked' : ''}`}>
                    <label htmlFor="doctor-first-name">
                      First name <span className="required-asterisk">*</span>
                      {editingDoctor ? <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span> : null}
                    </label>
                    {editingDoctor ? <input {...register('firstName')} type="hidden" /> : null}
                    <input
                      {...(!editingDoctor ? register('firstName') : {})}
                      disabled={submitting || Boolean(editingDoctor)}
                      id="doctor-first-name"
                      value={editingDoctor ? form.firstName : undefined}
                    />
                  </div>
                  <div className={`form-group ${editingDoctor ? 'locked' : ''}`}>
                    <label htmlFor="doctor-last-name">
                      Last name <span className="required-asterisk">*</span>
                      {editingDoctor ? <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span> : null}
                    </label>
                    {editingDoctor ? <input {...register('lastName')} type="hidden" /> : null}
                    <input
                      {...(!editingDoctor ? register('lastName') : {})}
                      disabled={submitting || Boolean(editingDoctor)}
                      id="doctor-last-name"
                      value={editingDoctor ? form.lastName : undefined}
                    />
                  </div>
                  <div className={`form-group ${editingDoctor ? 'locked' : ''}`}>
                    <label htmlFor="doctor-registration-number">
                      Registration number
                      {editingDoctor ? <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span> : null}
                    </label>
                    {editingDoctor ? <input {...register('registrationNumber')} type="hidden" /> : null}
                    <input
                      {...(!editingDoctor ? register('registrationNumber') : {})}
                      disabled={submitting || Boolean(editingDoctor)}
                      id="doctor-registration-number"
                      value={editingDoctor ? form.registrationNumber : undefined}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-qualification">Qualification</label>
                    <input {...register('qualification')} disabled={submitting} id="doctor-qualification" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-experience">Experience years</label>
                    <input {...register('experienceYears')} disabled={submitting} id="doctor-experience" max="80" min="0" type="number" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-specialization">Specialization <span className="required-asterisk">*</span></label>
                    <input {...register('specialization')} disabled={submitting} id="doctor-specialization" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-branch">Branch <span className="required-asterisk">*</span></label>
                    <select
                      {...register('branchId', {
                        onChange: () => setValue('departmentId', '', { shouldDirty: true }),
                      })}
                      disabled={submitting}
                      id="doctor-branch"
                    >
                      <option value="">Select branch</option>
                      {directory.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-department">Department <span className="required-asterisk">*</span></label>
                    <select {...register('departmentId')} disabled={submitting || !form.branchId} id="doctor-department">
                      <option value="">Select department</option>
                      {departmentsForForm.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-room">Consultation room</label>
                    <input {...register('consultationRoom')} disabled={submitting} id="doctor-room" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-phone">Phone</label>
                    <input {...register('phone')} disabled={submitting} id="doctor-phone" type="tel" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-email">Clinical email</label>
                    <input {...register('email')} disabled={submitting} id="doctor-email" type="email" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="doctor-status">Status</label>
                    <select {...register('status')} disabled={submitting} id="doctor-status">
                      <option value="ACTIVE">Active</option>
                      <option value="ON_LEAVE">On leave</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  {editingDoctor && form.status !== editingDoctor.status ? (
                    <div className="form-group full-width">
                      <label htmlFor="doctor-status-reason">Status change reason <span className="required-asterisk">*</span></label>
                      <input {...register('statusReason')} disabled={submitting} id="doctor-status-reason" />
                    </div>
                  ) : null}
                  <div className="form-group full-width">
                    <label htmlFor="doctor-notes">Notes</label>
                    <textarea {...register('notes')} disabled={submitting} id="doctor-notes" rows={3} />
                  </div>
                </div>
              </section>

              {!editingDoctor ? (
                <section className="doctor-onboarding-section">
                  <header><span><i className="ph ph-calendar-dots" aria-hidden="true" /></span><div><h3>Availability</h3><p>Initialize recurring working blocks and appointment slot duration.</p></div></header>
                  <Controller
                    control={control}
                    name="availability"
                    render={({ field }) => (
                      <DoctorAvailabilityEditor
                        disabled={submitting}
                        onChange={field.onChange}
                        value={field.value}
                      />
                    )}
                  />
                </section>
              ) : null}

              {!editingDoctor ? (
                <section className="doctor-onboarding-section">
                  <header><span><i className="ph ph-key" aria-hidden="true" /></span><div><h3>Account Access</h3><p>Optionally provision a secure login with the fixed DOCTOR role.</p></div></header>
                  <div className="doctor-account-toggle">
                    <div>
                      <strong>Create Login Account: {form.createLoginAccount ? 'Yes' : 'No'}</strong>
                      <p>{directory.canProvisionLogin ? 'Creates and links the User account in the same transaction.' : 'Additional permission is required to provision login accounts.'}</p>
                    </div>
                    <Controller
                      control={control}
                      name="createLoginAccount"
                      render={({ field }) => (
                        <label className="doctor-switch">
                          <input
                            checked={field.value}
                            disabled={submitting || !directory.canProvisionLogin}
                            onChange={(event) => {
                              field.onChange(event.target.checked);
                              if (event.target.checked && !form.loginEmail) {
                                setValue('loginEmail', form.email, { shouldDirty: true });
                              }
                            }}
                            type="checkbox"
                          />
                          <span />
                        </label>
                      )}
                    />
                  </div>
                  {form.createLoginAccount ? (
                    <div className="form-grid doctor-account-fields">
                      <div className="form-group"><label htmlFor="doctor-employee-code">Employee code <span className="required-asterisk">*</span></label><input autoComplete="off" disabled={submitting} id="doctor-employee-code" {...register('employeeCode')} required /><br />{errors.employeeCode ? <small className="field-error">{errors.employeeCode.message}</small> : null}</div>
                      <div className="form-group"><label htmlFor="doctor-username">Username <span className="required-asterisk">*</span></label><input autoComplete="off" disabled={submitting} id="doctor-username" {...register('username')} required /></div>
                      <div className="form-group"><label htmlFor="doctor-login-email">Login email <span className="required-asterisk">*</span></label><input autoComplete="off" disabled={submitting} id="doctor-login-email" {...register('loginEmail')} required type="email" /></div>

                      <div className="form-group">
                        <label htmlFor="doctor-temporary-password">password <span className="required-asterisk">*</span></label>
                        <input autoComplete="new-password" disabled={submitting} id="doctor-temporary-password" {...register('temporaryPassword')} required type="password" style={{ width: '100%' }} />
                        {errors.temporaryPassword ? <small className="field-error">{errors.temporaryPassword.message}</small> : null}
                      </div>

                      <div className="form-group">
                        <label htmlFor="doctor-confirm-password">Confirm password <span className="required-asterisk">*</span></label>
                        <input autoComplete="new-password" disabled={submitting} id="doctor-confirm-password" {...register('confirmTemporaryPassword')} required type="password" style={{ width: '100%' }} />
                        {errors.confirmTemporaryPassword ? <small className="field-error">{errors.confirmTemporaryPassword.message}</small> : null}
                      </div>
                      <div className="doctor-account-role"><span>Assigned role</span><strong>DOCTOR</strong><small>Role selection is fixed and cannot be changed during onboarding.</small></div>
                    </div>
                  ) : (
                    <div className="doctor-account-notice"><i className="ph ph-info" aria-hidden="true" /><span>The Doctor will be created without system login access. An authorized administrator can map a legacy account later.</span></div>
                  )}
                </section>
              ) : directory.canProvisionLogin ? (
                <section className="doctor-onboarding-section">
                  <header><span><i className="ph ph-link" aria-hidden="true" /></span><div><h3>Legacy User Mapping</h3><p>Retained for explicit remediation of Doctor records created before onboarding integration.</p></div></header>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label htmlFor="doctor-user">Linked user account</label>
                      <select {...register('userId')} disabled={submitting} id="doctor-user">
                        <option value="">No linked user</option>
                        {directory.userOptions
                          .filter((option) => !option.mapped_doctor_id || option.mapped_doctor_id === editingDoctor.id)
                          .map((option) => <option key={option.id} value={option.id}>{option.full_name} ({option.username})</option>)}
                      </select>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          )}

          <div className="modal-actions">
            <button className="secondary-action" disabled={submitting} onClick={() => closeModal()} type="button">Cancel</button>
            <button className="primary-action" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Doctor'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
