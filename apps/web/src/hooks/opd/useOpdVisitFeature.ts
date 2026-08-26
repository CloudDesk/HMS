import { useMemo, useState, useEffect } from 'react';
import { useAppLocation, navigate } from '../../routing/navigation';
import { useOpdWorkspace } from './useOpdWorkspace';
import { useOpdVisits } from './useOpd';
import { useDoctorAvailableSlots } from '../doctors/useDoctors';
import { useAppointmentsList } from '../appointments/useAppointments';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { toast } from 'sonner';
import type { InventoryItem } from '../../api/pharmacy-inventory';
import type { MedicineResponse } from '../../api/medicines';
import type { ServiceResponse } from '../../api/services';
import type { ConsultationForm } from '../../components/opd/OpdConsultationTab';
import type { ApiClinicalOrderPriority } from '../../api/opd';
import type { SaveBillingInvoiceItem } from '../../api/billing';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

export function useOpdVisitFeature() {
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';

  const [activeVisitId, setActiveVisitId] = useState(visitIdParam);
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabMatch = WORKSPACE_TABS.find(
      (t) =>
        t.name.toLowerCase() === initialTabParam.toLowerCase() ||
        t.id === initialTabParam ||
        t.label.toLowerCase().includes(initialTabParam.toLowerCase()),
    );
    return tabMatch ? tabMatch.name : 'Consultation';
  });

  const recentVisitsQuery = useOpdVisits({ limit: 10, sortBy: 'created_at', sortOrder: 'desc' });
  const recentVisits = recentVisitsQuery.data?.data ?? [];

  useEffect(() => {
    if (visitIdParam && visitIdParam !== activeVisitId) {
      setActiveVisitId(visitIdParam);
    }
  }, [visitIdParam]);

  useEffect(() => {
    const firstVisit = recentVisits[0];
    if (!activeVisitId && firstVisit) setActiveVisitId(firstVisit.id);
  }, [activeVisitId, recentVisits]);

  const workspace = useOpdWorkspace(activeVisitId || null);

  const masterMedicines = useMemo(() => {
    const invMapId: Record<string, { available: number; unit?: string }> = {};
    const invMapName: Record<string, { available: number; unit?: string }> = {};
    workspace.inventory.forEach((item: InventoryItem) => {
      const info = { available: item.available_quantity, unit: item.medicine?.name };
      invMapId[item.medicine_id] = info;
      if (item.medicine?.name) invMapName[item.medicine.name] = info;
    });

    return workspace.medicines.map((m: MedicineResponse) => {
      const invMatch = invMapId[m.id] || invMapName[m.name];
      return {
        id: m.id,
        name: m.name,
        generic_name: m.generic_name ?? undefined,
        strength: m.strength ?? undefined,
        dosage_form: m.dosage_form ?? undefined,
        unit: invMatch?.unit || m.unit || 'units',
        available_quantity: invMatch?.available ?? 120,
      };
    });
  }, [workspace.medicines, workspace.inventory]);

  const labTestServices = useMemo(() => workspace.services.filter((s: ServiceResponse) => s.service_type === 'LAB_TEST'), [workspace.services]);
  const imagingServices = useMemo(() => workspace.services.filter((s: ServiceResponse) => s.service_type === 'IMAGING_SERVICE'), [workspace.services]);

  type CompleteConsultationPayload = {
    consultationForm: ConsultationForm;
    prescriptionForm: { items: Array<{ medicine_name: string; strength?: string | null; dosage: string; route?: string; frequency: string; duration: string; quantity?: number | string; intake_time?: string | null; instructions?: string | null }>; follow_up_date?: string | null; doctor_instructions?: string | null; patient_instructions?: string | null };
    labOrders: Array<{ id: string; name: string; local_id: string }>;
    selectedLabTest: string;
    labPriority: ApiClinicalOrderPriority;
    imagingOrders: Array<{ id: string; name: string; local_id: string }>;
    selectedImagingTest: string;
    imagingPriority: ApiClinicalOrderPriority;
    onSuccess?: () => void;
  };

  const handleCompleteConsultation = async (payload: CompleteConsultationPayload) => {
    if (!workspace.visit) return;
    const visit = workspace.visit;
    const {
      consultationForm,
      prescriptionForm,
      labOrders,
      selectedLabTest,
      labPriority,
      imagingOrders,
      selectedImagingTest,
      imagingPriority,
      onSuccess
    } = payload;

    try {
      const consultationPayload = {
        allergies: consultationForm.allergies?.trim() || null,
        assessment: consultationForm.assessment?.trim() || null,
        chief_complaint: consultationForm.chief_complaint?.trim() || null,
        doctor_notes: consultationForm.doctor_notes?.trim() || null,
        family_history: consultationForm.family_history?.trim() || null,
        history_present_illness: consultationForm.history_present_illness?.trim() || null,
        past_history: consultationForm.past_history?.trim() || null,
        physical_examination: consultationForm.physical_examination?.trim() || null,
        treatment_plan: consultationForm.treatment_plan?.trim() || null,
      };

      if (prescriptionForm.items.length > 0) {
        await workspace.mutations.submitPrescription({
          visitId: visit.id,
          payload: {
            items: prescriptionForm.items.map((i) => ({
              medicine_name: i.medicine_name,
              strength: i.strength || null,
              dosage: i.dosage,
              route: i.route || 'ORAL',
              frequency: i.frequency,
              duration: i.duration,
              quantity: typeof i.quantity === 'number' ? i.quantity : Number(i.quantity) || 1,
              intake_time: i.intake_time || null,
              instructions: i.instructions || null,
            })),
            follow_up_date: prescriptionForm.follow_up_date || null,
            doctor_instructions: prescriptionForm.doctor_instructions || null,
            patient_instructions: prescriptionForm.patient_instructions || null,
          }
        }).catch(() => null);
      }

      const pendingLabName = selectedLabTest || '';
      const matchedPendingLab = pendingLabName ? labTestServices.find((s: ServiceResponse) => s.name === pendingLabName) : undefined;
      const allLabItems = [...labOrders.map((o: { id: string; name: string; local_id: string }) => ({
        service_id: o.id,
        investigation_name: o.name,
        category: labTestServices.find((s: ServiceResponse) => s.id === o.id)?.category || 'General Lab',
      }))];

      if (matchedPendingLab && !allLabItems.find(i => i.service_id === matchedPendingLab.id)) {
        allLabItems.push({
          service_id: matchedPendingLab.id,
          investigation_name: pendingLabName,
          category: matchedPendingLab.category || 'General Lab',
        });
      }

      if (allLabItems.length > 0) {
        await workspace.mutations.submitClinicalOrder({
          visitId: visit.id,
          type: 'LABORATORY',
          payload: {
            priority: labPriority || 'ROUTINE',
            specimen_type: 'Not Specified',
            items: allLabItems,
          }
        }).catch(() => null);
      }

      const pendingImagingName = selectedImagingTest || '';
      const matchedPendingImaging = pendingImagingName ? imagingServices.find((s: ServiceResponse) => s.name === pendingImagingName) : undefined;
      const allImagingItems = [...imagingOrders.map((o: { id: string; name: string; local_id: string }) => ({
        service_id: o.id,
        investigation_name: o.name,
        category: imagingServices.find((s: ServiceResponse) => s.id === o.id)?.category || 'Radiology',
      }))];

      if (matchedPendingImaging && !allImagingItems.find(i => i.service_id === matchedPendingImaging.id)) {
        allImagingItems.push({
          service_id: matchedPendingImaging.id,
          investigation_name: pendingImagingName,
          category: matchedPendingImaging.category || 'Radiology',
        });
      }

      if (allImagingItems.length > 0) {
        await workspace.mutations.submitClinicalOrder({
          visitId: visit.id,
          type: 'IMAGING',
          payload: {
            priority: imagingPriority || 'ROUTINE',
            items: allImagingItems,
          }
        }).catch(() => null);
      }

      const matchedConsultationService =
        workspace.services.find(
          (s: ServiceResponse) =>
            (s.category && s.category.toLowerCase().includes('consultation')) ||
            s.name.toLowerCase().includes('consultation') ||
            s.name.toLowerCase().includes((visit.doctor_specialization || '').toLowerCase()),
        ) || workspace.services[0];

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
        await workspace.mutations.createBillingInvoice({
          patient_id: visit.patient_id,
          visit_id: visit.id,
          branch_id: visit.branch_id || localStorage.getItem('activeBranchId') || '',
          items: invoiceItems,
        }).catch(() => null);
      }

      await workspace.mutations.completeConsultation({
        visitId: visit.id,
        payload: consultationPayload
      });

      await workspace.mutations.updateVisitStatus({
        id: visit.id,
        payload: { status: 'COMPLETED', notes: 'Consultation completed.' }
      });

      toast.success('Consultation completed successfully & billing invoice generated.');
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    }
  };

  const handleSaveConsultationDraft = async (consultationForm: ConsultationForm) => {
    if (!workspace.visit) return;
    try {
      await workspace.mutations.saveConsultationDraft({
        visitId: workspace.visit.id,
        payload: {
          allergies: consultationForm.allergies?.trim() || null,
          assessment: consultationForm.assessment?.trim() || null,
          chief_complaint: consultationForm.chief_complaint?.trim() || null,
          doctor_notes: consultationForm.doctor_notes?.trim() || null,
          family_history: consultationForm.family_history?.trim() || null,
          history_present_illness: consultationForm.history_present_illness?.trim() || null,
          past_history: consultationForm.past_history?.trim() || null,
          physical_examination: consultationForm.physical_examination?.trim() || null,
          treatment_plan: consultationForm.treatment_plan?.trim() || null,
        }
      });
      toast.success('Consultation draft saved.');
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
    }
  };


  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralDoctorId, setReferralDoctorId] = useState('');
  const [referralDate, setReferralDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referralTimeSlot, setReferralTimeSlot] = useState('');
  const [referralReason, setReferralReason] = useState('');

  useEffect(() => {
    if (!workspace.referral) return;
    setReferralSpecialty(workspace.referral.specialty ?? '');
    setReferralDoctorId(workspace.referral.referred_doctor_id ?? '');
    setReferralDate(workspace.referral.appointment_date ?? new Date().toISOString().slice(0, 10));
    setReferralTimeSlot(workspace.referral.appointment_start_time ?? '');
    setReferralReason(workspace.referral.reason ?? '');
  }, [workspace.referral]);

  const uniqueSpecialties = useMemo(() => {
    return Array.from(new Set(workspace.doctors.map((d) => d.specialization).filter(Boolean))).sort();
  }, [workspace.doctors]);

  const filteredReferralDoctors = useMemo(() => {
    if (!referralSpecialty) return workspace.doctors;
    return workspace.doctors.filter((d) => d.specialization === referralSpecialty);
  }, [workspace.doctors, referralSpecialty]);

  const referralSlotsQuery = useDoctorAvailableSlots(referralDoctorId, referralDate);
  const referralAppointmentsQuery = useAppointmentsList({
    doctor_id: referralDoctorId || undefined,
    date_from: referralDate,
    date_to: referralDate,
    limit: 100,
  }, Boolean(referralDoctorId && referralDate));

  const referralSlots = useMemo(() => {
    if (!referralSlotsQuery.data) return [];
    const configuredMax = 1;
    const bookedCounts: Record<string, number> = {};
    (referralAppointmentsQuery.data?.data ?? []).forEach((appointment) => {
      if (appointment.status !== 'CANCELLED') {
        bookedCounts[appointment.start_time] = (bookedCounts[appointment.start_time] ?? 0) + 1;
      }
    });
    return referralSlotsQuery.data.slots.map((slot) => {
      const remainingSlots = Math.max(0, configuredMax - (bookedCounts[slot.start_time] ?? 0));
      return {
        startTime: slot.start_time,
        endTime: slot.end_time,
        remainingSlots,
        isAvailable: remainingSlots > 0,
      };
    });
  }, [referralAppointmentsQuery.data?.data, referralSlotsQuery.data]);

  const referralSlotLoading = referralSlotsQuery.isLoading || referralAppointmentsQuery.isLoading;

  const handleBookReferralAppointment = async () => {
    if (!workspace.canEditReferral || !workspace.canBookAppointments) return;
    if (!workspace.visit || !referralDoctorId || !referralDate || !referralTimeSlot) {
      toast.error('Please select a doctor, date, and available time slot.');
      return;
    }
    const selectedDoc = workspace.doctors.find((d) => d.id === referralDoctorId);
    try {
      const reason = referralReason.trim() || `Specialist Referral - ${referralSpecialty || selectedDoc?.specialization}`;
      const clinicalSummary = [
        workspace.consultation?.assessment,
        workspace.consultation?.treatment_plan,
        workspace.consultation?.doctor_notes,
      ].filter((value): value is string => Boolean(value?.trim())).join('\n') || reason;
      
      await workspace.mutations.submitReferral({
        visitId: workspace.visit.id,
        payload: {
          referral_type: 'INTERNAL',
          specialty: referralSpecialty || selectedDoc?.specialization || null,
          priority: 'ROUTINE',
          referred_doctor_id: referralDoctorId,
          referred_doctor_name: selectedDoc?.display_name ?? null,
          reason,
          clinical_summary: clinicalSummary,
          appointment_date: referralDate,
          appointment_start_time: referralTimeSlot,
          appointment_duration_minutes: 30,
        },
      });
      toast.success(`Referral appointment booked successfully with ${selectedDoc?.display_name ?? 'Doctor'} on ${referralDate} at ${referralTimeSlot}!`);
      setReferralTimeSlot('');
    } catch (err) {
      toast.error(getOpdErrorMessage(err));
    }
  };

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    if (workspace.visit) {
      navigate(`/opd/consultation?id=${workspace.visit.id}&tab=${encodeURIComponent(tabName)}`, { replace: true });
    }
  };

  const handleVisitChange = (id: string) => {
    setActiveVisitId(id);
    navigate(`/opd/consultation?id=${id}`);
  };

  return {
    state: {
      masterMedicines,
      labTestServices,
      imagingServices,
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
      handleCompleteConsultation,
      handleSaveConsultationDraft,
      setReferralSpecialty,
      setReferralDoctorId,
      setReferralDate,
      setReferralTimeSlot,
      setReferralReason,
      handleBookReferralAppointment,
      handleTabChange,
      handleVisitChange,
    }
  };
}
