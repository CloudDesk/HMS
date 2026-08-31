import { useState, useMemo, type FormEvent } from 'react';
import { type BillingInvoice } from '../api/billing';
import { type DiagnosticOrder } from '../api/laboratory';
import { type OpdPrescriptionResponse } from '../api/opd';
import {
  type ApiPatientDocumentType,
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientHistoryResponse,
  type PatientDocumentResponse,
  type PatientResponse,
  type PatientTimelineEventResponse,
} from '../api/patients';
import { useCurrencyFormatter } from '../api/useSettings';
import { useAuth } from '../auth/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PatientCardModal } from '../components/patients/PatientCardModal';
import { PatientDocumentUploadModal } from '../components/patients/PatientDocumentUploadModal';
import { PatientEditModal, updatePatientSchema, type UpdatePatientForm } from '../components/patients/PatientEditModal';
import { PatientProfileHeader } from '../components/patients/PatientProfileHeader';
import { PatientProfileTabContent } from '../components/patients/PatientProfileTabContent';
import { PrintBillingModal } from '../components/print/PrintBillingModal';
import { PrintImagingOrderModal } from '../components/print/PrintImagingOrderModal';
import { PrintLabOrderModal } from '../components/print/PrintLabOrderModal';
import { PrintPrescriptionModal } from '../components/print/PrintPrescriptionModal';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import { usePatientProfileFeature, type PatientProfileTab } from '../hooks/patients/usePatientProfileFeature';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage, getPatientIdFromSearch, patientFullName, patientInitials, formatDate, formatDateTime } from './patient-utils';

const tabs = [
  'Overview',
  'EMR Timeline',
  'Visits',
  'Appointments',
  'Prescriptions',
  'Lab Results',
  'Imaging',
  'Documents',
  'Billing',
  'Consent',
] as const;

const calculateAge = (dob: string) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  return `${years} years`;
};

// removed toForm


// ── EMR helper functions (mirrored from PatientEmrTimelinePage) ──────────────

const getEventIcon = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'ph ph-stethoscope';
  if (eventType === 'PROFILE_UPDATED') return 'ph ph-user-switch';
  if (eventType === 'CONSENT_ADDED') return 'ph ph-pill';
  if (eventType === 'DOCUMENT_ADDED') return 'ph ph-flask';
  if (eventType === 'DOCUMENT_DELETED') return 'ph ph-trash';
  if (eventType === 'DOCUMENT_REVIEWED') return 'ph ph-file-check';
  return 'ph ph-file-text';
};

const getEventCategoryName = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'Consultation';
  if (eventType === 'PROFILE_UPDATED') return 'OPD Visit';
  if (eventType === 'CONSENT_ADDED') return 'Prescription';
  if (eventType === 'DOCUMENT_ADDED') return 'Lab Results';
  if (eventType === 'DOCUMENT_DELETED') return 'Document Removed';
  if (eventType === 'DOCUMENT_REVIEWED') return 'Document Review';
  return 'Clinical Note';
};

const getEventStatusBadge = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return { label: 'Completed', class: 'completed' };
  if (eventType === 'DOCUMENT_ADDED') return { label: 'Results Ready', class: 'completed' };
  if (eventType === 'DOCUMENT_REVIEWED') return { label: 'Reviewed', class: 'completed' };
  if (eventType === 'CONSENT_ADDED') return { label: 'Active', class: 'active' };
  return { label: 'Recorded', class: 'draft' };
};

function EmptyRecords({ message }: { message: string }) {
  return <div className="patient-empty-inline">{message}</div>;
}

// ── EMR Timeline Tab (inline, Option B) ─────────────────────────────────────

type EmrTabProps = {
  patientId: string;
  loading: boolean;
  loadError: string;
  timeline: PatientTimelineEventResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: { from: string; to: string };
  setFilters: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  currentPage: number;
  setCurrentPage: (val: number) => void;
};

function EmrTimelineTab({ loading, loadError, timeline, meta, filters, setFilters, currentPage, setCurrentPage }: EmrTabProps) {
  const [selectedDetails, setSelectedDetails] = useState<PatientTimelineEventResponse | null>(null);

  return (
    <div style={{ padding: '1rem' }}>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="doc-field" style={{ margin: 0 }}>
          <label htmlFor="emr-tab-from">From</label>
          <input
            id="emr-tab-from"
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, from: e.target.value }));
              setCurrentPage(1);
            }}
            type="date"
            value={filters.from}
          />
        </div>
        <div className="doc-field" style={{ margin: 0 }}>
          <label htmlFor="emr-tab-to">To</label>
          <input
            id="emr-tab-to"
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, to: e.target.value }));
              setCurrentPage(1);
            }}
            type="date"
            value={filters.to}
          />
        </div>
        <button
          className="doc-btn"
          onClick={() => { setFilters({ from: '', to: '' }); setCurrentPage(1); }}
          type="button"
        >
          <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" /> Reset
        </button>
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.83rem', alignSelf: 'center' }}>
          {loading ? 'Loading...' : `${meta.total} events`}
        </span>
      </div>

      {/* Timeline body */}
      {loading ? (
        <div style={{ padding: '2.5rem 1rem' }}>
          <MedicalLoader text="Loading EMR timeline..." subtext="Retrieving chronological patient clinical events" />
        </div>
      ) : loadError ? (
        <div className="um-state-cell" role="alert">
          {loadError}

        </div>
      ) : timeline.length === 0 ? (
        <EmptyRecords message="No EMR events recorded for this patient." />
      ) : (
        <div className="emr-timeline-axis">
          <div className="emr-timeline-line" />
          {timeline.map((event, index) => {
            const statusBadge = getEventStatusBadge(event.event_type);
            const categoryName = getEventCategoryName(event.event_type);
            const iconClass = getEventIcon(event.event_type);
            return (
              <div className="emr-timeline-item" key={event.id || index}>
                <div className="emr-timeline-node">
                  <i className={iconClass} aria-hidden="true" />
                </div>
                <article className="doc-card emr-event-card">
                  <div className="emr-card-header">
                    <div className="emr-card-title-group">
                      <div className="emr-card-icon">
                        <i className={iconClass} aria-hidden="true" />
                      </div>
                      <div>
                        <strong className="emr-card-category">{categoryName}</strong>
                        <span className="emr-card-subtitle">{event.title || 'Clinical event'}</span>
                      </div>
                    </div>
                    <span className={`doc-status ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  <div className="emr-card-body-grid">
                    <div className="emr-card-cell">
                      <span>Date &amp; Time</span>
                      <strong>{formatDateTime(event.occurred_at)}</strong>
                    </div>
                    <div className="emr-card-cell">
                      <span>Recorded by</span>
                      <strong>{event.created_by || 'System'}</strong>
                    </div>
                    <div className="emr-card-cell">
                      <span>Description</span>
                      <strong>{event.description || 'No description recorded'}</strong>
                    </div>
                  </div>
                  <div className="emr-card-actions">
                    <button
                      className="doc-btn"
                      onClick={() => setSelectedDetails(event)}
                      type="button"
                    >
                      View Details
                    </button>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 ? (
        <div className="um-pagination" style={{ marginTop: '1.5rem' }}>
          <span>
            Showing {timeline.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} events
          </span>
          <div className="um-page-controls">
            <button
              className="pg-btn"
              disabled={meta.page <= 1 || loading}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              type="button"
            >
              <i className="ph ph-caret-left" aria-hidden="true" />
            </button>
            <button className="pg-btn active" disabled type="button">{meta.page}</button>
            <button
              className="pg-btn"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => setCurrentPage(currentPage + 1)}
              type="button"
            >
              <i className="ph ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Event details modal */}
      {selectedDetails ? (
        <div className="modal-backdrop" onClick={() => setSelectedDetails(null)}>
          <div className="modal-box apt-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Timeline Record Details</h3>
              <button className="modal-close" onClick={() => setSelectedDetails(null)} type="button">
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              <div className="apt-modal-details-grid">
                <div className="apt-modal-detail-row"><span>Event Type</span><strong>{selectedDetails.event_type}</strong></div>
                <div className="apt-modal-detail-row"><span>Title</span><strong>{selectedDetails.title}</strong></div>
                <div className="apt-modal-detail-row"><span>Description</span><strong>{selectedDetails.description || 'N/A'}</strong></div>
                <div className="apt-modal-detail-row"><span>Timestamp</span><strong>{formatDateTime(selectedDetails.occurred_at)}</strong></div>
                <div className="apt-modal-detail-row"><span>Recorded by</span><strong>{selectedDetails.created_by || 'System'}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="doc-btn" onClick={() => setSelectedDetails(null)} type="button">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const detectCategoryFromFileName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) return 'Image';
  if (['doc', 'docx'].includes(extension)) return 'Word';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'Excel';
  if (['txt', 'rtf'].includes(extension)) return 'Scanned File';
  return 'PDF';
};

export function PatientProfilePage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const isAdmin = Boolean(user?.roles.some((role) => role.code === 'ADMINISTRATOR' || role.code === 'ADMIN' || role.name.toLowerCase().includes('admin')));
  const canEditAllDetails = isSuperAdmin || isAdmin;
  const formatMoney = useCurrencyFormatter();

  const { search } = useAppLocation();
  const requestedPatientId = getPatientIdFromSearch(search);
  const searchParams = new URLSearchParams(search);
  const initialTab = (searchParams.get('tab') as PatientProfileTab) || 'Overview';
  const feature = usePatientProfileFeature(requestedPatientId, initialTab);

  const {
    activeTab,
    patient,
    loadingDetails,
    loadingHistory,
    detailsError,
    timeline,
    timelineMeta,
    loadingTimeline,
    history,
    visits,
    visitsMeta,
    loadingVisits,
    appointments,
    appointmentsMeta,
    loadingAppointments,
    labOrders,
    loadingLabOrders,
    imagingOrders,
    loadingImagingOrders,
    documents,
    loadingDocuments,
    consents,
    billingInvoices,
    loadingBillingInvoices,
    doctors: doctorsList,
    filters,
    pageInfo,
    isSubmittingUpdate: submitting,
    isSubmittingUpload: submittingUpload
  } = feature.state;
  
  const { 
    setActiveTab, 
    handleUpdateProfile, 
    handleUploadDocument,
    setTimelineFilters,
    setTimelinePage: setTimelineMeta,
    setVisitsFilters,
    setVisitsPage: setVisitsMeta,
    setAppointmentFilters,
    setAppointmentsPage: setAppointmentsMeta
  } = feature.actions;
  
  // Extract specific filters to match component usage
  const timelineFilters = filters.timeline;
  const visitsFilters = filters.visits;
  const appointmentFilters = filters.appointments;

  const loading = loadingDetails || (loadingHistory && activeTab === 'Medical History');
  const loadError = detailsError?.message || '';

  const prescriptions: OpdPrescriptionResponse[] = [];
  const [viewingPrescription, setViewingPrescription] = useState<OpdPrescriptionResponse | null>(null);
  const [viewingLabOrder, setViewingLabOrder] = useState<DiagnosticOrder | null>(null);
  const [viewingImagingOrder, setViewingImagingOrder] = useState<DiagnosticOrder | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<BillingInvoice | null>(null);


  const [editOpen, setEditOpen] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const patientAllergies = useMemo(() => {
    const list: string[] = [];
    if (patient?.notes && (patient.notes.toLowerCase().includes('allerg') || patient.notes.toLowerCase().includes('sensitiv'))) {
      list.push(patient.notes);
    }
    visits.forEach((v) => {
      const vAny = v as unknown as { consultation?: { allergies?: string | null }; notes?: string | null; reason?: string | null };
      if (vAny.consultation?.allergies && !list.includes(vAny.consultation.allergies)) {
        list.push(vAny.consultation.allergies);
      }
      if (vAny.notes && vAny.notes.toLowerCase().includes('allerg') && !list.includes(vAny.notes)) {
        list.push(vAny.notes);
      }
    });
    timeline.forEach((ev) => {
      if (ev.description && ev.description.toLowerCase().includes('allerg') && !list.includes(ev.description)) {
        list.push(ev.description);
      }
    });
    return list;
  }, [patient?.notes, visits, timeline]);

  const patientChronicConditions = useMemo(() => {
    const list: string[] = [];
    visits.forEach((v) => {
      const vAny = v as unknown as { consultation?: { past_history?: string | null } };
      if (vAny.consultation?.past_history && vAny.consultation.past_history.trim().toLowerCase() !== 'no' && !list.includes(vAny.consultation.past_history)) {
        list.push(vAny.consultation.past_history);
      }
    });
    return list;
  }, [visits]);

  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const editForm = useForm<UpdatePatientForm>({ resolver: zodResolver(updatePatientSchema) });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<ApiPatientDocumentType>('CLINICAL');
  const [docCategory, setDocCategory] = useState('PDF');
  const [uploadMode, setUploadMode] = useState<'DOCUMENT' | 'CONSENT'>('DOCUMENT');
  const [documentReviewTarget, setDocumentReviewTarget] = useState<PatientDocumentResponse | null>(null);
  const [documentReviewDecision, setDocumentReviewDecision] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [documentReviewNotes, setDocumentReviewNotes] = useState('');
  const [submittingDocumentReview, setSubmittingDocumentReview] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    window.setTimeout(() => setToastMessage(''), 2800);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setStagedFiles((previous) => [...previous, ...newFiles]);
    const firstFile = newFiles[0];
    if (firstFile) {
      setDocCategory(detectCategoryFromFileName(firstFile.name));
      if (!docName.trim()) {
        const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) || firstFile.name;
        setDocName(baseName);
      }
    }
  };

  const handleUploadSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (stagedFiles.length === 0) {
      showToast('Please select at least one document to upload.', 'error');
      return;
    }
    if (!docName.trim()) {
      showToast('Please enter a document name.', 'error');
      return;
    }
    try {
      for (let index = 0; index < stagedFiles.length; index++) {
        const file = stagedFiles[index];
        if (!file) continue;
        const title = stagedFiles.length > 1 ? `${docName.trim()} (${index + 1})` : docName.trim();
        if (!requestedPatientId) throw new Error('No patient selected.');
        await handleUploadDocument({ document_type: uploadMode === 'CONSENT' ? 'CONSENT' : docType, title, file });
      }
      setUploadModalOpen(false);
      setStagedFiles([]);
      setDocName('');
      showToast(`${stagedFiles.length} file(s) uploaded successfully.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const handleDownloadDocument = async (document: PatientDocumentResponse) => {
    if (!requestedPatientId) return;
    try {
      const result = await patientsApi.downloadDocument(requestedPatientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName ?? document.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const handleViewDocument = async (document: PatientDocumentResponse) => {
    if (!requestedPatientId) return;
    try {
      const result = await patientsApi.downloadDocument(requestedPatientId, document.id);
      const url = URL.createObjectURL(result.blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) showToast('Allow pop-ups to preview this document.', 'error');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const openDocumentReview = (
    document: PatientDocumentResponse,
    decision: 'VERIFIED' | 'REJECTED',
  ) => {
    setDocumentReviewTarget(document);
    setDocumentReviewDecision(decision);
    setDocumentReviewNotes('');
  };

  const handleDocumentReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!requestedPatientId || !documentReviewTarget) return;
    if (documentReviewDecision === 'REJECTED' && !documentReviewNotes.trim()) {
      showToast('Please enter a reason for rejecting this document.', 'error');
      return;
    }
    setSubmittingDocumentReview(true);
    try {
      await patientsApi.reviewDocument(requestedPatientId, documentReviewTarget.id, {
        review_status: documentReviewDecision,
        review_notes: documentReviewNotes.trim() || null,
      });
      showToast(documentReviewDecision === 'VERIFIED' ? 'Document approved.' : 'Document rejected.');
      setDocumentReviewTarget(null);
      setDocumentReviewNotes('');
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    } finally {
      setSubmittingDocumentReview(false);
    }
  };

  const printPatientCard = (p: PatientResponse) => {
    const fullName = patientFullName(p);
    const initials = patientInitials(p);
    const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
    const dob = formatDate(p.date_of_birth);
    const registered = formatDate(p.created_at);
    const statusColor = p.status === 'ACTIVE' ? '#16a34a' : p.status === 'DECEASED' ? '#6b7280' : '#dc2626';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Patient Card — ${fullName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{width:340px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.13);overflow:hidden}
.card-header{background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:20px 20px 28px;position:relative}
.hospital-row{display:flex;align-items:center;gap:8px;margin-bottom:18px}
.hospital-logo{width:32px;height:32px;background:rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px}
.hospital-name{color:#fff;font-size:13px;font-weight:700;line-height:1.2}
.hospital-sub{color:rgba(255,255,255,.65);font-size:10px}
.card-type-badge{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:20px;text-transform:uppercase}
.avatar-row{display:flex;align-items:center;gap:14px}
.avatar{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.2);border:3px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0}
.avatar-info .name{color:#fff;font-size:18px;font-weight:800;line-height:1.2}
.avatar-info .mrn{margin-top:4px;display:inline-block;background:rgba(255,255,255,.18);color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:12px}
.status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}
.card-body{padding:18px 20px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.info-item .label{font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.info-item .value{font-size:13px;font-weight:600;color:#0f172a}
.divider{border:none;border-top:1px solid #e2e8f0;margin:14px 0}
.barcode-row{background:#f8fafc;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.barcode-lines{display:flex;align-items:flex-end;gap:2px;height:28px}
.bar{background:#1e293b;border-radius:1px}
.barcode-label{font-size:10px;color:#64748b;font-weight:500}
.card-footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
.footer-text{font-size:9px;color:#94a3b8}
.blood-badge{background:#fef2f2;color:#dc2626;font-weight:800;font-size:13px;padding:2px 10px;border-radius:8px;border:1px solid #fecaca}
@media print{body{background:#fff}.card{box-shadow:none;border:1px solid #e2e8f0}.no-print{display:none!important}}
.print-btn{display:block;width:100%;margin-top:20px;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
</style></head><body><div>
<div class="card">
<div class="card-header">
<div class="hospital-row"><div class="hospital-logo">H</div><div><div class="hospital-name">HMS Enterprise</div><div class="hospital-sub">Hospital Management System</div></div></div>
<span class="card-type-badge">Patient ID</span>
<div class="avatar-row"><div class="avatar">${initials}</div><div class="avatar-info"><div class="name">${fullName}</div><span class="mrn">${p.patient_number}</span></div></div>
</div>
<div class="card-body">
<div class="info-grid">
<div class="info-item"><div class="label">Date of Birth</div><div class="value">${dob}</div></div>
<div class="info-item"><div class="label">Age / Gender</div><div class="value">${age} yrs Â· ${p.gender.charAt(0)+p.gender.slice(1).toLowerCase()}</div></div>
<div class="info-item"><div class="label">Phone</div><div class="value">${p.phone||'Not recorded'}</div></div>
<div class="info-item"><div class="label">Status</div><div class="value"><span class="status-dot" style="background:${statusColor}"></span>${p.status}</div></div>
<div class="info-item"><div class="label">Registered</div><div class="value">${registered}</div></div>
<div class="info-item"><div class="label">Blood Group</div><div class="value">${p.blood_group?`<span class="blood-badge">${p.blood_group}</span>`:'Not recorded'}</div></div>
</div>
<hr class="divider"/>
<div class="barcode-row"><div><div class="barcode-lines">${Array.from({length:28},(_,i)=>{const h=[24,18,28,14,22,28,16,24,12,28,20,16,28,18,24,28,14,20,28,16,24,12,28,18,24,16,28,22][i];const w=i%3===0?3:1.5;return`<div class="bar" style="width:${w}px;height:${h}px"></div>`;}).join('')}</div><div class="barcode-label" style="margin-top:4px">${p.patient_number}</div></div><div style="text-align:right"><div style="font-size:10px;color:#64748b;font-weight:600">Valid For</div><div style="font-size:12px;font-weight:700;color:#0f172a">All Departments</div></div></div>
</div>
<div class="card-footer"><span class="footer-text">This card is non-transferable</span><span class="footer-text">Printed: ${new Date().toLocaleDateString()}</span></div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print Card</button>
</div><script>window.onload=()=>window.print();</script></body></html>`;
    const win = window.open('', '_blank', 'width=480,height=700,scrollbars=no,toolbar=no,menubar=no');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const saveProfile = async (data: UpdatePatientForm) => {
    if (!patient) return;
    try {
      await handleUpdateProfile({
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
      });
      setEditOpen(false);
      showToast('Patient profile updated successfully.');
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 1rem' }}>
        <MedicalLoader size="large" text="Loading patient workspace..." subtext="Accessing EMR & clinical profile records" />
      </div>
    );
  }
  if (loadError) return <div className="um-state-cell" role="alert">{loadError}</div>;
  if (!patient) {
    return (
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title"><h2>Patient Workspace</h2><p>Select a patient from search to open their workspace</p></div>
          <div className="appointment-page-actions">
            <button className="doc-btn primary" onClick={() => navigate('/patients/search')} type="button"><i className="ph ph-magnifying-glass" aria-hidden="true" /> Search Patients</button>
          </div>
        </section>
        <div className="patient-empty-inline" style={{ marginTop: '2rem' }}>No patient selected. Use <strong>Search Patients</strong> and click <strong>View Patient</strong> to open a workspace.</div>
      </div>
    );
  }

  const openEditModal = () => {
    editForm.reset({
      firstName: patient.first_name ?? '',
      lastName: patient.last_name,
      dateOfBirth: patient.date_of_birth.slice(0, 10),
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
    setEditOpen(true);
  };

  const openUploadModal = (mode: 'DOCUMENT' | 'CONSENT') => {
    setUploadMode(mode);
    setUploadModalOpen(true);
  };

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title"><h2>Patient Workspace</h2><p>Complete patient record and clinical history</p></div>
          <div className="appointment-page-actions">
            <button className="doc-btn" onClick={() => navigate('/patients/search')} type="button"><i className="ph ph-magnifying-glass" aria-hidden="true" /> Search Patients</button>
          </div>
        </section>

        {/* Hero Banner */}
        <section className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="profile-hero-avatar">
              <span>{patientInitials(patient)}</span>
            </div>
            <div className="profile-hero-info">
              <div className="profile-hero-title">
                <h2>{patientFullName(patient)}</h2>
                <span className="profile-mrn-badge">MRN-{patient.patient_number}</span>
                <span className={`doc-status ${patient.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                  {patient.status}
                </span>
              </div>
              <div className="profile-hero-meta">
                <span><i className="ph ph-user" /> {patient.gender}</span>
                <span className="divider">•</span>
                <span><i className="ph ph-cake" /> {calculateAge(patient.date_of_birth)} ({formatDate(patient.date_of_birth)})</span>
                <span className="divider">•</span>
                <span><i className="ph ph-phone" /> {patient.phone || 'Phone not recorded'}</span>
                <span className="divider">•</span>
                <span><i className="ph ph-envelope" /> {patient.email || 'Email not recorded'}</span>
                <span className="divider">•</span>
                <span><i className="ph ph-map-pin" /> {[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || 'Address not recorded'}</span>
                <span className="divider">•</span>
                <span><i className="ph ph-drop" /> Blood: {patient.blood_group || 'Not recorded'}</span>
                <span className="divider">•</span>
                <span><i className="ph ph-clock" /> Registered {formatDate(patient.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="profile-hero-actions">
            <button className="doc-btn" onClick={() => { 
                editForm.reset({ 
                  firstName: patient.first_name ?? '', 
                  lastName: patient.last_name, 
                  dateOfBirth: patient.date_of_birth.slice(0, 10), 
                  phone: patient.phone ?? '', 
                  email: patient.email ?? '', 
                  status: patient.status, 
                  gender: patient.gender, 
                  bloodGroup: patient.blood_group ?? '', 
                  addressLine1: patient.address?.line1 ?? '',
                  city: patient.address?.city ?? '',
                  postalCode: patient.address?.postal_code ?? '',
                  notes: patient.notes ?? '' 
                }); 
                setEditOpen(true); 
              }} type="button">
              <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Patient
            </button>
            {/* Register Visit — temporarily disabled */}
            {/* <button className="doc-btn" onClick={() => navigate(`/opd/visit?patient_id=${encodeURIComponent(patient.id)}`)} type="button">
              <i className="ph ph-clipboard-text" aria-hidden="true" /> Register Visit
            </button> */}
            <button className="doc-btn primary" onClick={() => navigate(`/appointments/book?patient=${encodeURIComponent(patient.id)}`)} type="button">
              <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
            </button>
            <button className="doc-btn" onClick={() => setShowCardModal(true)} type="button">
              <i className="ph ph-identification-card" aria-hidden="true" /> View Card
            </button>
          </div>
        </section>

        {/* 11 Workspace Tabs */}
        <section className="doc-card" style={{ marginTop: '1.25rem', padding: '0.5rem 1rem 0' }}>
          <div className="opd-workspace-tabs" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {tabs.map((tab) => (
              <button
                className={`opd-workspace-tab ${activeTab === tab ? 'active' : ''}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Contents */}
        <section className="doc-card" style={{ marginTop: '1.25rem', overflow: 'hidden', padding: 0 }}>
          {/* ── Overview ──────────────────────────────────────────────────── */}
          {activeTab === 'Overview' ? (
            <div className="profile-6card-grid">
              {/* Card 1: Personal Information */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-user-circle" /> Personal Information</h3>
                <div className="profile-info-grid">
                  <span className="label">Full Name</span>
                  <span className="value">{patientFullName(patient)}</span>
                  <span className="label">Gender / Age</span>
                  <span className="value">{patient.gender}, {calculateAge(patient.date_of_birth)}</span>
                  <span className="label">Date of Birth</span>
                  <span className="value">{formatDate(patient.date_of_birth)}</span>
                  <span className="label">MRN</span>
                  <span className="value">{patient.patient_number}</span>
                  <span className="label">Address</span>
                  <span className="value">{[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || 'Not recorded'}</span>
                  <span className="label">Preferred Language</span>
                  <span className="value">English</span>
                </div>
              </article>

              {/* Card 2: Emergency Contact */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-phone-call" /> Emergency Contact</h3>
                <div className="profile-info-grid">
                  <span className="label">Name</span>
                  <span className="value">{patient.emergency_contact.name || 'Not recorded'}</span>
                  <span className="label">Relationship</span>
                  <span className="value">{patient.emergency_contact.relationship || 'Not recorded'}</span>
                  <span className="label">Phone</span>
                  <span className="value">{patient.emergency_contact.phone || 'Not recorded'}</span>
                </div>
              </article>

              {/* Card 3: Current Prescriptions */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-pill" /> Current Prescriptions</h3>
                {prescriptions.flatMap(p => p.items).length === 0 ? (
                  <EmptyRecords message="No prescriptions recorded for this patient." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {prescriptions.flatMap(p => p.items.map(item => ({ item, pStatus: p.status }))).slice(0, 3).map(({ item, pStatus }) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                        <div>
                          <strong>{item.medicine_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.dosage} - {item.frequency} ({item.duration})</div>
                        </div>
                        <span className={`doc-status ${pStatus === 'SUBMITTED' || pStatus === 'DRAFT' ? 'active' : pStatus === 'DISPENSED' ? 'success' : 'neutral'}`}>{pStatus.charAt(0).toUpperCase() + pStatus.slice(1).toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              {/* Card 4: Recent Visits */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-calendar-blank" /> Recent Visits</h3>
                {timeline.length === 0 ? (
                  <EmptyRecords message="No recent visits recorded for this patient." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {timeline.slice(0, 3).map((event) => (
                      <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                        <span>{formatDate(event.occurred_at)} • {event.title}</span>
                        <strong style={{ color: '#2563eb' }}>Consultation</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              {/* Card 5: Outstanding Bills */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-receipt" /> Outstanding Bills</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Current balance</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>KES 0</strong>
                  </div>
                  <div>
                    <button className="doc-btn" onClick={() => setActiveTab('Billing')} type="button">
                      View Billing
                    </button>
                  </div>
                </div>
              </article>

              {/* Card 6: Alerts */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-warning" /> Alerts</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="profile-alert-box">
                    <strong>Allergies</strong>
                    <div>
                      {patientAllergies.length > 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{patientAllergies.join(', ')}</span>
                      ) : (
                        'None recorded'
                      )}
                    </div>
                  </div>
                  <div className="profile-alert-box info">
                    <strong>Chronic conditions</strong>
                    <div>
                      {patientChronicConditions.length > 0 ? (
                        <span style={{ color: '#1e40af', fontWeight: 600 }}>{patientChronicConditions.join(', ')}</span>
                      ) : (
                        'None recorded'
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {activeTab === 'EMR Timeline' ? (
            <EmrTimelineTab patientId={patient.id} loading={loadingTimeline} loadError={""} timeline={timeline || []} meta={timelineMeta || { page: 1, limit: 10, total: 0, totalPages: 1 }} filters={timelineFilters} setFilters={setTimelineFilters} currentPage={pageInfo.timeline.page} setCurrentPage={(p: number) => setTimelineMeta(prev => ({ ...prev, page: p  }))} />
          ) : null}

          {/* ── Medical History ──────────────────────────────────────────── */}
          {activeTab === 'Medical History' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={timelineFilters.from} onChange={(e) => { setTimelineFilters((prev) => ({ ...prev, from: e.target.value })); setTimelineMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={timelineFilters.to} onChange={(e) => { setTimelineFilters((prev) => ({ ...prev, to: e.target.value })); setTimelineMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <button className="doc-btn" type="button" onClick={() => { setTimelineFilters({ from: '', to: '' }); setTimelineMeta(prev => ({ ...prev, page: 1  })); }}>
                  Reset
                </button>
                {loadingTimeline && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
              </div>
              {timeline.length === 0 ? (
                <EmptyRecords message="No medical history events recorded for this patient." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>DATE</th><th>EVENT</th><th>DESCRIPTION</th></tr>
                    </thead>
                    <tbody>
                      {timeline.map((event) => (
                        <tr key={event.id}>
                          <td>{formatDateTime(event.occurred_at)}</td>
                          <td><strong>{event.title}</strong></td>
                          <td>{event.description || 'No description recorded'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {timelineMeta.totalPages > 1 && (
                <div className="um-pagination" style={{ marginTop: '1rem' }}>
                  <span>
                    Showing {timeline.length === 0 ? 0 : (timelineMeta.page - 1) * timelineMeta.limit + 1}-
                    {Math.min(timelineMeta.page * timelineMeta.limit, (timelineMeta.total) || 0)} of {(timelineMeta.total) || 0} events
                  </span>
                  <div className="um-page-controls">
                    <button className="pg-btn" disabled={timelineMeta.page <= 1} onClick={() => setTimelineMeta(prev => ({ ...prev, page: timelineMeta.page - 1  }))} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {timelineMeta.page}
                    </button>
                    <button className="pg-btn" disabled={timelineMeta.page >= timelineMeta.totalPages} onClick={() => setTimelineMeta(prev => ({ ...prev, page: timelineMeta.page + 1  }))} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Visits ───────────────────────────────────────────────────── */}
          {activeTab === 'Visits' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={visitsFilters.date_from} onChange={(e) => { setVisitsFilters((prev: typeof visitsFilters) => ({ ...prev, date_from: e.target.value })); setVisitsMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={visitsFilters.date_to} onChange={(e) => { setVisitsFilters((prev: typeof visitsFilters) => ({ ...prev, date_to: e.target.value })); setVisitsMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <button className="doc-btn" type="button" onClick={() => { setVisitsFilters({ date_from: '', date_to: '' }); setVisitsMeta(prev => ({ ...prev, page: 1  })); }}>
                  Reset
                </button>
                {loadingVisits && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
              </div>
              {visits.length === 0 ? (
                <EmptyRecords message="No OPD visit records found for this patient." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>DATE</th><th>VISIT NUMBER</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr>
                    </thead>
                    <tbody>
                      {visits.map((visit) => (
                        <tr key={visit.id}>
                          <td>{formatDate(visit.visit_date)}</td>
                          <td><strong>{visit.visit_number}</strong></td>
                          <td>{visit.doctor_name}</td>
                          <td>{visit.visit_type.replaceAll('_', ' ')}</td>
                          <td><span className={`status-badge status-${visit.status.toLowerCase()}`}>{visit.status.replaceAll('_', ' ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {visitsMeta.totalPages > 1 && (
                <div className="um-pagination" style={{ marginTop: '1rem' }}>
                  <span>
                    Showing {visits.length === 0 ? 0 : (visitsMeta.page - 1) * visitsMeta.limit + 1}-
                    {Math.min(visitsMeta.page * visitsMeta.limit, (visitsMeta.total) || 0)} of {(visitsMeta.total) || 0} visits
                  </span>
                  <div className="um-page-controls">
                    <button className="pg-btn" disabled={visitsMeta.page <= 1} onClick={() => setVisitsMeta(prev => ({ ...prev, page: visitsMeta.page - 1  }))} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {visitsMeta.page}
                    </button>
                    <button className="pg-btn" disabled={visitsMeta.page >= visitsMeta.totalPages} onClick={() => setVisitsMeta(prev => ({ ...prev, page: visitsMeta.page + 1  }))} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Appointments ─────────────────────────────────────────────── */}
          {activeTab === 'Appointments' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={appointmentFilters.date_from} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, date_from: e.target.value })); setAppointmentsMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={appointmentFilters.date_to} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, date_to: e.target.value })); setAppointmentsMeta(prev => ({ ...prev, page: 1  })); }} />
                </div>
                <div className="doc-field">
                  <label>Doctor</label>
                  <select value={appointmentFilters.doctor_id} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, doctor_id: e.target.value })); setAppointmentsMeta(prev => ({ ...prev, page: 1  })); }}>
                    <option value="">All Doctors</option>
                    {doctorsList.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.display_name}</option>
                    ))}
                  </select>
                </div>
                <button className="doc-btn" type="button" onClick={() => { setAppointmentFilters({ date_from: '', date_to: '', doctor_id: '' }); setAppointmentsMeta(prev => ({ ...prev, page: 1  })); }}>
                  Reset
                </button>
                {loadingAppointments && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
              </div>
              {appointments.length === 0 ? (
                <EmptyRecords message="No appointments recorded for this patient." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>DATE</th><th>TIME</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{formatDate(appointment.appointment_date)}</td>
                          <td>{appointment.start_time}</td>
                          <td>{appointment.doctor_name}</td>
                          <td>{appointment.visit_type.replaceAll('_', ' ')}</td>
                          <td><span className="doc-status active">{appointment.status.replaceAll('_', ' ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {appointmentsMeta.totalPages > 1 && (
                <div className="um-pagination" style={{ marginTop: '1rem' }}>
                  <span>
                    Showing {appointments.length === 0 ? 0 : (appointmentsMeta.page - 1) * appointmentsMeta.limit + 1}-
                    {Math.min(appointmentsMeta.page * appointmentsMeta.limit, (appointmentsMeta.total) || 0)} of {(appointmentsMeta.total) || 0} appointments
                  </span>
                  <div className="um-page-controls">
                    <button className="pg-btn" disabled={appointmentsMeta.page <= 1} onClick={() => setAppointmentsMeta(prev => ({ ...prev, page: appointmentsMeta.page - 1  }))} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {appointmentsMeta.page}
                    </button>
                    <button className="pg-btn" disabled={appointmentsMeta.page >= appointmentsMeta.totalPages} onClick={() => setAppointmentsMeta(prev => ({ ...prev, page: appointmentsMeta.page + 1  }))} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Prescriptions ────────────────────────────────────────────── */}
          {activeTab === 'Prescriptions' ? (
            prescriptions.length === 0 ? (
              <EmptyRecords message="No prescription records found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>DOCTOR</th><th>MEDICINES PRESCRIBED</th><th>DOSAGE &amp; FREQUENCY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((script: import('../api/opd').OpdPrescriptionResponse) => (
                      <tr key={script.id}>
                        <td>{formatDate(script.created_at)}</td>
                        <td><strong>{script.doctor_name || 'Attending Physician'}</strong></td>
                        <td>
                          {script.items.map((i: import('../api/opd').OpdPrescriptionItemResponse) => `${i.medicine_name}${i.strength ? ` (${i.strength})` : ''}`).join(', ')}
                        </td>
                        <td>
                          {script.items.map((i: import('../api/opd').OpdPrescriptionItemResponse) => `${i.dosage} - ${i.frequency} (${i.duration})`).join('; ')}
                        </td>
                        <td><span className="doc-status active">{script.status}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="doc-btn small" onClick={() => setViewingPrescription(script)} title="View Prescription" type="button">
                            <i aria-hidden="true" className="ph ph-file-text" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {/* ── Lab Results ──────────────────────────────────────────────── */}
          {activeTab === 'Lab Results' ? (
            labOrders.length === 0 ? (
              <EmptyRecords message="No laboratory test results found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>INVESTIGATION NAME</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {labOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{formatDate(order.created_at)}</td>
                        <td><strong>{order.items.map((i: { investigation_name: string }) => i.investigation_name).join(', ') || 'Lab Requisition'}</strong></td>
                        <td>{order.items[0]?.category || 'General Lab'}</td>
                        <td><span className="doc-status draft">{order.priority}</span></td>
                        <td><span className="doc-status active">{order.status.replaceAll('_', ' ')}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="doc-btn small" onClick={() => setViewingLabOrder(order)} title="View Lab Order" type="button">
                            <i aria-hidden="true" className="ph ph-file-text" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {/* ── Imaging ──────────────────────────────────────────────────── */}
          {activeTab === 'Imaging' ? (
            imagingOrders.length === 0 ? (
              <EmptyRecords message="No radiology / imaging records found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>SCAN / MODALITY</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {imagingOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{formatDate(order.created_at)}</td>
                        <td><strong>{order.items.map((i: { investigation_name: string }) => i.investigation_name).join(', ') || 'Imaging Requisition'}</strong></td>
                        <td>{order.items[0]?.category || 'Radiology'}</td>
                        <td><span className="doc-status draft">{order.priority}</span></td>
                        <td><span className="doc-status active">{order.status.replaceAll('_', ' ')}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="doc-btn small" onClick={() => setViewingImagingOrder(order)} title="View Imaging Order" type="button">
                            <i aria-hidden="true" className="ph ph-file-text" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {/* ── Documents ────────────────────────────────────────────────── */}
          {activeTab === 'Documents' ? (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="doc-btn primary" onClick={() => { setUploadMode('DOCUMENT'); setUploadModalOpen(true); }} type="button">
                  <i className="ph ph-upload-simple" aria-hidden="true" /> Upload Document
                </button>
              </div>
              {documents.length === 0 ? (
                <EmptyRecords message="No uploaded documents found for this patient." />
              ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>TITLE</th><th>FILE</th><th>TYPE</th><th>UPLOADED BY</th></tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td>{formatDate(document.created_at)}</td>
                        <td><strong>{document.title}</strong></td>
                        <td>{document.file_name}</td>
                        <td>{document.document_type}</td>
                        <td>{document.uploaded_by_name || 'Recorded user'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          ) : null}

          {/* ── Billing ──────────────────────────────────────────────────── */}
          {activeTab === 'Billing' ? (
            billingInvoices.length === 0 ? (
              <EmptyRecords message="No billing statements or invoices found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>INVOICE #</th><th>DATE</th><th>SERVICES BILLED</th><th>TOTAL AMOUNT</th><th>BALANCE</th><th>STATUS</th><th style={{ width: '80px', textAlign: 'center' }}>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {billingInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td><strong>{inv.invoice_number}</strong></td>
                        <td>{formatDate(inv.invoice_date || inv.created_at)}</td>
                        <td>{inv.items.map((i: { service_name: string }) => i.service_name).join(', ') || 'OPD Services'}</td>
                        <td>{formatMoney(inv.total_amount)}</td>
                        <td><strong style={{ color: inv.balance_amount > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(inv.balance_amount)}</strong></td>
                        <td><span className="doc-status active">{inv.status}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="doc-btn small" onClick={() => setViewingInvoice(inv)} title="View Invoice" type="button">
                            <i aria-hidden="true" className="ph ph-file-text" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {/* ─────────────────────────────────────────────────────────── */}
          {activeTab === 'Consent' ? (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="doc-btn primary" onClick={() => { setUploadMode('CONSENT'); setUploadModalOpen(true); }} type="button">
                  <i className="ph ph-upload-simple" aria-hidden="true" /> Upload Consent
                </button>
              </div>
              {consents.length === 0 ? (
                <EmptyRecords message="No consent forms found for this patient." />
              ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>CONSENT</th><th>SIGNED BY</th><th>STATUS</th><th>VALID UNTIL</th></tr>
                  </thead>
                  <tbody>
                    {consents.map((consent) => (
                      <tr key={consent.id}>
                        <td>{formatDate(consent.created_at)}</td>
                        <td><strong>{consent.title}</strong></td>
                        <td>{consent.signed_by_name || 'Not recorded'}</td>
                        <td>{consent.consent_status || 'Not recorded'}</td>
                        <td>{consent.valid_until ? formatDate(consent.valid_until) : 'Not recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          ) : null}
        </section>
      </div>

      <PatientEditModal canEditAllDetails={canEditAllDetails} form={editForm} onClose={() => setEditOpen(false)} onSubmit={saveProfile} open={editOpen} patient={patient} submitting={submitting} />
      <PatientCardModal onClose={() => setShowCardModal(false)} open={showCardModal} patient={patient} />
      <PatientDocumentUploadModal
        docCategory={docCategory}
        docName={docName}
        docType={docType}
        onClose={() => setUploadModalOpen(false)}
        onDocCategoryChange={setDocCategory}
        onDocNameChange={setDocName}
        onDocTypeChange={setDocType}
        onFileSelect={handleFileSelect}
        onRemoveFile={(index) => setStagedFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}
        onSubmit={handleUploadSubmit}
        open={uploadModalOpen}
        stagedFiles={stagedFiles}
        submitting={submittingUpload}
        uploadMode={uploadMode}
      />

      <Modal
        open={Boolean(documentReviewTarget)}
        onClose={() => {
          if (!submittingDocumentReview) setDocumentReviewTarget(null);
        }}
        title={documentReviewDecision === 'VERIFIED' ? 'Approve patient document' : 'Reject patient document'}
      >
        <form className="modal-form" onSubmit={handleDocumentReview}>
          <div className={`patient-document-review-summary ${documentReviewDecision.toLowerCase()}`}>
            <i className={`ph ${documentReviewDecision === 'VERIFIED' ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden="true" />
            <div>
              <strong>{documentReviewTarget?.title}</strong>
              <span>
                {documentReviewDecision === 'VERIFIED'
                  ? 'Confirm that staff have reviewed this patient-supplied document and it is suitable for the patient record.'
                  : 'The document will remain available with a rejected status and the reason will be recorded.'}
              </span>
            </div>
          </div>
          <div className="doc-field">
            <label htmlFor="document-review-notes">
              Review note {documentReviewDecision === 'REJECTED' ? <span className="required-asterisk">*</span> : '(optional)'}
            </label>
            <textarea
              id="document-review-notes"
              onChange={(event) => setDocumentReviewNotes(event.target.value)}
              placeholder={documentReviewDecision === 'REJECTED' ? 'Explain why this document was rejected' : 'Add a note for the patient record'}
              rows={4}
              value={documentReviewNotes}
            />
          </div>
          <div className="modal-actions">
            <button className="doc-btn" disabled={submittingDocumentReview} onClick={() => setDocumentReviewTarget(null)} type="button">
              Cancel
            </button>
            <button
              className={`doc-btn ${documentReviewDecision === 'VERIFIED' ? 'primary' : 'danger'}`}
              disabled={submittingDocumentReview}
              type="submit"
            >
              {submittingDocumentReview ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Saving review...</span>
                </>
              ) : documentReviewDecision === 'VERIFIED' ? (
                'Approve document'
              ) : (
                'Reject document'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <PrintPrescriptionModal onClose={() => setViewingPrescription(null)} patient={patient} prescription={viewingPrescription} />
      <PrintLabOrderModal onClose={() => setViewingLabOrder(null)} order={viewingLabOrder} patient={patient} />
      <PrintImagingOrderModal onClose={() => setViewingImagingOrder(null)} order={viewingImagingOrder} patient={patient} />
      <PrintBillingModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} patient={patient} />
      <Toast message={toastMessage} tone={toastTone} visible={Boolean(toastMessage)} />
    </>
  );
}
