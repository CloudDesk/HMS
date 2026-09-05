import { describe, expect, it, vi } from 'vitest';
import { UserService } from './user.service.js';

describe('User Creation Branch Scope Validation', () => {
  it('allows SUPER_ADMIN to assign any branch', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 'user-2' }),
      replaceAssignments: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'super-admin-id') {
          return { id: 'super-admin-id', roleIds: ['role-super'] };
        }
        return { id, roleIds: ['role-1'] };
      }),
      getAssignments: vi.fn().mockResolvedValue({
        branchesByUserId: new Map([
          ['super-admin-id', [{ id: 'branch-1', name: 'Branch 1', isPrimary: true }]],
          ['user-2', [{ id: 'branch-99', name: 'Branch 99', isPrimary: true }]],
        ]),
        departmentsByUserId: new Map(),
        rolesByUserId: new Map([
          ['super-admin-id', [{ id: 'role-super', name: 'Super Admin', code: 'SUPER_ADMIN' }]],
          ['user-2', [{ id: 'role-1', name: 'Role 1', code: 'ROLE_1' }]],
        ]),
      }),
      findByUniqueFields: vi.fn().mockResolvedValue([]),
      resolveBranchScope: vi.fn().mockResolvedValue(undefined),
      summary: vi.fn(),
    } as never;

    const roleRepository = {} as never;
    const permissions = {
      assertCanAssignRoles: vi.fn().mockResolvedValue(undefined),
      assertCanManageUser: vi.fn().mockResolvedValue(undefined),
    } as never;

    const service = new UserService(repository, roleRepository, permissions);
    vi.spyOn(service as unknown as { getPasswordPolicy: () => Promise<unknown> }, 'getPasswordPolicy').mockResolvedValue({
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: false,
    });
    vi.spyOn(service as unknown as { assertUniqueFields: () => Promise<void> }, 'assertUniqueFields').mockResolvedValue(undefined);
    vi.spyOn(service as unknown as { validateReferences: () => Promise<void> }, 'validateReferences').mockResolvedValue(undefined);
    vi.spyOn(service as unknown as { audit: () => Promise<void> }, 'audit').mockResolvedValue(undefined);

    const input = {
      employeeCode: 'EMP-001',
      username: 'newuser',
      fullName: 'New User',
      password: 'password123',
      branches: [{ id: 'branch-99', isPrimary: true }],
      departments: [{ id: 'dept-1', isPrimary: true }],
      roleIds: ['role-1'],
    };

    const created = await service.create(input, 'super-admin-id', {} as never);
    expect(created).toBeDefined();
    expect(repository.create).toHaveBeenCalled();
  });

  it('rejects branch-scoped admin assigning an unauthorized branch', async () => {
    const repository = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'branch-admin-id') {
          return { id: 'branch-admin-id', roleIds: ['role-admin'] };
        }
        return { id, roleIds: [] };
      }),
      getAssignments: vi.fn().mockResolvedValue({
        branchesByUserId: new Map([
          ['branch-admin-id', [{ id: 'branch-1', name: 'Branch 1', isPrimary: true }]],
        ]),
        departmentsByUserId: new Map(),
        rolesByUserId: new Map([
          ['branch-admin-id', [{ id: 'role-admin', name: 'Branch Admin', code: 'BRANCH_ADMIN' }]],
        ]),
      }),
      findByUniqueFields: vi.fn().mockResolvedValue([]),
      resolveBranchScope: vi.fn().mockResolvedValue(['branch-1']),
    } as never;

    const roleRepository = {} as never;
    const permissions = {
      assertCanAssignRoles: vi.fn().mockResolvedValue(undefined),
      assertCanManageUser: vi.fn().mockResolvedValue(undefined),
    } as never;

    const service = new UserService(repository, roleRepository, permissions);
    vi.spyOn(service as unknown as { getPasswordPolicy: () => Promise<unknown> }, 'getPasswordPolicy').mockResolvedValue({
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: false,
    });
    vi.spyOn(service as unknown as { assertUniqueFields: () => Promise<void> }, 'assertUniqueFields').mockResolvedValue(undefined);
    vi.spyOn(service as unknown as { validateReferences: () => Promise<void> }, 'validateReferences').mockResolvedValue(undefined);

    const input = {
      employeeCode: 'EMP-002',
      username: 'unauthorizeduser',
      fullName: 'Unauthorized User',
      password: 'password123',
      branches: [{ id: 'branch-2', isPrimary: true }],
      departments: [{ id: 'dept-1', isPrimary: true }],
      roleIds: ['role-1'],
    };

    await expect(service.create(input, 'branch-admin-id', {} as never)).rejects.toMatchObject({
      code: 'BRANCH_SCOPE_VIOLATION',
      statusCode: 403,
    });
  });
});
