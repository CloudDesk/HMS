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
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import {
  ClinicalVitalCard,
  calculateBmi,
  calculateMap,
  evaluateDiastolicBp,
  evaluatePulse,
  evaluateRespiratoryRate,
  evaluateSpo2,
  evaluateSystolicBp,
  evaluateTemperature,
} from '../components/ui/ClinicalVitalCard';
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
                      <button
                        className="doc-btn primary"
                        onClick={() => handleNextStep('Diagnosis')}
                        type="button"
                      >
                        Next: Diagnosis
                        <i className="ph ph-arrow-right" aria-hidden="true" />
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
                          {dxSearchTerm ? (
                            <button
                              type="button"
                              className="opd-dx-clear-btn"
                              onClick={() => setDxSearchTerm('')}
                              title="Clear search"
                            >
                              <i className="ph ph-x" />
                            </button>
                          ) : null}
                        </div>
                      </label>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', marginBottom: '2px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>
                          {dxSearchTerm.trim()
                            ? `Found ${filteredIcd10.length} matching diagnoses`
                            : 'Common Diagnoses (Type in the box above to search full ICD-10 catalogue)'}
                        </span>
                        {selectedDiagnoses.length > 0 ? (
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>
                            {selectedDiagnoses.length} diagnosis added
                          </span>
                        ) : null}
                      </div>

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
                                  <div className="opd-dx-details-stack">
                                    <span className="opd-dx-name">{dx.name}</span>
                                    {dx.category ? <span className="opd-dx-category-label">{dx.category}</span> : null}
                                  </div>
                                </div>
                                <button
                                  className={`doc-btn compact ${isAdded ? '' : 'primary'}`}
                                  disabled={isAdded}
                                  onClick={() => handleAddDiagnosis(dx)}
                                  style={isAdded ? { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a', cursor: 'default' } : undefined}
                                  type="button"
                                >
                                  {isAdded ? (
                                    <>
                                      <i className="ph-fill ph-check-circle" /> Added
                                    </>
                                  ) : (
                                    <>
                                      <i className="ph ph-plus" /> Add
                                    </>
                                  )}
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
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      <button
                        className="doc-btn primary"
                        onClick={() => handleNextStep('Prescription')}
                        type="button"
                      >
                        Next: Prescription
                        <i aria-hidden="true" className="ph ph-arrow-right" />
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
                          onChange={(e) => {
                            const val = e.target.value;
                            setMedicationForm((m) => ({
                              ...m,
                              duration: val === 'Custom' ? '' : val,
                            }));
                          }}
                          value={
                            ['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'].includes(medicationForm.duration)
                              ? medicationForm.duration
                              : medicationForm.duration === ''
                                ? 'Custom'
                                : 'Custom'
                          }
                        >
                          <option value="3 Days">3 Days</option>
                          <option value="5 Days">5 Days</option>
                          <option value="7 Days">7 Days</option>
                          <option value="10 Days">10 Days</option>
                          <option value="14 Days">14 Days</option>
                          <option value="30 Days">30 Days</option>
                          <option value="Ongoing">Ongoing / Chronic</option>
                          <option value="Custom">Custom</option>
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

                      {!['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'].includes(medicationForm.duration) && (
                        <>
                          <div />
                          <label className="doc-field" htmlFor="custom-duration-input">
                            <span>Custom Duration <span style={{ color: '#ef4444' }}>*</span></span>
                            <input
                              id="custom-duration-input"
                              onChange={(e) => setMedicationForm((m) => ({ ...m, duration: e.target.value }))}
                              placeholder="e.g. 21 Days, 6 Weeks, 2 Months"
                              value={medicationForm.duration}
                            />
                          </label>
                          <div />
                        </>
                      )}
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <button
                        className="doc-btn primary"
                        onClick={() => {
                          if (!medicationForm.medicine_name.trim()) {
                            showToast('Select a medicine first.', 'error');
                            return;
                          }
                          const finalDuration = medicationForm.duration.trim();
                          if (!finalDuration) {
                            showToast('Specify medication duration or select a custom duration.', 'error');
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
                                duration: finalDuration,
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
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
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
                        disabled={updating === 'prescription-submit'}
                        onClick={() => void handleSendToPharmacy()}
                        type="button"
                      >
                        {updating === 'prescription-submit' ? (
                          <>
                            <MedicalSpinner size="sm" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
                            Send To Pharmacy
                          </>
                        )}
                      </button>
                      <button
                        className="doc-btn"
                        onClick={() => handleNextStep('Lab Orders')}
                        type="button"
                      >
                        Next: Lab Orders
                        <i aria-hidden="true" className="ph ph-arrow-right" />
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

                    <div className="opd-form-section-head" style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h4>Available Tests</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Check tests to add to requisition ({availableLabTests.length} available)</p>
                      </div>
                      <div style={{ position: 'relative', width: '240px' }}>
                        <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }} />
                        <input
                          type="text"
                          placeholder="Filter lab tests..."
                          value={labSearchQuery}
                          onChange={(e) => setLabSearchQuery(e.target.value)}
                          className="opd-tests-search-input"
                          style={{ width: '100%', paddingLeft: '28px', height: '32px' }}
                        />
                      </div>
                    </div>

                    <div className="opd-tests-checkbox-grid">
                      {availableLabTests.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.82rem', gridColumn: '1 / -1', padding: '16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                          No lab tests found matching current category / filter.
                        </div>
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
                              <div className="opd-test-label-content">
                                <span className="opd-test-name">{test.name}</span>
                                <span className="opd-test-badge">
                                  {test.sample_type ? `Sample: ${test.sample_type}` : test.category || 'General Lab'}
                                </span>
                              </div>
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
                        onClick={() => handleNextStep('Imaging Orders')}
                        type="button"
                      >
                        Next: Imaging Orders
                        <i aria-hidden="true" className="ph ph-arrow-right" />
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

                    <div className="opd-form-section-head" style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h4>Available Imaging Tests</h4>
                        <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Check scans to add to requisition ({availableImagingTests.length} available)</p>
                      </div>
                      <div style={{ position: 'relative', width: '240px' }}>
                        <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }} />
                        <input
                          type="text"
                          placeholder="Filter imaging scans..."
                          value={imagingSearchQuery}
                          onChange={(e) => setImagingSearchQuery(e.target.value)}
                          className="opd-tests-search-input"
                          style={{ width: '100%', paddingLeft: '28px', height: '32px' }}
                        />
                      </div>
                    </div>

                    <div className="opd-tests-checkbox-grid">
                      {availableImagingTests.length === 0 ? (
                        <div style={{ color: '#64748b', fontSize: '0.82rem', gridColumn: '1 / -1', padding: '16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                          No imaging tests found matching current modality / filter.
                        </div>
                      ) : (
                        availableImagingTests.map((test) => {
                          const isSelected = imagingOrders.some((o) => o.id === test.id);
                          return (
                            <label
                              className={`opd-test-checkbox-label ${isSelected ? 'selected imaging' : ''}`}
                              key={test.id}
                            >
                              <input
                                checked={isSelected}
                                onChange={() => handleToggleImagingTest(test)}
                                type="checkbox"
                              />
                              <div className="opd-test-label-content">
                                <span className="opd-test-name">{test.name}</span>
                                <span className="opd-test-badge">
                                  {test.category || 'Radiology / Scan'}
                                </span>
                              </div>
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
                        onClick={() => handleNextStep('Referral')}
                        type="button"
                      >
                        Next: Referral
                        <i aria-hidden="true" className="ph ph-arrow-right" />
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
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" onClick={saveConsultationDraft} type="button">
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      <button
                        className="doc-btn primary"
                        onClick={() => handleNextStep('Follow-up')}
                        type="button"
                      >
                        Next: Follow-up
                        <i className="ph ph-arrow-right" aria-hidden="true" />
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
                        <input
                          disabled={followUp?.status === 'SCHEDULED'}
                          id="fu-date"
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(event) => setFollowUpDate(event.target.value)}
                          type="date"
                          value={followUpDate}
                        />
                      </label>
                      <label className="doc-field" htmlFor="fu-doctor">
                        <span>Doctor</span>
                        <select
                          disabled={followUp?.status === 'SCHEDULED'}
                          id="fu-doctor"
                          onChange={(event) => setFollowUpDoctorId(event.target.value)}
                          value={followUpDoctorId}
                        >
                          <option value="">Select Doctor</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.display_name} - {d.specialization}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="doc-field" htmlFor="fu-time">
                        <span>Start Time</span>
                        <input
                          disabled={followUp?.status === 'SCHEDULED'}
                          id="fu-time"
                          onChange={(event) => setFollowUpStartTime(event.target.value)}
                          type="time"
                          value={followUpStartTime}
                        />
                      </label>
                      <label className="doc-field" htmlFor="fu-duration">
                        <span>Duration</span>
                        <select
                          disabled={followUp?.status === 'SCHEDULED'}
                          id="fu-duration"
                          onChange={(event) => setFollowUpDurationMinutes(event.target.value)}
                          value={followUpDurationMinutes}
                        >
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">60 minutes</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={isVisitCompleted || updating !== ''} onClick={saveConsultationDraft} type="button">
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      {followUp?.status === 'SCHEDULED' ? (
                        <span
                          className="doc-btn"
                          style={{
                            backgroundColor: '#dcfce7',
                            borderColor: '#bbf7d0',
                            color: '#15803d',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <i className="ph ph-check-circle-fill" aria-hidden="true" />
                          Follow-up Scheduled
                        </span>
                      ) : (
                        <button
                          className="doc-btn success"
                          disabled={updating === 'consultation-complete' || updating === 'follow-up-schedule' || !followUpDate || !followUpDoctorId}
                          onClick={isVisitCompleted ? scheduleFollowUp : completeConsultation}
                          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                          type="button"
                        >
                          {updating === 'consultation-complete' || updating === 'follow-up-schedule' ? (
                            <>
                              <MedicalSpinner size="sm" />
                              <span>{isVisitCompleted ? 'Scheduling...' : 'Completing...'}</span>
                            </>
                          ) : (
                            <>
                              <i className="ph ph-check-circle" aria-hidden="true" />
                              {isVisitCompleted ? 'Schedule Follow-up' : 'Complete Consultation'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ) : null}

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
                      <button className="doc-btn primary" onClick={() => handleNextStep('Documents')} type="button">
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
              </fieldset>
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
        </>
      )}

      {/* Record Patient Vitals Modal */}
      <Modal onClose={() => setVitalsModalOpen(false)} open={vitalsModalOpen} size="large" title="Record Clinical Vitals">
        {(() => {
          const visitBmiObj = calculateBmi(vitalsForm.weight_kg, vitalsForm.height_cm);
          const visitMapVal = calculateMap(vitalsForm.blood_pressure_systolic, vitalsForm.blood_pressure_diastolic);

          return (
            <form className="clinical-vitals-modal-body" onSubmit={handleSaveVitalsModal}>
              {/* Clinical Patient Header Strip */}
              {visit ? (
                <div className="clinical-vitals-patient-strip">
                  <div className="clinical-vitals-patient-info">
                    <div className="clinical-vitals-avatar">
                      {patientInitials(visit.patient_name || 'Patient')}
                    </div>
                    <div className="clinical-vitals-patient-meta">
                      <h4>{visit.patient_name}</h4>
                      <span>Visit No: <strong>{visit.visit_number || 'OPD'}</strong> • Priority: {visit.priority} • Type: {visit.visit_type}</span>
                    </div>
                  </div>
                  <div className="clinical-vitals-summary-chips">
                    <span className="clinical-vital-summary-pill">
                      <i className="ph ph-stethoscope" /> Clinical Vitals
                    </span>
                    {visitMapVal !== null ? (
                      <span className="clinical-vital-summary-pill success">
                        <i className="ph ph-heartbeat" /> MAP: {visitMapVal} mmHg
                      </span>
                    ) : null}
                    {visitBmiObj ? (
                      <span className={`clinical-vital-summary-pill ${visitBmiObj.tone}`}>
                        <i className="ph ph-scales" /> BMI: {visitBmiObj.bmi} ({visitBmiObj.category})
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Clinical Vital Cards Grid */}
              <div className="clinical-vitals-grid">
                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-heartbeat"
                  id="modal-vitals-sys"
                  label="Systolic Blood Pressure"
                  max={300}
                  min={40}
                  normalRange="90 – 120 mmHg"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, blood_pressure_systolic: val })}
                  placeholder="120"
                  required
                  statusLabel={evaluateSystolicBp(vitalsForm.blood_pressure_systolic)?.label}
                  statusTone={evaluateSystolicBp(vitalsForm.blood_pressure_systolic)?.tone}
                  step={1}
                  themeColor="red"
                  unit="mmHg"
                  value={vitalsForm.blood_pressure_systolic}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-heart-straight"
                  id="modal-vitals-dia"
                  label="Diastolic Blood Pressure"
                  max={200}
                  min={30}
                  normalRange="60 – 80 mmHg"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: val })}
                  placeholder="80"
                  required
                  statusLabel={evaluateDiastolicBp(vitalsForm.blood_pressure_diastolic)?.label}
                  statusTone={evaluateDiastolicBp(vitalsForm.blood_pressure_diastolic)?.tone}
                  step={1}
                  themeColor="rose"
                  unit="mmHg"
                  value={vitalsForm.blood_pressure_diastolic}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-heart"
                  id="modal-vitals-pulse"
                  label="Heart / Pulse Rate"
                  max={250}
                  min={30}
                  normalRange="60 – 100 bpm"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, pulse_bpm: val })}
                  placeholder="72"
                  statusLabel={evaluatePulse(vitalsForm.pulse_bpm)?.label}
                  statusTone={evaluatePulse(vitalsForm.pulse_bpm)?.tone}
                  step={1}
                  themeColor="rose"
                  unit="bpm"
                  value={vitalsForm.pulse_bpm}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-thermometer-simple"
                  id="modal-vitals-temp"
                  label="Body Temperature"
                  max={45}
                  min={30}
                  normalRange="36.5 – 37.5 °C"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, temperature_c: val })}
                  placeholder="36.6"
                  statusLabel={evaluateTemperature(vitalsForm.temperature_c)?.label}
                  statusTone={evaluateTemperature(vitalsForm.temperature_c)?.tone}
                  step={0.1}
                  themeColor="amber"
                  unit="°C"
                  value={vitalsForm.temperature_c}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-drop"
                  id="modal-vitals-spo2"
                  label="Oxygen Saturation (SpO₂)"
                  max={100}
                  min={50}
                  normalRange="95 – 100 %"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, oxygen_saturation_percent: val })}
                  placeholder="98"
                  statusLabel={evaluateSpo2(vitalsForm.oxygen_saturation_percent)?.label}
                  statusTone={evaluateSpo2(vitalsForm.oxygen_saturation_percent)?.tone}
                  step={1}
                  themeColor="sky"
                  unit="%"
                  value={vitalsForm.oxygen_saturation_percent}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-wind"
                  id="modal-vitals-rr"
                  label="Respiratory Rate"
                  max={60}
                  min={6}
                  normalRange="12 – 20 breaths/min"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, respiratory_rate_per_min: val })}
                  placeholder="16"
                  statusLabel={evaluateRespiratoryRate(vitalsForm.respiratory_rate_per_min)?.label}
                  statusTone={evaluateRespiratoryRate(vitalsForm.respiratory_rate_per_min)?.tone}
                  step={1}
                  themeColor="teal"
                  unit="/min"
                  value={vitalsForm.respiratory_rate_per_min}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-scales"
                  id="modal-vitals-weight"
                  label="Body Weight"
                  max={400}
                  min={1}
                  normalRange="Adult kg"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, weight_kg: val })}
                  placeholder="70"
                  step={0.5}
                  themeColor="violet"
                  unit="kg"
                  value={vitalsForm.weight_kg}
                />

                <ClinicalVitalCard
                  disabled={updating === 'vitals'}
                  icon="ph-arrows-out-line-vertical"
                  id="modal-vitals-height"
                  label="Body Height"
                  max={260}
                  min={30}
                  normalRange="Adult cm"
                  onChange={(val) => setVitalsForm({ ...vitalsForm, height_cm: val })}
                  placeholder="170"
                  step={1}
                  themeColor="indigo"
                  unit="cm"
                  value={vitalsForm.height_cm}
                />
              </div>

              {/* Derived Clinical Health Summary (BMI & MAP) */}
              {(visitBmiObj || visitMapVal !== null) ? (
                <div className="clinical-derived-metrics-card">
                  {visitBmiObj ? (
                    <div className="clinical-derived-metric-item">
                      <i className="ph ph-scales" />
                      <div className="clinical-derived-metric-text">
                        <span className="clinical-derived-metric-label">Body Mass Index (BMI)</span>
                        <span className="clinical-derived-metric-value">{visitBmiObj.bmi} kg/m² • {visitBmiObj.category}</span>
                      </div>
                    </div>
                  ) : null}
                  {visitMapVal !== null ? (
                    <div className="clinical-derived-metric-item">
                      <i className="ph ph-heartbeat" />
                      <div className="clinical-derived-metric-text">
                        <span className="clinical-derived-metric-label">Mean Arterial Pressure (MAP)</span>
                        <span className="clinical-derived-metric-value">{visitMapVal} mmHg (Normal: 70–105 mmHg)</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="doc-field" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="modal-vitals-notes">Clinical Observations / Triage Notes</label>
                <textarea
                  id="modal-vitals-notes"
                  onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  placeholder="Clinical observation notes during vitals check"
                  rows={2}
                  value={vitalsForm.notes}
                />
              </div>

              <div className="modal-actions">
                <button className="doc-btn" onClick={() => setVitalsModalOpen(false)} type="button">
                  Cancel
                </button>
                <button className="doc-btn primary" disabled={updating === 'vitals'} type="submit">
                  {updating === 'vitals' ? 'Saving Vitals...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </div>
  );
}
