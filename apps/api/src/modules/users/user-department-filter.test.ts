import { describe, expect, it } from 'vitest';
import { buildDepartmentAssignmentFilter } from './user.repository.js';

describe('buildDepartmentAssignmentFilter', () => {
  it('uses the original exact-id filter for one department', () => {
    expect(buildDepartmentAssignmentFilter('dept-1')).toBe('dept-1');
  });

  it('matches any id represented by a grouped department option', () => {
    expect(buildDepartmentAssignmentFilter('dept-1, dept-2,dept-1')).toEqual({
      $in: ['dept-1', 'dept-2'],
    });
  });
});
