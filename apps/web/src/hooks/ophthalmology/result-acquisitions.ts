import { z } from 'zod';
import type { TestFormType } from '../../api/ophthalmology';
import { readPath, type ResultField } from './result-fields';

const lists: Partial<Record<TestFormType, string[]>> = {
  VISUAL_ACUITY: ['conclusion_codes'], LENSOMETRY: ['coating_codes', 'change_reason_codes'],
  AUTOREFRACTION_KERATOMETRY: ['observations'], OBJECTIVE_REFRACTION: ['observation_codes'], SUBJECTIVE_REFRACTION: ['usage_requirement_codes'],
  PACHYMETRY: ['technician_impression_codes'], MOTILITY_SQUINT_BINOCULAR: ['assessment_methods', 'impression_codes'],
  DRY_EYE: ['symptom_codes', 'impression_codes'], OCT: ['requested_scans', 'technician_observation_codes'],
  CORNEAL_TOPOGRAPHY: ['impression_codes'], BIOMETRY_IOL: ['special_factor_codes'],
  PAEDIATRIC_VISION: ['assessment_methods', 'parent_reported.symptom_codes', 'binocular_vision.findings', 'result_codes'],
};
export type AcquisitionGroup = { path: string; label: string; count: number; maximum: number; removable: boolean };
export function resultAcquisitions(type: TestFormType, eye: string, payload: Record<string, unknown>, extra: Record<string, number> = {}) {
  const eyes = eye === 'OD' ? ['OD'] : eye === 'OS' ? ['OS'] : ['OD', 'OS'];
  const fields: ResultField[] = []; const groups: AcquisitionGroup[] = [];
  const field = (path: string, label: string, kind: ResultField['kind'], options?: string[]) => fields.push({ path, label, kind, options });
  const group = (path: string, label: string, maximum = 50, minimum = 0) => {
    const saved = readPath(payload, path);
    const count = Math.max(minimum, Array.isArray(saved) ? saved.length : 0) + (extra[path] ?? 0);
    groups.push({ path, label, count, maximum, removable: true }); return count;
  };
  const codes = (path: string, label: string) => {
    const count = group(path, label);
    for (let index = 0; index < count; index++) field(`${path}.${index}`, `${label} ${index + 1}`, 'choice');
  };
  for (const path of lists[type] ?? []) codes(path, path.replaceAll('_', ' ').replaceAll('.', ' · '));
  if (type === 'POSTERIOR_FUNDUS_EXAM') {
    const count = group('dilation_medications', 'Dilation medication');
    for (let i = 0; i < count; i++) {
      const prefix = `dilation_medications.${i}`; const label = `Dilation ${i + 1}`;
      field(`${prefix}.drug`, `${label} drug`, 'text'); field(`${prefix}.dose`, `${label} dose`, 'text');
      field(`${prefix}.laterality`, `${label} eye`, 'choice', eye === 'OU' ? ['OD', 'OS', 'OU'] : eyes);
      field(`${prefix}.instilled_at`, `${label} instilled at`, 'instant'); field(`${prefix}.ready_at`, `${label} ready at`, 'instant');
    }
  }
  if (type === 'BIOMETRY_IOL') for (const side of eyes) {
    const path = `calculations.${side}`; const count = group(path, `${side} IOL calculation`);
    for (let i = 0; i < count; i++) for (const name of ['formula', 'iol_model', 'iol_power', 'predicted_refraction']) field(`${path}.${i}.${name}`, `${side} calculation ${i + 1} ${name.replaceAll('_', ' ')}`, name === 'formula' || name === 'iol_model' ? 'choice' : 'number');
  }
  if (type === 'FUNDUS_PHOTOGRAPHY') {
    const count = group('image_sets', 'Fundus image set', 50, 1);
    for (let i = 0; i < count; i++) {
      const prefix = `image_sets.${i}`; const label = `Image set ${i + 1}`;
      field(`${prefix}.eye`, `${label} eye`, 'choice', eyes);
      for (const name of ['image_type', 'dilatation', 'quality']) field(`${prefix}.${name}`, `${label} ${name}`, 'choice');
      codes(`${prefix}.fields`, `${label} fields`); codes(`${prefix}.visible_abnormality_codes`, `${label} abnormalities`);
      field(`${prefix}.notes`, `${label} notes`, 'text'); field(`${prefix}.repeat_required`, `${label} repeat required`, 'boolean');
    }
  }
  return { fields, groups };
}

export function removeAcquisition(payload: Record<string, unknown>, path: string, index: number) {
  if (!Number.isInteger(index) || index < 0 || path.split('.').some((key) => ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Invalid acquisition row.');
  const copy = structuredClone(payload); const rows = readPath(copy, path);
  if (!Array.isArray(rows) || index >= rows.length) throw new Error('Reload this acquisition before removing a row.');
  rows.splice(index, 1); return copy;
}

export function selectedDocuments(raw: string | undefined): string[] {
  let value: unknown;
  try { value = raw ? JSON.parse(raw) as unknown : []; } catch { return []; }
  const parsed = z.array(z.string().regex(/^[a-f\d]{24}$/i)).safeParse(value);
  return parsed.success ? parsed.data : [];
}
