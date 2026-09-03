import { useMemo } from 'react';
import { useOpdDashboardSummary, useOpdVisits } from './useOpd';
import { hasPermission, isSuperAdministrator } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { useActiveBranch } from '../../context/BranchContext';

const todayInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function useOpdDashboard() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const can = (module: string, screen: string, action = 'View') => {
    if (!user) return false;
    return isSuperAdministrator(user.roles) ||
      hasPermission(user.permissions, { module, screen, action });
  };
  const capabilities = {
    canCheckIn: can('OPD', 'OPD Visits', 'Create'),
    canSearchPatients: can('Patients', 'Patient Records', 'View'),
    canViewQueue: can('OPD', 'OPD Visits', 'View'),
  };
  const today = todayInputValue();
  const now = new Date(`${today}T00:00:00`);
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  const weekStart = toInputDate(start);

  const { data: weekResponse, isLoading: weekLoading, error: weekError } = useOpdVisits({
    date_from: weekStart,
    date_to: today,
    branch_id: activeBranchId || undefined,
    limit: 500,
    sortBy: 'check_in_time',
    sortOrder: 'asc',
  }, capabilities.canViewQueue);
  const summaryQuery = useOpdDashboardSummary({ date_from: today, date_to: today, branch_id: activeBranchId || undefined }, capabilities.canViewQueue);

  const weekVisits = weekResponse?.data ?? [];
  const hasCompleteDataset = Boolean(
    weekResponse && weekResponse.meta.total <= weekVisits.length,
  );
  const visits = useMemo(() => weekVisits.filter(v => v.visit_date.startsWith(today)), [weekVisits, today]);
  const loading = weekLoading;
  const loadError = weekError;

  const trend = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(todayDate);
      date.setDate(todayDate.getDate() - (6 - index));
      const key = toInputDate(date);
      return {
        label: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date),
        value: weekVisits.filter((visit) => visit.visit_date.slice(0, 10) === key).length,
      };
    });
  }, [weekVisits, today]);

  const waitingVisits = useMemo(() => visits.filter((visit) => ['CHECKED_IN', 'WAITING_FOR_VITALS'].includes(visit.status)), [visits]);
  const readyVisits = useMemo(() => visits.filter((visit) => visit.status === 'READY_FOR_CONSULTATION'), [visits]);
  const inConsultationVisits = useMemo(() => visits.filter((visit) => visit.status === 'IN_CONSULTATION'), [visits]);
  const completedVisits = useMemo(() => visits.filter((visit) => visit.status === 'COMPLETED'), [visits]);
  const urgentVisits = useMemo(() => visits.filter((visit) => visit.priority !== 'ROUTINE' && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'SKIPPED'].includes(visit.status)), [visits]);

  return {
    visits,
    weekVisits,
    loading,
    loadError,
    trend,
    waitingVisits,
    readyVisits,
    inConsultationVisits,
    completedVisits,
    urgentVisits,
    hasCompleteDataset,
    capabilities,
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
    summaryError: summaryQuery.error,
    branchScope: activeBranchId || 'ALL_AUTHORIZED',
  };
}
