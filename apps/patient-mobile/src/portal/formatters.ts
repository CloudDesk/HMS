import type { PortalPatient } from './contracts';

export function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function relationshipLabel(relationship: PortalPatient['relationship'] | string): string {
  switch (relationship) {
    case 'SELF':
      return 'Self';
    case 'PARENT':
      return 'Parent';
    case 'LEGAL_GUARDIAN':
      return 'Legal Guardian';
    default:
      return relationship;
  }
}
