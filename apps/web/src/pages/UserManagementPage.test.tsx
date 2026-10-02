// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserManagementPage } from './UserManagementPage';

const testState = vi.hoisted(() => ({ feature: vi.fn() }));

vi.mock('../hooks/users/useUserManagementFeature', () => ({
  useUserManagementFeature: () => testState.feature(),
  getErrorMessage: (err: unknown) => String(err),
}));

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ search: '' }),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'admin', roles: [{ code: 'SUPER_ADMIN', name: 'Super Admin' }] },
  }),
}));

const mockUsers = [
  {
    apiId: 'usr-1',
    fullName: 'Rahul Sharma',
    username: 'rahulsharma@gmail.com',
    email: 'rahulsharma@gmail.com',
    phone: '+254700000001',
    role: 'Patient',
    roleId: 'role-patient',
    department: 'Unassigned',
    departmentId: '',
    branch: 'Unassigned',
    branchId: '',
    status: 'Active' as const,
    lastLogin: '02 Oct 2026, 10:30',
    password: 'Protected',
    addedThisMonth: true,
    source: {
      id: 'usr-1',
      employeeCode: 'EMP-000001',
      fullName: 'Rahul Sharma',
      username: 'rahulsharma@gmail.com',
      email: 'rahulsharma@gmail.com',
      phone: '+254700000001',
      jobTitle: 'Patient',
      roles: [{ id: 'role-patient', name: 'Patient' }],
      branches: [],
      departments: [],
      status: 'active' as const,
      createdAt: '2026-10-01T00:00:00Z',
      lastLoginAt: '2026-10-02T10:30:00Z',
    },
  },
  {
    apiId: 'usr-2',
    fullName: 'Parent Guardian4453593607',
    username: 'guard_4453593607@example.com',
    email: 'guard_4453593607@example.com',
    phone: '',
    role: 'Parent / Guardian',
    roleId: 'role-parent',
    department: 'Pediatrics',
    departmentId: 'dept-pediatrics',
    branch: 'Main Branch',
    branchId: 'branch-1',
    status: 'Active' as const,
    lastLogin: 'Never',
    password: 'Protected',
    addedThisMonth: true,
    source: {
      id: 'usr-2',
      employeeCode: 'EMP-000002',
      fullName: 'Parent Guardian4453593607',
      username: 'guard_4453593607@example.com',
      email: 'guard_4453593607@example.com',
      phone: null,
      jobTitle: 'Parent / Guardian',
      roles: [{ id: 'role-parent', name: 'Parent / Guardian' }],
      branches: [{ id: 'branch-1', name: 'Main Branch', isPrimary: true }],
      departments: [{ id: 'dept-pediatrics', name: 'Pediatrics', isPrimary: true }],
      status: 'active' as const,
      createdAt: '2026-10-01T00:00:00Z',
      lastLoginAt: null,
    },
  },
];

describe('UserManagementPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    testState.feature.mockReturnValue({
      state: {
        query: '',
        setQuery: vi.fn(),
        roleFilter: '',
        setRoleFilter: vi.fn(),
        departmentFilter: '',
        setDepartmentFilter: vi.fn(),
        branchFilter: '',
        setBranchFilter: vi.fn(),
        statusFilter: '',
        setStatusFilter: vi.fn(),
        sortColumn: 'fullName',
        sortDirection: 'asc',
        currentPage: 1,
        setCurrentPage: vi.fn(),
        pageSize: 10,
        setPageSize: vi.fn(),
      },
      data: {
        users: mockUsers,
        meta: { limit: 10, page: 1, total: 2, totalPages: 1 },
        summary: { total: 58, active: 56, inactive: 1, locked: 1, addedThisMonth: 0 },
        roleOptions: [
          { id: 'role-patient', name: 'Patient', status: 'active' },
          { id: 'role-parent', name: 'Parent / Guardian', status: 'active' },
        ],
        branchOptions: [{ id: 'branch-1', name: 'Main Branch' }],
        departmentOptions: [{ id: 'dept-pediatrics', name: 'Pediatrics', branch_ids: ['branch-1'] }],
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSymbol: false,
        },
      },
      status: {
        isFetching: false,
        loadError: '',
        forbidden: false,
        isMutating: false,
      },
      rbac: {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
        canChangePassword: true,
        canResetPassword: true,
      },
      actions: {
        handleSort: vi.fn(),
        resetFilters: vi.fn(),
        locationSearch: '',
      },
      mutations: {
        createUser: { mutateAsync: vi.fn(), isPending: false },
        updateUser: { mutateAsync: vi.fn(), isPending: false },
        updateStatus: { mutateAsync: vi.fn(), isPending: false },
        resetPassword: { mutateAsync: vi.fn(), isPending: false },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all 8 table columns with colgroup percentages summing to 100%', async () => {
    await act(async () => {
      root.render(<UserManagementPage />);
    });

    const colElements = container.querySelectorAll('.um-table col');
    expect(colElements.length).toBe(8);

    const widths = Array.from(colElements).map((col) => (col as HTMLElement).style.width);
    expect(widths).toEqual(['4%', '20%', '25%', '12%', '13%', '11%', '8%', '7%']);

    const totalPercentage = widths.reduce((sum, w) => sum + parseFloat(w), 0);
    expect(totalPercentage).toBe(100);
  });

  it('renders sortable headers with sort indicators', async () => {
    await act(async () => {
      root.render(<UserManagementPage />);
    });

    const headers = container.querySelectorAll('.um-table th');
    expect(headers.length).toBe(8);

    const headerTexts = Array.from(headers).map((h) => h.textContent?.trim() || '');
    expect(headerTexts[1]).toContain('Name');
    expect(headerTexts[2]).toContain('Username');
    expect(headerTexts[3]).toContain('Role');
    expect(headerTexts[4]).toContain('Department');
    expect(headerTexts[5]).toContain('Branch');
    expect(headerTexts[6]).toContain('Status');
    expect(headerTexts[7]).toContain('Actions');

    // Name should be active sorted
    const nameHeader = headers[1] as HTMLElement;
    expect(nameHeader.className).toContain('active-sort');
  });

  it('renders user rows with avatar initials and properly aligned data', async () => {
    await act(async () => {
      root.render(<UserManagementPage />);
    });

    const rows = container.querySelectorAll('.um-table tbody tr');
    expect(rows.length).toBe(2);

    expect(container.textContent).toContain('Rahul Sharma');
    expect(container.textContent).toContain('rahulsharma@gmail.com');
    expect(container.textContent).toContain('Parent Guardian4453593607');
    expect(container.textContent).toContain('guard_4453593607@example.com');

    const avatars = container.querySelectorAll('.table-avatar-initials');
    expect(avatars.length).toBe(2);
    expect(avatars[0]?.textContent).toBe('RS');
    expect(avatars[1]?.textContent).toBe('PG');
  });

  it('renders action buttons for edit, status toggle, and delete', async () => {
    await act(async () => {
      root.render(<UserManagementPage />);
    });

    const actionButtons = container.querySelectorAll('.action-icon-btn');
    expect(actionButtons.length).toBeGreaterThanOrEqual(6); // 3 per row * 2 rows
  });
});
