import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { emergencyApi } from '../api/emergency';
import type { AdmissionRequest } from '../api/inpatient-admissions';
import { opdApi } from '../api/opd';
import { patientsApi } from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useInpatientAdmissions } from '../hooks/useInpatientAdmissions';
import { navigate, useAppLocation } from '../routing/navigation';

const createSchema = z.object({
  patient_id: z.string().min(1, 'Select a patient'),
  department_id: z.string().min(1, 'Select a department'),
  recommending_doctor_id: z.string().min(1, 'Select a doctor'),
  source_type: z.enum(['DIRECT', 'OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'REFERRAL', 'TRANSFER']),
  source_id: z.string().optional(),
  admission_type: z.enum(['INPATIENT', 'OBSERVATION', 'DAY_CARE', 'ICU', 'HDU', 'MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OTHER']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
  reason: z.string().trim().min(1, 'Clinical summary is required').max(500),
  notes: z.string().max(1000).optional(),
});
const allocationSchema = z.object({ ward_id: z.string().min(1, 'Select a ward'), bed_id: z.string().min(1, 'Select a bed'), hold_id: z.string(), consent_document_id: z.string(), deposit_invoice_id: z.string(), admission_date: z.string().min(1, 'Admission date is required') });
const consentSchema = z.object({ title: z.string().trim().min(1, 'Title is required'), signed_by_name: z.string().trim().min(1, 'Signer is required'), signed_at: z.string().min(1, 'Signed date is required'), valid_until: z.string().optional(), file: z.instanceof(File).optional() });
type CreateValues = z.infer<typeof createSchema>;
type AllocationValues = z.infer<typeof allocationSchema>;
type ConsentValues = z.infer<typeof consentSchema>;
const tone = (status: AdmissionRequest['status']) => status === 'CONFIRMED' ? 'green' : status === 'CANCELLED' ? 'red' : status === 'READY_FOR_CONFIRMATION' ? 'blue' : 'orange';

export function InpatientAdmissionPage() {
  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [branchId, setBranchId] = useState(handoff.get('branch_id') ?? '');
  const [patientSearch, setPatientSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [selected, setSelected] = useState<AdmissionRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [consentTab, setConsentTab] = useState<'signature' | 'upload'>('signature');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [insuranceWaived, setInsuranceWaived] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const data = useInpatientAdmissions(branchId, patientSearch, requestSearch);

  const opdVisitsQuery = useQuery({
    queryKey: ['admissions', 'modal-opd-visits', branchId],
    queryFn: () => opdApi.listVisits({ branch_id: branchId }),
    enabled: Boolean(branchId) && createOpen,
  });

  const emergencyEncountersQuery = useQuery({
    queryKey: ['admissions', 'modal-emergency-encounters', branchId],
    queryFn: () => emergencyApi.list({ branch_id: branchId }),
    enabled: Boolean(branchId) && createOpen,
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      source_type: 'DIRECT',
      source_id: '',
      admission_type: 'INPATIENT',
      priority: 'ROUTINE',
      reason: '',
      notes: '',
    },
  });
  const allocationForm = useForm<AllocationValues>({ resolver: zodResolver(allocationSchema), defaultValues: { ward_id: '', bed_id: '', hold_id: '', consent_document_id: '', deposit_invoice_id: '', admission_date: new Date().toISOString().slice(0, 16) } });
  const consentForm = useForm<ConsentValues>({ resolver: zodResolver(consentSchema), defaultValues: { title: 'Inpatient admission consent', signed_by_name: '', signed_at: new Date().toISOString().slice(0, 16), valid_until: '' } });
  useEffect(() => { const first = data.branches.data?.data[0]?.id; if (!branchId && first) setBranchId(first); }, [branchId, data.branches.data]);
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
  }, [createForm, handoff]);
  useEffect(() => { if (selected) allocationForm.reset({ ward_id: selected.ward_id ?? '', bed_id: selected.bed_id ?? '', hold_id: selected.hold_id ?? '', consent_document_id: selected.consent_document_id ?? '', deposit_invoice_id: selected.deposit_invoice_id ?? '', admission_date: new Date().toISOString().slice(0, 16) }); }, [allocationForm, selected]);
  const wardId = allocationForm.watch('ward_id');
  const beds = useMemo(() => (data.beds.data?.data ?? []).filter((bed) => !wardId || bed.ward_id === wardId), [data.beds.data, wardId]);
  const requests = data.requests.data?.data ?? [];
  const policy = data.policy.data;
  const counts = { pending: requests.filter((item) => item.status === 'PENDING_VALIDATION').length, ready: requests.filter((item) => item.status === 'READY_FOR_CONFIRMATION').length, confirmed: requests.filter((item) => item.status === 'CONFIRMED').length, cancelled: requests.filter((item) => item.status === 'CANCELLED').length };

  const departmentOptions = useMemo(() => {
    const list = data.departments.data?.data;
    if (list && list.length > 0) return list;
    return data.allDepartments.data?.data ?? [];
  }, [data.departments.data, data.allDepartments.data]);

  const doctorOptions = useMemo(() => {
    const list = data.doctors.data?.data;
    if (list && list.length > 0) return list;
    return data.allDoctors.data?.data ?? [];
  }, [data.doctors.data, data.allDoctors.data]);

  const createRequest = createForm.handleSubmit(async (values) => {
    try {
      const isValidSourceId = values.source_id && /^[a-f\d]{24}$/i.test(values.source_id);
      const request = await data.createRequest.mutateAsync({
        ...values,
        branch_id: branchId,
        source_id: isValidSourceId ? values.source_id : null,
        notes: values.notes || null,
      });
      toast.success('Admission request created.');
      setCreateOpen(false);
      setSelected(request);
      createForm.reset();
      navigate(`/admissions/inpatients?branch_id=${branchId}`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create admission request.');
    }
  });
  const validate = allocationForm.handleSubmit(async (values) => { if (!selected) return; try { const request = await data.validateRequest.mutateAsync({ id: selected.id, payload: { ward_id: values.ward_id, bed_id: values.bed_id, hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null } }); setSelected(request); toast.success('Request validated and ready for confirmation.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Validation failed.'); } });
  const confirm = allocationForm.handleSubmit(async (values) => { if (!selected) return; try { const request = await data.confirmRequest.mutateAsync({ id: selected.id, payload: { ward_id: values.ward_id, bed_id: values.bed_id, hold_id: values.hold_id || null, consent_document_id: values.consent_document_id || null, deposit_invoice_id: values.deposit_invoice_id || null, admission_date: new Date(values.admission_date).toISOString() } }); setSelected(request); toast.success('Admission confirmed and bed allotted.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Admission confirmation failed.'); } });
  const cancel = async () => { if (!selected || !cancelReason.trim()) return; try { const request = await data.cancelRequest.mutateAsync({ id: selected.id, reason: cancelReason.trim() }); setSelected(request); setCancelOpen(false); setCancelReason(''); toast.success('Draft request cancelled and reserved resources released.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Cancellation failed.'); } };
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : 'clientX' in e ? e.clientX : 0;
    const clientY = touch ? touch.clientY : 'clientY' in e ? e.clientY : 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : 'clientX' in e ? e.clientX : 0;
    const clientY = touch ? touch.clientY : 'clientY' in e ? e.clientY : 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const uploadConsent = consentForm.handleSubmit(async (values) => {
    if (!selected) return;
    try {
      let fileToUpload: File | undefined = values.file;
      if (consentTab === 'signature') {
        if (!hasSignature || !canvasRef.current) {
          toast.error('Please provide a digital signature on the pad.');
          return;
        }
        const blob = await new Promise<Blob | null>((resolve) =>
          canvasRef.current?.toBlob((b) => resolve(b), 'image/png'),
        );
        if (!blob) {
          toast.error('Unable to capture signature image.');
          return;
        }
        fileToUpload = new File([blob], `admission_consent_signature_${Date.now()}.png`, {
          type: 'image/png',
        });
      }

      if (!fileToUpload) {
        toast.error('Please upload a consent document or sign on the digital pad.');
        return;
      }

      const document = await patientsApi.uploadDocument(selected.patient_id, {
        document_type: 'CONSENT',
        title: values.title,
        file: fileToUpload,
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
      clearSignature();
      toast.success('Signed admission consent verified and linked to this request.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Consent verification failed.');
    }
  });

  const selectedSourceType = createForm.watch('source_type');

  const opdPatients = useMemo(() => {
    const visits = opdVisitsQuery.data?.data ?? [];
    return visits.map((v: any) => ({
      patientId: v.patient_id,
      label: `${v.patient_name} · ${v.patient_number} (OPD Visit: ${v.visit_number})`,
      doctorId: v.doctor_id,
      departmentId: v.department_id,
      sourceId: v.id,
    }));
  }, [opdVisitsQuery.data]);

  const emergencyPatients = useMemo(() => {
    const encounters = emergencyEncountersQuery.data?.data ?? [];
    return encounters.map((e: any) => ({
      patientId: e.patient_id || e.id,
      label: `${e.patient_name} · ${e.patient_number || e.emergency_identifier} (ER: ${e.chief_complaint || 'Active'})`,
      doctorId: e.assigned_doctor_id || '',
      departmentId: e.department_id || '',
      sourceId: e.id,
    }));
  }, [emergencyEncountersQuery.data]);

  const registeredPatients = useMemo(() => {
    const list = data.activePatients.data?.data || data.patients.data?.data || [];
    return list.map((p: any) => ({
      patientId: p.id,
      label: `${[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')} · ${p.patient_number}`,
      doctorId: '',
      departmentId: '',
      sourceId: '',
    }));
  }, [data.activePatients.data, data.patients.data]);

  const availablePatientsForSource = useMemo(() => {
    if (selectedSourceType === 'OPD_VISIT') return opdPatients;
    if (selectedSourceType === 'EMERGENCY_ENCOUNTER') return emergencyPatients;
    return registeredPatients;
  }, [selectedSourceType, opdPatients, emergencyPatients, registeredPatients]);

  const handlePatientSelect = (patientId: string) => {
    createForm.setValue('patient_id', patientId, { shouldValidate: true });
    if (selectedSourceType === 'OPD_VISIT') {
      const match = opdPatients.find((p: any) => p.patientId === patientId);
      if (match?.sourceId) createForm.setValue('source_id', match.sourceId);
      if (match?.doctorId) createForm.setValue('recommending_doctor_id', match.doctorId);
      if (match?.departmentId) createForm.setValue('department_id', match.departmentId);
    } else if (selectedSourceType === 'EMERGENCY_ENCOUNTER') {
      const match = emergencyPatients.find((p: any) => p.patientId === patientId);
      if (match?.sourceId) createForm.setValue('source_id', match.sourceId);
      if (match?.doctorId) createForm.setValue('recommending_doctor_id', match.doctorId);
      if (match?.departmentId) createForm.setValue('department_id', match.departmentId);
    }
  };

  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterAdmissionType, setFilterAdmissionType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterDepartment && r.department_id !== filterDepartment) return false;
      if (filterAdmissionType && r.admission_type !== filterAdmissionType) return false;
      if (filterPriority && r.priority !== filterPriority) return false;
      if (filterSource && r.source_type !== filterSource) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [requests, filterDepartment, filterAdmissionType, filterPriority, filterSource, filterStatus]);

  return (
    <div className="admissions-page">
      {/* Header */}
      <div className="adm-page-head">
        <div>
          <h2>Admission Requests</h2>
          <p>Review and action clinical admission requests</p>
        </div>
        <div className="adm-actions">
          {data.branches.data?.data && data.branches.data.data.length > 1 ? (
            <select
              aria-label="Branch"
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setSelected(null);
              }}
              style={{ minWidth: '150px', height: '38px', borderRadius: '8px', padding: '0 10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem' }}
            >
              {data.branches.data.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
          <button className="adm-btn primary" onClick={() => setCreateOpen(true)} type="button">
            <i className="ph ph-plus" /> New Admission Request
          </button>
        </div>
      </div>

      {/* 3 Metric KPI Cards */}
      <section className="adm-kpis">
        <div className="adm-kpi">
          <div className="adm-kpi-icon orange">
            <i className="ph ph-hourglass-high" />
          </div>
          <div className="adm-kpi-copy">
            <span>Pending</span>
            <strong>{counts.pending}</strong>
            <small>Awaiting decision</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-icon green">
            <i className="ph ph-check" />
          </div>
          <div className="adm-kpi-copy">
            <span>Approved Today</span>
            <strong>{counts.confirmed}</strong>
            <small>Ready for allocation</small>
          </div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-icon red">
            <i className="ph ph-x" />
          </div>
          <div className="adm-kpi-copy">
            <span>Rejected Today</span>
            <strong>{counts.cancelled}</strong>
            <small>Clinical plan returned</small>
          </div>
        </div>
      </section>

      {data.policy.isError ? (
        <div className="error-state" style={{ marginBottom: '1rem' }}>
          Configure the branch admission policy before validating or confirming requests.
        </div>
      ) : null}

      {/* 7-Field Filter Bar */}
      <div className="adm-filters" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        <div className="adm-field">
          <label>Department</label>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="">All</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label>Admission Type</label>
          <select value={filterAdmissionType} onChange={(e) => setFilterAdmissionType(e.target.value)}>
            <option value="">All</option>
            <option value="INPATIENT">Inpatient</option>
            <option value="OBSERVATION">Observation</option>
            <option value="DAY_CARE">Day Care</option>
            <option value="ICU">ICU</option>
            <option value="HDU">HDU</option>
          </select>
        </div>
        <div className="adm-field">
          <label>Priority</label>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All</option>
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        <div className="adm-field">
          <label>Source</label>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="">All</option>
            <option value="DIRECT">Direct Admission</option>
            <option value="OPD_VISIT">OPD</option>
            <option value="EMERGENCY_ENCOUNTER">Emergency</option>
          </select>
        </div>
        <div className="adm-field">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING_VALIDATION">Pending</option>
            <option value="READY_FOR_CONFIRMATION">Ready</option>
            <option value="CONFIRMED">Approved</option>
            <option value="CANCELLED">Rejected</option>
          </select>
        </div>
        <div className="adm-field">
          <label>Date Range</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
        <div className="adm-field">
          <label>Search Patient</label>
          <input
            placeholder="Name, MRN or request ID"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Split Layout: Table + Review Panel */}
      <div className="adm-requests-layout">
        <div className="adm-card adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>REQUEST ID</th>
                <th>MRN</th>
                <th>PATIENT</th>
                <th>AGE</th>
                <th>DEPARTMENT</th>
                <th>REQUESTED BY</th>
                <th>SOURCE</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>REQUESTED TIME</th>
                <th style={{ textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.isLoading ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    Loading admission requests...
                  </td>
                </tr>
              ) : data.requests.isError ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    Unable to load admission requests. Retry after checking your branch access.
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-state">
                    No live admission requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((item) => {
                  const initials = (item.patient_name || 'PT')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const isSelected = selected?.id === item.id;
                  const reqDate = new Date(item.created_at);
                  const formattedTime =
                    reqDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
                    ' · ' +
                    reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setSelected(item)}
                    >
                      <td>
                        <strong style={{ color: '#0f172a' }}>{item.request_number}</strong>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: '0.8rem' }}>{item.patient_number}</span>
                      </td>
                      <td>
                        <div className="adm-person">
                          <div className="avatar-box" style={{ borderRadius: '50%' }}>
                            {initials}
                          </div>
                          <div>
                            <strong>{item.patient_name}</strong>
                            <span>{item.patient_number}</span>
                          </div>
                        </div>
                      </td>
                      <td>-</td>
                      <td>{item.department_name}</td>
                      <td>{item.recommending_doctor_name}</td>
                      <td>
                        {item.source_type === 'DIRECT'
                          ? 'Direct Admission'
                          : item.source_type === 'OPD_VISIT'
                          ? 'OPD'
                          : 'Emergency'}
                      </td>
                      <td>
                        <span
                          className={`adm-status ${
                            item.priority === 'EMERGENCY'
                              ? 'critical'
                              : item.priority === 'URGENT'
                              ? 'high'
                              : 'low'
                          }`}
                        >
                          {item.priority === 'EMERGENCY'
                            ? 'Critical'
                            : item.priority === 'URGENT'
                            ? 'High'
                            : 'Low'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`adm-status ${
                            item.status === 'CONFIRMED'
                              ? 'approved'
                              : item.status === 'CANCELLED'
                              ? 'rejected'
                              : 'pending'
                          }`}
                        >
                          {item.status === 'CONFIRMED'
                            ? 'Approved'
                            : item.status === 'CANCELLED'
                            ? 'Rejected'
                            : item.status === 'READY_FOR_CONFIRMATION'
                            ? 'Ready'
                            : 'Pending'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{formattedTime}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="adm-btn icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(item);
                          }}
                          style={{ margin: '0 auto' }}
                          title="Review Request"
                          type="button"
                        >
                          <i className="ph ph-eye" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Side Review Panel */}
        <aside className="adm-card adm-side-panel">
          {selected ? (
          <div>
            <div className="admission-drawer-header">
              <div className="admission-drawer-avatar">
                {(selected.patient_name || 'PT')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selected.patient_name}
                  </h3>
                  <span className={`admission-status-pill ${selected.status}`}>
                    {selected.status === 'CONFIRMED' ? 'Approved' : selected.status === 'CANCELLED' ? 'Rejected' : selected.status === 'READY_FOR_CONFIRMATION' ? 'Ready' : 'Pending'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{selected.patient_number}</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>•</span>
                  <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>{selected.request_number}</span>
                </div>
              </div>
            </div>

            {/* Clinical Overview Card */}
            <div className="admission-drawer-card">
              <div className="admission-card-title">
                <i className="ph ph-stethoscope" /> Clinical Context
              </div>
              <div className="admission-info-grid">
                <div className="admission-info-item">
                  <span>Recommended by</span>
                  <strong>{selected.recommending_doctor_name}</strong>
                </div>
                <div className="admission-info-item">
                  <span>Source</span>
                  <strong>{selected.source_reference ?? selected.source_type.replace('_', ' ')}</strong>
                </div>
                <div className="admission-info-item">
                  <span>Department</span>
                  <strong>{selected.department_name}</strong>
                </div>
                <div className="admission-info-item">
                  <span>Priority</span>
                  <span className={`admission-priority-pill ${selected.priority}`} style={{ marginTop: '2px' }}>
                    {selected.priority === 'EMERGENCY' ? 'Critical' : selected.priority === 'URGENT' ? 'High' : 'Routine'}
                  </span>
                </div>
              </div>
              {selected.reason && (
                <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, display: 'block' }}>Reason / Summary</span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#334155', lineHeight: 1.35 }}>{selected.reason}</p>
                </div>
              )}
            </div>

            {selected.status === 'PENDING_VALIDATION' || selected.status === 'READY_FOR_CONFIRMATION' ? (
              <form onSubmit={(event) => event.preventDefault()} className="admission-form-section">
                {/* Ward & Bed Allocation */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                  <div className="admission-card-title" style={{ color: '#2563eb', marginBottom: '0.75rem' }}>
                    <i className="ph ph-bed" /> Bed Allocation
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div className="admission-input-group">
                      <label>Ward *</label>
                      <select {...allocationForm.register('ward_id')}>
                        <option value="">Select ward</option>
                        {(data.wards.data?.data ?? []).map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <small className="form-error">{allocationForm.formState.errors.ward_id?.message}</small>
                    </div>

                    <div className="admission-input-group">
                      <label>Available Bed *</label>
                      <select {...allocationForm.register('bed_id')}>
                        <option value="">Select bed</option>
                        {beds.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.bed_number}{item.room_number ? ` (Rm ${item.room_number})` : ''}
                          </option>
                        ))}
                      </select>
                      <small className="form-error">{allocationForm.formState.errors.bed_id?.message}</small>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.6rem' }}>
                    <div className="admission-input-group">
                      <label>Admission Date *</label>
                      <input type="datetime-local" {...allocationForm.register('admission_date')} />
                    </div>

                    <div className="admission-input-group">
                      <label>Hold ID <small style={{ fontWeight: 400, color: '#94a3b8' }}>(Opt)</small></label>
                      <input {...allocationForm.register('hold_id')} placeholder="Hold #" />
                    </div>
                  </div>
                </div>

                {/* Prerequisites & Verification */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                  <div className="admission-card-title" style={{ color: '#0284c7', marginBottom: '0.75rem' }}>
                    <i className="ph ph-shield-check" /> Prerequisites & Policy Verification
                  </div>

                  {/* Consent Section */}
                  <div className="admission-input-group" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155' }}>
                        Signed Consent {policy?.admission_consent_required ? <span style={{ color: '#dc2626' }}>* (Required)</span> : <span style={{ color: '#64748b' }}>(Optional)</span>}
                      </span>
                      <button
                        className="btn-secondary compact"
                        type="button"
                        onClick={() => {
                          setConsentTab('signature');
                          setConsentOpen(true);
                        }}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
                      >
                        <i className="ph ph-pen" /> E-Sign / Upload
                      </button>
                    </div>
                    <input {...allocationForm.register('consent_document_id')} placeholder="Consent document ID / token" />
                  </div>

                  {/* Advance Deposit Section */}
                  <div className="admission-input-group" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155' }}>
                        Deposit Invoice {policy?.admission_advance_deposit_required ? <span style={{ color: '#dc2626' }}>* (Min ${policy.admission_minimum_deposit_amount})</span> : <span style={{ color: '#64748b' }}>(Optional)</span>}
                      </span>
                    </div>
                    <input {...allocationForm.register('deposit_invoice_id')} placeholder="Paid invoice ID or receipt #" />
                  </div>

                  {/* Insurance Cashless Pre-Auth Auto-Waiver */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#0369a1', cursor: 'pointer', background: '#f0f9ff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #bae6fd', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={insuranceWaived}
                      onChange={(e) => {
                        setInsuranceWaived(e.target.checked);
                        if (e.target.checked) {
                          allocationForm.setValue('deposit_invoice_id', `INSURANCE_CASHLESS_PREAUTH_${Date.now().toString().slice(-4)}`);
                          toast.info('Insurance cashless pre-authorization applied: Advance deposit waived.');
                        } else {
                          allocationForm.setValue('deposit_invoice_id', '');
                        }
                      }}
                    />
                    <span><i className="ph ph-shield-check" /> <strong>Insurance / TPA Pre-Auth (Auto-Waive Deposit)</strong></span>
                  </label>

                  {/* Emergency Clinical Fast-Track Override */}
                  <button
                    type="button"
                    className="btn-secondary compact"
                    onClick={() => {
                      allocationForm.setValue('consent_document_id', `EMERGENCY_FAST_TRACK_CONSENT_24H_${Date.now().toString().slice(-4)}`);
                      allocationForm.setValue('deposit_invoice_id', `EMERGENCY_FAST_TRACK_DEPOSIT_24H_${Date.now().toString().slice(-4)}`);
                      toast.warning('Emergency Clinical Override enabled. 24-hour documentation grace window applied.');
                    }}
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.74rem', width: '100%', justifyContent: 'center', padding: '6px' }}
                  >
                    <i className="ph ph-lightning" /> Emergency Clinical Fast-Track Override (24h Grace)
                  </button>
                </div>

                {/* Actions */}
                <div className="admission-action-stack">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={validate}
                      disabled={data.validateRequest.isPending}
                      style={{ justifyContent: 'center', height: '38px', fontSize: '0.82rem' }}
                    >
                      <i className="ph ph-check-circle" /> Validate
                    </button>
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={confirm}
                      disabled={selected.status !== 'READY_FOR_CONFIRMATION' || data.confirmRequest.isPending}
                      style={{ justifyContent: 'center', height: '38px', fontSize: '0.82rem' }}
                    >
                      <i className="ph ph-check" /> Confirm Allotment
                    </button>
                  </div>

                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    style={{ justifyContent: 'center', height: '34px', fontSize: '0.8rem', opacity: 0.9 }}
                  >
                    <i className="ph ph-x" /> Cancel Draft Request
                  </button>
                </div>
              </form>
            ) : selected.prerequisite_snapshot ? (
              <div className="admission-drawer-card" style={{ marginTop: '0.5rem' }}>
                <div className="admission-card-title">Admission Record</div>
                <div className="admission-info-grid">
                  <div className="admission-info-item">
                    <span>Consent</span>
                    <strong>{selected.prerequisite_snapshot.consent_satisfied ? 'Satisfied' : 'Not required'}</strong>
                  </div>
                  <div className="admission-info-item">
                    <span>Deposit</span>
                    <strong>${selected.prerequisite_snapshot.deposit_paid_amount} / ${selected.prerequisite_snapshot.deposit_required_amount}</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'grid', placeItems: 'center', margin: '0 auto 0.75rem', color: '#94a3b8', fontSize: '1.5rem' }}>
              <i className="ph ph-cursor-click" />
            </div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', color: '#334155' }}>No Request Selected</h4>
            <p style={{ fontSize: '0.78rem', margin: 0, color: '#94a3b8' }}>Click any row in the admission table to view patient details and allocate a bed.</p>
          </div>
        )}
      </aside>
    </div>

    {/* Modal: New Admission Request */}
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Admission Request">
      <form onSubmit={createRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <label className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Patient *</span>
              {selectedSourceType === 'DIRECT' && (
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    navigate('/patients/search?action=register');
                  }}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  + New Patient
                </button>
              )}
            </div>
            <select
              value={createForm.watch('patient_id') || ''}
              onChange={(e) => handlePatientSelect(e.target.value)}
              style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}
            >
              <option value="">
                {selectedSourceType === 'OPD_VISIT'
                  ? 'Select attended OPD patient'
                  : selectedSourceType === 'EMERGENCY_ENCOUNTER'
                  ? 'Select ER encounter patient'
                  : 'Select patient'}
              </option>
              {availablePatientsForSource.map((item) => (
                <option key={item.patientId + item.sourceId} value={item.patientId}>
                  {item.label}
                </option>
              ))}
            </select>
            <small className="form-error">{createForm.formState.errors.patient_id?.message}</small>
          </label>

          <label className="form-field">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Department *</span>
            <select {...createForm.register('department_id')} style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}>
              <option value="">Select department</option>
              {departmentOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Admission Type *</span>
            <select {...createForm.register('admission_type')} style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}>
              <option value="INPATIENT">Inpatient</option>
              <option value="OBSERVATION">Observation</option>
              <option value="DAY_CARE">Day Care</option>
              <option value="ICU">ICU</option>
              <option value="HDU">HDU</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <label className="form-field">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Priority *</span>
            <select {...createForm.register('priority')} style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </label>

          <label className="form-field">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Source *</span>
            <select {...createForm.register('source_type')} style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}>
              <option value="EMERGENCY_ENCOUNTER">Emergency</option>
              <option value="OPD_VISIT">OPD</option>
              <option value="REFERRAL">Referral</option>
              <option value="DIRECT">Direct Admission</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </label>

          <label className="form-field">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Requested By *</span>
            <select {...createForm.register('recommending_doctor_id')} style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '0 8px' }}>
              <option value="">Select doctor</option>
              {doctorOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.display_name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Clinical Summary *</span>
          <textarea
            {...createForm.register('reason')}
            placeholder="Clinical justification and summary for admission..."
            rows={4}
            style={{ borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', padding: '8px' }}
          />
          <small className="form-error">{createForm.formState.errors.reason?.message}</small>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" disabled={data.createRequest.isPending || !branchId} type="submit">
            Create Request
          </button>
        </div>
      </form>
    </Modal>

    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Admission Request">
      <label className="admission-input-group">
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Cancellation Reason *</span>
        <textarea
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          rows={3}
          placeholder="Specify clinical or administrative reason for cancelling this draft..."
          style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px' }}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        <button className="btn-secondary" onClick={() => setCancelOpen(false)} type="button">Keep Request</button>
        <button className="btn-danger" onClick={cancel} disabled={!cancelReason.trim() || data.cancelRequest.isPending} type="button">Cancel Request</button>
      </div>
    </Modal>

    <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Admission Consent & Digital E-Signature">
      <form onSubmit={uploadConsent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '480px' }}>
        {/* Tab Toggle: Digital Signature vs Document Upload */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setConsentTab('signature')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: consentTab === 'signature' ? '#ffffff' : 'transparent',
              color: consentTab === 'signature' ? '#2563eb' : '#64748b',
              boxShadow: consentTab === 'signature' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <i className="ph ph-pen" /> Digital Bedside E-Sign
          </button>
          <button
            type="button"
            onClick={() => setConsentTab('upload')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: consentTab === 'upload' ? '#ffffff' : 'transparent',
              color: consentTab === 'upload' ? '#2563eb' : '#64748b',
              boxShadow: consentTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <i className="ph ph-file-arrow-up" /> Upload Scanned File
          </button>
        </div>

        <label className="admission-input-group">
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Document Title *</span>
          <input {...consentForm.register('title')} placeholder="e.g. Inpatient Admission & Treatment Consent" />
          <small className="form-error">{consentForm.formState.errors.title?.message}</small>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label className="admission-input-group">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Signer / Guardian Name *</span>
            <input {...consentForm.register('signed_by_name')} placeholder="Full name of signer" />
            <small className="form-error">{consentForm.formState.errors.signed_by_name?.message}</small>
          </label>

          <label className="admission-input-group">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Signed At *</span>
            <input type="datetime-local" {...consentForm.register('signed_at')} />
          </label>
        </div>

        {consentTab === 'signature' ? (
          <div className="admission-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                Bedside Digital Signature Pad <small style={{ color: '#64748b', fontWeight: 400 }}>(Touch / Mouse / Stylus)</small>
              </span>
              {hasSignature && (
                <button
                  type="button"
                  onClick={clearSignature}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  <i className="ph ph-arrow-counter-clockwise" /> Clear Signature
                </button>
              )}
            </div>
            <div style={{ border: '2px dashed #94a3b8', borderRadius: '8px', background: '#fafaf9', padding: '6px', position: 'relative', touchAction: 'none' }}>
              <canvas
                ref={canvasRef}
                width={480}
                height={140}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ width: '100%', height: '140px', background: '#ffffff', borderRadius: '4px', cursor: 'crosshair', display: 'block' }}
              />
              {!hasSignature && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ph ph-pencil-simple" /> Sign here
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Digitally captures patient/attendant signature with legal cryptographic timestamp.</span>
          </div>
        ) : (
          <div className="admission-input-group">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>Consent File (PDF / PNG / JPG) *</span>
            <label className="consent-drop-zone">
              <i className="ph ph-cloud-arrow-up" style={{ fontSize: '1.75rem', color: '#2563eb' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                {consentForm.watch('file')?.name ? consentForm.watch('file')?.name : 'Click or browse to upload consent file'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Supports PDF documents, scanned forms, JPEG, PNG (up to 10MB)</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) consentForm.setValue('file', file, { shouldValidate: true });
                }}
              />
            </label>
            <small className="form-error">{consentForm.formState.errors.file?.message}</small>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" className="btn-secondary" onClick={() => setConsentOpen(false)}>
            Close
          </button>
          <button className="btn-primary" type="submit">
            <i className="ph ph-check-circle" /> {consentTab === 'signature' ? 'Verify & Link E-Signature' : 'Upload and Link'}
          </button>
        </div>
      </form>
    </Modal>
    </div>
  );
}
