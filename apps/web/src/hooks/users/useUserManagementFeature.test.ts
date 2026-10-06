import { describe, expect, it } from 'vitest';
import type { DepartmentResponse } from '../../api/departments';
import { groupDepartmentFilterOptions } from './useUserManagementFeature';

const department = (
  id: string,
  name: string,
  branchIds: string[],
): DepartmentResponse => ({
  id,
  code: id.toUpperCase(),
  name,
  description: null,
  branch_ids: branchIds,
  status: 'ACTIVE',
  isClinical: true,
  hiddenModules: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  updated_by: null,
});

describe('groupDepartmentFilterOptions', () => {
  const departments = [
    department('dept-imaging-1', 'Imaging', ['branch-1']),
    department('dept-imaging-2', ' imaging  ', ['branch-2']),
    department('dept-lab-1', 'Laboratory', ['branch-1']),
  ];

  it('shows repeated department names once and retains every matching id', () => {
    expect(groupDepartmentFilterOptions(departments, '')).toEqual([
      {
        key: 'imaging',
        name: 'Imaging',
        value: 'dept-imaging-1,dept-imaging-2',
      },
      {
        key: 'laboratory',
        name: 'Laboratory',
        value: 'dept-lab-1',
      },
    ]);
  });

  it('limits grouped options to the selected branch', () => {
    expect(groupDepartmentFilterOptions(departments, 'branch-2')).toEqual([
      {
        key: 'imaging',
        name: 'imaging',
        value: 'dept-imaging-2',
      },
    ]);
  });
});
