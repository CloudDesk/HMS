import { useMemo } from 'react';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { usePatientsList } from '../patients/usePatients';
import { useDoctorsList } from '../doctors/useDoctors';
import { useAppointmentsList } from '../appointments/useAppointments';
import { useOpdVisits } from '../opd/useOpd';
import { useBillingSummary } from '../billing/useBilling';

export function useDashboardOverviewFeature() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const canView = (module: string, screen: string) => hasPermission(
    user?.permissions ?? [],
    { module, screen, action: 'View' },
  );
  const access = {
    patients: canView('Patients', 'Patient Records'),
    doctors: canView('Doctors', 'Doctor Directory'),
    appointments: canView('Appointments', 'Appointment Records'),
    opd: canView('OPD', 'OPD Visits'),
    billing: canView('Billing', 'Invoices'),
  };

  const patientsQuery = usePatientsList({ limit: 1 }, access.patients);
  const doctorsQuery = useDoctorsList({ limit: 1, status: 'ACTIVE' }, access.doctors);
  const appointmentsQuery = useAppointmentsList(
    { date_from: today, date_to: today, limit: 100 },
    access.appointments,
  );
  const visitsQuery = useOpdVisits(
    { date_from: today, date_to: today, limit: 100, sortBy: 'created_at', sortOrder: 'desc' },
    access.opd,
  );
  const billingQuery = useBillingSummary({}, access.billing);

  const isLoading = patientsQuery.isLoading || doctorsQuery.isLoading || appointmentsQuery.isLoading || visitsQuery.isLoading || billingQuery.isLoading;
  const isError = patientsQuery.isError || doctorsQuery.isError || appointmentsQuery.isError || visitsQuery.isError || billingQuery.isError;
  const isFetching = patientsQuery.isFetching || doctorsQuery.isFetching || appointmentsQuery.isFetching || visitsQuery.isFetching || billingQuery.isFetching;

  const refresh = () => {
    if (access.patients) void patientsQuery.refetch();
    if (access.doctors) void doctorsQuery.refetch();
    if (access.appointments) void appointmentsQuery.refetch();
    if (access.opd) void visitsQuery.refetch();
    if (access.billing) void billingQuery.refetch();
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
    canViewExecutive: Object.values(access).every(Boolean),
    refresh
  };
}
