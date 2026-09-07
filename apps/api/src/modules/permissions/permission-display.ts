const humanizeToken = (value: string) => value
  .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll(/[_-]+/g, ' ')
  .replaceAll(/\s+/g, ' ')
  .trim();

const actionLabels: Record<string, string> = {
  AdjustStock: 'Adjust Stock',
  ChangePassword: 'Change Password',
  ConfigureLowStock: 'Configure Low-Stock Level',
  ConvertToIP: 'Convert to Inpatient',
  CrossBranch: 'Transfer Across Branches',
  EnterReport: 'Enter Imaging Report',
  EnterResult: 'Enter Laboratory Result',
  MarkLeft: 'Mark Patient as Left',
  MarkNoShow: 'Mark No-Show',
  OverridePriority: 'Override Triage Priority',
  'Provision Login': 'Provision Doctor Login',
  RecordMovement: 'Record Stock Movement',
  RegisterBatch: 'Register Medicine Batch',
  ResetPassword: 'Reset Password',
  UpdateStatus: 'Update Status',
  VerifyReport: 'Verify Imaging Report',
  VerifyResult: 'Verify Laboratory Result',
  ViewReceipt: 'View Receipt',
};

const screenLabels: Record<string, string> = {
  Medicines: 'Medicine Master',
  'Phase 2 Reports': 'Reports',
};

const specialNames: Record<string, string> = {
  'OPD::OPD Visits::Create': 'Check In Patient',
  'Doctors::Doctor Directory::Provision Login': 'Provision Doctor Login',
  'Laboratory::Orders::EnterResult': 'Enter Laboratory Result',
  'Laboratory::Orders::VerifyResult': 'Verify Laboratory Result',
  'Imaging::Orders::EnterReport': 'Enter Imaging Report',
  'Imaging::Orders::VerifyReport': 'Verify Imaging Report',
  'Pharmacy::Medicine Inventory::AdjustStock': 'Adjust Stock',
  'Pharmacy::Medicine Inventory::RecordMovement': 'Record Stock Movement',
  'Pharmacy::Medicine Inventory::ConfigureLowStock': 'Configure Low-Stock Level',
  'Billing::Invoices::ViewReceipt': 'View Receipt',
  'Emergency::Disposition::ConvertToIP': 'Convert to Inpatient',
};

const specialDescriptions: Record<string, string> = {
  'OPD::OPD Visits::Create': 'Allows the user to check in an appointed patient and create the linked OPD visit.',
  'Doctors::Doctor Directory::Provision Login': 'Allows the user to create or map a login account for a doctor.',
  'Laboratory::Orders::EnterResult': 'Allows the user to enter a laboratory result without granting verification authority.',
  'Laboratory::Orders::VerifyResult': 'Allows the user to review and verify a laboratory result before it is finalized.',
  'Imaging::Orders::EnterReport': 'Allows the user to enter an imaging report without granting verification authority.',
  'Imaging::Orders::VerifyReport': 'Allows the user to review and verify an imaging report before it is finalized.',
  'Pharmacy::Medicine Inventory::AdjustStock': 'Allows the user to record controlled stock adjustments for found, lost, or damaged medicine.',
  'Pharmacy::Medicine Inventory::RecordMovement': 'Allows the user to record medicine stock receipts and issues.',
  'Pharmacy::Medicine Inventory::ConfigureLowStock': 'Allows the user to configure the stock level that triggers a low-stock warning.',
  'Billing::Invoices::ViewReceipt': 'Allows the user to view payment receipts linked to authorized invoices.',
  'Emergency::Disposition::ConvertToIP': 'Allows the user to initiate the authorized Emergency-to-Inpatient conversion workflow.',
};

const genericDescriptions: Record<string, string> = {
  View: 'view records and screen content',
  Create: 'create new records',
  Edit: 'edit existing records',
  Delete: 'delete eligible records',
  Export: 'export authorized records',
  Assign: 'assign eligible records or users',
  Attach: 'attach eligible records or documents',
  Verify: 'review and verify eligible records',
  Cancel: 'cancel eligible workflow records',
  Confirm: 'confirm eligible workflow records',
  Validate: 'validate eligible workflow records',
  Discharge: 'discharge eligible patients',
  Transfer: 'transfer eligible patients or resources',
  Release: 'release eligible resources',
  Complete: 'complete eligible workflow records',
  Assess: 'record an authorized assessment',
  Register: 'register new workflow records',
  Link: 'link eligible patient records',
  Correct: 'correct eligible patient links',
  CollectPayment: 'collect payment against authorized invoices',
  ChangeStatus: 'change an eligible resource status',
};

export const getPermissionDisplayMetadata = (moduleName: string, screen: string, action: string) => {
  const key = `${moduleName}::${screen}::${action}`;
  const actionLabel = actionLabels[action] ?? humanizeToken(action);
  const screenLabel = screenLabels[screen] ?? screen;
  const name = specialNames[key] ?? `${actionLabel} ${screenLabel}`;
  const description = specialDescriptions[key] ??
    `Allows the user to ${genericDescriptions[action] ?? actionLabel.toLowerCase()} in ${moduleName} - ${screen}.`;

  return { description, name };
};
