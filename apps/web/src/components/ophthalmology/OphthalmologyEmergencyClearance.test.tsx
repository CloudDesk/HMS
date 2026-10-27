// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OphthalmologyEmergencyClearance } from './OphthalmologyEmergencyClearance';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context-value';
import type { OphthalmologyAlert } from '../../api/ophthalmology';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import type { AuthUser } from '../../auth/auth-types';

const mockRequestGet = vi.fn();
vi.mock('../../api/inpatient-admissions', () => ({
  inpatientAdmissionsApi: {
    request: (id: string, branchId: string) => mockRequestGet(id, branchId),
  },
}));

const mockNavigate = vi.fn();
vi.mock('../../routing/navigation', () => ({
  navigate: (to: string) => mockNavigate(to),
  useAppLocation: () => ({ pathname: '/opd/ophthalmology', search: '' }),
}));

describe('OphthalmologyEmergencyClearance - Inpatient Admission Handoff', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockRequestGet.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(async () => {
    if (root && container) {
      await act(async () => { root?.unmount(); });
      container.remove();
    }
  });

  const renderComponent = async (
    alert: OphthalmologyAlert,
    user: AuthUser | null = null,
  ) => {
    const feature = {
      visitId: 'visit-1',
      emergencyAlerts: [alert],
      canClearEmergency: false,
      setQuery: vi.fn(),
      clearEmergency: vi.fn(),
      clearanceQuery: { isError: false, refetch: vi.fn() },
      busy: false,
      actionError: null,
    } as unknown as OphthalmologyWorkspaceFeature;

    const authValue: AuthContextValue = {
      status: user ? 'authenticated' : 'unauthenticated',
      user,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshCurrentUser: vi.fn(),
      clearAuthError: vi.fn(),
    };

    await act(async () => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={authValue}>
            <OphthalmologyEmergencyClearance feature={feature} />
          </AuthContext.Provider>
        </QueryClientProvider>
      );
    });

    // Flush promises so React Query queryFn resolves
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });
  };

  it('renders admission request details and safe pending-bed allocation notice when alert has ADMIT_TO_INPATIENT clearance', async () => {
    mockRequestGet.mockResolvedValueOnce({
      id: 'req-123',
      request_number: 'ADM-REQ-001',
      status: 'PENDING_VALIDATION',
      priority: 'EMERGENCY',
      bed_id: null,
      ward_id: null,
    });

    const alert: OphthalmologyAlert = {
      id: 'alert-1',
      type: 'EMERGENCY_SCREENING',
      status: 'CLEARED',
      version: 2,
      visit_id: 'visit-1',
      patient_id: 'pat-1',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      reason: 'Acute angle-closure glaucoma crisis',
      triggered_by: 'doc-1',
      triggered_at: '2026-10-26T00:00:00.000Z',
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgement_note: null,
      clearance: {
        cleared_by: 'doc-1',
        cleared_at: '2026-10-26T01:00:00.000Z',
        disposition: 'ADMIT_TO_INPATIENT',
        clearance_rationale: 'Urgent admission needed for IV mannitol and monitoring',
        resumption_permitted: false,
        admission_request_id: 'req-123',
      },
    };

    const user: AuthUser = {
      id: 'user-1',
      username: 'doctor1',
      status: 'active',
      patientId: null,
      email: 'doctor@hms.local',
      fullName: 'Dr. Eye Specialist',
      roles: [{ id: 'role-1', name: 'Doctor', code: 'DOCTOR' }],
      permissions: [
        { code: 'ADM_REQ_VIEW', module: 'Admissions', screen: 'Admission Requests', action: 'View' },
        { code: 'BED_MGMT_VIEW', module: 'Admissions', screen: 'Bed Management', action: 'View' },
      ],
      branches: [],
      departments: [],
    };

    await renderComponent(alert, user);

    expect(container?.textContent).toContain('Inpatient Admission Request (Emergency Handoff)');
    expect(container?.textContent).toContain('req-123');
    expect(container?.textContent).toContain('ADM-REQ-001');
    expect(container?.textContent).toContain('PENDING_VALIDATION');
    // Safety check: Does NOT falsely claim bed is allocated
    expect(container?.textContent).toContain('Awaiting inpatient bed coordination. Bed allocation is performed separately');
    expect(container?.textContent).not.toContain('Bed Allocated:');

    // Check action buttons for authorized users
    const queueBtn = Array.from(container?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.includes('Open Inpatient Request Queue')
    );
    expect(queueBtn).toBeDefined();

    act(() => {
      queueBtn?.click();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/admissions/requests?search=ADM-REQ-001');
  });

  it('renders bed allocated notice when bed_id is present', async () => {
    mockRequestGet.mockResolvedValueOnce({
      id: 'req-123',
      request_number: 'ADM-REQ-001',
      status: 'CONFIRMED',
      priority: 'EMERGENCY',
      bed_id: 'bed-404',
      ward_id: 'ward-eye-icu',
    });

    const alert: OphthalmologyAlert = {
      id: 'alert-1',
      type: 'EMERGENCY_SCREENING',
      status: 'CLEARED',
      version: 2,
      visit_id: 'visit-1',
      patient_id: 'pat-1',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      reason: 'Acute angle-closure glaucoma crisis',
      triggered_by: 'doc-1',
      triggered_at: '2026-10-26T00:00:00.000Z',
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgement_note: null,
      clearance: {
        cleared_by: 'doc-1',
        cleared_at: '2026-10-26T01:00:00.000Z',
        disposition: 'ADMIT_TO_INPATIENT',
        clearance_rationale: 'Admitted to ICU',
        resumption_permitted: false,
        admission_request_id: 'req-123',
      },
    };

    await renderComponent(alert, null);

    expect(container?.textContent).toContain('Bed Allocated: Bed bed-404 (Ward: ward-eye-icu)');
    expect(container?.textContent).not.toContain('Awaiting inpatient bed coordination');
  });

  it('renders actionable retry error when request lookup fails', async () => {
    mockRequestGet.mockRejectedValueOnce(new Error('Network error connecting to admissions service'));

    const alert: OphthalmologyAlert = {
      id: 'alert-1',
      type: 'EMERGENCY_SCREENING',
      status: 'CLEARED',
      version: 2,
      visit_id: 'visit-1',
      patient_id: 'pat-1',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      reason: 'Chemical burn',
      triggered_by: 'doc-1',
      triggered_at: '2026-10-26T00:00:00.000Z',
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgement_note: null,
      clearance: {
        cleared_by: 'doc-1',
        cleared_at: '2026-10-26T01:00:00.000Z',
        disposition: 'ADMIT_TO_INPATIENT',
        clearance_rationale: 'Admit immediately',
        resumption_permitted: false,
        admission_request_id: 'req-456',
      },
    };

    await renderComponent(alert, null);

    expect(container?.textContent).toContain('Unable to fetch live admission request details');
    expect(container?.querySelector('button')?.textContent).toContain('Refresh Status');
  });
});
