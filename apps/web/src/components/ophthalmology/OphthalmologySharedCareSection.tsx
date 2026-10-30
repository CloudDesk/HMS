import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fromZonedTime } from 'date-fns-tz';
import { useQueryClient } from '@tanstack/react-query';
import { useTimezone } from '../../api/useSettings';
import { OphthalmologyOrderIcon } from './OphthalmologyOrderIcon';
import { useOpdWorkspace } from '../../hooks/opd/useOpdWorkspace';
import { useBranchesList } from '../../hooks/branches/useBranches';
import { useDepartmentsList } from '../../hooks/departments/useDepartments';
import { registerDraftSaveHandler } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import type {
  ApiClinicalOrderPriority,
  ApiOpdReferralPriority,
  SaveOpdClinicalOrderPayload,
  SaveOpdFollowUpPayload,
  SaveOpdPrescriptionPayload,
  SaveOpdReferralPayload,
} from '../../api/opd';
import type { ServiceResponse } from '../../api/services';
import type { InventoryItem } from '../../api/pharmacy-inventory';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import {
  OpdPrescriptionSection,
  OpdReferralSection,
} from '../opd';
import { OphthalmologyLabOrdersSection } from './OphthalmologyLabOrdersSection';
import { OphthalmologyImagingOrdersSection } from './OphthalmologyImagingOrdersSection';
import { OphthalmologyFollowUpSchedulingSection } from './OphthalmologyFollowUpSchedulingSection';
import type {
  MedicationFormState,
  PrescriptionFormState,
} from '../opd/OpdPrescriptionSection';
import type { LabOrderItem } from '../opd/OpdLabSection';
import type { ImagingOrderItem } from '../opd/OpdImagingSection';
import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';
import type { CareWorkspace, OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';

const emptyMedicationForm: MedicationFormState = {
  medicine_name: '',
  strength: '',
  dosage: '',
  route: 'ORAL',
  frequency: '',
  duration: '',
  quantity: '',
  instructions: '',
};

const emptyPrescriptionForm: PrescriptionFormState = {
  items: [],
  follow_up_date: '',
  doctor_instructions: '',
  patient_instructions: '',
};

export type SharedCareTab =
  | 'prescription'
  | 'lab-orders'
  | 'imaging-orders'
  | 'referral'
  | 'follow-up';

export interface OphthalmologySharedCareSectionProps {
  workspace: CareWorkspace;
  feature: OphthalmologyCareFeature;
  mode?: 'orders' | 'continuing-care';
  activeSharedTab: SharedCareTab;
  onTabChange: (tab: SharedCareTab) => void;
  onReturnToTreatment: () => void;
}

export function OphthalmologySharedCareSection({
  workspace,
  feature,
  mode = 'orders',
  activeSharedTab,
  onTabChange,
  onReturnToTreatment,
}: OphthalmologySharedCareSectionProps) {
  const queryClient = useQueryClient();
  const timezone = useTimezone();
  const visitId = workspace.visitId;

  const activeOpdTab =
    activeSharedTab === 'prescription'
      ? 'Prescription'
      : activeSharedTab === 'lab-orders'
      ? 'Lab Orders'
      : activeSharedTab === 'imaging-orders'
      ? 'Imaging Orders'
      : activeSharedTab === 'referral'
      ? 'Referral'
      : 'Follow-up';

  const opd = useOpdWorkspace(visitId, activeOpdTab);

  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', limit: 100 },
    Boolean(visitId && activeSharedTab === 'lab-orders'),
  );
  const departmentsQuery = useDepartmentsList(
    { status: 'ACTIVE', limit: 100 },
    Boolean(visitId && (activeSharedTab === 'lab-orders' || activeSharedTab === 'imaging-orders')),
  );
  const branches = branchesQuery.data?.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];

  const [updating, setUpdating] = useState('');

  // 1. PRESCRIPTION STATE
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(emptyPrescriptionForm);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(emptyMedicationForm);

  useEffect(() => {
    if (opd.prescription) {
      setPrescriptionForm({
        items: (opd.prescription.items ?? []).map((item) => ({
          local_id: item.id || `rx-${Date.now()}-${Math.random()}`,
          medicine_name: item.medicine_name,
          strength: item.strength ?? '',
          dosage: item.dosage,
          route: item.route,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity?.toString() ?? '',
          instructions: item.instructions ?? '',
        })),
        follow_up_date: opd.prescription.follow_up_date?.slice(0, 10) ?? '',
        doctor_instructions: opd.prescription.doctor_instructions ?? '',
        patient_instructions: opd.prescription.patient_instructions ?? '',
      });
    }
  }, [opd.prescription]);

  const masterMedicines = useMemo(() => {
    const inventoryById: Record<string, InventoryItem> = {};
    opd.inventory.forEach((item) => {
      inventoryById[item.medicine_id] = item;
    });
    return opd.medicines.map((medicine) => {
      const inv = inventoryById[medicine.id];
      return {
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.generic_name,
        strength: medicine.strength,
        dosage_form: medicine.dosage_form,
        unit: medicine.unit || 'units',
        available_quantity: inv?.available_quantity ?? null,
      };
    });
  }, [opd.inventory, opd.medicines]);

  // 2. LAB ORDERS STATE
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>([]);
  const [labPriority, setLabPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [labFacility, setLabFacility] = useState('Main Branch - Laboratory');
  const [labSampleType, setLabSampleType] = useState('Blood');
  const [labCategory, setLabCategory] = useState('All');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [labOrderSummary, setLabOrderSummary] = useState('');
  const [labSearchQuery, setLabSearchQuery] = useState('');

  useEffect(() => {
    if (opd.labOrder) {
      setLabOrders(
        (opd.labOrder.items ?? []).map((item) => ({
          id: item.service_id,
          name: item.investigation_name,
          category: item.category,
          local_id: item.id || `lab-${Date.now()}-${Math.random()}`,
        })),
      );
      setLabPriority(opd.labOrder.priority ?? 'ROUTINE');
      setLabFacility(opd.labOrder.destination ?? 'Main Branch - Laboratory');
      setLabSampleType(opd.labOrder.specimen_type ?? 'Blood');
      setLabClinicalNotes(opd.labOrder.clinical_notes ?? '');
      setLabOrderSummary(opd.labOrder.instructions ?? '');
    }
  }, [opd.labOrder]);

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

  const labTestServices = useMemo(
    () => opd.services.filter((s) => s.service_type === 'LAB_TEST'),
    [opd.services],
  );

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
      'Conjunctival Swab',
      'Corneal Scraping',
      'Aqueous Humor',
      'Vitreous Tap',
      'Tissue / Biopsy',
    ];
    return Array.from(new Set([...dbSamples, ...standardSamples]));
  }, [labTestServices]);

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

  // 3. IMAGING ORDERS STATE
  const [imagingOrders, setImagingOrders] = useState<ImagingOrderItem[]>([]);
  const [imagingPriority, setImagingPriority] = useState<ApiClinicalOrderPriority>('ROUTINE');
  const [imagingCategory, setImagingCategory] = useState('All');
  const [imagingClinicalInfo, setImagingClinicalInfo] = useState('');
  const [imagingOrderInstructions, setImagingOrderInstructions] = useState('');
  const [imagingSearchQuery, setImagingSearchQuery] = useState('');

  useEffect(() => {
    if (opd.imagingOrder) {
      setImagingOrders(
        (opd.imagingOrder.items ?? []).map((item) => ({
          id: item.service_id,
          name: item.investigation_name,
          category: item.category,
          local_id: item.id || `img-${Date.now()}-${Math.random()}`,
        })),
      );
      setImagingPriority(opd.imagingOrder.priority ?? 'ROUTINE');
      setImagingClinicalInfo(opd.imagingOrder.clinical_notes ?? '');
      setImagingOrderInstructions(opd.imagingOrder.instructions ?? '');
    }
  }, [opd.imagingOrder]);

  const imagingServices = useMemo(
    () => opd.services.filter((s) => s.service_type === 'IMAGING_SERVICE'),
    [opd.services],
  );

  const imagingCategoryOptions = useMemo(() => {
    const dbCats = Array.from(
      new Set(
        imagingServices
          .map((s) => s.category?.trim())
          .filter((cat): cat is string => Boolean(cat && cat.length > 0)),
      ),
    );
    const standardOphImaging = ['Optical Coherence Tomography (OCT)', 'Fundus Photography', 'Visual Field (Perimetry)', 'Ultrasound B-Scan', 'X-Ray', 'CT Scan', 'MRI'];
    return Array.from(new Set([...dbCats, ...standardOphImaging, 'All']));
  }, [imagingServices]);

  const availableImagingTests = useMemo(() => {
    let list = imagingServices;
    if (imagingCategory && imagingCategory !== 'All') {
      const cat = imagingCategory.toLowerCase();
      const matched = list.filter(
        (s) =>
          (s.category && s.category.toLowerCase().includes(cat)) ||
          s.name.toLowerCase().includes(cat),
      );
      if (matched.length > 0) list = matched;
    }
    if (imagingSearchQuery.trim()) {
      const q = imagingSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.category && s.category.toLowerCase().includes(q)),
      );
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

  // 4. REFERRAL STATE
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralDoctorId, setReferralDoctorId] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralBooking, setReferralBooking] = useState(false);
  const [referralPriority, setReferralPriority] = useState<ApiOpdReferralPriority>('ROUTINE');
  const [referralAppointmentDate, setReferralAppointmentDate] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  useEffect(() => {
    if (opd.referral) {
      setReferralSpecialty(opd.referral.specialty ?? '');
      setReferralDoctorId(opd.referral.referred_doctor_id ?? '');
      setReferralReason(opd.referral.reason ?? '');
      setReferralPriority(opd.referral.priority ?? 'ROUTINE');
      setReferralAppointmentDate(opd.referral.appointment_date?.slice(0, 10) ?? '');
      setReferralNotes(opd.referral.clinical_summary ?? '');
    }
  }, [opd.referral]);

  const uniqueSpecialties = useMemo(() => {
    return Array.from(
      new Set(opd.doctors.map((d) => d.specialization).filter(Boolean)),
    ).sort() as string[];
  }, [opd.doctors]);

  const filteredReferralDoctors = useMemo(() => {
    if (!referralSpecialty) return opd.doctors;
    return opd.doctors.filter((d) => d.specialization === referralSpecialty);
  }, [opd.doctors, referralSpecialty]);

  // 5. FOLLOW-UP STATE
  const [followUpDate, setFollowUpDate] = useState('2026-10-12');
  const [followUpDoctorId, setFollowUpDoctorId] = useState('');
  const [followUpStartTime, setFollowUpStartTime] = useState('09:00');
  const [followUpDurationMinutes, setFollowUpDurationMinutes] = useState('30');
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  useEffect(() => {
    if (opd.followUp) {
      setFollowUpDate(opd.followUp.next_visit_date?.slice(0, 10) ?? '2026-10-12');
      setFollowUpDoctorId(opd.followUp.assigned_doctor_id ?? '');
      setFollowUpStartTime(opd.followUp.start_time ?? '09:00');
      setFollowUpDurationMinutes(String(opd.followUp.duration_minutes ?? 30));
      setFollowUpReason(opd.followUp.reason ?? '');
      setFollowUpNotes(opd.followUp.notes ?? '');
    } else {
      if (!followUpDoctorId && opd.visit?.doctor_id) {
        setFollowUpDoctorId(opd.visit.doctor_id);
      }
    }
  }, [opd.followUp, opd.visit?.doctor_id, followUpDoctorId]);

  const followUpUtcDateTime = () =>
    fromZonedTime(`${followUpDate}T${followUpStartTime}:00`, timezone).toISOString();

  // Selected diagnoses for prescription context
  const selectedDiagnoses: Icd10Diagnosis[] = useMemo(() => {
    return feature.diagnoses.map((d) => ({
      code: d.code,
      name: `${d.display}${d.laterality ? ` (${d.laterality})` : ''}`,
      category: d.laterality ?? 'Ophthalmic',
    }));
  }, [feature.diagnoses]);

  const invalidateEncounter = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['opd-workspace', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['opd-visit', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['opd-prescription', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['opd-clinical-orders', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['opd-referral', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['opd-follow-up', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['ophthalmology-summary', visitId] }),
      queryClient.invalidateQueries({ queryKey: ['ophthalmology-clinical', visitId] }),
    ]);
  };

  // Emergency lock and default ophthalmic laterality
  const isRoutineCareBlocked = Boolean(
    workspace.emergencyAlerts?.some(
      (a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED' || (a.status === 'CLEARED' && !a.clearance?.resumption_permitted)
    )
  );
  const contextLaterality = (workspace.context?.affected_eye as 'OD' | 'OS' | 'OU') || 'OU';

  // ACTIONS
  const handleSendToPharmacy = async () => {
    if (isRoutineCareBlocked) {
      toast.error('Routine prescription submission is blocked during an active emergency alert.');
      return;
    }
    if (prescriptionForm.items.length === 0) {
      toast.error('Add at least one medication before sending to pharmacy.');
      return;
    }
    setUpdating('prescription-submit');
    try {
      const payload: SaveOpdPrescriptionPayload = {
        items: prescriptionForm.items.map((i) => ({
          medicine_name: i.medicine_name,
          strength: i.strength || null,
          dosage: i.dosage,
          route: i.route || 'OPHTHALMIC',
          laterality: (i as { laterality?: 'OD' | 'OS' | 'OU' }).laterality || contextLaterality,
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
      await opd.mutations.submitPrescription({ visitId, payload });
      toast.success('Prescription sent to pharmacy successfully.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const savePrescriptionDraft = async () => {
    setUpdating('prescription-draft');
    try {
      const payload: SaveOpdPrescriptionPayload = {
        items: prescriptionForm.items.map((i) => ({
          medicine_name: i.medicine_name,
          strength: i.strength || null,
          dosage: i.dosage,
          route: i.route || 'OPHTHALMIC',
          laterality: (i as { laterality?: 'OD' | 'OS' | 'OU' }).laterality || contextLaterality,
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
      await opd.mutations.savePrescriptionDraft({ visitId, payload });
      toast.success('Medication prescription draft saved.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const saveLabDraft = async () => {
    const invalidItem = labOrders.find((o) => !/^[0-9a-fA-F]{24}$/.test(o.id));
    if (invalidItem) {
      toast.error(
        `Investigation "${invalidItem.name}" is not configured in the active laboratory catalogue and cannot be saved. Please remove it and select a configured test.`,
      );
      return;
    }
    setUpdating('lab-draft');
    try {
      const payload: SaveOpdClinicalOrderPayload = {
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
      };
      await opd.mutations.saveClinicalOrderDraft({ visitId, type: 'LABORATORY', payload });
      toast.success('Laboratory orders draft saved.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const handleSubmitLabOrder = async () => {
    if (isRoutineCareBlocked) {
      toast.error('Routine laboratory order submission is blocked during an active emergency alert.');
      return;
    }
    if (labOrders.length === 0) {
      toast.error('Select at least one laboratory investigation before submitting.');
      return;
    }
    const invalidItem = labOrders.find((o) => !/^[0-9a-fA-F]{24}$/.test(o.id));
    if (invalidItem) {
      toast.error(
        `Investigation "${invalidItem.name}" is not configured in the active laboratory catalogue and cannot be submitted. Please remove it and select a configured test.`,
      );
      return;
    }
    setUpdating('lab-submit');
    try {
      const payload: SaveOpdClinicalOrderPayload = {
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
      };
      await opd.mutations.submitClinicalOrder({ visitId, type: 'LABORATORY', payload });
      toast.success('Laboratory order submitted successfully.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const saveImagingDraft = async () => {
    setUpdating('imaging-draft');
    try {
      const payload: SaveOpdClinicalOrderPayload = {
        priority: imagingPriority || 'ROUTINE',
        clinical_notes: imagingClinicalInfo || null,
        instructions: imagingOrderInstructions || null,
        items: imagingOrders.map((o) => ({
          service_id: o.id,
          investigation_name: o.name,
          category: o.category || imagingCategory || 'Imaging',
        })),
      };
      await opd.mutations.saveClinicalOrderDraft({ visitId, type: 'IMAGING', payload });
      toast.success('Imaging orders draft saved.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const handleSubmitImagingOrder = async () => {
    if (isRoutineCareBlocked) {
      toast.error('Routine imaging order submission is blocked during an active emergency alert.');
      return;
    }
    if (imagingOrders.length === 0) {
      toast.error('Select at least one imaging examination before submitting.');
      return;
    }
    setUpdating('imaging-submit');
    try {
      const payload: SaveOpdClinicalOrderPayload = {
        priority: imagingPriority || 'ROUTINE',
        clinical_notes: imagingClinicalInfo || null,
        instructions: imagingOrderInstructions || null,
        items: imagingOrders.map((o) => ({
          service_id: o.id,
          investigation_name: o.name,
          category: o.category || imagingCategory || 'Imaging',
        })),
      };
      await opd.mutations.submitClinicalOrder({ visitId, type: 'IMAGING', payload });
      toast.success('Imaging order submitted successfully.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const handleSubmitReferral = async () => {
    if (!referralDoctorId || !referralSpecialty) {
      toast.error('Please select a specialty and a doctor.');
      return;
    }
    setReferralBooking(true);
    try {
      const payload: SaveOpdReferralPayload = {
        referral_type: 'INTERNAL',
        specialty: referralSpecialty,
        referred_doctor_id: referralDoctorId,
        priority: referralPriority,
        appointment_date: referralAppointmentDate || null,
        reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
        clinical_summary: referralNotes.trim() || feature.consultation?.assessment || 'Ophthalmic referral for further evaluation.',
      };
      await opd.mutations.submitReferral({ visitId, payload });
      toast.success('Referral submitted successfully.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setReferralBooking(false);
    }
  };

  const saveReferralDraft = async () => {
    setUpdating('referral-draft');
    try {
      const payload: SaveOpdReferralPayload = {
        referral_type: 'INTERNAL',
        specialty: referralSpecialty,
        referred_doctor_id: referralDoctorId || undefined,
        priority: referralPriority,
        appointment_date: referralAppointmentDate || null,
        reason: referralReason.trim() || `Specialist Referral - ${referralSpecialty}`,
        clinical_summary: referralNotes.trim() || feature.consultation?.assessment || 'Ophthalmic referral for further evaluation.',
      };
      await opd.mutations.saveReferralDraft({ visitId, payload });
      toast.success('Referral draft saved.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const scheduleFollowUp = async () => {
    if (!followUpDate || !followUpDoctorId) {
      toast.error('Please select a follow-up date and doctor.');
      return;
    }
    setUpdating('follow-up-schedule');
    try {
      const payload: SaveOpdFollowUpPayload = {
        follow_up_type: 'CLINICAL_REVIEW',
        next_visit_date: followUpDate,
        start_time: followUpStartTime,
        utc_datetime: followUpUtcDateTime(),
        duration_minutes: Number(followUpDurationMinutes),
        assigned_doctor_id: followUpDoctorId,
        reason: followUpReason || 'Ophthalmic clinical follow-up review',
        notes: followUpNotes || undefined,
        reminder_type: 'SMS',
      };
      await opd.mutations.scheduleFollowUp({ visitId, payload });
      toast.success('Follow-up scheduled and added to doctor calendar.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const saveFollowUpDraft = async () => {
    setUpdating('follow-up-draft');
    try {
      const payload: SaveOpdFollowUpPayload = {
        follow_up_type: 'CLINICAL_REVIEW',
        next_visit_date: followUpDate || new Date().toISOString().slice(0, 10),
        start_time: followUpStartTime,
        utc_datetime: followUpUtcDateTime(),
        duration_minutes: Number(followUpDurationMinutes),
        assigned_doctor_id: followUpDoctorId || undefined,
        reason: followUpReason || 'Ophthalmic clinical follow-up review',
        notes: followUpNotes || undefined,
        reminder_type: 'SMS',
      };
      await opd.mutations.saveFollowUpDraft({ visitId, payload });
      toast.success('Follow-up draft saved.');
      await invalidateEncounter();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  useEffect(() => {
    const handler =
      activeSharedTab === 'prescription' ? savePrescriptionDraft :
      activeSharedTab === 'lab-orders' ? saveLabDraft :
      activeSharedTab === 'imaging-orders' ? saveImagingDraft :
      activeSharedTab === 'referral' ? saveReferralDraft :
      activeSharedTab === 'follow-up' ? saveFollowUpDraft : null;
    if (!handler) return;
    return registerDraftSaveHandler('current', async () => {
      await handler();
    });
  }, [activeSharedTab, savePrescriptionDraft, saveLabDraft, saveImagingDraft, saveReferralDraft, saveFollowUpDraft]);

  const handleNextStepNavigation = (nextTabName: string) => {
    const nextTabMap: Record<string, SharedCareTab> = {
      'Prescription': 'prescription',
      'Lab Orders': 'lab-orders',
      'Imaging Orders': 'imaging-orders',
      'Referral': 'referral',
      'Follow-up': 'follow-up',
    };
    if (nextTabName === 'Referral' && mode === 'orders') {
      workspace.setQuery('care_tab', 'optical');
      return;
    }
    const target = nextTabMap[nextTabName];
    if (target) {
      onTabChange(target);
    } else {
      onReturnToTreatment();
    }
  };

  return (
    <div className={`oph-shared-care-container${mode === 'continuing-care' ? ' oph-continuing-care' : ' oph-orders-care'}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {mode === 'orders' && (
        <div className="oph-orders-heading">
          <div className="oph-exam-heading">
            <h2>Prescriptions &amp; orders</h2>
            <p className="oph-exam-description">Create, review, and send medication orders for this encounter.</p>
          </div>
        </div>
      )}
      {mode === 'continuing-care' && (
        <div className="oph-continuing-heading">
          <div className="oph-exam-heading">
            <h2>Referral &amp; Follow-up</h2>
            <p className="oph-exam-description">Refer the patient and schedule the next step in care.</p>
          </div>
        </div>
      )}
      {/* Step-Specific Unified Sub-Navigation & Actions Bar */}
      <nav
        className="oph-care-subnav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '8px 14px',
          marginBottom: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
        }}
        aria-label="Clinical care section navigation"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {mode === 'orders' && (
            <>
              <button
                type="button"
                className={`oph-care-subtab ${activeSharedTab === 'prescription' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeSharedTab === 'prescription' ? '1px solid #bfdbfe' : '1px solid transparent',
                  background: activeSharedTab === 'prescription' ? '#ffffff' : 'transparent',
                  color: activeSharedTab === 'prescription' ? '#2563eb' : '#334155',
                  boxShadow: activeSharedTab === 'prescription' ? '0 1px 2px rgba(37, 99, 235, 0.08)' : 'none',
                }}
                onClick={() => onTabChange('prescription')}
              >
                <OphthalmologyOrderIcon kind="pill" />
                <span>Medication prescription</span>
              </button>
              <button
                type="button"
                className={`oph-care-subtab ${activeSharedTab === 'lab-orders' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeSharedTab === 'lab-orders' ? '1px solid #bfdbfe' : '1px solid transparent',
                  background: activeSharedTab === 'lab-orders' ? '#ffffff' : 'transparent',
                  color: activeSharedTab === 'lab-orders' ? '#2563eb' : '#334155',
                  boxShadow: activeSharedTab === 'lab-orders' ? '0 1px 2px rgba(37, 99, 235, 0.08)' : 'none',
                }}
                onClick={() => onTabChange('lab-orders')}
              >
                <OphthalmologyOrderIcon kind="clipboard" />
                <span>Laboratory orders</span>
              </button>
              <button
                type="button"
                className={`oph-care-subtab ${activeSharedTab === 'imaging-orders' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeSharedTab === 'imaging-orders' ? '1px solid #bfdbfe' : '1px solid transparent',
                  background: activeSharedTab === 'imaging-orders' ? '#ffffff' : 'transparent',
                  color: activeSharedTab === 'imaging-orders' ? '#2563eb' : '#334155',
                  boxShadow: activeSharedTab === 'imaging-orders' ? '0 1px 2px rgba(37, 99, 235, 0.08)' : 'none',
                }}
                onClick={() => onTabChange('imaging-orders')}
              >
                <OphthalmologyOrderIcon kind="activity" />
                <span>Imaging orders</span>
              </button>
            </>
          )}

          {mode === 'continuing-care' && (
            <>
              <button
                type="button"
                className={`oph-care-subtab ${activeSharedTab === 'referral' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  fontWeight: activeSharedTab === 'referral' ? 700 : 500,
                  cursor: 'pointer',
                  border: activeSharedTab === 'referral' ? '1.5px solid #2563eb' : '1px solid transparent',
                  background: activeSharedTab === 'referral' ? '#ffffff' : 'transparent',
                  color: activeSharedTab === 'referral' ? '#2563eb' : '#475569',
                  boxShadow: activeSharedTab === 'referral' ? '0 1px 3px rgba(37, 99, 235, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onTabChange('referral')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Specialist referral</span>
              </button>
              <button
                type="button"
                className={`oph-care-subtab ${activeSharedTab === 'follow-up' ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  fontWeight: activeSharedTab === 'follow-up' ? 700 : 500,
                  cursor: 'pointer',
                  border: activeSharedTab === 'follow-up' ? '1.5px solid #2563eb' : '1px solid transparent',
                  background: activeSharedTab === 'follow-up' ? '#ffffff' : 'transparent',
                  color: activeSharedTab === 'follow-up' ? '#2563eb' : '#475569',
                  boxShadow: activeSharedTab === 'follow-up' ? '0 1px 3px rgba(37, 99, 235, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onTabChange('follow-up')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Follow-up scheduling</span>
              </button>
            </>
          )}
        </div>

        {/* Action Controls on the Right: Back to Diagnosis & Treatment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="doc-btn"
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '6px 14px',
              borderRadius: '7px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onClick={onReturnToTreatment}
          >
            <i className="ph ph-arrow-left" style={{ fontSize: '0.88rem', color: '#64748b' }} />
            <span>Back to diagnosis</span>
          </button>
        </div>
      </nav>

      {/* Render Active Section */}
      {activeSharedTab === 'prescription' && (
        <OpdPrescriptionSection
          referenceLayout
          statusLabel={opd.prescription?.status || 'Draft'}
          canEdit={opd.canEditPrescription}
          emptyMedicationForm={emptyMedicationForm}
          handleNextStep={handleNextStepNavigation}
          handleSendToPharmacy={handleSendToPharmacy}
          masterMedicines={masterMedicines}
          medicationForm={medicationForm}
          prescriptionForm={prescriptionForm}
          saveConsultationDraft={savePrescriptionDraft}
          selectedDiagnoses={selectedDiagnoses}
          setActiveTab={(tab) => handleNextStepNavigation(tab)}
          setMedicationForm={setMedicationForm}
          setPrescriptionForm={setPrescriptionForm}
          showToast={(msg, tone) => (tone === 'error' ? toast.error(msg) : toast.success(msg))}
          updating={updating}
        />
      )}

      {activeSharedTab === 'lab-orders' && (
        <OphthalmologyLabOrdersSection
          statusLabel={opd.labOrder?.status || 'Draft'}
          availableLabTests={labTestServices}
          canEdit={opd.canEditClinicalOrders}
          handleNextStep={handleNextStepNavigation}
          handleSubmitLabOrder={handleSubmitLabOrder}
          isSubmitting={updating === 'lab-submit'}
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
          saveConsultationDraft={saveLabDraft}
          setLabCategory={setLabCategory}
          setLabClinicalNotes={setLabClinicalNotes}
          setLabFacility={setLabFacility}
          setLabOrderSummary={setLabOrderSummary}
          setLabOrders={setLabOrders}
          setLabPriority={setLabPriority}
          setLabSampleType={setLabSampleType}
          setLabSearchQuery={setLabSearchQuery}
        />
      )}

      {activeSharedTab === 'imaging-orders' && (
        <OphthalmologyImagingOrdersSection
          statusLabel={opd.imagingOrder?.status || 'Draft'}
          availableImagingTests={availableImagingTests}
          canEdit={opd.canEditClinicalOrders}
          handleNextStep={handleNextStepNavigation}
          handleSubmitImagingOrder={handleSubmitImagingOrder}
          isSubmitting={updating === 'imaging-submit'}
          handleToggleImagingTest={handleToggleImagingTest}
          imagingCategory={imagingCategory}
          imagingCategoryOptions={imagingCategoryOptions}
          imagingClinicalInfo={imagingClinicalInfo}
          imagingOrderInstructions={imagingOrderInstructions}
          imagingOrders={imagingOrders}
          imagingPriority={imagingPriority}
          imagingSearchQuery={imagingSearchQuery}
          saveConsultationDraft={saveImagingDraft}
          setImagingCategory={setImagingCategory}
          setImagingClinicalInfo={setImagingClinicalInfo}
          setImagingOrderInstructions={setImagingOrderInstructions}
          setImagingOrders={setImagingOrders}
          setImagingPriority={setImagingPriority}
          setImagingSearchQuery={setImagingSearchQuery}
        />
      )}

      {activeSharedTab === 'referral' && (
        <OpdReferralSection
          showDraftAction={false}
          canEdit={opd.canEditReferral}
          filteredReferralDoctors={filteredReferralDoctors}
          handleNextStep={handleNextStepNavigation}
          handleSubmitReferral={handleSubmitReferral}
          referralBooking={referralBooking}
          referralDoctorId={referralDoctorId}
          referralReason={referralReason}
          referralSpecialty={referralSpecialty}
          saveConsultationDraft={saveReferralDraft}
          setReferralDoctorId={setReferralDoctorId}
          setReferralReason={setReferralReason}
          setReferralSpecialty={setReferralSpecialty}
          uniqueSpecialties={uniqueSpecialties}
          priority={referralPriority}
          setPriority={setReferralPriority}
          appointmentDate={referralAppointmentDate}
          setAppointmentDate={setReferralAppointmentDate}
          additionalNotes={referralNotes}
          setAdditionalNotes={setReferralNotes}
          visit={opd.visit}
          primaryDiagnosis={feature.diagnoses?.[0] ? `${feature.diagnoses[0].display} (${feature.diagnoses[0].code})` : 'Not recorded'}
          clinicalStatus={opd.visit?.status}
          statusLabel={opd.referral?.status || 'Draft'}
          affectedEye={workspace.context?.affected_eye}
        />
      )}

      {activeSharedTab === 'follow-up' && (
        <OphthalmologyFollowUpSchedulingSection
          completionBlocked={false}
          completeConsultation={() => {
            toast.info('Final consultation review and signing is managed in Step 6 (Consultation Summary).');
            workspace.setQuery('section', 'completion');
          }}
          doctors={opd.doctors}
          followUp={opd.followUp}
          followUpDate={followUpDate}
          followUpDoctorId={followUpDoctorId}
          followUpDurationMinutes={followUpDurationMinutes}
          followUpStartTime={followUpStartTime}
          followUpReason={followUpReason}
          setFollowUpReason={setFollowUpReason}
          followUpNotes={followUpNotes}
          setFollowUpNotes={setFollowUpNotes}
          isVisitCompleted={!opd.canEditFollowUp}
          saveConsultationDraft={saveFollowUpDraft}
          scheduleFollowUp={scheduleFollowUp}
          setFollowUpDate={setFollowUpDate}
          setFollowUpDoctorId={setFollowUpDoctorId}
          setFollowUpDurationMinutes={setFollowUpDurationMinutes}
          setFollowUpStartTime={setFollowUpStartTime}
          updating={updating}
          visit={opd.visit}
        />
      )}
    </div>
  );
}
