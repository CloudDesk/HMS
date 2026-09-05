import { useState, type FormEvent } from 'react';
import { type BillingInvoice } from '../api/billing';
import { type DiagnosticOrder } from '../api/laboratory';
import { type OpdPrescriptionResponse } from '../api/opd';
import {
  type ApiPatientDocumentType,
  type PatientDocumentResponse,
} from '../api/patients';
import { useAuth } from '../auth/useAuth';
import { hasPermission, isSuperAdministrator } from '../auth/access-control';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PatientCardModal } from '../components/patients/PatientCardModal';
import { PatientDocumentUploadModal } from '../components/patients/PatientDocumentUploadModal';
import { PatientEditModal, updatePatientSchema, type UpdatePatientForm } from '../components/patients/PatientEditModal';
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
import { getPatientErrorMessage, getPatientIdFromSearch, patientFullName, patientInitials, formatDate } from './patient-utils';

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
  const canEditAllDetails = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Patients', screen: 'Patient Records', action: 'Edit' })
  ));
  const canBookAppointment = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' })
  ));
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
    formatMoney,
    isSubmittingUpdate: submitting,
    isSubmittingUpload: submittingUpload,
    isSubmittingDocumentReview: submittingDocumentReview,
  } = feature.state;

  const {
    setActiveTab,
    handleUpdateProfile,
    handleUploadDocument,
    handleDownloadDocument: downloadDocument,
    handleReviewDocument: reviewDocument,
  } = feature.actions;

  const loading = loadingDetails || (loadingHistory && activeTab === 'Medical History');
  const loadError = detailsError?.message || '';

  const prescriptions: OpdPrescriptionResponse[] = [];
  const [viewingPrescription, setViewingPrescription] = useState<OpdPrescriptionResponse | null>(null);
  const [viewingLabOrder, setViewingLabOrder] = useState<DiagnosticOrder | null>(null);
  const [viewingImagingOrder, setViewingImagingOrder] = useState<DiagnosticOrder | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<BillingInvoice | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

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
      const result = await downloadDocument(document.id);
      if (!result) return;
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
      const result = await downloadDocument(document.id);
      if (!result) return;
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
    try {
      await reviewDocument(documentReviewTarget.id, {
        review_status: documentReviewDecision,
        review_notes: documentReviewNotes.trim() || null,
      });
      showToast(documentReviewDecision === 'VERIFIED' ? 'Document approved.' : 'Document rejected.');
      setDocumentReviewTarget(null);
      setDocumentReviewNotes('');
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
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
            {canEditAllDetails ? (
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
            ) : null}
            {/* Register Visit — temporarily disabled */}
            {/* <button className="doc-btn" onClick={() => navigate(`/opd/visit?patient_id=${encodeURIComponent(patient.id)}`)} type="button">
              <i className="ph ph-clipboard-text" aria-hidden="true" /> Register Visit
            </button> */}
            {canBookAppointment ? (
              <button className="doc-btn primary" onClick={() => navigate(`/appointments/book?patient=${encodeURIComponent(patient.id)}`)} type="button">
                <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
              </button>
            ) : null}
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
        <PatientProfileTabContent
          actions={feature.actions}
          canEditAllDetails={canEditAllDetails}
          formatCurrency={formatMoney}
          onDownloadDocument={handleDownloadDocument}
          onOpenUpload={(mode) => {
            setUploadMode(mode);
            setUploadModalOpen(true);
          }}
          onReviewDocument={openDocumentReview}
          onViewDocument={handleViewDocument}
          onViewImagingOrder={setViewingImagingOrder}
          onViewInvoice={setViewingInvoice}
          onViewLabOrder={setViewingLabOrder}
          onViewPrescription={setViewingPrescription}
          patient={patient}
          prescriptions={prescriptions}
          state={feature.state}
        />
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
