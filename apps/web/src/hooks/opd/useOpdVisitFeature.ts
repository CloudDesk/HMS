import { useMemo, useState, useEffect } from 'react';
import { useAppLocation, navigate } from '../../routing/navigation';
import { useOpdWorkspace } from './useOpdWorkspace';
import { useOpdVisits } from './useOpd';
import { useDoctorAvailableSlots } from '../doctors/useDoctors';
import { useAppointmentsList } from '../appointments/useAppointments';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { toast } from 'sonner';

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
  };
}
