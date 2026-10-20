import { z } from 'zod';

const path = z.string().trim().min(1).max(250).refine((value) =>
  value.split('.').every((key) => /^[A-Za-z0-9_]+$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key)));
export const comparisonUnitsSchema = z.record(path, z.string().trim().min(1).max(80)).refine((units) => Object.keys(units).length <= 100);
type ComparisonSource = { form_type: string; form_schema_version: string; payload: Record<string, unknown> };
const read = (payload: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((value, part) =>
  value && typeof value === 'object' && Object.hasOwn(value, part) ? (value as Record<string, unknown>)[part] : undefined, payload);
const sameText = (a: unknown, b: unknown) => typeof a === 'string' && a.trim().length > 0 && a === b;

// Conservative compatibility only. Clinical progression remains the clinician's
// decision; this helper never converts units or derives an outcome from values.
export function resultComparisonProblem(current: ComparisonSource, prior: ComparisonSource,
  currentProfile: Record<string, unknown>, priorProfile: Record<string, unknown>): string | null {
  if (current.form_type !== prior.form_type || current.form_schema_version !== prior.form_schema_version) return 'FORM_SCHEMA_MISMATCH';
  if (!sameText(current.payload.eye, prior.payload.eye)) return 'EYE_MISMATCH';
  if (current.form_type === 'VISUAL_FIELD') {
    if (!['machine', 'program', 'strategy'].every((key) => sameText(current.payload[key], prior.payload[key]))) return 'PROTOCOL_MISMATCH';
  } else if (current.form_type === 'OCT') {
    const scans = z.array(z.string().trim().min(1)).min(1);
    const a = scans.safeParse(current.payload.requested_scans); const b = scans.safeParse(prior.payload.requested_scans);
    if (!sameText(current.payload.oct_type, prior.payload.oct_type) || !a.success || !b.success
      || JSON.stringify([...new Set(a.data)].sort()) !== JSON.stringify([...new Set(b.data)].sort())) return 'PROTOCOL_MISMATCH';
  } else return 'FORM_UNSUPPORTED';
  const a = comparisonUnitsSchema.safeParse(currentProfile.comparison_units); const b = comparisonUnitsSchema.safeParse(priorProfile.comparison_units);
  if (!a.success || !b.success || !Object.keys(a.data).length || !Object.keys(b.data).length) return 'UNITS_NOT_CONFIGURED';
  const keys = Object.keys(a.data).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(b.data).sort()) || keys.some((key) => a.data[key] !== b.data[key])) return 'UNITS_MISMATCH';
  const prefix = current.form_type === 'VISUAL_FIELD' ? 'result_indices.' : 'measurements.';
  if (keys.some((key) => !key.startsWith(prefix) || ![read(current.payload, key), read(prior.payload, key)]
    .every((value) => typeof value === 'number' && Number.isFinite(value)))) return 'MEASUREMENTS_MISSING';
  return null;
}
