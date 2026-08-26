import { useState, type FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { BillingInvoice } from '../api/billing';
import type { DiagnosticOrder } from '../api/laboratory';
import type { OpdPrescriptionResponse } from '../api/opd';
import type { ApiPatientDocumentType } from '../api/patients';
import { useCurrencyFormatter } from '../api/useSettings';
import { useAuth } from '../auth/useAuth';
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
import { usePatientProfileFeature, type PatientProfileTab } from '../hooks/patients/usePatientProfileFeature';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage, getPatientIdFromSearch } from './patient-utils';

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
  const formatCurrency = useCurrencyFormatter();

  const { search } = useAppLocation();
  const requestedPatientId = getPatientIdFromSearch(search);
  const searchParams = new URLSearchParams(search);
  const initialTab = (searchParams.get('tab') as PatientProfileTab) || 'Overview';
  const feature = usePatientProfileFeature(requestedPatientId, initialTab);

  const { activeTab, patient, loadingDetails, loadingHistory, detailsError, isSubmittingUpdate: submitting, isSubmittingUpload: submittingUpload } = feature.state;
  const { setActiveTab, handleUpdateProfile, handleUploadDocument } = feature.actions;
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

  if (loading) return <div className="um-state-cell">Loading patient workspace...</div>;
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

        <PatientProfileHeader
          onBookAppointment={() => navigate(`/appointments/book?patient=${encodeURIComponent(patient.id)}`)}
          onEdit={openEditModal}
          onViewCard={() => setShowCardModal(true)}
          patient={patient}
        />

        <section className="doc-card" style={{ marginTop: '1.25rem', padding: '0.5rem 1rem 0' }}>
          <div className="opd-workspace-tabs" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {tabs.map((tab) => <button className={`opd-workspace-tab ${activeTab === tab ? 'active' : ''}`} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}
          </div>
        </section>

        <PatientProfileTabContent
          actions={feature.actions}
          formatCurrency={formatCurrency}
          onOpenUpload={openUploadModal}
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

      <PrintPrescriptionModal onClose={() => setViewingPrescription(null)} patient={patient} prescription={viewingPrescription} />
      <PrintLabOrderModal onClose={() => setViewingLabOrder(null)} order={viewingLabOrder} patient={patient} />
      <PrintImagingOrderModal onClose={() => setViewingImagingOrder(null)} order={viewingImagingOrder} patient={patient} />
      <PrintBillingModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} patient={patient} />
      <Toast message={toastMessage} tone={toastTone} visible={Boolean(toastMessage)} />
    </>
  );
}
