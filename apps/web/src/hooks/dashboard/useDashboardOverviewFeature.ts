import { useMemo } from 'react';
import { usePatientsList } from '../patients/usePatients';
import { useDoctorsList } from '../doctors/useDoctors';
import { useAppointmentsList } from '../appointments/useAppointments';
import { useOpdVisits } from '../opd/useOpd';
import { useBillingSummary } from '../billing/useBilling';

export function useDashboardOverviewFeature() {
  const today = new Date().toISOString().slice(0, 10);
  
  const patientsQuery = usePatientsList({ limit: 1 });
  const doctorsQuery = useDoctorsList({ limit: 1, status: 'ACTIVE' });
  const appointmentsQuery = useAppointmentsList({ date_from: today, date_to: today, limit: 100 });
  const visitsQuery = useOpdVisits({ date_from: today, date_to: today, limit: 100, sortBy: 'created_at', sortOrder: 'desc' });
  const billingQuery = useBillingSummary({});

  const isLoading = patientsQuery.isLoading || doctorsQuery.isLoading || appointmentsQuery.isLoading || visitsQuery.isLoading || billingQuery.isLoading;
  const isError = patientsQuery.isError || doctorsQuery.isError || appointmentsQuery.isError || visitsQuery.isError || billingQuery.isError;
  const isFetching = patientsQuery.isFetching || doctorsQuery.isFetching || appointmentsQuery.isFetching || visitsQuery.isFetching || billingQuery.isFetching;

  const refresh = () => {
    void patientsQuery.refetch();
    void doctorsQuery.refetch();
    void appointmentsQuery.refetch();
    void visitsQuery.refetch();
    void billingQuery.refetch();
  };

  const data = useMemo(() => {
    const visitData = visitsQuery.data?.data || [];
    
    const trendPoints: Array<{ day: string; visits: number; revenue: number }> = [];

    return {
      activeDoctors: doctorsQuery.data?.meta.total ?? 0,
      appointmentsToday: appointmentsQuery.data?.meta.total ?? 0,
      completedVisits: visitData.filter((v) => v.status === 'COMPLETED').length,
      opdVisitsToday: visitData.length,
      registeredPatients: patientsQuery.data?.meta.total ?? 0,
      billedTotal: billingQuery.isLoading || billingQuery.isFetching ? null : (billingQuery.data?.billed_amount ?? 0),
      collectedTotal: billingQuery.isLoading || billingQuery.isFetching ? null : (billingQuery.data?.collected_amount ?? 0),
      recentVisits: visitData.slice(0, 6),
      trend: trendPoints,
    };
  }, [
    patientsQuery.data,
    doctorsQuery.data,
    appointmentsQuery.data,
    visitsQuery.data,
    billingQuery.data
  ]);

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refresh
  };
}
