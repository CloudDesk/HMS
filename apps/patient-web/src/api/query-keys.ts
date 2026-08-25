export const portalQueryKeys = {
  branches: (params?: { page?: number; limit?: number; search?: string }) =>
    [
      'public-branches',
      {
        page: params?.page ?? 1,
        limit: params?.limit ?? 8,
        search: params?.search ?? '',
      },
    ] as const,

  departments: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
  }) =>
    [
      'public-departments',
      {
        page: params?.page ?? 1,
        limit: params?.limit ?? 8,
        search: params?.search ?? '',
        branchId: params?.branchId ?? '',
      },
    ] as const,

  services: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    branchId?: string;
  }) =>
    [
      'public-services',
      {
        page: params?.page ?? 1,
        limit: params?.limit ?? 8,
        search: params?.search ?? '',
        departmentId: params?.departmentId ?? '',
        branchId: params?.branchId ?? '',
      },
    ] as const,

  doctors: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    branchId?: string;
  }) =>
    [
      'public-doctors',
      {
        page: params?.page ?? 1,
        limit: params?.limit ?? 8,
        search: params?.search ?? '',
        departmentId: params?.departmentId ?? '',
        branchId: params?.branchId ?? '',
      },
    ] as const,

  doctorSlots: (doctorId: string, date: string) =>
    ['public-doctor-slots', { doctorId, date }] as const,

  context: () => ['patient-portal-context'] as const,

  overview: (patientId?: string) =>
    ['patient-portal-overview', patientId ?? 'default'] as const,

  invoice: (patientId: string, invoiceId?: string) =>
    ['patient-portal-invoice', patientId, invoiceId ?? 'none'] as const,

  appointments: (params: {
    patientId: string;
    scope: 'upcoming' | 'past';
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    [
      'patient-portal-appointments',
      params.patientId,
      {
        scope: params.scope,
        status: params.status ?? 'all',
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      },
    ] as const,

  documents: (patientId: string) =>
    ['patient-portal-documents', patientId] as const,

  rescheduleEligibility: (appointmentId: string) =>
    ['patient-portal-reschedule-eligibility', appointmentId] as const,
};
