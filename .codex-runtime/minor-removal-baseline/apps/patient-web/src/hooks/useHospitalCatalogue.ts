import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { patientPortalApi, type PublicDoctor } from '../api/patient-portal';
import { portalQueryKeys } from '../api/query-keys';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from '../routing/navigation';
import { buildPortalBookingUrl } from '../routing/routes';

const publicQueryConfig = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
  refetchOnMount: false,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false,
};

export type HeaderMenu = 'departments' | 'services' | 'doctors' | null;

export function useHospitalCatalogue() {
  const { status, user } = useAuth();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const branchId = params.get('branch_id') ?? '';
  const departmentId = params.get('department_id') ?? '';
  const departmentQuery = params.get('department_q') ?? '';
  const serviceQuery = params.get('service_q') ?? '';
  const requestedDepartmentPage = Number(params.get('department_page') ?? '1');
  const departmentPage =
    Number.isInteger(requestedDepartmentPage) && requestedDepartmentPage > 0
      ? requestedDepartmentPage
      : 1;
  const requestedServicePage = Number(params.get('service_page') ?? '1');
  const servicePage =
    Number.isInteger(requestedServicePage) && requestedServicePage > 0
      ? requestedServicePage
      : 1;
  const requestedDoctorPage = Number(params.get('doctor_page') ?? '1');
  const doctorPage =
    Number.isInteger(requestedDoctorPage) && requestedDoctorPage > 0
      ? requestedDoctorPage
      : 1;

  const [departmentSearch, setDepartmentSearch] = useState(departmentQuery);
  const [serviceSearch, setServiceSearch] = useState(serviceQuery);
  const [doctorSearch, setDoctorSearch] = useState(params.get('q') ?? '');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [openHeaderMenu, setOpenHeaderMenu] = useState<HeaderMenu>(null);
  const querySearch = params.get('q') ?? '';

  const branches = useQuery({
    queryKey: portalQueryKeys.branches({ limit: 24 }),
    queryFn: () => patientPortalApi.publicBranches({ limit: 24 }),
    ...publicQueryConfig,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setGlobalQuery(globalSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [globalSearch]);

  const allDepartments = useQuery({
    queryKey: portalQueryKeys.departments({
      limit: 100,
      branchId: branchId || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDepartments({
        limit: 100,
        branchId: branchId || undefined,
      }),
    ...publicQueryConfig,
  });

  const departments = useQuery({
    queryKey: portalQueryKeys.departments({
      limit: 8,
      page: departmentPage,
      branchId: branchId || undefined,
      search: departmentQuery || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDepartments({
        limit: 8,
        page: departmentPage,
        branchId: branchId || undefined,
        search: departmentQuery || undefined,
      }),
    ...publicQueryConfig,
  });

  const services = useQuery({
    queryKey: portalQueryKeys.services({
      limit: 8,
      page: servicePage,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      search: serviceQuery || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicServices({
        limit: 8,
        page: servicePage,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        search: serviceQuery || undefined,
      }),
    ...publicQueryConfig,
  });

  const doctors = useQuery({
    queryKey: portalQueryKeys.doctors({
      limit: 6,
      page: doctorPage,
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      search: querySearch || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDoctors({
        limit: 6,
        page: doctorPage,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        search: querySearch || undefined,
      }),
    ...publicQueryConfig,
  });

  const headerServices = useQuery({
    queryKey: portalQueryKeys.services({
      limit: 12,
      branchId: branchId || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicServices({
        limit: 12,
        branchId: branchId || undefined,
      }),
    enabled: openHeaderMenu === 'services',
    ...publicQueryConfig,
  });

  const headerDoctors = useQuery({
    queryKey: portalQueryKeys.doctors({
      limit: 12,
      branchId: branchId || undefined,
    }),
    queryFn: () =>
      patientPortalApi.publicDoctors({
        limit: 12,
        branchId: branchId || undefined,
      }),
    enabled: openHeaderMenu === 'doctors',
    ...publicQueryConfig,
  });

  const globalDepartments = useQuery({
    queryKey: portalQueryKeys.departments({
      limit: 5,
      branchId: branchId || undefined,
      search: globalQuery,
    }),
    queryFn: () =>
      patientPortalApi.publicDepartments({
        limit: 5,
        branchId: branchId || undefined,
        search: globalQuery,
      }),
    enabled: globalQuery.length >= 2,
    ...publicQueryConfig,
  });

  const globalServices = useQuery({
    queryKey: portalQueryKeys.services({
      limit: 5,
      branchId: branchId || undefined,
      search: globalQuery,
    }),
    queryFn: () =>
      patientPortalApi.publicServices({
        limit: 5,
        branchId: branchId || undefined,
        search: globalQuery,
      }),
    enabled: globalQuery.length >= 2,
    ...publicQueryConfig,
  });

  const globalDoctors = useQuery({
    queryKey: portalQueryKeys.doctors({
      limit: 5,
      branchId: branchId || undefined,
      search: globalQuery,
    }),
    queryFn: () =>
      patientPortalApi.publicDoctors({
        limit: 5,
        branchId: branchId || undefined,
        search: globalQuery,
      }),
    enabled: globalQuery.length >= 2,
    ...publicQueryConfig,
  });

  const portalContext = useQuery({
    queryKey: portalQueryKeys.context(),
    queryFn: () => patientPortalApi.context(),
    enabled: status === 'authenticated',
    retry: false,
  });

  const linkedPatientName = portalContext.data?.patients[0]?.full_name;
  const isPatientAccount = user?.roles.some((role) => role.code === 'PATIENT');
  const signedInLabel =
    linkedPatientName ?? (isPatientAccount ? user?.fullName : null) ?? 'Patient portal';
  const globalResultCount =
    (globalDepartments.data?.data.length ?? 0) +
    (globalServices.data?.data.length ?? 0) +
    (globalDoctors.data?.data.length ?? 0);
  const globalSearchLoading =
    globalDepartments.isFetching || globalServices.isFetching || globalDoctors.isFetching;

  const headerDepartmentItems = useMemo(() => {
    return allDepartments.data?.data?.slice(0, 12) ?? departments.data?.data?.slice(0, 12) ?? [];
  }, [allDepartments.data, departments.data]);

  const headerDepartmentCount =
    allDepartments.data?.meta?.total ??
    allDepartments.data?.data?.length ??
    departments.data?.meta?.total ??
    0;

  const departmentOptions = useMemo(() => {
    const raw = allDepartments.data?.data?.length
      ? allDepartments.data.data
      : departments.data?.data ?? [];
    const seen = new Set<string>();
    return raw.filter((dept) => {
      const nameKey = dept.name.trim().toLowerCase();
      if (seen.has(nameKey)) return false;
      seen.add(nameKey);
      return true;
    });
  }, [allDepartments.data, departments.data]);

  const setCatalogueQuery = (updates: Record<string, string | null>, section: string) => {
    const next = new URLSearchParams(search);
    Object.entries(updates).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    navigate(`/?${next.toString()}`);
    window.setTimeout(
      () =>
        document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  };

  const goHome = () => {
    setDepartmentSearch('');
    setServiceSearch('');
    setDoctorSearch('');
    setGlobalSearch('');
    setGlobalQuery('');
    setGlobalSearchOpen(false);
    setOpenHeaderMenu(null);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitDepartmentSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery(
      { department_q: departmentSearch.trim() || null, department_page: null },
      'departments',
    );
  };

  const submitServiceSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery(
      { service_q: serviceSearch.trim() || null, service_page: null },
      'services',
    );
  };

  const submitDoctorSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery({ q: doctorSearch.trim() || null, doctor_page: null }, 'doctors');
  };

  const bookDoctor = (doctor: PublicDoctor) => {
    const bookingUrl = buildPortalBookingUrl({
      doctorId: doctor.id,
      branchId: doctor.branch?.id,
      departmentId: doctor.department?.id,
    });
    if (status === 'authenticated') {
      navigate(bookingUrl);
    } else {
      navigate(`/login?return=${encodeURIComponent(bookingUrl)}`);
    }
  };

  const closeGlobalSearch = () => {
    setGlobalSearchOpen(false);
  };

  return {
    status,
    user,
    branchId,
    departmentId,
    departmentQuery,
    serviceQuery,
    querySearch,
    departmentPage,
    servicePage,
    doctorPage,
    departmentSearch,
    setDepartmentSearch,
    serviceSearch,
    setServiceSearch,
    doctorSearch,
    setDoctorSearch,
    globalSearch,
    setGlobalSearch,
    globalQuery,
    setGlobalQuery,
    globalSearchOpen,
    setGlobalSearchOpen,
    openHeaderMenu,
    setOpenHeaderMenu,
    branches,
    allDepartments,
    departments,
    services,
    doctors,
    headerServices,
    headerDoctors,
    globalDepartments,
    globalServices,
    globalDoctors,
    portalContext,
    signedInLabel,
    globalResultCount,
    globalSearchLoading,
    headerDepartmentItems,
    headerDepartmentCount,
    departmentOptions,
    setCatalogueQuery,
    goHome,
    submitDepartmentSearch,
    submitServiceSearch,
    submitDoctorSearch,
    bookDoctor,
    closeGlobalSearch,
  };
}
