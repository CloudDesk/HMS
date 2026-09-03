import { describe, expect, test } from 'vitest';
import type { DepartmentResponse } from '../../api/departments';

export function filterClinicalDepartments(departments: Partial<DepartmentResponse>[]) {
  return departments.filter((dept) => dept.isClinical === true);
}

describe('Clinical Department Filtering', () => {
  const sampleDepartments: Partial<DepartmentResponse>[] = [
    { id: '1', name: 'Cardiology', isClinical: true },
    { id: '2', name: 'Dental', isClinical: true },
    { id: '3', name: 'Billing / Finance', isClinical: false },
    { id: '4', name: 'Pharmacy', isClinical: false },
    { id: '5', name: 'Imaging', isClinical: false },
    { id: '6', name: 'Laboratory', isClinical: false },
    { id: '7', name: 'Nursing', isClinical: false },
    { id: '8', name: 'Reception', isClinical: false },
    { id: '9', name: 'Administration', isClinical: false },
    { id: '10', name: 'Unknown Dept', isClinical: undefined },
    { id: '11', name: 'Null Dept', isClinical: null as unknown as boolean },
  ];

  test('includes departments where isClinical is explicitly true', () => {
    const result = filterClinicalDepartments(sampleDepartments);
    expect(result.map((d) => d.name)).toEqual(['Cardiology', 'Dental']);
  });

  test('excludes departments where isClinical is false', () => {
    const result = filterClinicalDepartments(sampleDepartments);
    const names = result.map((d) => d.name);
    expect(names).not.toContain('Billing / Finance');
    expect(names).not.toContain('Pharmacy');
    expect(names).not.toContain('Imaging');
    expect(names).not.toContain('Laboratory');
    expect(names).not.toContain('Nursing');
    expect(names).not.toContain('Reception');
    expect(names).not.toContain('Administration');
  });

  test('excludes departments where isClinical is missing, undefined, or null', () => {
    const result = filterClinicalDepartments(sampleDepartments);
    const names = result.map((d) => d.name);
    expect(names).not.toContain('Unknown Dept');
    expect(names).not.toContain('Null Dept');
  });

  test('preserves real department IDs for backend selection', () => {
    const result = filterClinicalDepartments(sampleDepartments);
    expect(result[0]?.id).toBe('1');
    expect(result[1]?.id).toBe('2');
  });
});
