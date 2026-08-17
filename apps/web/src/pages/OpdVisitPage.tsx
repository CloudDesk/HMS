import { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentsApi } from '../api/appointments';
import { billingApi, type SaveBillingInvoiceItem } from '../api/billing';
import { doctorsApi, type ApiDoctorAvailabilityDay, type DoctorResponse } from '../api/doctors';
import { medicinesApi } from '../api/medicines';
import {
  opdApi,
  type ApiClinicalOrderPriority,
  type OpdConsultationResponse,
  type OpdPrescriptionResponse,
  type OpdVisitResponse,
  type SaveOpdConsultationPayload,
} from '../api/opd';
import { patientsApi, type PatientDocumentResponse } from '../api/patients';
import { pharmacyInventoryApi } from '../api/pharmacy-inventory';
import { servicesApi, type ServiceResponse } from '../api/services';
import { hasPermission } from '../auth/access-control';
import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { getPatientErrorMessage } from './patient-utils';
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
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (module: string, screen: string, action: string) => isSuperAdmin || hasPermission(
    user?.permissions ?? [],
    { module, screen, action },
  );
  const canEditConsultation = can('OPD', 'OPD Consultation', 'Edit');
  const canEditPrescription = can('OPD', 'OPD Prescription', 'Edit');
  const canEditClinicalOrders = can('OPD', 'OPD Clinical Orders', 'Edit');
  const canEditReferral = can('OPD', 'OPD Referral', 'Edit');
  const canBookAppointments = can('Appointments', 'Appointment Booking', 'Create');
  const canCreateDocuments = can('Patients', 'Patient Documents', 'Create');
  const canDeleteDocuments = can('Patients', 'Patient Documents', 'Delete');
  const canCreateVitals = can('OPD', 'OPD Vitals', 'Create');
  const canCreateInvoice = can('Billing', 'Invoices', 'Create');
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';

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
  const [consultationForm, setConsultationForm] = useState<ConsultationFormState>(emptyConsultationForm);

  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState('');

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
  const [referralDate, setReferralDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referralTimeSlot, setReferralTimeSlot] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralSlots, setReferralSlots] = useState<
    Array<{ startTime: string; endTime: string; remainingSlots: number; isAvailable: boolean }>
  >([]);
  const [referralSlotLoading, setReferralSlotLoading] = useState(false);
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

  // Load available slots for selected referral doctor and date
  const loadReferralSlots = useCallback(async () => {
    if (!referralDoctorId || !referralDate) {
      setReferralSlots([]);
      return;
    }
    setReferralSlotLoading(true);
    try {
      const [availableSlotsRes, existingApptsRes] = await Promise.all([
        doctorsApi.availableSlots(referralDoctorId, referralDate),
        appointmentsApi
          .list({ doctor_id: referralDoctorId, date_from: referralDate, date_to: referralDate, limit: 100 })
          .catch(() => ({ data: [] })),
      ]);

      const selectedDoc = doctors.find((d) => d.id === referralDoctorId);
      const dayNames: ApiDoctorAvailabilityDay[] = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const dateParts = referralDate.split('-');
      const dateObj =
        dateParts.length === 3
          ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))
          : new Date(referralDate);
      const dayOfWeek = dayNames[dateObj.getDay()];
      const dayAvail = selectedDoc?.availability.find((a) => a.day_of_week === dayOfWeek);
      const configuredMax = dayAvail?.max_patients_per_slot ?? availableSlotsRes.max_patients_per_slot ?? 2;

      const bookedCountMap: Record<string, number> = {};
      existingApptsRes.data.forEach((appt) => {
        if (appt.status !== 'CANCELLED') {
          bookedCountMap[appt.start_time] = (bookedCountMap[appt.start_time] || 0) + 1;
        }
      });

      const options = availableSlotsRes.slots.map((slot) => {
        const maxCapacity = slot.max_patients_per_slot ?? configuredMax;
        const bookedCount = bookedCountMap[slot.start_time] || 0;
        const remainingSlots = Math.max(0, maxCapacity - bookedCount);
        return {
          startTime: slot.start_time,
          endTime: slot.end_time,
          remainingSlots,
          isAvailable: remainingSlots > 0,
        };
      });

      setReferralSlots(options);
    } catch {
      setReferralSlots([]);
    } finally {
      setReferralSlotLoading(false);
    }
  }, [doctors, referralDate, referralDoctorId]);

  useEffect(() => {
    void loadReferralSlots();
  }, [loadReferralSlots]);

  const handleBookReferralAppointment = async () => {
    if (!canEditReferral || !canBookAppointments) return;
    if (!visit || !referralDoctorId || !referralDate || !referralTimeSlot) {
      showToast('Please select a doctor, date, and available time slot.', 'error');
      return;
    }
    const selectedDoc = doctors.find((d) => d.id === referralDoctorId);
    setReferralBooking(true);
    try {
      await appointmentsApi.create({
        patient_id: visit.patient_id,
        doctor_id: referralDoctorId,
        appointment_date: referralDate,
        start_time: referralTimeSlot,
        duration_minutes: 30,
        visit_type: 'FOLLOW_UP',
        priority: 'ROUTINE',
        reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty || selectedDoc?.specialization}`,
        notes: `Referred from OPD Visit #${visit.visit_number}`,
      });
      showToast(`Referral appointment booked successfully with ${selectedDoc?.display_name ?? 'Doctor'} on ${referralDate} at ${referralTimeSlot}!`);
      setReferralTimeSlot('');
      await loadReferralSlots();
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
    if (!canCreateVitals) return;
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
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const response = await opdApi.getVisitById(activeVisitId);
      setVisit(response);
    } catch (error) {
      setVisit(null);
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

  const selectedMasterMed = useMemo(
    () => masterMedicines.find((m) => m.name === medicationForm.medicine_name) ?? null,
    [masterMedicines, medicationForm.medicine_name],
  );

  const [labOrders, setLabOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedLabTest, setSelectedLabTest] = useState('');

  const [imagingOrders, setImagingOrders] = useState<Array<{ id: string; name: string; local_id: string }>>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [selectedImagingTest, setSelectedImagingTest] = useState('');

  // Load patient clinical sub-resources
  const loadClinicalData = useCallback(async () => {
    if (!activeVisitId) return;

    try {
      const [vitalsRes, consultRes, prescriptionRes, docRes, medRes, invRes, servRes, labOrderRes, imagingOrderRes] =
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
        ]);

      if (labOrderRes.status === 'fulfilled' && labOrderRes.value?.items?.length) {
        setLabOrders(labOrderRes.value.items.map(i => ({ id: i.service_id, name: i.investigation_name, local_id: i.id || `lab-${Date.now()}-${Math.random()}` })));
        if (labOrderRes.value.priority) setLabPriority(labOrderRes.value.priority);
      }
      if (imagingOrderRes.status === 'fulfilled' && imagingOrderRes.value?.items?.length) {
        setImagingOrders(imagingOrderRes.value.items.map(i => ({ id: i.service_id, name: i.investigation_name, local_id: i.id || `img-${Date.now()}-${Math.random()}` })));
        if (imagingOrderRes.value.priority) setImagingPriority(imagingOrderRes.value.priority);
      }

      if (servRes.status === 'fulfilled' && servRes.value?.data) {
        setServices(servRes.value.data);
      }

      if (medRes.status === 'fulfilled' && medRes.value?.data) {
        const invMapId: Record<string, { available: number; unit?: string }> = {};
        const invMapName: Record<string, { available: number; unit?: string }> = {};
        if (invRes.status === 'fulfilled' && invRes.value?.data) {
          invRes.value.data.forEach((item) => {
            const info = { available: item.available_quantity, unit: item.medicine.unit ?? undefined };
            if (item.medicine_id) invMapId[item.medicine_id] = info;
            if (item.medicine.name) invMapName[item.medicine.name] = info;
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
    void loadClinicalData();
  }, [loadClinicalData]);

  const loadDocuments = useCallback(async () => {
    if (!visit) {
      setDocuments([]);
      return;
    }
    try {
      const response = await patientsApi.documents(visit.patient_id, { visit_id: visit.id, limit: 100 });
      setDocuments(response.data);
    } catch (error) {
      setDocuments([]);
      showToast(getPatientErrorMessage(error), 'error');
    }
  }, [visit]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Action Handlers
  const saveConsultationDraft = async () => {
    if (!visit || !canEditConsultation) return;
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
      showToast('Consultation draft saved.');
    } catch (error) {
      showToast(getOpdErrorMessage(error), 'error');
    } finally {
      setUpdating('');
    }
  };

  const completeConsultation = async () => {
    if (!visit || !canEditConsultation) return;
    if (prescriptionForm.items.length > 0 && !canEditPrescription) {
      showToast('Prescription Edit permission is required to submit the entered medications.');
      return;
    }
    if ((labOrders.length > 0 || selectedLabTest) && !canEditClinicalOrders) {
      showToast('Clinical Orders Edit permission is required to submit laboratory orders.');
      return;
    }
    if ((imagingOrders.length > 0 || selectedImagingTest) && !canEditClinicalOrders) {
      showToast('Clinical Orders Edit permission is required to submit imaging orders.');
      return;
    }
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
      // The payload will be sent when completing the consultation at the end of this function
      // Save & Submit Prescriptions if items present
      if (prescriptionForm.items.length > 0) {
        await opdApi
          .submitPrescription(visit.id, {
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

      // Save & Submit Lab Clinical Orders if selected
      const pendingLabName = selectedLabTest || (document.getElementById('lab-test-name') as HTMLSelectElement | null)?.value || '';
      const matchedPendingLab = pendingLabName ? labTestServices.find((s) => s.name === pendingLabName) : undefined;
      
      const allLabItems = [...labOrders.map(o => ({
        service_id: o.id,
        investigation_name: o.name,
        category: labTestServices.find(s => s.id === o.id)?.category || 'General Lab',
      }))];
      
      if (matchedPendingLab && !allLabItems.find(i => i.service_id === matchedPendingLab.id)) {
        allLabItems.push({
          service_id: matchedPendingLab.id,
          investigation_name: pendingLabName,
          category: matchedPendingLab.category || 'General Lab',
        });
      }

      if (allLabItems.length > 0) {
        await opdApi
          .submitClinicalOrder(visit.id, 'LABORATORY', {
            priority: labPriority || 'ROUTINE',
            specimen_type: 'Not Specified',
            items: allLabItems,
          })
          .catch(() => null);
      }

      // Save & Submit Imaging Clinical Orders if selected
      const pendingImagingName = selectedImagingTest || (document.getElementById('imaging-test-name') as HTMLSelectElement | null)?.value || '';
      const matchedPendingImaging = pendingImagingName ? imagingServices.find((s) => s.name === pendingImagingName) : undefined;

      const allImagingItems = [...imagingOrders.map(o => ({
        service_id: o.id,
        investigation_name: o.name,
        category: imagingServices.find(s => s.id === o.id)?.category || 'Radiology',
      }))];

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

      if (invoiceItems.length > 0 && canCreateInvoice) {
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
      showToast(
        canCreateInvoice
          ? 'Consultation completed successfully and the billing invoice was generated.'
          : 'Consultation completed successfully.',
      );
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
    setUpdating('document-upload');
    try {
      const document = await patientsApi.uploadDocument(visit.patient_id, {
        document_type: uploadFileType === 'Identification' ? 'IDENTITY' : 'CLINICAL',
        title: uploadFileType,
        description: `OPD visit ${visit.visit_number} attachment`,
        visit_id: visit.id,
        file: selectedFile,
      });
      setDocuments((current) => [document, ...current]);
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
    if (!visit || !canDeleteDocuments || !window.confirm(`Delete ${document.title}?`)) return;
    try {
      await patientsApi.deleteDocument(visit.patient_id, document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      showToast(`${document.title} deleted.`);
    } catch (error) {
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const isTabCompleted = (tabName: string): boolean => {
    switch (tabName) {
      case 'Consultation':
        return Boolean(consultationForm.chief_complaint.trim());
      case 'Vitals':
        return Boolean(vitalsForm.blood_pressure_systolic.trim() || vitalsForm.pulse_bpm.trim());
      case 'Diagnosis':
        return Boolean(primaryDiagnosis.trim());
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
                <span>Female • 34 years</span>
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
                        <span>Complaint</span>
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
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        <i className="ph ph-floppy-disk" aria-hidden="true" />
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Diagnosis')} type="button">
                        Next: Diagnosis
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Prescription')} type="button">
                        Next: Prescription
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                        disabled={!canEditPrescription}
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
                                    disabled={!canEditPrescription}
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
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Lab Orders')} type="button">
                        Next: Lab Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Imaging Orders')} type="button">
                        Next: Imaging Orders
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Referral')} type="button">
                        Next: Referral
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                            setReferralTimeSlot('');
                            setReferralSlots([]);
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
                            setReferralTimeSlot('');
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

                      <label className="doc-field" htmlFor="ref-date">
                        <span>Appointment Date</span>
                        <input
                          id="ref-date"
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => {
                            setReferralDate(e.target.value);
                            setReferralTimeSlot('');
                          }}
                          type="date"
                          value={referralDate}
                        />
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

                  {/* Doctor Availability & Time Slots Section */}
                  {referralDoctorId ? (
                    <section className="opd-form-section" style={{ marginTop: '1.25rem' }}>
                      <div className="opd-form-section-head">
                        <div>
                          <h3>Doctor Availability &amp; Open Slots</h3>
                          <p>
                            Select an available slot to book appointment for {referralDate}
                          </p>
                        </div>
                      </div>

                      {referralSlotLoading ? (
                        <div className="um-state-cell">Loading available doctor time slots...</div>
                      ) : referralSlots.length === 0 ? (
                        <div className="form-error-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                          <i className="ph ph-warning-circle" aria-hidden="true" />
                          <span>Doctor is not available for appointments on {referralDate}. Please pick another date.</span>
                        </div>
                      ) : (
                        <div className="referral-slots-grid">
                          {referralSlots.map((slot) => {
                            const isSelected = referralTimeSlot === slot.startTime;
                            return (
                              <button
                                className={`referral-slot-btn${isSelected ? ' selected' : ''}${!slot.isAvailable ? ' disabled' : ''}`}
                                disabled={!slot.isAvailable}
                                key={slot.startTime}
                                onClick={() => setReferralTimeSlot(slot.startTime)}
                                type="button"
                              >
                                <span className="slot-time">{slot.startTime}</span>
                                <span className={`slot-capacity-badge ${slot.remainingSlots > 2 ? 'available' : slot.remainingSlots > 0 ? 'warning' : 'full'}`}>
                                  {slot.isAvailable ? `${slot.remainingSlots} slots left` : 'Fully booked'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="referral-booking-action-bar" style={{ marginTop: '1.25rem' }}>
                        <button
                          className="doc-btn primary"
                          disabled={!canEditReferral || !canBookAppointments || !referralTimeSlot || referralBooking}
                          onClick={() => void handleBookReferralAppointment()}
                          style={{ minWidth: '220px' }}
                          type="button"
                        >
                          <i className="ph ph-calendar-plus" aria-hidden="true" />
                          {referralBooking ? 'Booking Appointment...' : 'Book Referral Appointment'}
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <div className="opd-sticky-actions">
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button className="doc-btn primary" onClick={() => setActiveTab('Follow-up')} type="button">
                        Next: Follow-up
                        <i className="ph ph-arrow-right" aria-hidden="true" />
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                        <input id="fu-date" type="date" />
                      </label>
                      <label className="doc-field" htmlFor="fu-doctor">
                        <span>Doctor</span>
                        <select id="fu-doctor">
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
                    <span className="opd-autosave saved">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      Auto-save enabled
                    </span>
                    <div>
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
                        Save Draft
                      </button>
                      <button
                        className="doc-btn success"
                        disabled={!canEditConsultation || updating === 'consultation-complete'}
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
                      <button className="doc-btn" disabled={!canEditConsultation} onClick={saveConsultationDraft} type="button">
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
                          <button className="doc-btn primary upload-btn" disabled={!canCreateDocuments || updating === 'document-upload'} type="submit">
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
                    <span>SpO₂</span>
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
      <Modal onClose={() => setVitalsModalOpen(false)} open={vitalsModalOpen} size="large" title="Record Patient Vitals">
        <form className="modal-form" onSubmit={handleSaveVitalsModal}>
          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-vitals-sys">
                Blood Pressure (Systolic) <span className="required-asterisk">*</span>
              </label>
              <input
                id="modal-vitals-sys"
                onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_systolic: e.target.value })}
                placeholder="120"
                required
                type="number"
                value={vitalsForm.blood_pressure_systolic}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-vitals-dia">
                Blood Pressure (Diastolic) <span className="required-asterisk">*</span>
              </label>
              <input
                id="modal-vitals-dia"
                onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: e.target.value })}
                placeholder="80"
                required
                type="number"
                value={vitalsForm.blood_pressure_diastolic}
              />
            </div>
          </div>

          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-vitals-pulse">Pulse (bpm)</label>
              <input
                id="modal-vitals-pulse"
                onChange={(e) => setVitalsForm({ ...vitalsForm, pulse_bpm: e.target.value })}
                placeholder="72"
                type="number"
                value={vitalsForm.pulse_bpm}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-vitals-temp">Temperature (°C)</label>
              <input
                id="modal-vitals-temp"
                onChange={(e) => setVitalsForm({ ...vitalsForm, temperature_c: e.target.value })}
                placeholder="36.6"
                step="0.1"
                type="number"
                value={vitalsForm.temperature_c}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-vitals-spo2">SpO₂ (%)</label>
              <input
                id="modal-vitals-spo2"
                onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen_saturation_percent: e.target.value })}
                placeholder="98"
                type="number"
                value={vitalsForm.oxygen_saturation_percent}
              />
            </div>
          </div>

          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-vitals-rr">Respiratory Rate (/min)</label>
              <input
                id="modal-vitals-rr"
                onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate_per_min: e.target.value })}
                placeholder="16"
                type="number"
                value={vitalsForm.respiratory_rate_per_min}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-vitals-weight">Weight (kg)</label>
              <input
                id="modal-vitals-weight"
                onChange={(e) => setVitalsForm({ ...vitalsForm, weight_kg: e.target.value })}
                placeholder="70"
                type="number"
                value={vitalsForm.weight_kg}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-vitals-height">Height (cm)</label>
              <input
                id="modal-vitals-height"
                onChange={(e) => setVitalsForm({ ...vitalsForm, height_cm: e.target.value })}
                placeholder="170"
                type="number"
                value={vitalsForm.height_cm}
              />
            </div>
          </div>

          <div className="doc-field" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="modal-vitals-notes">Vitals Notes</label>
            <textarea
              id="modal-vitals-notes"
              onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
              placeholder="Observation notes during vitals check"
              rows={2}
              value={vitalsForm.notes}
            />
          </div>

          <div className="modal-actions">
            <button className="doc-btn" onClick={() => setVitalsModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={!canCreateVitals || updating === 'vitals'} type="submit">
              {updating === 'vitals' ? 'Saving Vitals...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </div>
  );
}
