import { useAppLocation } from '../../routing/navigation';
import { getPatientIdFromSearch } from '../../pages/patient-utils';
import { usePatientsList, usePatientDetails, usePatientTimeline } from './usePatients';
import { useDoctorsList } from '../doctors/useDoctors';
import { useDepartmentsList } from '../departments/useDepartments';
import type { PatientTimelineEventType } from '../../api/patients';

export type EmrTimelineFilters = {
  eventType: PatientTimelineEventType | '';
  fromDate: string;
  toDate: string;
  page: number;
};

export function usePatientEmrTimelineFeature(filters: EmrTimelineFilters) {
  const { search } = useAppLocation();
  const searchPatientId = getPatientIdFromSearch(search);

  const patientsQuery = usePatientsList({ limit: 50 });
  const patientList = patientsQuery.data?.data || [];

  const targetId = searchPatientId || (patientList.length > 0 ? patientList[0]?.id : null) || null;

  const detailsQuery = usePatientDetails(targetId, Boolean(targetId));
  const timelineQuery = usePatientTimeline(
    targetId,
    {
      event_type: filters.eventType || undefined,
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      page: filters.page,
      limit: 10,
    },
    Boolean(targetId)
  );

  const doctorsQuery = useDoctorsList({ limit: 100, status: 'ACTIVE' });
  const departmentsQuery = useDepartmentsList({ limit: 100, status: 'ACTIVE' });

  const loading =
    patientsQuery.isLoading ||
    detailsQuery.isLoading ||
    timelineQuery.isLoading ||
    doctorsQuery.isLoading ||
    departmentsQuery.isLoading;

  const loadError =
    patientsQuery.error?.message ||
    detailsQuery.error?.message ||
    timelineQuery.error?.message ||
    '';

  const refresh = () => {
    void patientsQuery.refetch();
    if (targetId) {
      void detailsQuery.refetch();
      void timelineQuery.refetch();
    }
  };

  return {
    patientId: targetId,
    patient: detailsQuery.data || null,
    patientList,
    timeline: timelineQuery.data?.data || [],
    meta: timelineQuery.data?.meta || { limit: 10, page: 1, total: 0, totalPages: 1 },
    doctors: doctorsQuery.data?.data || [],
    departments: departmentsQuery.data?.data || [],
    loading,
    loadError,
    refresh,
  };
}


