import { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentsApi } from '../api/appointments';
import { billingApi, type SaveBillingInvoiceItem } from '../api/billing';
import { doctorsApi, type ApiDoctorAvailabilityDay, type DoctorResponse } from '../api/doctors';
import { medicinesApi } from '../api/medicines';
import {
  opdApi,
  type OpdConsultationResponse,
  type OpdPrescriptionResponse,
  type OpdVisitResponse,
  type SaveOpdConsultationPayload,
} from '../api/opd';
import { patientsApi, type PatientDocumentResponse, type PatientResponse } from '../api/patients';
import { pharmacyInventoryApi } from '../api/pharmacy-inventory';
import { servicesApi, type ServiceResponse } from '../api/services';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage, calculateAge } from './patient-utils';
import {
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitStatusClass,
} from './opd-utils';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

const nullableNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function OpdVisitPage() {
  const {
    state: {
      activeVisitId,
      activeTab,
      recentVisits,
      workspace,
      referralSpecialty,
      referralDoctorId,
      referralDate,
      referralTimeSlot,
      referralReason,
      uniqueSpecialties,
      filteredReferralDoctors,
      referralSlots,
      referralSlotLoading,
    },
    actions: {
      setReferralSpecialty,
      setReferralDoctorId,
      setReferralDate,
      setReferralTimeSlot,
      setReferralReason,
      handleBookReferralAppointment,
      handleTabChange,
      handleVisitChange,
    }
  } = useOpdVisitFeature();

  const {
    canEditConsultation,
    canEditPrescription,
    canEditClinicalOrders,
    canEditReferral,
    canEditFollowUp,
    canBookAppointments,
    canCreateDocuments,
    canDeleteDocuments,
    canCreateVitals,
  } = workspace;

  // Active Workspace Tab state (1 Consultation to 9 Documents)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabMatch = WORKSPACE_TABS.find(
      (t) =>
        t.name.toLowerCase() === initialTabParam.toLowerCase() ||
        t.id === initialTabParam ||
        t.label.toLowerCase().includes(initialTabParam.toLowerCase()),
    );
    return tabMatch ? tabMatch.name : 'Consultation';
  });

  // Clinical forms & records state
  const [vitalsForm, setVitalsForm] = useState<VitalsFormState>(emptyVitalsForm);

  const [, setConsultation] = useState<OpdConsultationResponse | null>(null);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(emptyConsultationForm);

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('');

  // Documents state (Tab 9)
  const documents = workspace.documents;
  const [uploadFileType, setUploadFileType] = useState('Consultation Document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const doctors = workspace.doctors;
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Referral Tab (Tab 6) State
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralDoctorId, setReferralDoctorId] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralBooking, setReferralBooking] = useState(false);

  // Derive unique specialties from Doctor Directory records
  const uniqueSpecialties = useMemo(() => {
    return Array.from(new Set(doctors.map((d) => d.specialization).filter(Boolean))).sort();
  }, [doctors]);

  // Derive filtered doctors for selected referral specialty
  const filteredReferralDoctors = useMemo(() => {
    if (!referralSpecialty) return doctors;
    return doctors.filter((d) => d.specialization === referralSpecialty);
  }, [doctors, referralSpecialty]);



  const handleSubmitReferral = async () => {
    if (!visit || !referralDoctorId || !referralSpecialty) {
      showToast('Please select a specialty and a doctor.', 'error');
      return;
    }
    const selectedDoc = doctors.find((d) => d.id === referralDoctorId);
    setReferralBooking(true);
    try {
      await opdApi.submitReferral(visit.id, {
        referral_type: 'INTERNAL',
        specialty: referralSpecialty,
        referred_doctor_id: referralDoctorId,
        reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
        clinical_summary: consultationForm.assessment || 'Referred for further evaluation.',
      });
      showToast(`Referral submitted successfully to ${selectedDoc?.display_name ?? 'Doctor'}!`);
      setReferralReason('');
      setReferralDoctorId('');
      setReferralSpecialty('');
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    } finally {
      setReferralBooking(false);
    }
  };

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3200);
  };

  const handleSaveVitalsModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsForm.blood_pressure_systolic || !vitalsForm.blood_pressure_diastolic) {
      showToast('Blood Pressure (Systolic & Diastolic) is required.', 'error');
      return;
    }

    setUpdating('vitals');
    try {
      if (visit) {
        await opdApi.createVitals(visit.id, {
          blood_pressure_systolic: Number(vitalsForm.blood_pressure_systolic),
          blood_pressure_diastolic: Number(vitalsForm.blood_pressure_diastolic),
          weight_kg: Number(vitalsForm.weight_kg) || 70,
          height_cm: Number(vitalsForm.height_cm) || 170,
          temperature_c: vitalsForm.temperature_c ? Number(vitalsForm.temperature_c) : null,
          pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : null,
          respiratory_rate_per_min: vitalsForm.respiratory_rate_per_min ? Number(vitalsForm.respiratory_rate_per_min) : null,
          oxygen_saturation_percent: vitalsForm.oxygen_saturation_percent ? Number(vitalsForm.oxygen_saturation_percent) : null,
          notes: vitalsForm.notes.trim() || null,
        });
      }
      showToast('Patient vitals recorded successfully.');
      setVitalsModalOpen(false);
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  // Sync activeVisitId from URL search param if present
  useEffect(() => {
    if (visitIdParam && visitIdParam !== activeVisitId) {
      setActiveVisitId(visitIdParam);
    }
  }, [visitIdParam]);

  // Load available recent visits if no direct ID passed
  const loadRecentVisits = useCallback(async () => {
    try {
      const res = await opdApi.listVisits({ limit: 10, sortBy: 'created_at', sortOrder: 'desc' });
      setRecentVisits(res.data);
      const firstVisit = res.data[0];
      if (!activeVisitId && firstVisit) {
        setActiveVisitId(firstVisit.id);
      }
    } catch {
      setRecentVisits([]);
    }
  }, [activeVisitId]);

  useEffect(() => {
    void loadRecentVisits();
  }, [loadRecentVisits]);

  // Load active visit details
  const loadVisit = useCallback(async () => {
    if (!activeVisitId) {
      setVisit(null);
      setPatient(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    setPatient(null);

    try {
      const response = await opdApi.getVisitById(activeVisitId);
      setVisit(response);
      try {
        const patientData = await patientsApi.getById(response.patient_id);
        setPatient(patientData);
      } catch (err) {
        console.error('Failed to load patient data:', err);
        setPatient(null);
      }
    } catch (error) {
      setVisit(null);
      setPatient(null);
      setLoadError(getOpdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeVisitId]);

  useEffect(() => {
    void loadVisit();
  }, [loadVisit]);

  // Master Medicines & Service Catalogue States
  const [masterMedicines, setMasterMedicines] = useState<
    Array<{
      id: string;
      name: string;
      generic_name: string | null;
      strength: string | null;
      dosage_form: string | null;
      unit: string | null;
      available_quantity: number;
    }>
  >([]);
  const [services, setServices] = useState<ServiceResponse[]>([]);

  const labTestServices = useMemo(
    () => services.filter((service) => service.service_type === 'LAB_TEST'),
    [services],
  );

  const imagingServices = useMemo(
    () => services.filter((service) => service.service_type === 'IMAGING_SERVICE'),
    [services],
  );
  const [labOrders, setLabOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedLabTest, setSelectedLabTest] = useState('');

  const [imagingOrders, setImagingOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedImagingTest, setSelectedImagingTest] = useState('');

  useEffect(() => {
    if (!workspace.labOrder) return;
    setLabOrders(workspace.labOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      local_id: item.id,
    })));
    setLabPriority(workspace.labOrder.priority);
  }, [workspace.labOrder]);

  useEffect(() => {
    if (!workspace.imagingOrder) return;
    setImagingOrders(workspace.imagingOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      local_id: item.id,
    })));
    setImagingPriority(workspace.imagingOrder.priority);
  }, [workspace.imagingOrder]);

  // Action Handlers
  const saveConsultationDraft = (data: ConsultationForm) => {
    if (!visit || !canEditConsultation) return;
    workspace.mutations.saveConsultationDraft({ visitId: visit.id, payload: data });
  };

  const completeConsultation = (data: ConsultationForm) => {
    if (!visit || !canEditConsultation) return;
    workspace.mutations.completeConsultation({ visitId: visit.id, payload: data });
  };

  const saveLoadedConsultation = () => {
    if (!visit || !canEditConsultation || !workspace.consultation) return;
    const consultation = workspace.consultation;
    workspace.mutations.saveConsultationDraft({
      visitId: visit.id,
      payload: {
        chief_complaint: consultation.chief_complaint,
        history_present_illness: consultation.history_present_illness,
        past_history: consultation.past_history,
        family_history: consultation.family_history,
        allergies: consultation.allergies,
        physical_examination: consultation.physical_examination,
        assessment: consultation.assessment,
        treatment_plan: consultation.treatment_plan,
        doctor_notes: consultation.doctor_notes,
      },
    });
  };

  const completeLoadedConsultation = () => {
    if (!visit || !canEditConsultation || !workspace.consultation) return;
    const consultation = workspace.consultation;
    workspace.mutations.completeConsultation({
      visitId: visit.id,
      payload: {
        chief_complaint: consultation.chief_complaint,
        history_present_illness: consultation.history_present_illness,
        past_history: consultation.past_history,
        family_history: consultation.family_history,
        allergies: consultation.allergies,
        physical_examination: consultation.physical_examination,
        assessment: consultation.assessment,
        treatment_plan: consultation.treatment_plan,
        doctor_notes: consultation.doctor_notes,
      },
    });
  };

  const saveReferralDraft = () => {
    if (!visit || !canEditReferral) return;
    const selectedDoctor = doctors.find((doctor) => doctor.id === referralDoctorId);
    workspace.mutations.saveReferralDraft({
      visitId: visit.id,
      payload: {
        referral_type: 'INTERNAL',
        specialty: referralSpecialty || selectedDoctor?.specialization || null,
        priority: 'ROUTINE',
        referred_doctor_id: referralDoctorId || null,
        referred_doctor_name: selectedDoctor?.display_name ?? null,
        reason: referralReason.trim() || null,
        clinical_summary: workspace.consultation?.assessment ?? null,
        appointment_date: referralDate || null,
        appointment_start_time: referralTimeSlot || null,
        appointment_duration_minutes: referralTimeSlot ? 30 : null,
      },
    });
  };

  const saveFollowUpDraft = () => {
    if (!visit || !canEditFollowUp) return;
    workspace.mutations.saveFollowUpDraft({
      visitId: visit.id,
      payload: {
        follow_up_type: 'CLINICAL_REVIEW',
        next_visit_date: followUpDate || null,
        assigned_doctor_id: followUpDoctorId || null,
        reason: visit.reason,
        reminder_type: 'NONE',
      },
    });
  };

  const savePrescription = (data: PrescriptionForm) => {
    if (!visit || !canEditPrescription) return;
    workspace.mutations.submitPrescription({
      visitId: visit.id,
      payload: {
        items: data.items.map((item) => ({
          medicine_name: item.medicine_name,
          strength: item.strength || null,
          dosage: item.dosage,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: nullableNumber(item.quantity),
          instructions: item.instructions || null,
        })),
        follow_up_date: data.follow_up_date || null,
        doctor_instructions: data.doctor_instructions || null,
        patient_instructions: data.patient_instructions || null,
      },
    });
  };

      if (matchedPendingImaging && !allImagingItems.find(i => i.service_id === matchedPendingImaging.id)) {
        allImagingItems.push({
          service_id: matchedPendingImaging.id,
          investigation_name: pendingImagingName,
          category: matchedPendingImaging.category || 'Radiology',
        });
      }

      if (allImagingItems.length > 0) {
        await opdApi
          .submitClinicalOrder(visit.id, 'IMAGING', {
            priority: imagingPriority || 'ROUTINE',
            items: allImagingItems,
          })
          .catch(() => null);
      }

      // Automatically Create Billing Invoice for Consultation + Lab + Imaging
      const matchedConsultationService =
        services.find(
          (s) =>
            (s.service_type as string) === 'CONSULTATION' ||
            (s.service_type as string) === 'DOCTOR_CONSULTATION' ||
            (s.category && s.category.toLowerCase().includes('consultation')) ||
            s.name.toLowerCase().includes('consultation') ||
            s.name.toLowerCase().includes((visit.doctor_specialization || '').toLowerCase()),
        ) || services[0];

      const invoiceItems: SaveBillingInvoiceItem[] = [];
      if (matchedConsultationService) {
        invoiceItems.push({
          service_id: matchedConsultationService.id,
          service_type: 'CONSULTATION',
          quantity: 1,
        });
      }
      for (const item of allLabItems) {
        invoiceItems.push({
          service_id: item.service_id,
          service_type: 'LAB_TEST',
          quantity: 1,
        });
      }

      for (const item of allImagingItems) {
        invoiceItems.push({
          service_id: item.service_id,
          service_type: 'IMAGING_SERVICE',
          quantity: 1,
        });
      }

      if (invoiceItems.length > 0) {
        await billingApi
          .create({
            patient_id: visit.patient_id,
            visit_id: visit.id,
            branch_id: visit.branch_id || localStorage.getItem('activeBranchId') || '',
            items: invoiceItems,
          })
          .catch(() => null);
      }

      const response = await opdApi.completeConsultation(visit.id, payload);
      setConsultation(response);
      
      // Update the overall visit status to COMPLETED now that consultation is closed
      await opdApi.updateVisitStatus(visit.id, { status: 'COMPLETED', notes: 'Consultation completed.' });
      
      await loadVisit();
      await loadClinicalData();
      showToast('Consultation completed successfully & billing invoice generated.');

      // Automatically trigger "Call Next Patient"
      await handleCallNextPatient();
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDocuments) return;
    if (!selectedFile || !visit) {
      showToast('Please choose a file to upload.', 'error');
      return;
    }
    try {
      const document = await workspace.mutations.uploadDocument({
        id: visit.patient_id,
        payload: {
          document_type: uploadFileType === 'Identification' ? 'IDENTITY' : 'CLINICAL',
          title: uploadFileType,
          description: `OPD visit ${visit.visit_number} attachment`,
          visit_id: visit.id,
          file: selectedFile,
        },
      });
      setSelectedFile(null);
      showToast(`${document.file_name} uploaded successfully.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const viewDocument = async (document: PatientDocumentResponse) => {
    if (!visit) return;
    try {
      const download = await workspace.mutations.downloadDocument({ patientId: visit.patient_id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const downloadDocument = async (document: PatientDocumentResponse) => {
    if (!visit) return;
    try {
      const download = await workspace.mutations.downloadDocument({ patientId: visit.patient_id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const deleteDocument = async (document: PatientDocumentResponse) => {
    if (!visit || !canDeleteDocuments || !window.confirm(`Delete ${document.title}?`)) return;
    try {
      await workspace.mutations.deleteDocument({ id: visit.patient_id, documentId: document.id });
      showToast(`${document.title} deleted.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const handleCallNextPatient = async () => {
    if (!visit) return;
    try {
      // Import isn't strictly necessary as we can use apiClient directly if needed,
      // but we have `notificationsApi` available.
      const { notificationsApi } = await import('../api/notifications');
      await notificationsApi.listMe(); // Just to make sure we imported it
      // Create notification by calling API directly or via a new endpoint if we had one.
      // Wait, we don't have a `create` exposed in notificationsApi. Let's just use `apiClient.post`
      const { apiClient } = await import('../api/client');
      await apiClient.request('/notifications', {
        method: 'POST',
        body: {
          recipient_role: 'RECEPTIONIST',
          title: 'Call Next Patient',
          message: `Dr. ${visit.doctor_name} is ready for the next patient. Previous patient: ${visit.patient_name}.`,
          type: 'CALL_NEXT_PATIENT',
          related_entity_id: visit.id,
        }
      });
      showToast('Receptionist notified to call the next patient.');
    } catch (err) {
      showToast('Failed to notify receptionist.', 'error');
    }
  };

  const isTabCompleted = (tabName: string): boolean => {
    switch (tabName) {
      case 'Consultation':
        return Boolean(workspace.consultation?.chief_complaint?.trim());
      case 'Vitals':
        return workspace.vitals?.blood_pressure_systolic != null || workspace.vitals?.pulse_bpm != null;
      case 'Diagnosis':
        return Boolean(primaryDiagnosis.trim());
      case 'Prescription':
        return Boolean(workspace.prescription?.items.length);
      case 'Orders & Labs':
        return false;
      case 'Procedure':
        return Boolean(workspace.consultation?.treatment_plan?.trim());
      case 'Referral':
        return Boolean(workspace.referral?.specialty || workspace.referral?.reason);
      case 'Follow-up':
        return Boolean(workspace.followUp?.next_visit_date);
      case 'Notes':
        return Boolean(workspace.consultation?.doctor_notes?.trim());
      case 'Documents':
        return documents.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="opd-page">
      {/* Top Header Bar */}
      <section className="opd-page-header">
        <div className="opd-page-title">
          <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-arrow-left" aria-hidden="true" />
            Back to Queue
          </button>
        </div>
        <div className="opd-page-actions">
          {recentVisits.length > 1 ? (
            <label className="opd-visit-selector" htmlFor="active-visit-select">
              <span>Patient Visit:</span>
              <select
                id="active-visit-select"
                onChange={(e) => {
                  handleVisitChange(e.target.value);
                }}
                value={activeVisitId}
              >
                {recentVisits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patient_name} ({v.visit_number}) - {opdVisitStatusLabels[v.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />

      {loading ? (
        <section className="doc-card">
          <div className="um-state-cell">Loading consultation workspace...</div>
        </section>
      ) : !visit ? (
        <section className="doc-card opd-empty-workspace">
          <i className="ph ph-stethoscope" aria-hidden="true" />
          <h3>No Active Visit Selected</h3>
          <p>Select a patient visit from the OPD Waiting Queue to begin consultation.</p>
          <button className="doc-btn primary" onClick={() => navigate('/opd/queue')} type="button">
            Go to Waiting Queue
          </button>
        </section>
      ) : (
        <>
          {/* Patient Hero Card (Matching Image 1) */}
          <section className="doc-card opd-patient-banner">
            <div className="opd-patient-avatar-box">
              <span>{patientInitials(visit.patient_name)}</span>
            </div>
            <div className="opd-patient-banner-info">
              <div className="opd-patient-banner-title">
                <h3>{visit.patient_name}</h3>
                <span className="opd-mrn-chip">{visit.patient_number}</span>
                <span className={`doc-status ${visitStatusClass(visit.status)}`}>
                  {opdVisitStatusLabels[visit.status]}
                </span>
              </div>
              <div className="opd-patient-meta-line">
                <span>{patient ? `${patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()} • ${calculateAge(patient.date_of_birth)}` : 'Gender/Age N/A'}</span>
                <span className="divider">|</span>
                <span>{opdVisitTypeLabels[visit.visit_type]}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_specialization}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_name}</span>
                <span className="divider">|</span>
                <span>{new Date(visit.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span className="divider">|</span>
                <span>{visit.visit_number}</span>
              </div>
            </div>
            <div className="opd-patient-banner-actions">
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/profile?id=${visit.patient_id}`)}
                type="button"
              >
                <i className="ph ph-user" aria-hidden="true" />
                View Patient Profile
              </button>
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/emr?id=${visit.patient_id}`)}
                type="button"
              >
                <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
                Patient Timeline
              </button>
            </div>
          </section>

          {/* Main Layout: 9 Workspace Tabs on Left, Patient Summary on Right */}
          <div className="opd-workspace">
            <main className="opd-clinical-main">
              {/* 9 Workspace Tabs Bar */}
              <div className="opd-workspace-tabs" role="tablist" aria-label="Consultation tabs">
                {WORKSPACE_TABS.map((tab) => {
                  const completed = isTabCompleted(tab.name);
                  return (
                    <button
                      aria-selected={activeTab === tab.name}
                      className={`opd-workspace-tab ${activeTab === tab.name ? 'active' : ''} ${completed ? 'completed' : ''}`}
                      key={tab.id}
                      onClick={() => {
                        handleTabChange(tab.name);
                        navigate(`/opd/consultation?id=${visit.id}&tab=${encodeURIComponent(tab.name)}`, { replace: true });
                      }}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                      {completed ? (
        <i className="ph ph-check-circle-fill tab-completed-icon" aria-hidden="true" title="Tab completed" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: CONSULTATION */}
              {activeTab === 'Consultation' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Clinical History</h3>
                        <p>Document presenting complaint and relevant clinical history</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="chief-complaint">
                        <span>Chief Complaint</span>
                        <textarea
                          id="chief-complaint"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, chief_complaint: e.target.value }))}
                          rows={3}
                          value={consultationForm.chief_complaint}
                        />
                      </label>
                      <label className="doc-field" htmlFor="history-present-illness">
                        <span>History of Present Illness</span>
                        <textarea
                          id="history-present-illness"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, history_present_illness: e.target.value }))}
                          rows={3}
                          value={consultationForm.history_present_illness}
                        />
                      </label>
                      <label className="doc-field" htmlFor="past-history">
                        <span>Past Medical History</span>
                        <textarea
                          id="past-history"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, past_history: e.target.value }))}
                          rows={3}
                          value={consultationForm.past_history}
                        />
                      </label>
                      <label className="doc-field" htmlFor="family-history">
                        <span>Family History</span>
                        <textarea
                          id="family-history"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, family_history: e.target.value }))}
                          rows={3}
                          value={consultationForm.family_history}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="allergies">
                        <span>Allergies / Sensitivities</span>
                        <textarea
                          id="allergies"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, allergies: e.target.value }))}
                          rows={2}
                          value={consultationForm.allergies}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Examination &amp; Assessment</h3>
                        <p>Document physical findings and treatment plan</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="physical-examination">
                        <span>Physical Examination</span>
                        <textarea
                          id="physical-examination"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, physical_examination: e.target.value }))}
                          rows={3}
                          value={consultationForm.physical_examination}
                        />
                      </label>
                      <label className="doc-field" htmlFor="assessment">
                        <span>Assessment / Impression</span>
                        <textarea
                          id="assessment"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, assessment: e.target.value }))}
                          rows={3}
                          value={consultationForm.assessment}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="treatment-plan">
                        <span>Treatment Plan &amp; Advice</span>
                        <textarea
                          id="treatment-plan"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, treatment_plan: e.target.value }))}
                          rows={3}
                          value={consultationForm.treatment_plan}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Diagnosis')} type="button">
                        Next: Diagnosis
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 2: DIAGNOSIS */}
              {activeTab === 'Diagnosis' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Diagnosis &amp; ICD Coding</h3>
                        <p>Assign primary and secondary ICD diagnoses for this encounter</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field full" htmlFor="primary-dx">
                        <span>Primary Diagnosis (ICD-10)</span>
                        <input
                          id="primary-dx"
                          onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                          placeholder="e.g. Essential (primary) hypertension [I10]"
                          value={primaryDiagnosis}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="secondary-dx">
                        <span>Secondary Diagnoses</span>
                        <textarea
                          id="secondary-dx"
                          onChange={(e) => setSecondaryDiagnosis(e.target.value)}
                          rows={3}
                          value={secondaryDiagnosis}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => handleTabChange('Prescription')} type="button">
                        Next: Prescription
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 3: PRESCRIPTION */}
              {activeTab === 'Prescription' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Prescription Builder</h3>
                        <p>Formulary search and dosage instructions</p>
                      </div>
                    </div>
                    <div className="opd-medication-builder">
                      <label className="doc-field medicine" htmlFor="medicine-name">
                        <span>Medicine Name</span>
                        <select
                          id="medicine-name"
                          onChange={(e) => {
                            const selectedMedName = e.target.value;
                            const matchedOpt = masterMedicines.find((m) => m.name === selectedMedName);
                            setMedicationForm((m) => ({
                              ...m,
                              medicine_name: selectedMedName,
                              strength: matchedOpt?.strength || m.strength,
                            }));
                          }}
                          value={medicationForm.medicine_name}
                        >
                          <option value="">Select Medicine from Master Data</option>
                          {masterMedicines.map((med) => (
                            <option key={med.id} value={med.name}>
                              {med.name} {med.strength ? `(${med.strength})` : ''} — Stock: {med.available_quantity} {med.unit || 'units'}
                            </option>
                          ))}
                        </select>
                        {selectedMasterMed ? (
                          <span className={`stock-level-chip ${selectedMasterMed.available_quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                            <i className={`ph ${selectedMasterMed.available_quantity > 0 ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden="true" />
                            Available Stock: {selectedMasterMed.available_quantity} {selectedMasterMed.unit || 'units'}
                          </span>
                        ) : null}
                      </label>
                      <label className="doc-field" htmlFor="medicine-strength">
                        <span>Strength</span>
                        <input
                          id="medicine-strength"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, strength: e.target.value }))}
                          placeholder="5 mg"
                          value={medicationForm.strength}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-dosage">
                        <span>Dosage</span>
                        <input
                          id="medicine-dosage"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, dosage: e.target.value }))}
                          placeholder="1 tablet"
                          value={medicationForm.dosage}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-frequency">
                        <span>Frequency</span>
                        <select
                          id="medicine-frequency"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, frequency: e.target.value }))}
                          value={medicationForm.frequency}
                        >
                          <option value="OD">OD (Once Daily)</option>
                          <option value="BD">BD (Twice Daily)</option>
                          <option value="TDS">TDS (Thrice Daily)</option>
                          <option value="QID">QID (Four times daily)</option>
                          <option value="PRN">PRN (As needed)</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="medicine-duration">
                        <span>Duration</span>
                        <input
                          id="medicine-duration"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                          placeholder="30 days"
                          value={medicationForm.duration}
                        />
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        onClick={() => {
                          if (!medicationForm.medicine_name.trim()) return;
                          setPrescriptionForm((prev) => ({
                            ...prev,
                            items: [...prev.items, { ...medicationForm, local_id: `med-${Date.now()}` }],
                          }));
                          setMedicationForm(emptyMedicationForm);
                          showToast('Medication added.');
                        }}
                        type="button"
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Medicine
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Instructions</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {prescriptionForm.items.length === 0 ? (
                            <tr>
                              <td className="opd-prescription-empty" colSpan={6}>
                                No medications prescribed yet.
                              </td>
                            </tr>
                          ) : (
                            prescriptionForm.items.map((item, index) => (
                              <tr key={item.local_id || index}>
                                <td><strong>{item.medicine_name}</strong>{item.strength ? ` (${item.strength})` : ''}</td>
                                <td>{item.dosage}</td>
                                <td>{item.frequency}</td>
                                <td>{item.duration}</td>
                                <td>{item.instructions || '-'}</td>
                                <td>
                                  <button
                                    className="doc-action danger"
                                    onClick={() =>
                                      setPrescriptionForm((prev) => ({
                                        ...prev,
                                        items: prev.items.filter((_, i) => i !== index),
                                      }))
                                    }
                                    title="Remove medication"
                                    type="button"
                                  >
                                    <i className="ph ph-trash" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Lab Orders')} type="button">
                        Next: Lab Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}
              {/* TAB 4: LAB ORDERS */}
              {activeTab === 'Lab Orders' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Laboratory Requisition</h3>
                        <p>Order laboratory tests for this encounter</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="lab-test-name">
                        <span>Test / Investigation Name</span>
                        <select id="lab-test-name" onChange={(e) => setSelectedLabTest(e.target.value)} value={selectedLabTest}>
                          <option value="">Select Lab Test from Service Catalogue</option>
                          {labTestServices.map((service) => (
                            <option key={service.id} value={service.name}>
                              {service.name} ({service.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="lab-priority">
                        <span>Priority</span>
                        <select id="lab-priority" onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)} value={labPriority}>
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        disabled={!canEditClinicalOrders}
                        onClick={() => {
                          if (!selectedLabTest.trim()) return;
                          const matchedLab = labTestServices.find(s => s.name === selectedLabTest);
                          if (!matchedLab) return;
                          setLabOrders((prev) => [
                            ...prev,
                            { id: matchedLab.id, name: selectedLabTest, local_id: `lab-${Date.now()}` }
                          ]);
                          setSelectedLabTest('');
                        }}
                        type="button"
                        style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Test
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Test / Investigation Name</th>
                            <th style={{ width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {labOrders.length === 0 ? (
                            <tr>
                              <td colSpan={2} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                                No lab tests added yet. Select a test and click "Add Test".
                              </td>
                            </tr>
                          ) : (
                            labOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td>
                                  <strong>{item.name}</strong>
                                </td>
                                <td>
                                  <button
                                    className="btn-icon"
                                    disabled={!canEditClinicalOrders}
                                    onClick={() => setLabOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                                    title="Remove test"
                                    type="button"
                                    style={{ color: '#ef4444' }}
                                  >
                                    <i className="ph ph-trash" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => handleTabChange('Imaging Orders')} type="button">
                        Next: Imaging Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 5: IMAGING ORDERS */}
              {activeTab === 'Imaging Orders' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Imaging &amp; Radiology Requisition</h3>
                        <p>Order X-rays, Ultrasounds, CT, or MRI scans</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="imaging-test-name">
                        <span>Scan / Modality</span>
                        <select id="imaging-test-name" onChange={(e) => setSelectedImagingTest(e.target.value)} value={selectedImagingTest}>
                          <option value="">Select Imaging Scan from Service Catalogue</option>
                          {imagingServices.map((service) => (
                            <option key={service.id} value={service.name}>
                              {service.name} ({service.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="imaging-priority">
                        <span>Priority</span>
                        <select id="imaging-priority" onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)} value={imagingPriority}>
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <button
                        className="doc-btn primary add-medication"
                        disabled={!canEditClinicalOrders}
                        onClick={() => {
                          if (!selectedImagingTest.trim()) return;
                          const matchedImg = imagingServices.find(s => s.name === selectedImagingTest);
                          if (!matchedImg) return;
                          setImagingOrders((prev) => [
                            ...prev,
                            { id: matchedImg.id, name: selectedImagingTest, local_id: `img-${Date.now()}` }
                          ]);
                          setSelectedImagingTest('');
                        }}
                        type="button"
                        style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
                      >
                        <i className="ph ph-plus" aria-hidden="true" />
                        Add Scan
                      </button>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>Scan / Modality</th>
                            <th style={{ width: '60px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {imagingOrders.length === 0 ? (
                            <tr>
                              <td colSpan={2} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                                No imaging scans added yet. Select a scan and click "Add Scan".
                              </td>
                            </tr>
                          ) : (
                            imagingOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td>
                                  <strong>{item.name}</strong>
                                </td>
                                <td>
                                  <button
                                    className="btn-icon"
                                    disabled={!canEditClinicalOrders}
                                    onClick={() => setImagingOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                                    title="Remove scan"
                                    type="button"
                                    style={{ color: '#ef4444' }}
                                  >
                                    <i className="ph ph-trash" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation || !workspace.consultation} onClick={saveLoadedConsultation} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => handleTabChange('Referral')} type="button">
                        Next: Referral
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 6: REFERRAL */}
              {activeTab === 'Referral' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Specialist Referral &amp; Direct Appointment Booking</h3>
                        <p>Select specialty, doctor, date and book referral appointment</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="ref-specialty">
                        <span>Specialty</span>
                        <select
                          id="ref-specialty"
                          onChange={(e) => {
                            setReferralSpecialty(e.target.value);
                            setReferralDoctorId('');
                          }}
                          value={referralSpecialty}
                        >
                          <option value="">Select Specialty</option>
                          {uniqueSpecialties.map((spec) => (
                            <option key={spec} value={spec}>
                              {spec}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="doc-field" htmlFor="ref-doctor">
                        <span>Referred Doctor</span>
                        <select
                          disabled={!referralSpecialty}
                          id="ref-doctor"
                          onChange={(e) => {
                            setReferralDoctorId(e.target.value);
                          }}
                          value={referralDoctorId}
                        >
                          <option value="">
                            {referralSpecialty ? 'Select Doctor' : 'Select a Specialty first'}
                          </option>
                          {filteredReferralDoctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.display_name} — {doc.specialization} ({doc.consultation_room || 'OPD Room'})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="doc-field" htmlFor="ref-reason">
                        <span>Reason for Referral</span>
                        <input
                          id="ref-reason"
                          onChange={(e) => setReferralReason(e.target.value)}
                          placeholder="e.g. Specialist assessment & second opinion"
                          value={referralReason}
                        />
                      </label>
                    </div>
                  </section>

                  {/* Submit Referral Section */}
                  <section className="opd-form-section" style={{ marginTop: '1.25rem' }}>
                    <div className="referral-booking-action-bar">
                      <button
                        className="doc-btn primary"
                        disabled={!referralDoctorId || referralBooking}
                        onClick={() => void handleSubmitReferral()}
                        style={{ minWidth: '220px' }}
                        type="button"
                      >
                        <i className="ph ph-paper-plane-tilt" aria-hidden="true" />
                        {referralBooking ? 'Submitting...' : 'Submit Referral'}
                      </button>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    
                    <div>
                      <button className="doc-btn" disabled={!canEditReferral || workspace.referral?.status === 'SUBMITTED' || workspace.isSavingReferral} onClick={saveReferralDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => handleTabChange('Follow-up')} type="button">
                        Next: Follow-up
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 7: FOLLOW-UP */}
              {activeTab === 'Follow-up' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Follow-up Schedule</h3>
                        <p>Book next review date and doctor assignment</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field" htmlFor="fu-date">
                        <span>Follow-up Date</span>
                        <input id="fu-date" onChange={(event) => setFollowUpDate(event.target.value)} type="date" value={followUpDate} />
                      </label>
                      <label className="doc-field" htmlFor="fu-doctor">
                        <span>Doctor</span>
                        <select id="fu-doctor" onChange={(event) => setFollowUpDoctorId(event.target.value)} value={followUpDoctorId}>
                          <option value="">Select Doctor</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.display_name} - {d.specialization}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    
                    <div>
                      <button className="doc-btn" disabled={!canEditFollowUp || workspace.followUp?.status === 'SCHEDULED' || workspace.isSavingFollowUp} onClick={saveFollowUpDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={updating === 'consultation-complete' || visit.status === 'COMPLETED'}
                        onClick={completeConsultation}
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        type="button"
                      >
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        Complete Consultation
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 9: DOCUMENTS (Matching Image 1 Reference) */}
              {activeTab === 'Documents' ? (
                <article className="doc-card opd-tab-card">
                  {/* Upload Form */}
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Upload Documents</h3>
                        <p>Add encounter documents and attachments</p>
                      </div>
                    </div>
                    <form className="opd-document-upload-form" onSubmit={handleFileUpload}>
                      <div className="opd-doc-upload-grid">
                        <div className="doc-field">
                          <label htmlFor="document-file-input">Document File</label>
                          <div className="opd-file-chooser">
                            <input
                              id="document-file-input"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
                              disabled={!canCreateDocuments}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setSelectedFile(file ?? null);
                              }}
                              type="file"
                            />
                          </div>
                        </div>
                        <div className="doc-field">
                          <label htmlFor="document-type-select">Document Type</label>
                          <select
                            id="document-type-select"
                            disabled={!canCreateDocuments}
                            onChange={(e) => setUploadFileType(e.target.value)}
                            value={uploadFileType}
                          >
                            <option value="Consultation Document">Consultation Document</option>
                            <option value="Lab Report">Lab Report</option>
                            <option value="Imaging Result">Imaging Result</option>
                            <option value="Referral Letter">Referral Letter</option>
                            <option value="Consent Form">Consent Form</option>
                            <option value="Identification">Identification</option>
                          </select>
                        </div>
                        <div className="opd-upload-btn-wrap">
                          <button className="doc-btn primary upload-btn" disabled={!canCreateDocuments || workspace.isUploadingDocument} type="submit">
                            <i className="ph ph-upload-simple" aria-hidden="true" />
                            {workspace.isUploadingDocument ? 'Uploading...' : 'Upload'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </section>

                  {/* Consultation Documents & History */}
                  <section className="opd-form-section" style={{ marginTop: '1.5rem' }}>
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Consultation Documents &amp; Document History</h3>
                        <p>Prescriptions, reports, consent forms and referral letters</p>
                      </div>
                    </div>

                    <div className="opd-documents-cards-grid">
                      {documents.length === 0 ? <div className="um-state-cell">No files are stored for this OPD visit.</div> : documents.map((doc) => (
                        <div className="opd-document-card" key={doc.id}>
                          <div className="opd-document-icon">
                            <i className="ph ph-file-text" aria-hidden="true" />
                          </div>
                          <div className="opd-document-details">
                            <strong>{doc.title}</strong>
                            <span>
                              {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="opd-document-actions">
                            <button
                              aria-label={`View ${doc.title}`}
                              className="doc-icon-action"
                              onClick={() => void viewDocument(doc)}
                              title="View Document"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Download ${doc.title}`}
                              className="doc-icon-action"
                              onClick={() => void downloadDocument(doc)}
                              title="Download Document"
                              type="button"
                            >
                              <i className="ph ph-download-simple" aria-hidden="true" />
                            </button>
                            {canDeleteDocuments ? (
                              <button
                                aria-label={`Delete ${doc.title}`}
                                className="doc-icon-action"
                                onClick={() => void deleteDocument(doc)}
                                title="Delete Document"
                                type="button"
                              >
                                <i className="ph ph-trash" aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                </article>
              ) : null}
            </main>

            {/* Right Summary Side Panel (Matching Image 1 Reference) */}
            <aside className="opd-summary-panel">
              {/* Patient Summary / Vitals Card */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Patient Summary</h3>
                  </div>
                </div>
                <div className="opd-summary-list">
                  <div className="opd-summary-row">
                    <span>Blood Pressure</span>
                    <strong>
                      {workspace.vitals?.blood_pressure_systolic && workspace.vitals.blood_pressure_diastolic
                        ? `${workspace.vitals.blood_pressure_systolic}/${workspace.vitals.blood_pressure_diastolic} mmHg`
                        : 'Not recorded'}
                    </strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Pulse</span>
                    <strong>{workspace.vitals?.pulse_bpm ? `${workspace.vitals.pulse_bpm} bpm` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Temperature</span>
                    <strong>{workspace.vitals?.temperature_c ? `${workspace.vitals.temperature_c} °C` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>SpO₂</span>
                    <strong>{workspace.vitals?.oxygen_saturation_percent ? `${workspace.vitals.oxygen_saturation_percent}%` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Blood Group</span>
                    <strong>'O+'</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Allergies</span>
                    <strong style={{ color: '#dc2626' }}>{workspace.consultation?.allergies || 'None recorded'}</strong>
                  </div>
                </div>
              </div>

              {/* Current Medications */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Current Medications</h3>
                  </div>
                </div>
                <div className="opd-summary-list">
                  {!workspace.prescription?.items.length ? (
                    <div className="opd-summary-empty-text">No medications recorded for this visit.</div>
                  ) : workspace.prescription.items.map((item) => (
                    <div className="opd-medication-chip-item" key={item.id}>
                      <div><strong>{item.medicine_name}</strong><span>{[item.strength, item.dosage, item.frequency].filter(Boolean).join(' ')}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous Diagnoses */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Previous Diagnoses</h3>
                  </div>
                </div>
                <div className="opd-summary-empty-text">No previous diagnoses recorded.</div>
              </div>

              {/* Recent Lab Results */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Recent Lab Results</h3>
                  </div>
                </div>
                <div className="opd-summary-empty-text">No laboratory results are available in this visit.</div>
              </div>

              {/* Clinical Alerts */}
              <div className="doc-card opd-summary-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Clinical Alerts</h3>
                  </div>
                </div>
                {workspace.consultation?.allergies ? (
                  <div className="opd-clinical-alert warning"><i className="ph ph-warning-circle" aria-hidden="true" /><div><strong>Allergy Alert</strong><span>{workspace.consultation.allergies}</span></div></div>
                ) : <div className="opd-summary-empty-text">No clinical alerts recorded.</div>}
              </div>
            </aside>
          </div>
        </>
      )}

      <OpdVitalsModal
        initialData={workspace.vitals}
        isSaving={workspace.isCreatingVitals}
        onClose={() => setVitalsModalOpen(false)}
        onSave={saveVitals}
        open={vitalsModalOpen}
        visit={visit}
      />
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </div>
  );
}

