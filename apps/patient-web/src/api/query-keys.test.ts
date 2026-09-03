import { describe, it, expect } from 'vitest';
import { portalQueryKeys } from './query-keys';

describe('portalQueryKeys Factory', () => {
  it('generates distinct query keys for different branches parameters', () => {
    const defaultKey = portalQueryKeys.branches();
    const dropdownKey = portalQueryKeys.branches({ limit: 24 });
    const signupKey = portalQueryKeys.branches({ limit: 100 });
    const searchKey = portalQueryKeys.branches({ search: 'Metro' });

    expect(defaultKey).not.toEqual(dropdownKey);
    expect(dropdownKey).not.toEqual(signupKey);
    expect(signupKey).not.toEqual(searchKey);

    expect(dropdownKey).toEqual([
      'public-branches',
      { page: 1, limit: 24, search: '' },
    ]);
    expect(signupKey).toEqual([
      'public-branches',
      { page: 1, limit: 100, search: '' },
    ]);
  });

  it('generates parameterized query keys for departments, services, and doctors', () => {
    const deptKey = portalQueryKeys.departments({ branchId: 'b-1', limit: 8 });
    expect(deptKey).toEqual([
      'public-departments',
      { page: 1, limit: 8, search: '', branchId: 'b-1' },
    ]);

    const serviceKey = portalQueryKeys.services({
      branchId: 'b-1',
      departmentId: 'd-1',
      search: 'cardio',
    });
    expect(serviceKey).toEqual([
      'public-services',
      {
        page: 1,
        limit: 8,
        search: 'cardio',
        departmentId: 'd-1',
        branchId: 'b-1',
      },
    ]);

    const doctorKey = portalQueryKeys.doctors({
      branchId: 'b-1',
      departmentId: 'd-1',
      page: 2,
    });
    expect(doctorKey).toEqual([
      'public-doctors',
      { page: 2, limit: 8, search: '', departmentId: 'd-1', branchId: 'b-1' },
    ]);
  });

  it('generates appointment, document, and invoice keys with entity scopes', () => {
    const aptKey = portalQueryKeys.appointments({
      patientId: 'pat-100',
      scope: 'upcoming',
      status: 'CONFIRMED',
      page: 1,
      limit: 10,
    });
    expect(aptKey).toEqual([
      'patient-portal-appointments',
      'pat-100',
      { scope: 'upcoming', status: 'CONFIRMED', page: 1, limit: 10 },
    ]);

    const docKey = portalQueryKeys.documents('pat-100');
    expect(docKey).toEqual(['patient-portal-documents', 'pat-100']);

    const invKey = portalQueryKeys.invoice('pat-100', 'inv-500');
    expect(invKey).toEqual(['patient-portal-invoice', 'pat-100', 'inv-500']);

    const slotKey = portalQueryKeys.doctorSlots('doc-10', '2026-09-01');
    expect(slotKey).toEqual([
      'public-doctor-slots',
      { doctorId: 'doc-10', date: '2026-09-01' },
    ]);
  });
});
