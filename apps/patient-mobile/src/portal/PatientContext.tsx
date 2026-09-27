import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { friendlyError } from '../api/errors';
import { useAuth } from '../ui/AuthContext';
import type {
  PortalContext,
  PortalOverview,
  PortalPatient,
} from './contracts';
import { PortalApi } from './portal-api';

interface PatientContextValue {
  context: PortalContext | null;
  selectedPatientId: string | null;
  selectedPatient: PortalPatient | null;
  overview: PortalOverview | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchPatient: (patientId: string) => Promise<void>;
  portalApi: PortalApi;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { state: authState, manager } = useAuth();
  const portalApi = useMemo(() => new PortalApi(manager), [manager]);

  const [context, setContext] = useState<PortalContext | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(
    async (patientId: string) => {
      try {
        const data = await portalApi.getOverview(patientId);
        setOverview(data);
        setError(null);
      } catch (err) {
        setError(friendlyError(err));
      }
    },
    [portalApi]
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (authState.status !== 'authenticated') return;

      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      setError(null);

      try {
        const ctx = await portalApi.getContext();
        setContext(ctx);

        if (ctx.patients.length > 0) {
          // Determine initial selected patient: keep current if valid, else primary, else first
          let targetId = selectedPatientId;
          const currentValid = ctx.patients.some((p) => p.id === targetId);
          if (!currentValid || !targetId) {
            const primary = ctx.patients.find((p) => p.is_primary) ?? ctx.patients[0];
            targetId = primary?.id ?? null;
            setSelectedPatientId(targetId);
          }

          if (targetId) {
            const data = await portalApi.getOverview(targetId);
            setOverview(data);
          }
        } else {
          setOverview(null);
        }
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [authState.status, portalApi, selectedPatientId]
  );

  useEffect(() => {
    if (authState.status === 'authenticated') {
      void loadData(false);
    } else {
      setContext(null);
      setSelectedPatientId(null);
      setOverview(null);
      setError(null);
      setIsLoading(true);
    }
  }, [authState.status]);

  const switchPatient = useCallback(
    async (patientId: string) => {
      if (!context) return;
      const target = context.patients.find((p) => p.id === patientId);
      if (!target) {
        setError('Unauthorized patient selection.');
        return;
      }

      setSelectedPatientId(patientId);
      setIsLoading(true);
      setError(null);
      try {
        await fetchOverview(patientId);
      } finally {
        setIsLoading(false);
      }
    },
    [context, fetchOverview]
  );

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const selectedPatient = useMemo(() => {
    if (!context || !selectedPatientId) return null;
    return context.patients.find((p) => p.id === selectedPatientId) ?? null;
  }, [context, selectedPatientId]);

  const value: PatientContextValue = {
    context,
    selectedPatientId,
    selectedPatient,
    overview,
    isLoading,
    isRefreshing,
    error,
    refresh,
    switchPatient,
    portalApi,
  };

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return ctx;
}
