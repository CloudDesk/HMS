export const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );

export const money = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value);

export const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const fullName = (patient: { first_name: string; middle_name?: string | null; last_name: string }) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');

export const relationshipTag = (relationship: string) => {
  if (relationship === 'SELF') return 'Self';
  if (relationship === 'PARENT') return 'My child';
  if (relationship === 'LEGAL_GUARDIAN') return 'Under my care';
  return label(relationship);
};

export const ageOnDate = (value: string) => {
  const birthDate = new Date(value);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) years -= 1;
  return Math.max(0, years);
};

export const serviceIcon = (type: string) =>
  type === 'LAB_TEST' ? 'ph-flask' : type === 'IMAGING_SERVICE' ? 'ph-scan' : 'ph-stethoscope';

export const departmentIcons = [
  'ph-heartbeat',
  'ph-tooth',
  'ph-baby',
  'ph-brain',
  'ph-eye',
  'ph-bone',
  'ph-first-aid',
  'ph-test-tube',
];
