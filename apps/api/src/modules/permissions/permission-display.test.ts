import { describe, expect, it } from 'vitest';
import { getPermissionDisplayMetadata } from './permission-display.js';

describe('permission display metadata', () => {
  it.each([
    ['Doctors', 'Doctor Directory', 'Provision Login', 'Provision Doctor Login'],
    ['Laboratory', 'Orders', 'EnterResult', 'Enter Laboratory Result'],
    ['Laboratory', 'Orders', 'VerifyResult', 'Verify Laboratory Result'],
    ['Imaging', 'Orders', 'EnterReport', 'Enter Imaging Report'],
    ['Imaging', 'Orders', 'VerifyReport', 'Verify Imaging Report'],
    ['Pharmacy', 'Medicine Inventory', 'AdjustStock', 'Adjust Stock'],
    ['Pharmacy', 'Medicine Inventory', 'RecordMovement', 'Record Stock Movement'],
    ['Pharmacy', 'Medicine Inventory', 'ConfigureLowStock', 'Configure Low-Stock Level'],
    ['Billing', 'Invoices', 'ViewReceipt', 'View Receipt'],
    ['Emergency', 'Disposition', 'ConvertToIP', 'Convert to Inpatient'],
    ['OPD', 'OPD Visits', 'Create', 'Check In Patient'],
  ])('maps %s / %s / %s to an administrator-friendly name', (moduleName, screen, action, name) => {
    const metadata = getPermissionDisplayMetadata(moduleName, screen, action);
    expect(metadata.name).toBe(name);
    expect(metadata.description.length).toBeGreaterThan(20);
  });

  it('generates a useful fallback for custom permission tuples', () => {
    expect(getPermissionDisplayMetadata('Example', 'Queue', 'OverridePriority')).toEqual({
      name: 'Override Triage Priority Queue',
      description: 'Allows the user to override triage priority in Example - Queue.',
    });
  });
});
