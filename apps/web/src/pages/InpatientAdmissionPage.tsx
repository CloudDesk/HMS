import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import type { AdmissionRequest, AdmissionSourceType, AdmissionType } from '../api/inpatient-admissions';
import { Modal } from '../components/ui/Modal';
import { AdmissionRequestDetailModal } from '../components/admissions/AdmissionRequestDetailModal';
import { NewAdmissionRequestModal } from '../components/admissions/NewAdmissionRequestModal';
import { useInpatientAdmissionFeature } from '../hooks/admissions/useInpatientAdmissionFeature';
import { navigate, useAppLocation } from '../routing/navigation';

const linkedSourceTypes = ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'REFERRAL'] as const;
type LinkedSourceType = (typeof linkedSourceTypes)[number];

const isLinkedSourceType = (value: AdmissionSourceType): value is LinkedSourceType =>
  linkedSourceTypes.some((item) => item === value);

const isObjectId = (value: string | null | undefined) => Boolean(value && /^[a-f\d]{24}$/i.test(value));

const admissionTypeOptions: Array<{ value: AdmissionType; label: string }> = [
  { value: 'INPATIENT', label: 'Inpatient' },
  { value: 'OBSERVATION', label: 'Observation' },
  { value: 'DAY_CARE', label: 'Day Care' },
];

const sourceOptions: Array<{ value: AdmissionSourceType; label: string }> = [
  { value: 'OPD_VISIT', label: 'OPD' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'DIRECT', label: 'Direct Admission' },
];

const priorityOptions = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'EMERGENCY', label: 'Emergency' },
] as const;

const statusMeta: Record<AdmissionRequest['status'], { label: string; tone: string; description: string }> = {
  PENDING_VALIDATION: { label: 'Pending Validation', tone: 'pending', description: 'Request intent captured; bed and prerequisites not yet validated.' },
  READY_FOR_CONFIRMATION: { label: 'Ready For Confirmation', tone: 'ready', description: 'Bed and prerequisites are selected; final admission is still pending.' },
  CONFIRMED: { label: 'Confirmed', tone: 'approved', description: 'Actual inpatient admission has been created and linked.' },
  CANCELLED: { label: 'Cancelled', tone: 'rejected', description: 'Request is closed and cannot create an admission.' },
};

const sourceLabels: Record<AdmissionSourceType, string> = {
  DIRECT: 'Direct Admission',
  OPD_VISIT: 'OPD',
  EMERGENCY_ENCOUNTER: 'Emergency',
  REFERRAL: 'Referral',
  TRANSFER: 'Transfer',
  PROCEDURE_BOOKING: 'Procedure Booking',
};

const createSchema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  department_id: z.string().min(1, 'Select a department'),
  recommending_doctor_id: z.string().min(1, 'Select the requesting doctor or staff member'),
  source_type: z.enum(['DIRECT', 'OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'REFERRAL']),
  source_id: z.string().optional(),
  admission_type: z.enum(['INPATIENT', 'OBSERVATION', 'DAY_CARE']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
  reason: z.string().trim().min(1, 'Clinical summary is required').max(500, 'Clinical summary must be 500 characters or fewer'),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer').optional(),
}).superRefine((value, context) => {
  if (isLinkedSourceType(value.source_type) && !isObjectId(value.source_id)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_id'],
      message: `${sourceLabels[value.source_type]} source requires an existing linked record`,
    });
  }
});

const allocationSchema = z.object({
  ward_id: z.string().min(1, 'Select a ward'),
  bed_id: z.string().min(1, 'Select an available bed'),
  hold_id: z.string(),
  consent_document_id: z.string(),
  deposit_invoice_id: z.string(),
  admission_date: z.string().min(1, 'Admission date is required'),
});

const consentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  signed_by_name: z.string().trim().min(1, 'Signer is required'),
  signed_at: z.string().min(1, 'Signed date is required'),
  valid_until: z.string().optional(),
  file: z.instanceof(File).optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type AllocationValues = z.infer<typeof allocationSchema>;
type ConsentValues = z.infer<typeof consentSchema>;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PT';

const admissionErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Unable to complete the admission workflow.';
  }

  if (error.status === 401 || error.code === 'SESSION_EXPIRED' || error.code === 'TOKEN_EXPIRED') {
    return 'Your session has expired. Please sign in again.';
  }
  if (error.status === 403) return 'You are not authorized to perform this admission action.';
  if (error.code === 'VALIDATION_ERROR') return 'Check the highlighted fields and try again.';
  if (error.code === 'ACTIVE_ADMISSION_EXISTS' || error.code === 'ACTIVE_ADMISSION_CONFLICT' || error.code === 'PATIENT_ALREADY_ADMITTED') return 'This patient already has an active inpatient admission.';
  if (error.code === 'DUPLICATE_ADMISSION_REQUEST') return 'This patient already has a pending admission request.';
  if (error.code === 'ADMISSION_SOURCE_MISMATCH') return 'The selected source does not match this patient, branch, department, or requester.';
  if (error.code === 'ADMISSION_SOURCE_NOT_FOUND') return 'The selected OPD, referral, or emergency source could not be found.';
  if (error.code === 'SOURCE_ALREADY_CONVERTED' || error.code === 'ADMISSION_SOURCE_ALREADY_CONVERTED') return 'This source has already been converted to an inpatient admission.';
  if (error.code === 'BED_NOT_AVAILABLE') return 'The selected bed is no longer available. Refresh the bed list and choose another bed.';
  if (error.code === 'CONSENT_REQUIRED') return 'Signed admission consent is required before confirmation.';
  if (error.code === 'ADVANCE_DEPOSIT_REQUIRED') return error.message;
  if (error.status >= 500) return 'The admission service is temporarily unavailable. Please try again shortly.';
  return error.message;
};

export function InpatientAdmissionPage() {
  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [patientSearch, setPatientSearch] = useState(handoff.get('patient_search') ?? '');
  const [requestSearch, setRequestSearch] = useState(handoff.get('search') ?? '');
  const [selected, setSelected] = useState<AdmissionRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [filterDepartment, setFilterDepartment] = useState(handoff.get('department_id') ?? '');
  const [filterAdmissionType, setFilterAdmissionType] = useState(handoff.get('admission_type') ?? '');
  const [filterPriority, setFilterPriority] = useState(handoff.get('priority') ?? '');
  const [filterSource, setFilterSource] = useState(handoff.get('source_type') ?? '');
  const [filterStatus, setFilterStatus] = useState(handoff.get('status') ?? '');
  const [page, setPage] = useState(Number(handoff.get('page') ?? '1') || 1);
  const pageSize = 10;

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      source_type: 'OPD_VISIT',
      source_id: '',
      admission_type: 'INPATIENT',
      priority: 'ROUTINE',
      reason: '',
      notes: '',
    },
  });
  const allocationForm = useForm<AllocationValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { ward_id: '', bed_id: '', hold_id: '', consent_document_id: '', deposit_invoice_id: '', admission_date: new Date().toISOString().slice(0, 16) },
  });
  const consentForm = useForm<ConsentValues>({
    resolver: zodResolver(consentSchema),
    defaultValues: { title: 'Inpatient admission consent', signed_by_name: '', signed_at: new Date().toISOString().slice(0, 16), valid_until: '' },
  });

  const wardId = allocationForm.watch('ward_id');
  const createValues = createForm.watch();
  const selectedSourceType = createValues.source_type;
  const feature = useInpatientAdmissionFeature({ patientSearch, requestSearch, createOpen, selectedRequest: selected, selectedSourceType, wardId });
  const {
    branchId,
    branches,
    wards,
    beds,
    requests,
    admissions,
    policy,
    counts,
    departmentOptions,
    doctorOptions,
    availablePatients,
    loading,
    errors,
    pending,
  } = feature.state;
  const {
    setBranchId,
    createRequest: submitCreateRequest,
    validateRequest,
    confirmRequest,
    cancelRequest,
    uploadConsent: submitConsent,
  } = feature.actions;

  const selectedPatientOption = useMemo(() => {
    const selectedKey = isLinkedSourceType(selectedSourceType) ? createValues.source_id : createValues.patient_id;
    return availablePatients.find((item) => (isLinkedSourceType(selectedSourceType) ? item.sourceId : item.patientId) === selectedKey) ?? null;
  }, [availablePatients, createValues.patient_id, createValues.source_id, selectedSourceType]);

  const selectedDepartment = departmentOptions.find((item) => item.id === createValues.department_id);
  const selectedDoctor = doctorOptions.find((item) => item.id === createValues.recommending_doctor_id);
  const activeAdmissionForPatient = admissions.find((item) => item.patient_id === createValues.patient_id && item.status === 'ADMITTED');
  const pendingRequestForPatient = requests.find((item) => item.patient_id === createValues.patient_id && ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'].includes(item.status));

  useEffect(() => {
    if (handoff.get('source_type') !== 'EMERGENCY_ENCOUNTER') return;
    const sourceId = handoff.get('source_id') ?? '';
    const patientId = handoff.get('patient_id') ?? '';
    const departmentId = handoff.get('department_id') ?? '';
    const doctorId = handoff.get('doctor_id') ?? '';
    if (!sourceId || !patientId || !departmentId || !doctorId) return;
    setBranchId(handoff.get('branch_id') ?? '');
    setPatientSearch(handoff.get('patient_search') ?? '');
    createForm.reset({ patient_id: patientId, department_id: departmentId, recommending_doctor_id: doctorId, source_type: 'EMERGENCY_ENCOUNTER', source_id: sourceId, admission_type: 'INPATIENT', priority: 'EMERGENCY', reason: handoff.get('reason') ?? '', notes: handoff.get('notes') ?? '' });
    setCreateOpen(true);
  }, [createForm, handoff, setBranchId]);

  useEffect(() => {
    if (selected) {
      allocationForm.reset({
        ward_id: selected.ward_id ?? '',
        bed_id: selected.bed_id ?? '',
        hold_id: selected.hold_id ?? '',
        consent_document_id: selected.consent_document_id ?? '',
        deposit_invoice_id: selected.deposit_invoice_id ?? '',
        admission_date: new Date().toISOString().slice(0, 16),
      });
    }
  }, [allocationForm, selected]);

  const updateUrl = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '') params.delete(key);
      else params.set(key, String(value));
    });
    const next = params.toString();
    navigate(`${location.pathname}${next ? `?${next}` : ''}`, { replace: true });
  };

  const handleSourceChange = (sourceType: AdmissionSourceType) => {
    createForm.setValue('source_type', sourceType as CreateValues['source_type'], { shouldValidate: true });
    createForm.setValue('patient_id', '', { shouldValidate: true });
    createForm.setValue('source_id', '', { shouldValidate: true });
    createForm.setValue('reason', '');
    createForm.setValue('notes', '');
  };

  const handlePatientSelect = (value: string) => {
    if (selectedSourceType === 'DIRECT') {
      createForm.setValue('patient_id', value, { shouldValidate: true });
      createForm.setValue('source_id', '');
      return;
    }

    const match = availablePatients.find((patient) => patient.sourceId === value);
    createForm.setValue('patient_id', match?.patientId ?? '', { shouldValidate: true });
    createForm.setValue('source_id', match?.sourceId ?? '', { shouldValidate: true });
    if (match?.doctorId) createForm.setValue('recommending_doctor_id', match.doctorId, { shouldValidate: true });
    if (match?.departmentId) createForm.setValue('department_id', match.departmentId, { shouldValidate: true });
    if (match?.priority) createForm.setValue('priority', match.priority);
    if (match?.clinicalSummary && !createValues.reason) createForm.setValue('reason', match.clinicalSummary);
    else if (match?.sourceReason && !createValues.reason) createForm.setValue('reason', match.sourceReason);
  };

  const createRequest = createForm.handleSubmit(async (values) => {
    try {
      const request = await submitCreateRequest({
        ...values,
        branch_id: branchId,
        source_id: isLinkedSourceType(values.source_type) ? values.source_id : null,
        notes: values.notes || null,
      });
      toast.success('Admission request created.');
      setCreateOpen(false);
      setSelected(request);
      createForm.reset();
      navigate(`/admissions/requests?branch_id=${branchId}`, { replace: true });
    } catch (error) {
      toast.error(admissionErrorMessage(error));
    }
  });

  const validate = allocationForm.handleSubmit(async (values) => {
    if (!selected) return;
    try {
      const request = await validateRequest({ id: selected.id, patientId: selected.patient_id, payload: { ward_id: values.ward_id, bed_id: values.bed_id, hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null } });
      setSelected(request);
      toast.success('Request validated and ready for confirmation.');
    } catch (error) {
      toast.error(admissionErrorMessage(error));
    }
  });

  const confirm = allocationForm.handleSubmit(async (values) => {
    if (!selected) return;
    try {
      const request = await confirmRequest({ id: selected.id, patientId: selected.patient_id, payload: { ward_id: values.ward_id, bed_id: values.bed_id, hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null, admission_date: new Date(values.admission_date).toISOString() } });
      setSelected(request);
      toast.success('Admission confirmed and bed allotted.');
    } catch (error) {
      toast.error(admissionErrorMessage(error));
    }
  });

  const cancel = async () => {
    if (!selected || !cancelReason.trim()) return;
    try {
      const request = await cancelRequest({ id: selected.id, reason: cancelReason.trim() });
      setSelected(request);
      setCancelOpen(false);
      setCancelReason('');
      toast.success('Admission request cancelled.');
    } catch (error) {
      toast.error(admissionErrorMessage(error));
    }
  };

  const uploadConsent = consentForm.handleSubmit(async (values) => {
    if (!selected || !values.file) {
      toast.error('Upload a signed consent document before linking it.');
      return;
    }
    try {
      const document = await submitConsent(selected.patient_id, {
        document_type: 'CONSENT',
        title: values.title,
        file: values.file,
        consent_status: 'SIGNED',
        signed_by_name: values.signed_by_name,
        signed_at: new Date(values.signed_at).toISOString(),
        valid_until: values.valid_until ? new Date(values.valid_until).toISOString() : undefined,
        context_type: 'INPATIENT_ADMISSION',
        context_id: selected.id,
        admission_id: selected.id,
        branch_id: branchId,
        consent_kind: 'INPATIENT_ADMISSION',
      });
      allocationForm.setValue('consent_document_id', document.id);
      setConsentOpen(false);
      consentForm.reset();
      toast.success('Signed admission consent linked.');
    } catch (error) {
      toast.error(admissionErrorMessage(error));
    }
  });

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (filterDepartment && request.department_id !== filterDepartment) return false;
      if (filterAdmissionType && request.admission_type !== filterAdmissionType) return false;
      if (filterPriority && request.priority !== filterPriority) return false;
      if (filterSource && request.source_type !== filterSource) return false;
      if (filterStatus && request.status !== filterStatus) return false;
      return true;
    });
  }, [filterAdmissionType, filterDepartment, filterPriority, filterSource, filterStatus, requests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterDepartment, filterAdmissionType, filterPriority, filterSource, filterStatus, requestSearch]);

  const showDuplicateWarning = Boolean(createValues.patient_id && (activeAdmissionForPatient || pendingRequestForPatient));
  const selectedSourceValue = isLinkedSourceType(selectedSourceType) ? createValues.source_id ?? '' : createValues.patient_id ?? '';

  return (
    <div className="admissions-page">
      <div className="adm-page-head">
        <div>
          <h2>Admission Requests</h2>
          <p>Review requests separately from final inpatient admission.</p>
        </div>
        <div className="adm-actions">
          {branches.length > 1 ? (
            <select
              aria-label="Select Branch"
              className="um-filter"
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setSelected(null);
                updateUrl({ branch_id: event.target.value });
              }}
            >
              {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          ) : null}
          <button className="adm-btn primary" onClick={() => setCreateOpen(true)} type="button">
            <i className="ph ph-plus" /> New Admission Request
          </button>
        </div>
      </div>

      <section className="adm-kpis admission-request-kpis">
        <Kpi icon="ph-hourglass-high" tone="orange" label="Pending Validation" value={counts.pendingValidation} hint="Request intent captured" />
        <Kpi icon="ph-clipboard-text" tone="blue" label="Ready For Confirmation" value={counts.readyForConfirmation} hint="Bed step prepared" />
        <Kpi icon="ph-check-circle" tone="green" label="Confirmed" value={counts.confirmed} hint="Admission created" />
        <Kpi icon="ph-x-circle" tone="red" label="Cancelled" value={counts.cancelled} hint="Closed requests" />
      </section>

      {errors.policy ? (
        <div className="error-state" style={{ marginBottom: '1rem' }}>
          Configure the branch admission policy before validating or confirming requests.
        </div>
      ) : null}

      <div className="adm-filters inpatient-admission-filters">
        <Filter label="Department">
          <select value={filterDepartment} onChange={(event) => { setFilterDepartment(event.target.value); updateUrl({ department_id: event.target.value }); }}>
            <option value="">All</option>
            {departmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Filter>
        <Filter label="Admission Type">
          <select value={filterAdmissionType} onChange={(event) => { setFilterAdmissionType(event.target.value); updateUrl({ admission_type: event.target.value }); }}>
            <option value="">All</option>
            {admissionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Filter>
        <Filter label="Priority">
          <select value={filterPriority} onChange={(event) => { setFilterPriority(event.target.value); updateUrl({ priority: event.target.value }); }}>
            <option value="">All</option>
            {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Filter>
        <Filter label="Source">
          <select value={filterSource} onChange={(event) => { setFilterSource(event.target.value); updateUrl({ source_type: event.target.value }); }}>
            <option value="">All</option>
            {sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            <option value="EMERGENCY_ENCOUNTER">Emergency</option>
          </select>
        </Filter>
        <Filter label="Status">
          <select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); updateUrl({ status: event.target.value }); }}>
            <option value="">All</option>
            {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </Filter>
        <Filter label="Search">
          <input
            placeholder="Patient, MRN, request ID"
            value={requestSearch}
            onChange={(event) => {
              setRequestSearch(event.target.value);
              updateUrl({ search: event.target.value });
            }}
          />
        </Filter>
      </div>

      <div className="adm-requests-layout">
        <div className="adm-card adm-table-wrap">
          <table className="adm-table responsive-table">
            <thead>
              <tr>
                <th className="th-request-id">Request ID</th>
                <th className="th-patient">Patient</th>
                <th className="th-source">Source</th>
                <th className="th-type">Admission Type</th>
                <th className="th-dept">Department</th>
                <th className="th-priority">Priority</th>
                <th className="th-doctor">Requested By</th>
                <th className="th-date">Requested Date</th>
                <th className="th-status">Status</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.requests ? (
                <TableState columns={10} text="Loading admission requests..." />
              ) : errors.requests ? (
                <TableState columns={10} text={admissionErrorMessage(errors.requests)} />
              ) : paginatedRequests.length === 0 ? (
                <TableState columns={10} text="No admission requests match these filters." />
              ) : paginatedRequests.map((request) => (
                <tr key={request.id} className={selected?.id === request.id ? 'selected' : ''} onClick={() => setSelected(request)}>
                  <td className="td-request-id"><strong>{request.request_number}</strong></td>
                  <td className="td-patient">
                    <div className="adm-person">
                      <div className="avatar-box">{initials(request.patient_name)}</div>
                      <span className="patient-name">{request.patient_name}</span>
                    </div>
                  </td>
                  <td className="td-source"><SourceCell request={request} /></td>
                  <td className="td-type">{admissionTypeOptions.find((item) => item.value === request.admission_type)?.label ?? request.admission_type}</td>
                  <td className="td-dept">{request.department_name}</td>
                  <td className="td-priority"><span className={`adm-status ${request.priority.toLowerCase()}`}>{priorityOptions.find((item) => item.value === request.priority)?.label}</span></td>
                  <td className="td-doctor">{request.recommending_doctor_name}</td>
                  <td className="td-date">{formatDateTime(request.created_at)}</td>
                  <td className="td-status"><span className={`adm-status ${statusMeta[request.status].tone}`}>{statusMeta[request.status].label}</span></td>
                  <td className="td-actions">
                    <button className="adm-btn icon" onClick={(event) => { event.stopPropagation(); setSelected(request); }} title="Review request" type="button">
                      <i className="ph ph-eye" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length > 0 ? (
            <div className="bed-pagination">
              <span>Showing {Math.min((page - 1) * pageSize + 1, filteredRequests.length)} to {Math.min(page * pageSize, filteredRequests.length)} of {filteredRequests.length}</span>
              <div>
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><i className="ph ph-caret-left" /></button>
                <strong>Page {page} of {totalPages}</strong>
                <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button"><i className="ph ph-caret-right" /></button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AdmissionRequestDetailModal
        request={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        allocationForm={allocationForm}
        wards={wards}
        beds={beds}
        policy={policy}
        loadingConfiguration={loading.configuration}
        pending={pending}
        admissions={admissions}
        onValidate={validate}
        onConfirm={confirm}
        onCancel={() => setCancelOpen(true)}
        onConsent={() => setConsentOpen(true)}
      />

      <NewAdmissionRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        createForm={createForm}
        onSubmit={createRequest}
        patientSearch={patientSearch}
        setPatientSearch={setPatientSearch}
        selectedSourceType={selectedSourceType}
        onSourceChange={handleSourceChange}
        selectedSourceValue={selectedSourceValue}
        onPatientSelect={handlePatientSelect}
        availablePatients={availablePatients}
        selectedPatientOption={selectedPatientOption}
        departmentOptions={departmentOptions}
        doctorOptions={doctorOptions}
        selectedDepartment={selectedDepartment}
        selectedDoctor={selectedDoctor}
        activeAdmissionForPatient={activeAdmissionForPatient}
        pendingRequestForPatient={pendingRequestForPatient}
        showDuplicateWarning={showDuplicateWarning}
        loadingModalPatients={loading.modalPatients}
        pendingCreate={pending.createRequest}
        branchId={branchId}
      />

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Admission Request">
        <label className="admission-input-group">
          <span>Cancellation Reason <span className="required-asterisk">*</span></span>
          <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} placeholder="Record why this request is being cancelled" />
        </label>
        <div className="modal-footer-actions">
          <button className="btn-secondary" onClick={() => setCancelOpen(false)} type="button">Keep Request</button>
          <button className="btn-danger" onClick={cancel} disabled={!cancelReason.trim() || pending.cancelRequest} type="button">Cancel Request</button>
        </div>
      </Modal>

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Link Admission Consent" layer="top">
        <form className="modal-form-grid" onSubmit={uploadConsent}>
          <label className="span-2">Document Title <span className="required-asterisk">*</span><input {...consentForm.register('title')} /></label>
          <label>Signer / Guardian <span className="required-asterisk">*</span><input {...consentForm.register('signed_by_name')} /></label>
          <label>Signed At <span className="required-asterisk">*</span><input type="datetime-local" {...consentForm.register('signed_at')} /></label>
          <label>Valid Until<input type="datetime-local" {...consentForm.register('valid_until')} /></label>
          <label className="span-2">Consent File <span className="required-asterisk">*</span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) consentForm.setValue('file', file, { shouldValidate: true }); }} /></label>
          <div className="span-2 modal-footer-actions">
            <button className="btn-secondary" onClick={() => setConsentOpen(false)} type="button">Close</button>
            <button className="btn-primary" disabled={pending.uploadConsent} type="submit">Upload And Link</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({ icon, tone, label, value, hint }: { icon: string; tone: string; label: string; value: number; hint: string }) {
  return (
    <div className="adm-kpi">
      <div className={`adm-kpi-icon ${tone}`}><i className={`ph ${icon}`} /></div>
      <div className="adm-kpi-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="adm-field"><label>{label}</label>{children}</div>;
}

function SourceCell({ request }: { request: AdmissionRequest }) {
  return (
    <span>
      {sourceLabels[request.source_type]}
      {request.source_reference ? <small style={{ display: 'block', color: '#64748b' }}>{request.source_reference}</small> : null}
    </span>
  );
}

function TableState({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="empty-state">{text}</td></tr>;
}
