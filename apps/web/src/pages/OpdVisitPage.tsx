import { useEffect, useMemo, useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import type { SaveBillingInvoiceItem } from '../api/billing';
import {
  type ApiClinicalOrderPriority,
  type OpdConsultationResponse,
  type OpdPrescriptionResponse,
  type SaveOpdConsultationPayload,
  type SaveOpdPrescriptionPayload,
} from '../api/opd';
import type { PatientDocumentResponse } from '../api/patients';
import type { ServiceResponse } from '../api/services';
import { ICD10_DIAGNOSES, type Icd10Diagnosis } from '../data/icd10-diagnoses';
import { Toast } from '../components/ui/Toast';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import {
  OpdConsultationSection,
  OpdDiagnosisTab,
  OpdPrescriptionSection,
  OpdLabSection,
  OpdImagingSection,
  OpdReferralSection,
  OpdFollowUpTab,
  OpdNotesTab,
  OpdDocumentsTab,
  OpdSummaryPanel,
  OpdClinicalVitalsModal,
} from '../components/opd';
import { useOpdVisitFeature } from '../hooks/opd/useOpdVisitFeature';
import { useActiveBranch } from '../context/BranchContext';
import { useTimezone } from '../api/useSettings';
import { navigate } from '../routing/navigation';
import { getPatientErrorMessage, calculateAge } from './patient-utils';
import {
  getOpdErrorMessage,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitStatusClass,
} from './opd-utils';

type VitalsFormState = {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  weight_kg: string;
  height_cm: string;
  temperature_c: string;
  pulse_bpm: string;
  respiratory_rate_per_min: string;
  oxygen_saturation_percent: string;
  notes: string;
};

type ConsultationFormState = {
  chief_complaint: string;
  history_present_illness: string;
  past_history: string;
  family_history: string;
  allergies: string;
  physical_examination: string;
  assessment: string;
  treatment_plan: string;
  doctor_notes: string;
};

type MedicationFormState = {
  medicine_name: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

type PrescriptionItemFormState = MedicationFormState & { local_id: string };

type PrescriptionFormState = {
  items: PrescriptionItemFormState[];
  follow_up_date: string;
  doctor_instructions: string;
  patient_instructions: string;
};

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

const emptyVitalsForm: VitalsFormState = {
  blood_pressure_systolic: '',
  blood_pressure_diastolic: '',
  weight_kg: '',
  height_cm: '',
  temperature_c: '',
  pulse_bpm: '',
  respiratory_rate_per_min: '',
  oxygen_saturation_percent: '',
  notes: '',
};

const emptyConsultationForm: ConsultationFormState = {
  allergies: '', assessment: '', chief_complaint: '', doctor_notes: '', family_history: '',
  history_present_illness: '', past_history: '', physical_examination: '', treatment_plan: '',
};

const emptyMedicationForm: MedicationFormState = {
  medicine_name: '',
  strength: '',
  dosage: '', route: '', frequency: '', duration: '', quantity: '', instructions: '',
};

const emptyPrescriptionForm: PrescriptionFormState = {
  items: [],
  follow_up_date: '',
  doctor_instructions: '', patient_instructions: '',
};

const consultationFormFromRecord = (consultation: OpdConsultationResponse | null): ConsultationFormState => ({
  allergies: consultation?.allergies ?? emptyConsultationForm.allergies,
  assessment: consultation?.assessment ?? emptyConsultationForm.assessment,
  chief_complaint: consultation?.chief_complaint ?? emptyConsultationForm.chief_complaint,
  doctor_notes: consultation?.doctor_notes ?? emptyConsultationForm.doctor_notes,
  family_history: consultation?.family_history ?? emptyConsultationForm.family_history,
  history_present_illness: consultation?.history_present_illness ?? emptyConsultationForm.history_present_illness,
  past_history: consultation?.past_history ?? emptyConsultationForm.past_history,
  physical_examination: consultation?.physical_examination ?? emptyConsultationForm.physical_examination,
  treatment_plan: consultation?.treatment_plan ?? emptyConsultationForm.treatment_plan,
});

const prescriptionFormFromRecord = (prescription: OpdPrescriptionResponse | null | undefined): PrescriptionFormState => ({
  items: (prescription?.items ?? []).map((item) => ({
    local_id: item.id,
    medicine_name: item.medicine_name,
    strength: item.strength ?? '',
    dosage: item.dosage,
    route: item.route,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity?.toString() ?? '',
    instructions: item.instructions ?? '',
  })),
  follow_up_date: prescription?.follow_up_date?.slice(0, 10) ?? '',
  doctor_instructions: prescription?.doctor_instructions ?? '',
  patient_instructions: prescription?.patient_instructions ?? '',
});

export function OpdVisitPage() {
  const { activeBranchId } = useActiveBranch();
  const timezone = useTimezone();
  const feature = useOpdVisitFeature();
  const {
    activeVisitId, activeTab, recentVisits, visit, patient, vitals, consultation,
    prescription, followUp, referral, laboratoryOrder, imagingOrder, doctors, masterMedicines, services,
    branches, departments, documents, loading, loadError,
  } = feature.state;
  const { setActiveTab, selectVisit } = feature.actions;
  const [updating, setUpdating] = useState('');

  // Clinical forms & records state
  const [vitalsForm, setVitalsForm] = useState<VitalsFormState>(emptyVitalsForm);

  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(emptyConsultationForm);

  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(emptyPrescriptionForm);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(emptyMedicationForm);

  // Documents state (Tab 9)
  const [uploadFileType, setUploadFileType] = useState('Consultation Document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Referral Tab (Tab 6) State
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralDoctorId, setReferralDoctorId] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralBooking, setReferralBooking] = useState(false);

  // Follow-up Tab (Tab 7) State
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpDoctorId, setFollowUpDoctorId] = useState('');
  const [followUpStartTime, setFollowUpStartTime] = useState('09:00');
  const [followUpDurationMinutes, setFollowUpDurationMinutes] = useState('30');

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
      if (visit.status !== 'COMPLETED') {
        await feature.actions.saveWorkspaceDraft({
          consultation: {
            allergies: consultationForm.allergies.trim() || null,
            assessment: consultationForm.assessment.trim() || null,
            chief_complaint: consultationForm.chief_complaint.trim() || null,
            doctor_notes: consultationForm.doctor_notes.trim() || null,
            family_history: consultationForm.family_history.trim() || null,
            history_present_illness: consultationForm.history_present_illness.trim() || null,
            past_history: consultationForm.past_history.trim() || null,
            physical_examination: consultationForm.physical_examination.trim() || null,
            treatment_plan: consultationForm.treatment_plan.trim() || null,
          },
          referral: {
            referral_type: 'INTERNAL',
            specialty: referralSpecialty,
            referred_doctor_id: referralDoctorId,
            reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
            clinical_summary: consultationForm.assessment || 'Referred for further evaluation.',
          },
        });
        showToast('Referral details saved. Complete the consultation to submit this referral.');
      } else {
        await feature.actions.submitReferral({
          visitId: visit.id,
          payload: {
            referral_type: 'INTERNAL',
            specialty: referralSpecialty,
            referred_doctor_id: referralDoctorId,
            reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
            clinical_summary: consultationForm.assessment || 'Referred for further evaluation.',
          },
        });
        showToast(`Referral submitted successfully to ${selectedDoc?.display_name ?? 'Doctor'}!`);
      }
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
        await feature.actions.createVitals({
          visitId: visit.id,
          payload: {
            blood_pressure_systolic: Number(vitalsForm.blood_pressure_systolic),
            blood_pressure_diastolic: Number(vitalsForm.blood_pressure_diastolic),
            weight_kg: Number(vitalsForm.weight_kg) || 70,
            height_cm: Number(vitalsForm.height_cm) || 170,
            temperature_c: vitalsForm.temperature_c ? Number(vitalsForm.temperature_c) : null,
            pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : null,
            respiratory_rate_per_min: vitalsForm.respiratory_rate_per_min ? Number(vitalsForm.respiratory_rate_per_min) : null,
            oxygen_saturation_percent: vitalsForm.oxygen_saturation_percent ? Number(vitalsForm.oxygen_saturation_percent) : null,
            notes: vitalsForm.notes.trim() || null,
          },
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

  const [labSearchQuery, setLabSearchQuery] = useState('');

  const availableLabTests = useMemo(() => {
    let list = labTestServices;
    if (labCategory && labCategory !== 'All') {
      const cat = labCategory.toLowerCase();
      const matched = list.filter((s) => (s.category && s.category.toLowerCase().includes(cat)) || s.name.toLowerCase().includes(cat));
      if (matched.length > 0) list = matched;
    }
    if (labSearchQuery.trim()) {
      const q = labSearchQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.category && s.category.toLowerCase().includes(q)));
    }
    return list;
  }, [labTestServices, labCategory, labSearchQuery]);

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
  const [imagingSearchQuery, setImagingSearchQuery] = useState('');

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
    let list = imagingServices;
    if (imagingCategory && imagingCategory !== 'All') {
      const cat = imagingCategory.toLowerCase();
      const matched = list.filter((s) => (s.category && s.category.toLowerCase().includes(cat)) || s.name.toLowerCase().includes(cat));
      if (matched.length > 0) list = matched;
    }
    if (imagingSearchQuery.trim()) {
      const q = imagingSearchQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.category && s.category.toLowerCase().includes(q)));
    }
    return list;
  }, [imagingServices, imagingCategory, imagingSearchQuery]);

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

  useEffect(() => {
    if (!vitals) return;
    setVitalsForm({
      blood_pressure_systolic: vitals.blood_pressure_systolic?.toString() ?? '',
      blood_pressure_diastolic: vitals.blood_pressure_diastolic?.toString() ?? '',
      weight_kg: vitals.weight_kg?.toString() ?? '',
      height_cm: vitals.height_cm?.toString() ?? '',
      temperature_c: vitals.temperature_c?.toString() ?? '',
      pulse_bpm: vitals.pulse_bpm?.toString() ?? '',
      respiratory_rate_per_min: vitals.respiratory_rate_per_min?.toString() ?? '',
      oxygen_saturation_percent: vitals.oxygen_saturation_percent?.toString() ?? '',
      notes: vitals.notes ?? '',
    });
  }, [vitals]);

  useEffect(() => {
    if (!consultation) return;
    setConsultationForm(consultationFormFromRecord(consultation));
    const assessment = consultation.assessment;
    if (!assessment) return;
    const matched = ICD10_DIAGNOSES.filter((diagnosis) =>
      assessment.toLowerCase().includes(diagnosis.code.toLowerCase()) ||
      assessment.toLowerCase().includes(diagnosis.name.toLowerCase()));
    if (matched.length > 0) setSelectedDiagnoses(matched);
  }, [consultation]);

  useEffect(() => {
    if (prescription) setPrescriptionForm(prescriptionFormFromRecord(prescription));
  }, [prescription]);

  useEffect(() => {
    if (!referral) return;
    setReferralSpecialty(referral.specialty ?? '');
    setReferralDoctorId(referral.referred_doctor_id ?? '');
    setReferralReason(referral.reason ?? '');
  }, [referral]);

  useEffect(() => {
    if (!followUp) return;
    setFollowUpDate(followUp.next_visit_date?.slice(0, 10) ?? '');
    setFollowUpDoctorId(followUp.assigned_doctor_id ?? '');
    setFollowUpStartTime(followUp.start_time ?? '09:00');
    setFollowUpDurationMinutes(String(followUp.duration_minutes ?? 30));
  }, [followUp]);

  useEffect(() => {
    if (!laboratoryOrder?.items?.length) return;
    setLabOrders(laboratoryOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      category: item.category,
      local_id: item.id || `lab-${Date.now()}-${Math.random()}`,
    })));
    setLabPriority(laboratoryOrder.priority);
    if (laboratoryOrder.destination) setLabFacility(laboratoryOrder.destination);
    if (laboratoryOrder.specimen_type) setLabSampleType(laboratoryOrder.specimen_type);
    if (laboratoryOrder.clinical_notes) setLabClinicalNotes(laboratoryOrder.clinical_notes);
    if (laboratoryOrder.instructions) setLabOrderSummary(laboratoryOrder.instructions);
  }, [laboratoryOrder]);

  useEffect(() => {
    if (!imagingOrder?.items?.length) return;
    setImagingOrders(imagingOrder.items.map((item) => ({
      id: item.service_id,
      name: item.investigation_name,
      category: item.category,
      local_id: item.id || `img-${Date.now()}-${Math.random()}`,
    })));
    setImagingPriority(imagingOrder.priority);
    if (imagingOrder.clinical_notes) setImagingClinicalInfo(imagingOrder.clinical_notes);
    if (imagingOrder.instructions) setImagingOrderInstructions(imagingOrder.instructions);
  }, [imagingOrder]);

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
      await feature.actions.saveWorkspaceDraft({
        consultation: payload,
        prescription: prescriptionForm.items.length > 0 ? {
            items: prescriptionForm.items.map((i) => ({
              medicine_name: i.medicine_name,
              strength: i.strength || null,
              dosage: i.dosage,
              route: i.route || 'ORAL',
              frequency: i.frequency,
              duration: i.duration,
              quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
              intake_time: null,
              instructions: i.instructions || null,
            })),
            follow_up_date: prescriptionForm.follow_up_date || null,
            doctor_instructions: prescriptionForm.doctor_instructions || null,
            patient_instructions: prescriptionForm.patient_instructions || null,
          } : undefined,
        laboratory: labOrders.length > 0 ? {
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
          } : undefined,
        imaging: imagingOrders.length > 0 ? {
            priority: imagingPriority || 'ROUTINE',
            clinical_notes: imagingClinicalInfo || null,
            instructions: imagingOrderInstructions || null,
            items: imagingOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category || imagingCategory || 'X-Ray',
            })),
          } : undefined,
      });

      showToast('Consultation draft and clinical orders saved.');
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleNextStep = (nextTab: string) => {
    void saveConsultationDraft();
    setActiveTab(nextTab);
    if (visit?.id) {
      navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}&tab=${encodeURIComponent(nextTab)}`, { replace: true });
    }
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector('.main-content');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleSendToPharmacy = async () => {
    if (!visit) return;
    if (prescriptionForm.items.length === 0) {
      showToast('Add at least one medication before sending to pharmacy.', 'error');
      return;
    }
    setUpdating('prescription-submit');
    try {
      const consultationPayload: SaveOpdConsultationPayload = {
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
      await feature.actions.saveWorkspaceDraft({ consultation: consultationPayload });

      const prescriptionPayload: SaveOpdPrescriptionPayload = {
        items: prescriptionForm.items.map((i) => ({
          medicine_name: i.medicine_name,
          strength: i.strength || null,
          dosage: i.dosage,
          route: i.route || 'ORAL',
          frequency: i.frequency,
          duration: i.duration,
          quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
          intake_time: null,
          instructions: i.instructions || null,
        })),
        follow_up_date: prescriptionForm.follow_up_date || null,
        doctor_instructions: prescriptionForm.doctor_instructions || null,
        patient_instructions: prescriptionForm.patient_instructions || null,
      };
      await feature.actions.submitPrescription({ visitId: visit.id, payload: prescriptionPayload });
      showToast('Prescription sent to pharmacy successfully.');
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const followUpUtcDateTime = () =>
    fromZonedTime(`${followUpDate}T${followUpStartTime}:00`, timezone).toISOString();

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

      const prescriptionPayload =
        prescriptionForm.items.length > 0
          ? {
            items: prescriptionForm.items.map((i) => ({
              medicine_name: i.medicine_name,
              strength: i.strength || null,
              dosage: i.dosage,
              route: i.route || 'ORAL',
              frequency: i.frequency,
              duration: i.duration,
              quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
              intake_time: null,
              instructions: i.instructions || null,
            })),
            follow_up_date: prescriptionForm.follow_up_date || null,
            doctor_instructions: prescriptionForm.doctor_instructions || null,
            patient_instructions: prescriptionForm.patient_instructions || null,
          }
          : undefined;
      const laboratoryPayload =
        labOrders.length > 0
          ? {
            priority: labPriority,
            destination: labFacility,
            specimen_type: labSampleType,
            clinical_notes: labClinicalNotes || null,
            instructions: labOrderSummary || null,
            items: labOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category && o.category !== 'All' ? o.category : 'Hematology',
            })),
          }
          : undefined;
      const imagingPayload =
        imagingOrders.length > 0
          ? {
            priority: imagingPriority,
            clinical_notes: imagingClinicalInfo || null,
            instructions: imagingOrderInstructions || null,
            items: imagingOrders.map((o) => ({
              service_id: o.id,
              investigation_name: o.name,
              category: o.category && o.category !== 'All' ? o.category : 'Imaging',
            })),
          }
          : undefined;

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

      const referralPayload =
        referralDoctorId && referralSpecialty
          ? {
            referral_type: 'INTERNAL' as const,
            specialty: referralSpecialty,
            referred_doctor_id: referralDoctorId,
            reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
            clinical_summary: consultationForm.assessment || 'Referred for further evaluation.',
          }
          : undefined;

      const followUpPayload =
        followUpDate && followUpDoctorId
          ? {
              follow_up_type: 'CLINICAL_REVIEW' as const,
              next_visit_date: followUpDate,
              start_time: followUpStartTime,
              utc_datetime: followUpUtcDateTime(),
              duration_minutes: Number(followUpDurationMinutes),
              assigned_doctor_id: followUpDoctorId,
              reason: 'Clinical follow-up review',
              reminder_type: 'SMS' as const,
            }
          : undefined;

      await feature.actions.completeWorkspace({
        consultation: payload,
        prescription: prescriptionPayload,
        laboratory: laboratoryPayload,
        imaging: imagingPayload,
        referral: referralPayload,
        followUp: followUpPayload,
        invoice:
          invoiceItems.length > 0
            ? {
            patient_id: visit.patient_id,
            visit_id: visit.id,
            branch_id: visit.branch_id || activeBranchId || '',
            items: invoiceItems,
          }
            : undefined,
      });
      showToast('Consultation completed successfully!');

    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const scheduleFollowUp = async () => {
    if (!visit || !followUpDate || !followUpDoctorId) {
      showToast('Please select a follow-up date and doctor.', 'error');
      return;
    }
    setUpdating('follow-up-schedule');
    try {
      await feature.actions.scheduleFollowUp({
        visitId: visit.id,
        payload: {
          follow_up_type: 'CLINICAL_REVIEW',
          next_visit_date: followUpDate,
          start_time: followUpStartTime,
          utc_datetime: followUpUtcDateTime(),
          duration_minutes: Number(followUpDurationMinutes),
          assigned_doctor_id: followUpDoctorId,
          reason: 'Clinical follow-up review',
          reminder_type: 'SMS',
        },
      });
      showToast('Follow-up scheduled and added to the doctor calendar.');
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !visit) {
      showToast('Please choose a file to upload.', 'error');
      return;
    }
    setUpdating('document-upload');
    try {
      const document = await feature.actions.uploadDocument(visit.patient_id, {
        document_type: uploadFileType === 'Identification' ? 'IDENTITY' : 'CLINICAL',
        title: uploadFileType,
        description: `OPD visit ${visit.visit_number} attachment`,
        visit_id: visit.id,
        file: selectedFile,
      });
      setSelectedFile(null);
      showToast(`${document.file_name} uploaded successfully.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const viewDocument = async (document: PatientDocumentResponse) => {
    if (!visit) return;
    try {
      const download = await feature.actions.downloadDocument(visit.patient_id, document.id);
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
      const download = await feature.actions.downloadDocument(visit.patient_id, document.id);
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
      await feature.actions.deleteDocument(visit.patient_id, document.id);
      showToast(`${document.title} deleted.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const handleCallNextPatient = async () => {
    if (!visit) return;
    setUpdating('call-next');
    try {
      const nextVisit = await feature.actions.callNextPatient(visit.id);
      showToast(`${nextVisit.patient_name} has been called. Reception and nursing were notified.`);
      selectVisit(nextVisit.id);
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const isVisitCompleted = visit?.status === 'COMPLETED';

  const isTabCompleted = (tabName: string): boolean => {
    switch (tabName) {
      case 'Consultation':
        return Boolean(
          consultationForm.chief_complaint.trim() ||
            consultationForm.assessment.trim() ||
            consultation?.chief_complaint,
        );
      case 'Vitals':
        return Boolean(vitalsForm.blood_pressure_systolic.trim() || vitalsForm.pulse_bpm.trim());
      case 'Diagnosis':
        return selectedDiagnoses.length > 0 || Boolean(consultationForm.assessment.trim());
      case 'Prescription':
        return prescriptionForm.items.length > 0 || Boolean(prescription?.items?.length);
      case 'Lab Orders':
        return labOrders.length > 0 || Boolean(laboratoryOrder?.items?.length);
      case 'Imaging Orders':
        return imagingOrders.length > 0 || Boolean(imagingOrder?.items?.length);
      case 'Referral':
        return (
          Boolean(referralSpecialty?.trim()) ||
          Boolean(referralReason?.trim())
        );
      case 'Follow-up':
        return (
          Boolean(prescriptionForm.follow_up_date)
        );
      case 'Notes':
        return Boolean(consultationForm.doctor_notes.trim());
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
                onChange={(e) => selectVisit(e.target.value)}
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
          <button
            className="doc-btn"
            disabled={loading}
            onClick={() => void feature.actions.refetchVisit()}
            type="button"
          >
            <i className="ph ph-arrow-clockwise" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />

      {loadError ? <div className="form-error-banner">{loadError}</div> : null}

      {loading ? (
        <section className="doc-card" style={{ padding: '3rem 1rem' }}>
          <MedicalLoader
            text="Loading consultation workspace..."
            subtext="Retrieving patient history, vitals, prescriptions, and clinical orders"
          />
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
              {isVisitCompleted ? (
                <div
                  className="opd-completed-banner"
                  style={{
                    padding: '0.75rem 1.25rem',
                    marginBottom: '1rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.5rem',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 500,
                  }}
                >
                  <i className="ph ph-check-circle-fill" aria-hidden="true" style={{ fontSize: '1.25rem', color: '#16a34a' }} />
                  <span>Consultation Completed &mdash; Details are locked in read-only mode.</span>
                </div>
              ) : null}

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
                        setActiveTab(tab.name);
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

              <fieldset disabled={isVisitCompleted} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                {/* TAB 1: CONSULTATION */}
                {activeTab === 'Consultation' ? (
                  <OpdConsultationSection
                    canEdit={!isVisitCompleted}
                    consultationForm={consultationForm}
                    handleNextStep={handleNextStep}
                    saveConsultationDraft={saveConsultationDraft}
                    setConsultationForm={setConsultationForm}
                  />
                ) : null}

                {/* TAB 2: DIAGNOSIS */}
                {activeTab === 'Diagnosis' ? (
                  <OpdDiagnosisTab
                    assessment={consultationForm.assessment}
                    canEdit={!isVisitCompleted}
                    dxSearchTerm={dxSearchTerm}
                    filteredIcd10={filteredIcd10}
                    handleAddDiagnosis={handleAddDiagnosis}
                    handleRemoveDiagnosis={handleRemoveDiagnosis}
                    onAssessmentChange={(val) => setConsultationForm((c) => ({ ...c, assessment: val }))}
                    onNext={() => handleNextStep('Prescription')}
                    onSaveDraft={saveConsultationDraft}
                    selectedDiagnoses={selectedDiagnoses}
                    setDxSearchTerm={setDxSearchTerm}
                    showToast={showToast}
                  />
                ) : null}

                {/* TAB 3: PRESCRIPTION */}
                {activeTab === 'Prescription' ? (
                  <OpdPrescriptionSection
                    canEdit={!isVisitCompleted}
                    emptyMedicationForm={emptyMedicationForm}
                    handleNextStep={handleNextStep}
                    handleSendToPharmacy={handleSendToPharmacy}
                    masterMedicines={masterMedicines}
                    medicationForm={medicationForm}
                    prescriptionForm={prescriptionForm}
                    saveConsultationDraft={saveConsultationDraft}
                    selectedDiagnoses={selectedDiagnoses}
                    setActiveTab={setActiveTab}
                    setMedicationForm={setMedicationForm}
                    setPrescriptionForm={setPrescriptionForm}
                    showToast={showToast}
                    updating={updating}
                  />
                ) : null}

                {/* TAB 4: LAB ORDERS */}
                {activeTab === 'Lab Orders' ? (
                  <OpdLabSection
                    availableLabTests={availableLabTests}
                    canEdit={!isVisitCompleted}
                    handleNextStep={handleNextStep}
                    handleToggleLabTest={handleToggleLabTest}
                    labCategory={labCategory}
                    labCategoryOptions={labCategoryOptions}
                    labClinicalNotes={labClinicalNotes}
                    labFacilities={labFacilities}
                    labFacility={labFacility}
                    labOrderSummary={labOrderSummary}
                    labOrders={labOrders}
                    labPriority={labPriority}
                    labSampleType={labSampleType}
                    labSampleTypeOptions={labSampleTypeOptions}
                    labSearchQuery={labSearchQuery}
                    saveConsultationDraft={saveConsultationDraft}
                    setLabCategory={setLabCategory}
                    setLabClinicalNotes={setLabClinicalNotes}
                    setLabFacility={setLabFacility}
                    setLabOrderSummary={setLabOrderSummary}
                    setLabOrders={setLabOrders}
                    setLabPriority={setLabPriority}
                    setLabSampleType={setLabSampleType}
                    setLabSearchQuery={setLabSearchQuery}
                  />
                ) : null}

                {/* TAB 5: IMAGING ORDERS */}
                {activeTab === 'Imaging Orders' ? (
                  <OpdImagingSection
                    availableImagingTests={availableImagingTests}
                    canEdit={!isVisitCompleted}
                    handleNextStep={handleNextStep}
                    handleToggleImagingTest={handleToggleImagingTest}
                    imagingCategory={imagingCategory}
                    imagingCategoryOptions={imagingCategoryOptions}
                    imagingClinicalInfo={imagingClinicalInfo}
                    imagingOrderInstructions={imagingOrderInstructions}
                    imagingOrders={imagingOrders}
                    imagingPriority={imagingPriority}
                    imagingSearchQuery={imagingSearchQuery}
                    saveConsultationDraft={saveConsultationDraft}
                    setImagingCategory={setImagingCategory}
                    setImagingClinicalInfo={setImagingClinicalInfo}
                    setImagingOrderInstructions={setImagingOrderInstructions}
                    setImagingOrders={setImagingOrders}
                    setImagingPriority={setImagingPriority}
                    setImagingSearchQuery={setImagingSearchQuery}
                  />
                ) : null}

                {/* TAB 6: REFERRAL */}
                {activeTab === 'Referral' ? (
                  <OpdReferralSection
                    canEdit={!isVisitCompleted}
                    filteredReferralDoctors={filteredReferralDoctors}
                    handleNextStep={handleNextStep}
                    handleSubmitReferral={handleSubmitReferral}
                    referralBooking={referralBooking}
                    referralDoctorId={referralDoctorId}
                    referralReason={referralReason}
                    referralSpecialty={referralSpecialty}
                    saveConsultationDraft={saveConsultationDraft}
                    setReferralDoctorId={setReferralDoctorId}
                    setReferralReason={setReferralReason}
                    setReferralSpecialty={setReferralSpecialty}
                    uniqueSpecialties={uniqueSpecialties}
                  />
                ) : null}

                {/* TAB 7: FOLLOW-UP */}
                {activeTab === 'Follow-up' ? (
                  <OpdFollowUpTab
                    completeConsultation={completeConsultation}
                    doctors={doctors}
                    followUp={followUp}
                    followUpDate={followUpDate}
                    followUpDoctorId={followUpDoctorId}
                    followUpDurationMinutes={followUpDurationMinutes}
                    followUpStartTime={followUpStartTime}
                    isVisitCompleted={isVisitCompleted}
                    saveConsultationDraft={saveConsultationDraft}
                    scheduleFollowUp={scheduleFollowUp}
                    setFollowUpDate={setFollowUpDate}
                    setFollowUpDoctorId={setFollowUpDoctorId}
                    setFollowUpDurationMinutes={setFollowUpDurationMinutes}
                    setFollowUpStartTime={setFollowUpStartTime}
                    updating={updating}
                  />
                ) : null}

                {/* TAB 8: NOTES */}
                {activeTab === 'Notes' ? (
                  <OpdNotesTab
                    canEdit={!isVisitCompleted}
                    doctorNotes={consultationForm.doctor_notes}
                    handleNextStep={handleNextStep}
                    onDoctorNotesChange={(val) =>
                      setConsultationForm((c) => ({ ...c, doctor_notes: val }))
                    }
                    saveConsultationDraft={saveConsultationDraft}
                  />
                ) : null}

                {/* TAB 9: DOCUMENTS */}
                {activeTab === 'Documents' ? (
                  <OpdDocumentsTab
                    canEdit={!isVisitCompleted}
                    deleteDocument={deleteDocument}
                    documents={documents}
                    downloadDocument={downloadDocument}
                    handleFileUpload={handleFileUpload}
                    setSelectedFile={setSelectedFile}
                    setUploadFileType={setUploadFileType}
                    updating={updating}
                    uploadFileType={uploadFileType}
                    viewDocument={viewDocument}
                  />
                ) : null}
              </fieldset>
            </main>

            {/* Right Summary Side Panel */}
            <OpdSummaryPanel
              consultationForm={consultationForm}
              prescriptionForm={prescriptionForm}
              visit={visit}
              vitalsForm={vitalsForm}
            />
          </div>
        </>
      )}

      {/* Record Patient Vitals Modal */}
      <OpdClinicalVitalsModal
        handleSaveVitalsModal={handleSaveVitalsModal}
        onClose={() => setVitalsModalOpen(false)}
        open={vitalsModalOpen}
        setVitalsForm={setVitalsForm}
        updating={updating}
        visit={visit}
        vitalsForm={vitalsForm}
      />

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </div>
  );
}
