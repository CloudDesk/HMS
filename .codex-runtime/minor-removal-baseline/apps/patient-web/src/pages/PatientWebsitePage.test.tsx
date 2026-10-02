import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { patientPortalApi } from '../api/patient-portal';
import { AuthProvider } from '../auth/AuthContext';
import { PatientWebsitePage } from './PatientWebsitePage';

const mockBranches = {
  data: [
    {
      id: 'branch-1',
      code: 'MAIN',
      name: 'Main Hospital',
      short_name: 'Main',
      email: 'info@hospital.test',
      phone: '+254700000000',
      address: '123 Hospital Way',
      city: 'Nairobi',
      state: null,
      country: 'KE',
      postal_code: '00100',
    },
  ],
  meta: { page: 1, limit: 24, total: 1, totalPages: 1 },
};

const mockDepartments = {
  data: [
    {
      id: 'dept-1',
      code: 'CARD',
      name: 'Cardiology',
      description: 'Comprehensive cardiovascular care.',
      branch: { id: 'branch-1', name: 'Main Hospital', city: 'Nairobi' },
    },
    {
      id: 'dept-2',
      code: 'NEUR',
      name: 'Neurology',
      description: 'Expert neurological treatments.',
      branch: { id: 'branch-1', name: 'Main Hospital', city: 'Nairobi' },
    },
  ],
  meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
};

const mockServices = {
  data: [
    {
      id: 'srv-1',
      code: 'ECG-01',
      name: 'Electrocardiogram',
      service_type: 'LAB_TEST' as const,
      category: 'Diagnostics',
      description: 'Heart rhythm evaluation',
      standard_price: 3500,
      department: { id: 'dept-1', name: 'Cardiology' },
      branch: { id: 'branch-1', name: 'Main Hospital', city: 'Nairobi' },
    },
    {
      id: 'srv-2',
      code: 'MRI-01',
      name: 'Brain MRI Scan',
      service_type: 'IMAGING_SERVICE' as const,
      category: 'Radiology',
      description: 'High-resolution imaging',
      standard_price: 18000,
      department: { id: 'dept-2', name: 'Neurology' },
      branch: { id: 'branch-1', name: 'Main Hospital', city: 'Nairobi' },
    },
  ],
  meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
};

const mockDoctors = {
  data: [
    {
      id: 'doc-1',
      display_name: 'Dr. Sarah Connor',
      specialization: 'Cardiologist',
      qualification: 'MBChB, MMed Cardiology',
      experience_years: 12,
      branch: { id: 'branch-1', name: 'Main Hospital', city: 'Nairobi' },
      department: { id: 'dept-1', name: 'Cardiology' },
      consultation_room: 'Suite 204',
      available_days: ['Monday', 'Wednesday', 'Friday'],
    },
  ],
  meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

describe('M-008: PatientWebsitePage catalogue query deduplication', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(patientPortalApi, 'publicBranches').mockImplementation(async () => mockBranches);
    vi.spyOn(patientPortalApi, 'publicDepartments').mockImplementation(async () => mockDepartments);
    vi.spyOn(patientPortalApi, 'publicServices').mockImplementation(async () => mockServices);
    vi.spyOn(patientPortalApi, 'publicDoctors').mockImplementation(async () => mockDoctors);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('fetches departments, services, and doctors exactly once each on initial homepage load', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PatientWebsitePage />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patientPortalApi.publicDepartments).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicDepartments).toHaveBeenCalledWith({
      limit: 100,
      branchId: undefined,
    });

    expect(patientPortalApi.publicServices).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicServices).toHaveBeenCalledWith({
      limit: 100,
      branchId: undefined,
    });

    expect(patientPortalApi.publicDoctors).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicDoctors).toHaveBeenCalledWith({
      limit: 100,
      branchId: undefined,
    });

    expect(patientPortalApi.publicBranches).toHaveBeenCalledTimes(1);
  });

  it('shares cached catalogue data across page, header, and selectors without extra requests', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PatientWebsitePage />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await new Promise((r) => setTimeout(r, 300));
    });

    const text = container.textContent ?? '';

    expect(text).toBeDefined();

    // Confirm no secondary queries were dispatched for header or selector variants
    expect(patientPortalApi.publicDepartments).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicServices).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicDoctors).toHaveBeenCalledTimes(1);
  });

  it('dispatches a targeted search request only when department search is explicitly active', async () => {
    window.history.pushState({}, '', '/?department_q=Cardio');

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PatientWebsitePage />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    // 1 call for base catalogue + 1 call for targeted department search
    expect(patientPortalApi.publicDepartments).toHaveBeenCalledTimes(2);
    expect(patientPortalApi.publicDepartments).toHaveBeenLastCalledWith({
      limit: 8,
      page: 1,
      branchId: undefined,
      search: 'Cardio',
    });

    // Services and doctors remain on single shared catalogue query
    expect(patientPortalApi.publicServices).toHaveBeenCalledTimes(1);
    expect(patientPortalApi.publicDoctors).toHaveBeenCalledTimes(1);

    window.history.pushState({}, '', '/');
  });

  it('dispatches a targeted filtered request only when department_id filter is active for services/doctors', async () => {
    window.history.pushState({}, '', '/?department_id=dept-1');

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PatientWebsitePage />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    // Departments remain on single catalogue query
    expect(patientPortalApi.publicDepartments).toHaveBeenCalledTimes(1);

    // Services and Doctors execute their filtered query
    expect(patientPortalApi.publicServices).toHaveBeenCalledTimes(2);
    expect(patientPortalApi.publicServices).toHaveBeenLastCalledWith({
      limit: 8,
      page: 1,
      branchId: undefined,
      departmentId: 'dept-1',
      search: undefined,
    });

    expect(patientPortalApi.publicDoctors).toHaveBeenCalledTimes(2);
    expect(patientPortalApi.publicDoctors).toHaveBeenLastCalledWith({
      limit: 6,
      page: 1,
      branchId: undefined,
      departmentId: 'dept-1',
      search: undefined,
    });

    window.history.pushState({}, '', '/');
  });
});


