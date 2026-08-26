import { useCallback, useEffect, useMemo, useState } from 'react';
import { billingApi, type SaveBillingInvoiceItem } from '../api/billing';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { medicinesApi } from '../api/medicines';
import {
  opdApi,
  type ApiClinicalOrderPriority,
  type OpdConsultationResponse,
  type OpdPrescriptionResponse,
  type OpdVisitResponse,
  type SaveOpdConsultationPayload,
} from '../api/opd';
import { patientsApi, type PatientDocumentResponse, type PatientResponse } from '../api/patients';
import { pharmacyInventoryApi } from '../api/pharmacy-inventory';
import { servicesApi, type ServiceResponse } from '../api/services';
import { ICD10_DIAGNOSES, type Icd10Diagnosis } from '../data/icd10-diagnoses';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

import {
  ClinicalVitalCard,
  evaluateDiastolicBp,
  evaluatePulse,
  evaluateRespiratoryRate,
  evaluateSpo2,
  evaluateSystolicBp,
  evaluateTemperature,
} from '../components/ui/ClinicalVitalCard';
import { navigate, useAppLocation } from '../routing/navigation';
import { useCallNextOpdPatient } from '../hooks/opd/useOpd';
import { getPatientErrorMessage, calculateAge } from './patient-utils';
import {
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  visitStatusClass,
} from './opd-utils';

import { useOpdVisitFeature } from '../hooks/opd/useOpdVisitFeature';
import {
  OpdConsultationTab,
  type ConsultationForm,
  OpdPrescriptionTab,
  type PrescriptionForm,
  OpdVitalsModal,
  type VitalsForm,
  OpdLabOrdersTab,
  OpdImagingOrdersTab,
  OpdReferralTab,
} from '../components/opd';
import type { ApiClinicalOrderPriority } from '../api/opd';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

export function OpdVisitPage() {
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';
  const callNextPatient = useCallNextOpdPatient();

  // Active visit and selection state
  const [activeVisitId, setActiveVisitId] = useState(visitIdParam);
  const [recentVisits, setRecentVisits] = useState<OpdVisitResponse[]>([]);
  const [visit, setVisit] = useState<OpdVisitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState('');

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

  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(emptyPrescriptionForm);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(emptyMedicationForm);

  // Documents state (Tab 9)
  const [documents, setDocuments] = useState<PatientDocumentResponse[]>([]);
  const [uploadFileType, setUploadFileType] = useState('Consultation Document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
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
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
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
      } catch {
        // patient data load failed â€” continue without patient details
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
    () => services.filter((s) => s.service_type === 'LAB_TEST'),
    [services],
  );

  const imagingServices = useMemo(
    () => services.filter((s) => s.service_type === 'IMAGING_SERVICE'),
    [services],
  );

  // Sub-tab 2: Diagnosis State
  const [dxSearchTerm, setDxSearchTerm] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Icd10Diagnosis[]>([]);

  const filteredIcd10 = useMemo(() => {
    if (!dxSearchTerm.trim()) {
      return ICD10_DIAGNOSES.slice(0, 8);
    }
    const q = dxSearchTerm.toLowerCase();
    return ICD10_DIAGNOSES.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [dxSearchTerm]);

  const handleAddDiagnosis = (dx: Icd10Diagnosis) => {
    if (selectedDiagnoses.some((d) => d.code === dx.code)) return;
    const next = [...selectedDiagnoses, dx];
    setSelectedDiagnoses(next);
    setConsultationForm((prev) => ({
      ...prev,
      assessment: prev.assessment ? `${prev.assessment}\n${dx.code} - ${dx.name}` : `${dx.code} - ${dx.name}`,
    }));
  };

  const handleRemoveDiagnosis = (code: string) => {
    const next = selectedDiagnoses.filter((d) => d.code !== code);
    setSelectedDiagnoses(next);
  };

  // Sub-tab 4: Lab Orders State
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  const labFacilities = useMemo(() => {
    const list: string[] = [];
    branches.forEach((b) => {
      if (b.name) list.push(`${b.name} - Laboratory`);
    });
    departments
      .filter(
        (d) =>
          d.name.toLowerCase().includes('lab') ||
          d.name.toLowerCase().includes('pathology') ||
          d.name.toLowerCase().includes('diagnostic'),
      )
      .forEach((d) => {
        if (!list.includes(d.name)) list.push(d.name);
      });
    if (list.length === 0) {
      list.push('Main Branch - Laboratory');
    }
    return list;
  }, [branches, departments]);

  const [labOrders, setLabOrders] = useState<Array<{ id: string; name: string; local_id: string; category?: string }>>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [labFacility, setLabFacility] = useState('Main Branch - Laboratory');
  const [labSampleType, setLabSampleType] = useState('Blood');
  const [labCategory, setLabCategory] = useState('All');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [labOrderSummary, setLabOrderSummary] = useState('');

  const labCategoryOptions = useMemo(() => {
    const dbCats = Array.from(
      new Set(
        labTestServices
          .map((s) => s.category?.trim())
          .filter((cat): cat is string => Boolean(cat && cat.length > 0)),
      ),
    );
    return dbCats.length > 0 ? [...dbCats, 'All'] : ['All'];
  }, [labTestServices]);

  const labSampleTypeOptions = useMemo(() => {
    const dbSamples = Array.from(
      new Set(
        labTestServices
          .map((s) => s.sample_type?.trim())
          .filter((st): st is string => Boolean(st && st.length > 0)),
      ),
    );
    const standardSamples = [
      'Blood',
      'Serum',
      'Plasma',
      'Urine',
      'Stool',
      'Sputum',
      'Throat Swab',
      'CSF (Cerebrospinal Fluid)',
      'Tissue / Biopsy',
      'Synovial Fluid',
    ];
    return Array.from(new Set([...dbSamples, ...standardSamples]));
  }, [labTestServices]);

  const availableLabTests = useMemo(() => {
    if (!labCategory || labCategory === 'All') return labTestServices;
    const cat = labCategory.toLowerCase();
    const matched = labTestServices.filter((s) => (s.category && s.category.toLowerCase().includes(cat)) || s.name.toLowerCase().includes(cat));
    return matched.length > 0 ? matched : labTestServices;
  }, [labTestServices, labCategory]);

  const handleToggleLabTest = (test: ServiceResponse) => {
    if (labOrders.some((o) => o.id === test.id)) {
      setLabOrders((prev) => prev.filter((o) => o.id !== test.id));
    } else {
      if (test.sample_type && test.sample_type.trim()) {
        setLabSampleType(test.sample_type);
      }
      setLabOrders((prev) => [
        ...prev,
        {
          id: test.id,
          name: test.name,
          local_id: `lab-${Date.now()}-${Math.random()}`,
          category: test.category || labCategory,
        },
      ]);
    }
  };

  // Sub-tab 5: Imaging Orders State
  const [imagingOrders, setImagingOrders] = useState<Array<{ id: string; name: string; local_id: string; category?: string }>>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [imagingCategory, setImagingCategory] = useState('All');
  const [imagingClinicalInfo, setImagingClinicalInfo] = useState('');
  const [imagingOrderInstructions, setImagingOrderInstructions] = useState('');

  const imagingCategoryOptions = useMemo(() => {
    const dbCats = Array.from(
      new Set(
        imagingServices
          .map((s) => s.category?.trim())
          .filter((cat): cat is string => Boolean(cat && cat.length > 0)),
      ),
    );
    return dbCats.length > 0 ? [...dbCats, 'All'] : ['All'];
  }, [imagingServices]);

  const availableImagingTests = useMemo(() => {
    if (!imagingCategory || imagingCategory === 'All') return imagingServices;
    const cat = imagingCategory.toLowerCase();
    const matched = imagingServices.filter((s) => (s.category && s.category.toLowerCase().includes(cat)) || s.name.toLowerCase().includes(cat));
    return matched.length > 0 ? matched : imagingServices;
  }, [imagingServices, imagingCategory]);

  const handleToggleImagingTest = (test: ServiceResponse) => {
    if (imagingOrders.some((o) => o.id === test.id)) {
      setImagingOrders((prev) => prev.filter((o) => o.id !== test.id));
    } else {
      setImagingOrders((prev) => [
        ...prev,
        {
          id: test.id,
          name: test.name,
          local_id: `img-${Date.now()}-${Math.random()}`,
          category: test.category || imagingCategory,
        },
      ]);
    }
  };

  // Load patient clinical sub-resources
  const loadClinicalData = useCallback(async () => {
    if (!activeVisitId) return;

    try {
      const [vitalsRes, consultRes, prescriptionRes, docRes, medRes, invRes, servRes, labOrderRes, imagingOrderRes, branchRes, deptRes] =
        await Promise.allSettled([
          opdApi.getLatestVitals(activeVisitId),
          opdApi.getConsultation(activeVisitId),
          opdApi.getPrescription(activeVisitId),
          doctorsApi.list({ limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
          medicinesApi.list({ status: 'ACTIVE', limit: 100 }),
          pharmacyInventoryApi.list({ branch_id: visit?.branch_id || '', limit: 100 }).catch(() => ({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } })),
          servicesApi.list({ status: 'ACTIVE', limit: 100 }),
          opdApi.getClinicalOrder(activeVisitId, 'LABORATORY'),
          opdApi.getClinicalOrder(activeVisitId, 'IMAGING'),
          branchesApi.list({ status: 'ACTIVE', limit: 100 }),
          departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
        ]);

      if (branchRes.status === 'fulfilled' && branchRes.value?.data) {
        setBranches(branchRes.value.data);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value?.data) {
        setDepartments(deptRes.value.data);
      }

      if (labOrderRes.status === 'fulfilled' && labOrderRes.value?.items?.length) {
        setLabOrders(labOrderRes.value.items.map(i => ({ id: i.service_id, name: i.investigation_name, category: i.category, local_id: i.id || `lab-${Date.now()}-${Math.random()}` })));
        if (labOrderRes.value.priority) setLabPriority(labOrderRes.value.priority);
        if (labOrderRes.value.destination) setLabFacility(labOrderRes.value.destination);
        if (labOrderRes.value.specimen_type) setLabSampleType(labOrderRes.value.specimen_type);
        if (labOrderRes.value.clinical_notes) setLabClinicalNotes(labOrderRes.value.clinical_notes);
        if (labOrderRes.value.instructions) setLabOrderSummary(labOrderRes.value.instructions);
      }
      if (imagingOrderRes.status === 'fulfilled' && imagingOrderRes.value?.items?.length) {
        setImagingOrders(imagingOrderRes.value.items.map(i => ({ id: i.service_id, name: i.investigation_name, category: i.category, local_id: i.id || `img-${Date.now()}-${Math.random()}` })));
        if (imagingOrderRes.value.priority) setImagingPriority(imagingOrderRes.value.priority);
        if (imagingOrderRes.value.clinical_notes) setImagingClinicalInfo(imagingOrderRes.value.clinical_notes);
        if (imagingOrderRes.value.instructions) setImagingOrderInstructions(imagingOrderRes.value.instructions);
      }

      if (servRes.status === 'fulfilled' && servRes.value?.data) {
        setServices(servRes.value.data);
      }

      if (medRes.status === 'fulfilled' && medRes.value?.data) {
        const invMapId: Record<string, { available: number; unit?: string }> = {};
        const invMapName: Record<string, { available: number; unit?: string }> = {};
        if (invRes.status === 'fulfilled' && invRes.value?.data) {
          invRes.value.data.forEach((item) => {
            const info = { available: item.available_quantity, unit: item.medicine?.name };
            invMapId[item.medicine_id] = info;
            if (item.medicine?.name) invMapName[item.medicine.name] = info;
          });
        }

        const combined = medRes.value.data.map((m) => {
          const invMatch = invMapId[m.id] || invMapName[m.name];
          return {
            id: m.id,
            name: m.name,
            generic_name: m.generic_name,
            strength: m.strength,
            dosage_form: m.dosage_form,
            unit: invMatch?.unit || m.unit || 'units',
            available_quantity: invMatch?.available ?? 120,
          };
        });
        setMasterMedicines(combined);
      }

      if (vitalsRes.status === 'fulfilled' && vitalsRes.value) {
        setVitalsForm({
          blood_pressure_systolic: vitalsRes.value.blood_pressure_systolic?.toString() ?? '',
          blood_pressure_diastolic: vitalsRes.value.blood_pressure_diastolic?.toString() ?? '',
          weight_kg: vitalsRes.value.weight_kg?.toString() ?? '',
          height_cm: vitalsRes.value.height_cm?.toString() ?? '',
          temperature_c: vitalsRes.value.temperature_c?.toString() ?? '',
          pulse_bpm: vitalsRes.value.pulse_bpm?.toString() ?? '',
          respiratory_rate_per_min: vitalsRes.value.respiratory_rate_per_min?.toString() ?? '',
          oxygen_saturation_percent: vitalsRes.value.oxygen_saturation_percent?.toString() ?? '',
          notes: vitalsRes.value.notes ?? '',
        });
      }
      if (consultRes.status === 'fulfilled' && consultRes.value) {
        setConsultation(consultRes.value);
        setConsultationForm(consultationFormFromRecord(consultRes.value));
        const assessmentVal = consultRes.value?.assessment;
        if (assessmentVal) {
          const matched = ICD10_DIAGNOSES.filter(
            (d) =>
              assessmentVal.toLowerCase().includes(d.code.toLowerCase()) ||
              assessmentVal.toLowerCase().includes(d.name.toLowerCase()),
          );
          if (matched.length > 0) {
            setSelectedDiagnoses(matched);
          }
        }
      }
      if (prescriptionRes.status === 'fulfilled' && prescriptionRes.value) {
        setPrescriptionForm(prescriptionFormFromRecord(prescriptionRes.value));
      }
      if (docRes.status === 'fulfilled') setDoctors(docRes.value.data);
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    }
  }, [activeVisitId]);

  useEffect(() => {
    const labOrderData = workspace.labOrder;
    const imagingOrderData = workspace.imagingOrder;
    if (labOrderData) {
      const labs = (labOrderData.items ?? []).map((i) => ({
        id: i.service_id,
        name: i.investigation_name || 'Lab Test',
        local_id: `lab-${i.id || Date.now()}`,
      }));
      setLabOrders(labs);
    } else {
      setLabOrders([]);
    }
    if (imagingOrderData) {
      const imaging = (imagingOrderData.items ?? []).map((i) => ({
        id: i.service_id,
        name: i.investigation_name || 'Imaging Test',
        local_id: `img-${i.id || Date.now()}`,
      }));
      setImagingOrders(imaging);
    } else {
      setImagingOrders([]);
    }
  }, [workspace.labOrder, workspace.imagingOrder]);

  if (!activeVisitId) {
    return (
      <div className="layout-content opd-workspace">
        <Toast message="" visible={false} />
        <div className="page-header">
          <div>
            <h1>OPD Consultation</h1>
            <p className="subtitle">Select a patient visit from the queue to begin</p>
          </div>
        </div>
        <div className="empty-state">
          <i className="ph ph-stethoscope" aria-hidden="true" />
          <p>No active OPD visits available.</p>
        </div>
      </div>
    );
  }

  // Action Handlers
  const saveConsultationDraft = async () => {
    if (!visit) return;
    setUpdating('consultation-draft');
    try {
      const payload: SaveOpdConsultationPayload = {
        allergies: consultationForm.allergies.trim() || null,
        assessment: consultationForm.assessment.trim() || null,
        chief_complaint: consultationForm.chief_complaint.trim() || null,
        doctor_notes: consultationForm.doctor_notes.trim() || null,
        family_history: consultationForm.family_history.trim() || null,
        history_present_illness: consultationForm.history_present_illness.trim() || null,
        past_history: consultationForm.past_history.trim() || null,
        physical_examination: consultationForm.physical_examination.trim() || null,
        treatment_plan: consultationForm.treatment_plan.trim() || null,
      };
      const response = await opdApi.saveConsultationDraft(visit.id, payload);
      setConsultation(response);

      // Also persist prescription draft if items exist
      if (prescriptionForm.items.length > 0) {
        await opdApi
          .savePrescriptionDraft(visit.id, {
            items: prescriptionForm.items.map((i) => ({
              medicine_name: i.medicine_name,
              strength: i.strength || null,
              dosage: i.dosage,
              route: i.route || 'ORAL',
              frequency: i.frequency,
              duration: i.duration,
              quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
              instructions: i.instructions || null,
            })),
            follow_up_date: prescriptionForm.follow_up_date || null,
            doctor_instructions: prescriptionForm.doctor_instructions || null,
            patient_instructions: prescriptionForm.patient_instructions || null,
          })
          .catch(() => null);
      }

      // Also persist lab order draft if items exist
      if (labOrders.length > 0) {
        await opdApi
          .saveClinicalOrderDraft(visit.id, 'LABORATORY', {
            priority: labPriority || 'ROUTINE',
            destination: labFacility,
            specimen_type: labSampleType,
            clinical_notes: labClinicalNotes || null,
            instructions: labOrderSummary || null,
            items: labOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category || labCategory || 'Hematology',
            })),
          })
          .catch(() => null);
      }

      // Also persist imaging order draft if items exist
      if (imagingOrders.length > 0) {
        await opdApi
          .saveClinicalOrderDraft(visit.id, 'IMAGING', {
            priority: imagingPriority || 'ROUTINE',
            clinical_notes: imagingClinicalInfo || null,
            instructions: imagingOrderInstructions || null,
            items: imagingOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category || imagingCategory || 'X-Ray',
            })),
          })
          .catch(() => null);
      }

      showToast('Consultation draft and clinical orders saved.');
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleSendToPharmacy = async () => {
    if (!visit) return;
    if (prescriptionForm.items.length === 0) {
      showToast('Add at least one medication before sending to pharmacy.', 'error');
      return;
    }
    setUpdating('prescription-submit');
    try {
      await opdApi.submitPrescription(visit.id, {
        items: prescriptionForm.items.map((i) => ({
          medicine_name: i.medicine_name,
          strength: i.strength || null,
          dosage: i.dosage,
          route: i.route || 'ORAL',
          frequency: i.frequency,
          duration: i.duration,
          quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
          instructions: i.instructions || null,
        })),
        follow_up_date: prescriptionForm.follow_up_date || null,
        doctor_instructions: prescriptionForm.doctor_instructions || null,
        patient_instructions: prescriptionForm.patient_instructions || null,
      });
      showToast('Prescription sent to Pharmacy queue successfully!', 'success');
      await loadClinicalData();
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleSubmitLabOrder = async () => {
    if (!visit) return;
    if (labOrders.length === 0) {
      showToast('Select at least one lab test to order.', 'error');
      return;
    }
    setUpdating('lab-order-submit');
    try {
      await opdApi.submitClinicalOrder(visit.id, 'LABORATORY', {
        priority: labPriority,
        destination: labFacility,
        specimen_type: labSampleType,
        clinical_notes: labClinicalNotes || null,
        instructions: labOrderSummary || null,
        items: labOrders.map((o) => ({
          service_id: o.id,
          investigation_name: o.name,
          category: o.category || labCategory,
        })),
      });
      showToast('Laboratory order submitted to Laboratory queue successfully!', 'success');
      await loadClinicalData();
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleSubmitImagingOrder = async () => {
    if (!visit) return;
    if (imagingOrders.length === 0) {
      showToast('Select at least one imaging test to order.', 'error');
      return;
    }
    setUpdating('imaging-order-submit');
    try {
      await opdApi.submitClinicalOrder(visit.id, 'IMAGING', {
        priority: imagingPriority,
        clinical_notes: imagingClinicalInfo || null,
        instructions: imagingOrderInstructions || null,
        items: imagingOrders.map((o) => ({
          service_id: o.id,
          investigation_name: o.name,
          category: o.category || imagingCategory,
        })),
      });
      showToast('Imaging order submitted to Radiology queue successfully!', 'success');
      await loadClinicalData();
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    } finally {
      setUpdating('');
    }
  };

  const completeConsultation = async () => {
    if (!visit) return;
    setUpdating('consultation-complete');
    try {
      const payload: SaveOpdConsultationPayload = {
        allergies: consultationForm.allergies.trim() || null,
        assessment: consultationForm.assessment.trim() || null,
        chief_complaint: consultationForm.chief_complaint.trim() || null,
        doctor_notes: consultationForm.doctor_notes.trim() || null,
        family_history: consultationForm.family_history.trim() || null,
        history_present_illness: consultationForm.history_present_illness.trim() || null,
        past_history: consultationForm.past_history.trim() || null,
        physical_examination: consultationForm.physical_examination.trim() || null,
        treatment_plan: consultationForm.treatment_plan.trim() || null,
      };

      // 1. FIRST: Mark the consultation as COMPLETED on the backend so order submissions can succeed
      const response = await opdApi.completeConsultation(visit.id, payload);
      setConsultation(response);

      // 2. Submit Prescriptions to Pharmacy Queue
      if (prescriptionForm.items.length > 0) {
        try {
          await opdApi.submitPrescription(visit.id, {
            items: prescriptionForm.items.map((i) => ({
              medicine_name: i.medicine_name,
              strength: i.strength || null,
              dosage: i.dosage,
              route: i.route || 'ORAL',
              frequency: i.frequency,
              duration: i.duration,
              quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
              instructions: i.instructions || null,
            })),
            follow_up_date: prescriptionForm.follow_up_date || null,
            doctor_instructions: prescriptionForm.doctor_instructions || null,
            patient_instructions: prescriptionForm.patient_instructions || null,
          });
        } catch (rxErr) {
          console.error('Failed to submit prescriptions:', rxErr);
        }
      }

      // 3. Submit Lab Orders to Laboratory Queue
      if (labOrders.length > 0) {
        try {
          await opdApi.submitClinicalOrder(visit.id, 'LABORATORY', {
            priority: labPriority,
            destination: labFacility,
            specimen_type: labSampleType,
            clinical_notes: labClinicalNotes || null,
            instructions: labOrderSummary || null,
            items: labOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category || labCategory,
            })),
          });
        } catch (labErr) {
          console.error('Failed to submit lab orders:', labErr);
        }
      }

      // 4. Submit Imaging Orders to Radiology Queue
      if (imagingOrders.length > 0) {
        try {
          await opdApi.submitClinicalOrder(visit.id, 'IMAGING', {
            priority: imagingPriority,
            clinical_notes: imagingClinicalInfo || null,
            instructions: imagingOrderInstructions || null,
            items: imagingOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category || imagingCategory,
            })),
          });
        } catch (imgErr) {
          console.error('Failed to submit imaging orders:', imgErr);
        }
      }

      // 5. Automatically Create Billing Invoice for Consultation + Lab + Imaging
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
      for (const item of labOrders) {
        invoiceItems.push({
          service_id: item.id,
          service_type: 'LAB_TEST',
          quantity: 1,
        });
      }

      for (const item of imagingOrders) {
        invoiceItems.push({
          service_id: item.id,
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

      // 6. Update the overall visit status to COMPLETED now that consultation and orders are processed
      await opdApi.updateVisitStatus(visit.id, { status: 'COMPLETED', notes: 'Consultation completed.' });

      await loadVisit();
      await loadClinicalData();
      showToast('Consultation completed successfully! Orders routed to Pharmacy, Lab & Imaging.');

    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const onPrescriptionSave = async (data: PrescriptionForm) => {
    if (!visit) return;
    try {
      const download = await patientsApi.downloadDocument(visit.patient_id, document.id);
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
      const download = await patientsApi.downloadDocument(visit.patient_id, document.id);
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
    if (!visit || !window.confirm(`Delete ${document.title}?`)) return;
    try {
      await patientsApi.deleteDocument(visit.patient_id, document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      showToast(`${document.title} deleted.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const handleCallNextPatient = async () => {
    if (!visit) return;
    setUpdating('call-next');
    try {
      const nextVisit = await callNextPatient.mutateAsync(visit.id);
      showToast(`${nextVisit.patient_name} has been called. Reception and nursing were notified.`);
      navigate(`/opd/consultation?id=${encodeURIComponent(nextVisit.id)}`);
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const isTabCompleted = (tabName: string): boolean => {
    switch (tabName) {
      case 'Consultation':
        return Boolean(consultationForm.chief_complaint.trim());
      case 'Vitals':
        return Boolean(vitalsForm.blood_pressure_systolic.trim() || vitalsForm.pulse_bpm.trim());
      case 'Diagnosis':
        return selectedDiagnoses.length > 0;
      case 'Prescription':
        return prescriptionForm.items.length > 0;
      case 'Orders & Labs':
        return false;
      case 'Procedure':
        return Boolean(consultationForm.treatment_plan.trim());
      case 'Follow-up':
        return Boolean(prescriptionForm.follow_up_date);
      case 'Notes':
        return Boolean(consultationForm.doctor_notes.trim());
      case 'Documents':
        return documents.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="layout-content opd-workspace">
      <Toast message="" visible={false} />

      {isVitalsModalOpen && (
        <OpdVitalsModal
          open={isVitalsModalOpen}
          visit={visit}
          initialData={vitals}
          onClose={() => setIsVitalsModalOpen(false)}
          onSave={submitVitals}
          isSaving={workspace.isCreatingVitals}
        />
      )}

      {/* 1. Header (Patient Info & Controls) */}
      <header className="page-header workspace-header">
        <div className="header-patient-info">
          <div className="patient-details">
            <h1 className="patient-name">{visit.patient_name}</h1>
            <div className="patient-meta">
              <span className="patient-mrn">{visit.patient_number}</span>
            </div>
          </div>
        </div>
        <div className="opd-page-actions">
          <button
            className="doc-btn primary"
            disabled={!visit || visit.status !== 'COMPLETED' || updating === 'call-next'}
            onClick={() => void handleCallNextPatient()}
            title={visit?.status === 'COMPLETED' ? 'Call the next ready OPD token' : 'Complete this consultation first'}
            type="button"
          >
            <i className="ph ph-megaphone" aria-hidden="true" />
            {updating === 'call-next' ? 'Calling...' : 'Call Next Patient'}
          </button>
          {recentVisits.length > 1 ? (
            <label className="opd-visit-selector" htmlFor="active-visit-select">
              <span>Patient Visit:</span>
              <select
                id="active-visit-select"
                onChange={(e) => {
                  setActiveVisitId(e.target.value);
                  navigate(`/opd/consultation?id=${e.target.value}`);
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
          <button className="doc-btn" disabled={loading} onClick={loadVisit} type="button">
            <i className="ph ph-arrow-clockwise" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />

      {loadError ? <div className="form-error-banner">{loadError}</div> : null}

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
                <span>{patient ? `${patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()} ${calculateAge(patient.date_of_birth)}` : 'Gender/Age N/A'}</span>
                <span className="divider">|</span>
                <span>{opdVisitTypeLabels[visit.visit_type]}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_specialization}</span>
                <span className="divider">|</span>
                <span>{visit.doctor_name}</span>
                <span className="divider">|</span>
                <span>10:00 AM</span>
                <span className="divider">|</span>
                <span>{visit.visit_number}</span>
              </div>
            </div>
            <div className="opd-patient-banner-actions">
              <button
                key={tab.id}
                className={`workspace-tab ${activeTab === tab.name ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.name)}
                type="button"
              >
                <div className="tab-icon">
                  {tab.id === '1' && <i className="ph ph-stethoscope" aria-hidden="true" />}
                  {tab.id === '2' && <i className="ph ph-activity" aria-hidden="true" />}
                  {tab.id === '3' && <i className="ph ph-pill" aria-hidden="true" />}
                  {tab.id === '4' && <i className="ph ph-flask" aria-hidden="true" />}
                  {tab.id === '5' && <i className="ph ph-radioactive" aria-hidden="true" />}
                  {tab.id === '6' && <i className="ph ph-arrows-merge" aria-hidden="true" />}
                  {tab.id === '7' && <i className="ph ph-calendar-plus" aria-hidden="true" />}
                </div>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="workspace-body">
          <div className="workspace-scroll-area">
            <div className="workspace-content-wrapper">
              
              {/* TAB 1: CONSULTATION */}
              {activeTab === 'Consultation' && (
                <OpdConsultationTab
                  consultation={workspace.consultation}
                  onSaveDraft={onConsultationSaveDraft}
                  onComplete={onConsultationComplete}
                  isSaving={false}
                  isCompleting={false}
                  canEdit={canEdit}
                  onChange={() => {}}
                />
              )}

              {/* TAB 2: DIAGNOSIS */}
              {activeTab === 'Diagnosis' && (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Diagnosis Search</h3>
                        <p>Search ICD-10 terminology and add diagnoses</p>
                      </div>
                    </div>

                    <div className="opd-dx-search-container">
                      <label className="doc-field full" htmlFor="icd-search-input">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span>Diagnosis / ICD-10 Search</span>
                          {dxSearchTerm.trim().length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const customCode = `DX-${Date.now().toString().slice(-4)}`;
                                handleAddDiagnosis({ code: customCode, name: dxSearchTerm.trim(), category: 'Clinical Diagnosis' });
                                setDxSearchTerm('');
                                showToast(`Custom diagnosis "${dxSearchTerm.trim()}" added.`, 'success');
                              }}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <i className="ph ph-plus-circle" /> Add "{dxSearchTerm}" as Custom Diagnosis
                            </button>
                          )}
                        </div>
                        <div className="opd-dx-search-input-wrap">
                          <i className="ph ph-magnifying-glass" aria-hidden="true" />
                          <input
                            id="icd-search-input"
                            className="opd-dx-search-input"
                            onChange={(e) => setDxSearchTerm(e.target.value)}
                            placeholder="Search code or clinical term (e.g. reflux, hypertension, K21, diabetes)..."
                            value={dxSearchTerm}
                          />
                        </div>
                      </label>

                      <div className="opd-dx-results-list">
                        {filteredIcd10.length === 0 && dxSearchTerm.trim().length > 1 ? (
                          <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: '#475569' }}>
                              No ICD-10 code matched "<strong>{dxSearchTerm}</strong>"
                            </p>
                            <button
                              type="button"
                              className="doc-btn primary compact"
                              onClick={() => {
                                const customCode = `DX-${Date.now().toString().slice(-4)}`;
                                handleAddDiagnosis({ code: customCode, name: dxSearchTerm.trim(), category: 'Clinical Diagnosis' });
                                setDxSearchTerm('');
                                showToast(`Custom diagnosis "${dxSearchTerm.trim()}" added.`, 'success');
                              }}
                            >
                              <i className="ph ph-plus" /> Add "{dxSearchTerm}" as Custom Diagnosis
                            </button>
                          </div>
                        ) : (
                          filteredIcd10.map((dx) => {
                            const isAdded = selectedDiagnoses.some((d) => d.code === dx.code);
                            return (
                              <div className="opd-dx-result-item" key={dx.code}>
                                <div className="opd-dx-item-info">
                                  <span className="opd-dx-code-badge">{dx.code}</span>
                                  <span className="opd-dx-name">{dx.name}</span>
                                </div>
                                <button
                                  className="doc-btn compact"
                                  disabled={isAdded}
                                  onClick={() => handleAddDiagnosis(dx)}
                                  type="button"
                                >
                                  {isAdded ? 'Added' : 'Add'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {selectedDiagnoses.length > 0 ? (
                      <div className="opd-dx-chips-container">
                        {selectedDiagnoses.map((dx) => (
                          <span className="opd-dx-chip" key={dx.code}>
                            {dx.code} • {dx.name}
                            <button
                              onClick={() => handleRemoveDiagnosis(dx.code)}
                              title="Remove diagnosis"
                              type="button"
                            >
                              <i aria-hidden="true" className="ph ph-x" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="doc-form-grid">
                      <label className="doc-field full" htmlFor="diagnostic-reasoning">
                        <span>Document Diagnostic Reasoning &amp; Clinical Notes</span>
                        <textarea
                          id="diagnostic-reasoning"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, assessment: e.target.value }))}
                          placeholder="Document clinical reasoning, differential diagnoses, or diagnostic findings..."
                          rows={3}
                          value={consultationForm.assessment}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i aria-hidden="true" className="ph ph-check-circle" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn" onClick={() => setActiveTab('Prescription')} type="button">
                        Prescription
                        <i aria-hidden="true" className="ph ph-arrow-right" />
                      </button>
                      <button
                        className="doc-btn primary"
                        onClick={async () => {
                          await saveConsultationDraft();
                          showToast('Diagnosis saved successfully.', 'success');
                        }}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-check-circle" />
                        Save Diagnosis
                      </button>
                    </div>
                  </div>
                </article>
              )}

              {/* TAB 3: PRESCRIPTION */}
              {activeTab === 'Prescription' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Prescription Builder</h3>
                        <p>Search formulary medicine and specify dosage instructions</p>
                      </div>
                    </div>

                    {/* Diagnosis Summary Section */}
                    <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selectedDiagnoses.length > 0 ? '0.5rem' : '0' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <i className="ph ph-stethoscope" style={{ color: '#2563eb' }} />
                          Diagnosis Summary
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('Diagnosis')}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          Edit Diagnosis <i className="ph ph-arrow-right" />
                        </button>
                      </div>
                      {selectedDiagnoses.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                          No diagnosis selected yet. You can add ICD-10 diagnoses in the Diagnosis tab.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {selectedDiagnoses.map((dx) => (
                            <span
                              key={dx.code}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.65rem',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '16px',
                                color: '#1e40af',
                                fontSize: '0.78rem',
                                fontWeight: 500,
                              }}
                            >
                              <strong>{dx.code}</strong> • {dx.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="doc-form-grid three" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <label className="doc-field" htmlFor="medicine-search-sel">
                        <span>Medicine Search</span>
                        <select
                          id="medicine-search-sel"
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
                          <option value="">Search medicine from Pharmacy formulary</option>
                          {masterMedicines.map((med) => (
                            <option key={med.id} value={med.name}>
                              {med.name} {med.strength ? `(${med.strength})` : ''} — Stock: {med.available_quantity} {med.unit || 'units'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="medicine-dosage">
                        <span>Dosage</span>
                        <input
                          id="medicine-dosage"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, dosage: e.target.value }))}
                          placeholder="e.g. 1 tablet"
                          value={medicationForm.dosage}
                        />
                      </label>
                      <label className="doc-field" htmlFor="medicine-route">
                        <span>Route</span>
                        <select
                          id="medicine-route"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, route: e.target.value }))}
                          value={medicationForm.route || 'Oral'}
                        >
                          <option value="Oral">Oral</option>
                          <option value="Intravenous (IV)">Intravenous (IV)</option>
                          <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                          <option value="Subcutaneous (SC)">Subcutaneous (SC)</option>
                          <option value="Inhalation">Inhalation</option>
                          <option value="Topical">Topical</option>
                          <option value="Sublingual">Sublingual</option>
                          <option value="Ophthalmic">Ophthalmic</option>
                          <option value="Otic">Otic</option>
                          <option value="Rectal">Rectal</option>
                        </select>
                      </label>
                    </div>

                    <div className="doc-form-grid four" style={{ gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
                      <label className="doc-field" htmlFor="medicine-frequency">
                        <span>Frequency</span>
                        <select
                          id="medicine-frequency"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, frequency: e.target.value }))}
                          value={medicationForm.frequency || 'BD'}
                        >
                          <option value="OD">OD (Once Daily)</option>
                          <option value="BD">BD (Twice Daily)</option>
                          <option value="TDS">TDS (Thrice Daily)</option>
                          <option value="QID">QID (Four times daily)</option>
                          <option value="PRN">PRN (As needed)</option>
                          <option value="STAT">STAT (Immediately)</option>
                          <option value="Q4H">Q4H (Every 4 hours)</option>
                          <option value="Q6H">Q6H (Every 6 hours)</option>
                          <option value="Q8H">Q8H (Every 8 hours)</option>
                          <option value="HS">HS (At bedtime)</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="medicine-duration">
                        <span>Duration</span>
                        <select
                          id="medicine-duration"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                          value={medicationForm.duration || '5 Days'}
                        >
                          <option value="3 Days">3 Days</option>
                          <option value="5 Days">5 Days</option>
                          <option value="7 Days">7 Days</option>
                          <option value="10 Days">10 Days</option>
                          <option value="14 Days">14 Days</option>
                          <option value="30 Days">30 Days</option>
                          <option value="Ongoing">Ongoing / Chronic</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="medicine-instructions">
                        <span>Instructions</span>
                        <input
                          id="medicine-instructions"
                          onChange={(e) => setMedicationForm((m) => ({ ...m, instructions: e.target.value }))}
                          placeholder="e.g. After meals"
                          value={medicationForm.instructions}
                        />
                      </label>
                      <button
                        className="doc-btn primary"
                        onClick={() => {
                          if (!medicationForm.medicine_name.trim()) {
                            showToast('Select a medicine first.', 'error');
                            return;
                          }
                          setPrescriptionForm((prev) => ({
                            ...prev,
                            items: [
                              ...prev.items,
                              {
                                ...medicationForm,
                                dosage: medicationForm.dosage || '1 tablet',
                                route: medicationForm.route || 'Oral',
                                frequency: medicationForm.frequency || 'BD',
                                duration: medicationForm.duration || '5 Days',
                                local_id: `med-${Date.now()}`,
                              },
                            ],
                          }));
                          setMedicationForm(emptyMedicationForm);
                          showToast('Medication added.');
                        }}
                        style={{ height: '42px', justifyContent: 'center' }}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-plus" />
                        Add Medication
                      </button>
                    </div>

                    <div className="opd-form-section-head" style={{ marginTop: '1rem' }}>
                      <div>
                        <h4>Medication Table</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Current prescription items</p>
                      </div>
                    </div>

                    <div className="doc-table-wrap">
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>MEDICINE</th>
                            <th>DOSAGE</th>
                            <th>ROUTE</th>
                            <th>FREQUENCY</th>
                            <th>DURATION</th>
                            <th>INSTRUCTIONS</th>
                            <th aria-label="Actions" style={{ width: '48px' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {prescriptionForm.items.length === 0 ? (
                            <tr>
                              <td className="opd-prescription-empty" colSpan={7}>
                                No medications prescribed yet.
                              </td>
                            </tr>
                          ) : (
                            prescriptionForm.items.map((item, index) => (
                              <tr key={item.local_id || index}>
                                <td>
                                  <strong>{item.medicine_name}</strong>
                                  {item.strength ? <small style={{ color: '#64748b' }}>{item.strength}</small> : null}
                                </td>
                                <td>{item.dosage || '1 tablet'}</td>
                                <td>{item.route || 'Oral'}</td>
                                <td>{item.frequency || 'BD'}</td>
                                <td>{item.duration || '5 Days'}</td>
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

                    <div className="doc-form-grid two" style={{ marginTop: '1.25rem' }}>
                      <label className="doc-field" htmlFor="rx-follow-up-date">
                        <span>Follow-up Date</span>
                        <input
                          id="rx-follow-up-date"
                          onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, follow_up_date: e.target.value }))}
                          type="date"
                          value={prescriptionForm.follow_up_date}
                        />
                      </label>
                      <label className="doc-field" htmlFor="rx-doctor-instructions">
                        <span>Doctor Instructions</span>
                        <textarea
                          id="rx-doctor-instructions"
                          onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, doctor_instructions: e.target.value }))}
                          placeholder="Clinical instructions for pharmacy dispensing..."
                          rows={2}
                          value={prescriptionForm.doctor_instructions}
                        />
                      </label>
                      <label className="doc-field full" htmlFor="rx-patient-instructions">
                        <span>Patient Instructions</span>
                        <textarea
                          id="rx-patient-instructions"
                          onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, patient_instructions: e.target.value }))}
                          placeholder="Patient counseling notes, lifestyle advice, diet restrictions..."
                          rows={2}
                          value={prescriptionForm.patient_instructions}
                        />
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i aria-hidden="true" className="ph ph-check-circle" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn"
                        onClick={() => window.print()}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-printer" />
                        Print Prescription
                      </button>
                      <button
                        className="doc-btn primary"
                        disabled={updating === 'prescription-submit' || prescriptionForm.items.length === 0}
                        onClick={handleSendToPharmacy}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
                        Send To Pharmacy
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
                        <h3>Laboratory Order</h3>
                        <p>Select priority, category and requested investigations</p>
                      </div>
                    </div>

                    <div className="doc-form-grid four" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                      <label className="doc-field" htmlFor="lab-priority-sel">
                        <span>Priority</span>
                        <select
                          id="lab-priority-sel"
                          onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)}
                          value={labPriority}
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="lab-facility-sel">
                        <span>Laboratory</span>
                        <select
                          id="lab-facility-sel"
                          onChange={(e) => setLabFacility(e.target.value)}
                          value={labFacility}
                        >
                          {labFacilities.map((facility) => (
                            <option key={facility} value={facility}>
                              {facility}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="lab-sample-type-sel">
                        <span>Sample Type</span>
                        <select
                          id="lab-sample-type-sel"
                          onChange={(e) => setLabSampleType(e.target.value)}
                          value={labSampleType}
                        >
                          {labSampleTypeOptions.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="lab-category-sel">
                        <span>Laboratory Category</span>
                        <select
                          id="lab-category-sel"
                          onChange={(e) => setLabCategory(e.target.value)}
                          value={labCategory}
                        >
                          {labCategoryOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat === 'All' ? 'All Categories' : cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="opd-form-section-head" style={{ marginTop: '0.75rem' }}>
                      <div>
                        <h4>Available Tests</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Check tests to add to requisition</p>
                      </div>
                    </div>

                    <div className="opd-tests-checkbox-grid">
                      {availableLabTests.length === 0 ? (
                        <span style={{ color: '#64748b', fontSize: '0.82rem', gridColumn: 'span 4' }}>
                          No lab tests found for this category in the Service Catalogue.
                        </span>
                      ) : (
                        availableLabTests.map((test) => {
                          const isSelected = labOrders.some((o) => o.id === test.id);
                          return (
                            <label
                              className={`opd-test-checkbox-label ${isSelected ? 'selected' : ''}`}
                              key={test.id}
                            >
                              <input
                                checked={isSelected}
                                onChange={() => handleToggleLabTest(test)}
                                type="checkbox"
                              />
                              <span>{test.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="doc-form-grid two" style={{ marginTop: '1rem' }}>
                      <label className="doc-field" htmlFor="lab-clinical-notes">
                        <span>Clinical Notes</span>
                        <textarea
                          id="lab-clinical-notes"
                          onChange={(e) => setLabClinicalNotes(e.target.value)}
                          placeholder="Clinical indication or suspected conditions..."
                          rows={2}
                          value={labClinicalNotes}
                        />
                      </label>
                      <label className="doc-field" htmlFor="lab-order-summary">
                        <span>Order Summary</span>
                        <textarea
                          id="lab-order-summary"
                          onChange={(e) => setLabOrderSummary(e.target.value)}
                          placeholder="Instructions for laboratory technician..."
                          rows={2}
                          value={labOrderSummary}
                        />
                      </label>
                    </div>

                    <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>TEST</th>
                            <th>CATEGORY</th>
                            <th>PRIORITY</th>
                            <th>STATUS</th>
                            <th style={{ width: '48px' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {labOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '1.2rem', color: '#64748b' }}>
                                No lab tests selected yet.
                              </td>
                            </tr>
                          ) : (
                            labOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td><strong>{item.name}</strong></td>
                                <td>{item.category || labCategory}</td>
                                <td>
                                  <span className="doc-status draft">{labPriority}</span>
                                </td>
                                <td>
                                  <span className="doc-status pending">Pending Submit</span>
                                </td>
                                <td>
                                  <button
                                    className="doc-action danger"
                                    onClick={() => setLabOrders((prev) => prev.filter((i) => i.local_id !== item.local_id))}
                                    title="Remove test"
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
                      <i aria-hidden="true" className="ph ph-check-circle" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn"
                        onClick={() => window.print()}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-printer" />
                        Print Laboratory Order
                      </button>
                      <button
                        className="doc-btn primary"
                        disabled={updating === 'lab-order-submit' || labOrders.length === 0}
                        onClick={handleSubmitLabOrder}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
                        Submit Laboratory Order
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

                    <div className="doc-form-grid two" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                      <label className="doc-field" htmlFor="imaging-priority-sel">
                        <span>Priority</span>
                        <select
                          id="imaging-priority-sel"
                          onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)}
                          value={imagingPriority}
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">Stat</option>
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="imaging-category-sel">
                        <span>Imaging Category</span>
                        <select
                          id="imaging-category-sel"
                          onChange={(e) => setImagingCategory(e.target.value)}
                          value={imagingCategory}
                        >
                          {imagingCategoryOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat === 'All' ? 'All Modalities' : cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="opd-form-section-head" style={{ marginTop: '0.75rem' }}>
                      <div>
                        <h4>Available Imaging Tests</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Check scans to add to requisition</p>
                      </div>
                    </div>

                    <div className="opd-tests-checkbox-grid">
                      {availableImagingTests.length === 0 ? (
                        <span style={{ color: '#64748b', fontSize: '0.82rem', gridColumn: 'span 2' }}>
                          No imaging tests found for this modality in the Service Catalogue.
                        </span>
                      ) : (
                        availableImagingTests.map((test) => {
                          const isSelected = imagingOrders.some((o) => o.id === test.id);
                          return (
                            <label
                              className={`opd-test-checkbox-label ${isSelected ? 'selected' : ''}`}
                              key={test.id}
                            >
                              <input
                                checked={isSelected}
                                onChange={() => handleToggleImagingTest(test)}
                                type="checkbox"
                              />
                              <span>{test.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="doc-form-grid two" style={{ marginTop: '1rem' }}>
                      <label className="doc-field" htmlFor="imaging-clinical-info">
                        <span>Clinical Information</span>
                        <textarea
                          id="imaging-clinical-info"
                          onChange={(e) => setImagingClinicalInfo(e.target.value)}
                          placeholder="Clinical symptoms, suspected pathology, or trauma site..."
                          rows={2}
                          value={imagingClinicalInfo}
                        />
                      </label>
                      <label className="doc-field" htmlFor="imaging-order-instructions">
                        <span>Order Instructions</span>
                        <textarea
                          id="imaging-order-instructions"
                          onChange={(e) => setImagingOrderInstructions(e.target.value)}
                          placeholder="Special radiology instructions, views requested, with/without contrast..."
                          rows={2}
                          value={imagingOrderInstructions}
                        />
                      </label>
                    </div>

                    <div className="opd-form-section-head" style={{ marginTop: '1.25rem' }}>
                      <div>
                        <h4>Selected Imaging Tests</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Orders created during this consultation</p>
                      </div>
                    </div>

                    <div className="doc-table-wrap">
                      <table className="doc-table opd-prescription-table">
                        <thead>
                          <tr>
                            <th>TEST</th>
                            <th>CATEGORY</th>
                            <th>PRIORITY</th>
                            <th>STATUS</th>
                            <th style={{ width: '48px' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {imagingOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '1.2rem', color: '#64748b' }}>
                                No tests selected.
                              </td>
                            </tr>
                          ) : (
                            imagingOrders.map((item) => (
                              <tr key={item.local_id}>
                                <td><strong>{item.name}</strong></td>
                                <td>{item.category || imagingCategory}</td>
                                <td>
                                  <span className="doc-status draft">{imagingPriority}</span>
                                </td>
                                <td>
                                  <span className="doc-status pending">Pending Submit</span>
                                </td>
                                <td>
                                  <button
                                    className="doc-action danger"
                                    onClick={() => setImagingOrders((prev) => prev.filter((i) => i.local_id !== item.local_id))}
                                    title="Remove test"
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
                      <i aria-hidden="true" className="ph ph-check-circle" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn"
                        onClick={() => window.print()}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-printer" />
                        Print Imaging Order
                      </button>
                      <button
                        className="doc-btn primary"
                        disabled={updating === 'imaging-order-submit' || imagingOrders.length === 0}
                        onClick={handleSubmitImagingOrder}
                        type="button"
                      >
                        <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
                        Submit Imaging Order
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

              {/* TAB 6: REFERRAL */}
              {activeTab === 'Referral' && (
                <OpdReferralTab
                  uniqueSpecialties={uniqueSpecialties}
                  filteredReferralDoctors={filteredReferralDoctors as Array<{ id: string; display_name: string; specialization: string }>}
                  referralSpecialty={referralSpecialty}
                  setReferralSpecialty={setReferralSpecialty}
                  referralDoctorId={referralDoctorId}
                  setReferralDoctorId={setReferralDoctorId}
                  referralReason={referralReason}
                  setReferralReason={setReferralReason}
                  referralBooking={false}
                  handleSubmitReferral={handleBookReferralAppointment}
                  canEdit={canEdit}
                />
              )}

              {/* TAB 7: FOLLOW-UP */}
              {activeTab === 'Follow-up' && (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Follow-up Instructions</h3>
                      </div>
                    </div>
                    <div className="doc-form-grid full-width">
                      <p style={{ color: '#64748b' }}>Configure follow-up dates in the Prescription tab.</p>
                    </div>
                  </section>
                </article>
              )}

              {/* TAB 8: NOTES */}
              {activeTab === 'Notes' ? (
                <article className="doc-card opd-tab-card">
                  <section className="opd-form-section">
                    <div className="opd-form-section-head">
                      <div>
                        <h3>Encounter Notes &amp; Observations</h3>
                        <p>Internal clinical notes and observations</p>
                      </div>
                    </div>
                    <div className="doc-form-grid two">
                      <label className="doc-field full" htmlFor="notes-text">
                        <span>Doctor Clinical Notes</span>
                        <textarea
                          id="notes-text"
                          onChange={(e) => setConsultationForm((c) => ({ ...c, doctor_notes: e.target.value }))}
                          rows={6}
                          value={consultationForm.doctor_notes}
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
                        Save Notes Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Documents')} type="button">
                        Next: Documents
                        <i className="ph ph-arrow-right" aria-hidden="true" />
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
                          <button className="doc-btn primary upload-btn" disabled={updating === 'document-upload'} type="submit">
                            <i className="ph ph-upload-simple" aria-hidden="true" />
                            {updating === 'document-upload' ? 'Uploading...' : 'Upload'}
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
                              {doc.document_type} â€¢ {new Date(doc.created_at).toLocaleDateString()}
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
                            <button
                              aria-label={`Delete ${doc.title}`}
                              className="doc-icon-action"
                              onClick={() => void deleteDocument(doc)}
                              title="Delete Document"
                              type="button"
                            >
                              <i className="ph ph-trash" aria-hidden="true" />
                            </button>
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
                      {vitalsForm.blood_pressure_systolic && vitalsForm.blood_pressure_diastolic
                        ? `${vitalsForm.blood_pressure_systolic}/${vitalsForm.blood_pressure_diastolic} mmHg`
                        : 'Not recorded'}
                    </strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Pulse</span>
                    <strong>{vitalsForm.pulse_bpm ? `${vitalsForm.pulse_bpm} bpm` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Temperature</span>
                    <strong>{vitalsForm.temperature_c ? `${vitalsForm.temperature_c} °C` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>SpOa</span>
                    <strong>{vitalsForm.oxygen_saturation_percent ? `${vitalsForm.oxygen_saturation_percent}%` : 'Not recorded'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Blood Group</span>
                    <strong>{visit ? 'O+' : 'Not available in visit record'}</strong>
                  </div>
                  <div className="opd-summary-row">
                    <span>Allergies</span>
                    <strong style={{ color: '#dc2626' }}>{consultationForm.allergies || 'None recorded'}</strong>
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
                  {prescriptionForm.items.length === 0 ? (
                    <div className="opd-summary-empty-text">No medications recorded for this visit.</div>
                  ) : prescriptionForm.items.map((item) => (
                    <div className="opd-medication-chip-item" key={item.local_id}>
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
                {consultationForm.allergies ? (
                  <div className="opd-clinical-alert warning"><i className="ph ph-warning-circle" aria-hidden="true" /><div><strong>Allergy Alert</strong><span>{consultationForm.allergies}</span></div></div>
                ) : <div className="opd-summary-empty-text">No clinical alerts recorded.</div>}
              </div>
            </aside>
          </div>
        </main>

        <aside className="workspace-right-panel">
          <div className="doc-card summary-card">
            <h3>Visit Summary</h3>
            <div className="summary-list">
              <div className="summary-item">
                <span className="summary-label">Date</span>
                <span className="summary-value">{formatDate(visit.created_at)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Visit Type</span>
                <span className="summary-value">{opdVisitTypeLabels[visit.visit_type] || visit.visit_type}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Room / Token</span>
                <span className="summary-value">
                  {'OPD Room'}
                </span>
              </div>
            </div>
          </div>

          <div className="doc-card documents-card">
            <h3>Documents &amp; Reports</h3>
            <p style={{ color: '#64748b', marginTop: '1rem', fontSize: '13px' }}>
              View and upload documents from the Patient Profile.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
