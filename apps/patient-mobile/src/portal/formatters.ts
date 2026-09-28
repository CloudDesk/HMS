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

export function formatDateOfBirth(dateStr?: string | null): string {
  if (!dateStr) return 'Not recorded';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length === 1 && first) return first.charAt(0).toUpperCase();
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return '—';
}

