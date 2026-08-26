import { useState, useMemo, type FormEvent } from 'react';
import { type BillingInvoice } from '../api/billing';
import { type DiagnosticOrder } from '../api/laboratory';
import { type OpdPrescriptionResponse } from '../api/opd';
import {
    type ApiPatientDocumentType,
  type PatientResponse,
  type PatientTimelineEventResponse,
  } from '../api/patients';
import { usePatientProfileFeature } from '../hooks/patients/usePatientProfileFeature';
import { useForm } from 'react-hook-form';
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

  const patientAllergies = useMemo(() => {
    const list: string[] = [];
    if (patient?.notes && (patient.notes.toLowerCase().includes('allerg') || patient.notes.toLowerCase().includes('sensitiv'))) {
      list.push(patient.notes);
    }
    visitsData.forEach((v) => {
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
  }, [patient?.notes, visitsData, timeline]);

  const patientChronicConditions = useMemo(() => {
    const list: string[] = [];
    visitsData.forEach((v) => {
      const vAny = v as unknown as { consultation?: { past_history?: string | null } };
      if (vAny.consultation?.past_history && vAny.consultation.past_history.trim().toLowerCase() !== 'no' && !list.includes(vAny.consultation.past_history)) {
        list.push(vAny.consultation.past_history);
      }
    });
    return list;
  }, [visitsData]);
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
        {/* Tab Contents */}
        <section className="doc-card" style={{ marginTop: '1.25rem', overflow: 'hidden', padding: 0 }}>
          {/* â”€â”€ Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                        <span>{formatDate(event.occurred_at)} â€¢ {event.title}</span>
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
            <EmrTimelineTab patientId={patient.id} loading={loadingTimeline} loadError={""} timeline={timeline || []} meta={timelineMeta || { page: 1, limit: 10, total: 0, totalPages: 1 }} filters={timelineFilters} setFilters={setTimelineFilters} currentPage={timelinePageInfo.page} setCurrentPage={(p: number) => setTimelineMeta({ page: p })} />
          ) : null}

          {/* â”€â”€ Medical History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Medical History' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={timelineFilters.from} onChange={(e) => { setTimelineFilters((prev) => ({ ...prev, from: e.target.value })); setTimelineMeta({ page: 1 }); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={timelineFilters.to} onChange={(e) => { setTimelineFilters((prev) => ({ ...prev, to: e.target.value })); setTimelineMeta({ page: 1 }); }} />
                </div>
                <button className="doc-btn" type="button" onClick={() => { setTimelineFilters({ from: '', to: '' }); setTimelineMeta({ page: 1 }); }}>
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
                    <button className="pg-btn" disabled={timelineMeta.page <= 1} onClick={() => setTimelineMeta({ page: timelineMeta.page - 1 })} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {timelineMeta.page}
                    </button>
                    <button className="pg-btn" disabled={timelineMeta.page >= timelineMeta.totalPages} onClick={() => setTimelineMeta({ page: timelineMeta.page + 1 })} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* â”€â”€ Visits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Visits' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={visitsFilters.date_from} onChange={(e) => { setVisitsFilters((prev: typeof visitsFilters) => ({ ...prev, date_from: e.target.value })); setVisitsMeta({ page: 1 }); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={visitsFilters.date_to} onChange={(e) => { setVisitsFilters((prev: typeof visitsFilters) => ({ ...prev, date_to: e.target.value })); setVisitsMeta({ page: 1 }); }} />
                </div>
                <button className="doc-btn" type="button" onClick={() => { setVisitsFilters({ date_from: '', date_to: '' }); setVisitsMeta({ page: 1 }); }}>
                  Reset
                </button>
                {loadingVisits && <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center', marginLeft: 'auto' }}>Loading...</span>}
              </div>
              {visitsData.length === 0 ? (
                <EmptyRecords message="No OPD visit records found for this patient." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>DATE</th><th>VISIT NUMBER</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr>
                    </thead>
                    <tbody>
                      {visitsData.map((visit) => (
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
                    Showing {visitsData.length === 0 ? 0 : (visitsMeta.page - 1) * visitsMeta.limit + 1}-
                    {Math.min(visitsMeta.page * visitsMeta.limit, (visitsMeta.total) || 0)} of {(visitsMeta.total) || 0} visits
                  </span>
                  <div className="um-page-controls">
                    <button className="pg-btn" disabled={visitsMeta.page <= 1} onClick={() => setVisitsMeta({ page: visitsMeta.page - 1 })} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {visitsMeta.page}
                    </button>
                    <button className="pg-btn" disabled={visitsMeta.page >= visitsMeta.totalPages} onClick={() => setVisitsMeta({ page: visitsMeta.page + 1 })} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* â”€â”€ Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === 'Appointments' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="doc-toolbar">
                <div className="doc-field">
                  <label>From</label>
                  <input type="date" value={appointmentFilters.date_from} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, date_from: e.target.value })); setAppointmentsMeta({ page: 1 }); }} />
                </div>
                <div className="doc-field">
                  <label>To</label>
                  <input type="date" value={appointmentFilters.date_to} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, date_to: e.target.value })); setAppointmentsMeta({ page: 1 }); }} />
                </div>
                <div className="doc-field">
                  <label>Doctor</label>
                  <select value={appointmentFilters.doctor_id} onChange={(e) => { setAppointmentFilters((prev: typeof appointmentFilters) => ({ ...prev, doctor_id: e.target.value })); setAppointmentsMeta({ page: 1 }); }}>
                    <option value="">All Doctors</option>
                    {doctorsList.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.display_name}</option>
                    ))}
                  </select>
                </div>
                <button className="doc-btn" type="button" onClick={() => { setAppointmentFilters({ date_from: '', date_to: '', doctor_id: '' }); setAppointmentsMeta({ page: 1 }); }}>
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
                    <button className="pg-btn" disabled={appointmentsMeta.page <= 1} onClick={() => setAppointmentsMeta({ page: appointmentsMeta.page - 1 })} type="button">
                      <i className="ph ph-caret-left" aria-hidden="true" />
                    </button>
                    <button className="pg-btn active" disabled type="button">
                      {appointmentsMeta.page}
                    </button>
                    <button className="pg-btn" disabled={appointmentsMeta.page >= appointmentsMeta.totalPages} onClick={() => setAppointmentsMeta({ page: appointmentsMeta.page + 1 })} type="button">
                      <i className="ph ph-caret-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* â”€â”€ Prescriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

          {/* â”€â”€ Lab Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

          {/* â”€â”€ Imaging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

          {/* â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

          {/* â”€â”€ Billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                        <td>₹{inv.total_amount.toLocaleString()}</td>
                        <td><strong style={{ color: inv.balance_amount > 0 ? '#dc2626' : '#16a34a' }}>₹{inv.balance_amount.toLocaleString()}</strong></td>
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

      <PrintPrescriptionModal onClose={() => setViewingPrescription(null)} patient={patient} prescription={viewingPrescription} />
      <PrintLabOrderModal onClose={() => setViewingLabOrder(null)} order={viewingLabOrder} patient={patient} />
      <PrintImagingOrderModal onClose={() => setViewingImagingOrder(null)} order={viewingImagingOrder} patient={patient} />
      <PrintBillingModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} patient={patient} />
      <Toast message={toastMessage} tone={toastTone} visible={Boolean(toastMessage)} />
    </>
  );
}
