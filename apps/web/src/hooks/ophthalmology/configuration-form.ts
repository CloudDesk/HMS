import { z } from 'zod';
import { configurationTypeSchema, type AdminConfiguration } from '../../api/ophthalmology-admin';
import { testFormSchema } from '../../api/ophthalmology';

export const completionRequirements = ['INTAKE_COMPLETED', 'MANDATORY_TESTS_REVIEWED', 'ALL_RESULTS_RESOLVED', 'ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED', 'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED'] as const;
const pathSchema = z.string().trim().min(1).max(250).refine((value) => !value.split('.').some((key) => ['__proto__', 'prototype', 'constructor'].includes(key)), 'Invalid field path.');
export const configurationEditorSchema = z.object({
  type: configurationTypeSchema, code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), description: z.string().max(1000), effective_from: z.string().datetime({ offset: true }).nullable(),
  entries: z.array(z.object({ code: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160), active: z.boolean(), requires_description: z.boolean() })).max(100),
  form_type: z.string(), schema_version: z.string().max(40), test_codes: z.string(), required_fields: z.string(), required_quadrants: z.string(),
  numeric_ranges: z.array(z.object({ path: pathSchema, min: z.number().finite().nullable(), max: z.number().finite().nullable() })),
  comparison_units: z.array(z.object({ path: pathSchema, unit: z.string().trim().min(1).max(80) })).max(100),
  allowed_values: z.array(z.object({ path: pathSchema, kind: z.enum(['TEXT', 'NUMBER', 'BOOLEAN']), choices: z.string() })),
  iop_low: z.number().finite().nullable(), iop_high: z.number().finite().nullable(), iop_asymmetry: z.number().finite().nullable(),
  iop_low_code: z.string(), iop_high_code: z.string(), iop_asymmetry_code: z.string(), iop_within_code: z.string(), paediatric_max_age_years: z.number().positive().nullable(),
  required_requirements: z.array(z.enum(completionRequirements)), mandatory_test_codes: z.string(), allow_override: z.boolean(),
}).superRefine((value, ctx) => {
  if (new Set(value.entries.map((entry) => entry.code.toUpperCase())).size !== value.entries.length) ctx.addIssue({ code: 'custom', path: ['entries'], message: 'Entry codes must be unique.' });
  if (value.type === 'FORM_PROFILE' && (!testFormSchema.safeParse(value.form_type).success || !value.schema_version.trim() || !lines(value.test_codes).length)) ctx.addIssue({ code: 'custom', path: ['form_type'], message: 'Select a form, schema version and supported test codes.' });
  for (const range of value.numeric_ranges) if (range.min !== null && range.max !== null && range.min > range.max) ctx.addIssue({ code: 'custom', path: ['numeric_ranges'], message: 'Minimum must not exceed maximum.' });
  for (const key of ['numeric_ranges', 'allowed_values', 'comparison_units'] as const) if (new Set(value[key].map((entry) => entry.path)).size !== value[key].length) ctx.addIssue({ code: 'custom', path: [key], message: 'Field paths must be unique.' });
});
export type ConfigurationEditor = z.infer<typeof configurationEditorSchema>;
export const lines = (value: string) => [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
const stringList = (value: unknown) => z.array(z.string()).safeParse(value).data?.join('\n') ?? '';
const numberOrNull = (value: unknown) => typeof value === 'number' ? value : null;
export function configurationEditorDefaults(record: AdminConfiguration | null): ConfigurationEditor {
  const values = record?.values ?? {};
  const rawEntries = values[record?.type === 'CLINICAL_THRESHOLD' ? 'criteria' : record?.type === 'TEST_CATALOGUE' ? 'tests' : 'options'];
  const entries = z.array(z.union([z.string(), z.object({ code: z.string(), label: z.string().optional(), name: z.string().optional(), active: z.boolean().optional(), requires_description: z.boolean().optional() })])).safeParse(rawEntries).data ?? [];
  const object = (value: unknown) => z.record(z.string(), z.unknown()).safeParse(value).data ?? {};
  const iop = object(values.iop_thresholds);
  return {
    type: record?.type ?? 'COMPLAINT', code: record?.code ?? '', name: record?.name ?? '', description: record?.description ?? '', effective_from: record?.effective_from ?? null,
    entries: entries.map((item) => typeof item === 'string' ? { code: item, label: item, active: true, requires_description: false } : { code: item.code, label: item.label ?? item.name ?? item.code, active: item.active !== false, requires_description: item.requires_description === true }),
    form_type: typeof values.form_type === 'string' ? values.form_type : '', schema_version: typeof values.schema_version === 'string' ? values.schema_version : '', test_codes: stringList(values.test_codes), required_fields: stringList(values.required_fields), required_quadrants: stringList(values.required_quadrants),
    numeric_ranges: Object.entries(object(values.numeric_ranges)).flatMap(([path, rule]) => { const parsed = z.object({ min: z.number().optional(), max: z.number().optional() }).safeParse(rule); return parsed.success ? [{ path, min: parsed.data.min ?? null, max: parsed.data.max ?? null }] : []; }),
    comparison_units: Object.entries(object(values.comparison_units)).flatMap(([path, unit]) => typeof unit === 'string' ? [{ path, unit }] : []),
    allowed_values: Object.entries(object(values.allowed_values)).flatMap(([path, choices]) => Array.isArray(choices) && choices.every((choice) => ['string', 'number', 'boolean'].includes(typeof choice) && typeof choice === typeof choices[0]) ? [{ path, kind: choices.every((choice) => typeof choice === 'number') ? 'NUMBER' as const : choices.every((choice) => typeof choice === 'boolean') ? 'BOOLEAN' as const : 'TEXT' as const, choices: choices.join('\n') }] : []),
    iop_low: numberOrNull(iop.low), iop_high: numberOrNull(iop.high), iop_asymmetry: numberOrNull(iop.asymmetry), iop_low_code: typeof iop.low_code === 'string' ? iop.low_code : '', iop_high_code: typeof iop.high_code === 'string' ? iop.high_code : '', iop_asymmetry_code: typeof iop.asymmetry_code === 'string' ? iop.asymmetry_code : '', iop_within_code: typeof iop.within_code === 'string' ? iop.within_code : '',
    paediatric_max_age_years: numberOrNull(values.paediatric_max_age_years), required_requirements: z.array(z.enum(completionRequirements)).safeParse(values.required_requirements).data ?? [], mandatory_test_codes: stringList(values.mandatory_test_codes), allow_override: values.allow_override === true,
  };
}
export function configurationEditorValues(form: ConfigurationEditor, original: Record<string, unknown>, baseline?: ConfigurationEditor) {
  const values = structuredClone(original);
  const clinicalKeys = ['entries', 'form_type', 'schema_version', 'test_codes', 'required_fields', 'required_quadrants', 'numeric_ranges', 'allowed_values', 'comparison_units', 'iop_low', 'iop_high', 'iop_asymmetry', 'iop_low_code', 'iop_high_code', 'iop_asymmetry_code', 'iop_within_code', 'paediatric_max_age_years', 'required_requirements', 'mandatory_test_codes', 'allow_override'] as const;
  if (baseline && baseline.type === form.type && clinicalKeys.every((key) => JSON.stringify(form[key]) === JSON.stringify(baseline[key]))) return values;
  if (['COMPLAINT', 'CLINICAL_THRESHOLD', 'TEST_CATALOGUE', 'SUB_SPECIALITY'].includes(form.type)) {
    const key = form.type === 'CLINICAL_THRESHOLD' ? 'criteria' : form.type === 'TEST_CATALOGUE' ? 'tests' : 'options';
    const previous = z.array(z.record(z.string(), z.unknown())).safeParse(original[key]).data ?? [];
    values[key] = form.entries.map((entry) => ({ ...previous.find((old) => typeof old.code === 'string' && old.code.toUpperCase() === entry.code.toUpperCase()), code: entry.code.toUpperCase(), ...(key === 'tests' ? { name: entry.label } : { label: entry.label }), active: entry.active, ...(key === 'options' ? { requires_description: entry.requires_description } : {}) }));
  }
  if (form.type === 'FORM_PROFILE') {
    Object.assign(values, { form_type: testFormSchema.parse(form.form_type), schema_version: form.schema_version.trim(), test_codes: lines(form.test_codes).map((code) => code.toUpperCase()), required_fields: lines(form.required_fields), numeric_ranges: Object.fromEntries(form.numeric_ranges.map((rule) => [pathSchema.parse(rule.path), { ...(rule.min !== null ? { min: rule.min } : {}), ...(rule.max !== null ? { max: rule.max } : {}) }])), allowed_values: Object.fromEntries(form.allowed_values.map((rule) => [pathSchema.parse(rule.path), lines(rule.choices).map((value) => rule.kind === 'NUMBER' ? z.coerce.number().finite().parse(value) : rule.kind === 'BOOLEAN' ? z.enum(['true', 'false']).parse(value) === 'true' : value)])) });
    values.comparison_units = Object.fromEntries(form.comparison_units.map((rule) => [pathSchema.parse(rule.path), rule.unit.trim()]));
    values.required_quadrants = lines(form.required_quadrants);
    if (form.paediatric_max_age_years !== null) values.paediatric_max_age_years = form.paediatric_max_age_years; else delete values.paediatric_max_age_years;
    if (form.iop_low !== null || form.iop_high !== null || form.iop_asymmetry !== null) values.iop_thresholds = z.object({ low: z.number(), high: z.number(), asymmetry: z.number(), low_code: z.string().trim().min(1), high_code: z.string().trim().min(1), asymmetry_code: z.string().trim().min(1), within_code: z.string().trim().min(1) }).parse({ low: form.iop_low, high: form.iop_high, asymmetry: form.iop_asymmetry, low_code: form.iop_low_code, high_code: form.iop_high_code, asymmetry_code: form.iop_asymmetry_code, within_code: form.iop_within_code });
    else delete values.iop_thresholds;
  }
  if (form.type === 'COMPLETION_PROFILE') Object.assign(values, { required_requirements: form.required_requirements, mandatory_test_codes: lines(form.mandatory_test_codes).map((code) => code.toUpperCase()), allow_override: form.allow_override });
  if (baseline && baseline.type === form.type) {
    // Only rewrite the clinical groups the administrator actually changed.
    // Unsupported historical rules must survive edits to an unrelated group.
    const groups: Record<string, (keyof ConfigurationEditor)[]> = {
      options: ['entries'], criteria: ['entries'], tests: ['entries'],
      form_type: ['form_type'], schema_version: ['schema_version'], test_codes: ['test_codes'], required_fields: ['required_fields'], required_quadrants: ['required_quadrants'],
      numeric_ranges: ['numeric_ranges'], allowed_values: ['allowed_values'], comparison_units: ['comparison_units'],
      iop_thresholds: ['iop_low', 'iop_high', 'iop_asymmetry', 'iop_low_code', 'iop_high_code', 'iop_asymmetry_code', 'iop_within_code'],
      paediatric_max_age_years: ['paediatric_max_age_years'], required_requirements: ['required_requirements'], mandatory_test_codes: ['mandatory_test_codes'], allow_override: ['allow_override'],
    };
    for (const [key, fields] of Object.entries(groups)) {
      if (fields.every((field) => JSON.stringify(form[field]) === JSON.stringify(baseline[field]))) {
        if (Object.hasOwn(original, key)) values[key] = structuredClone(original[key]); else delete values[key];
      }
    }
    if (form.type === 'FORM_PROFILE') for (const key of ['numeric_ranges', 'allowed_values'] as const) {
      if (JSON.stringify(form[key]) === JSON.stringify(baseline[key])) continue;
      const previous = z.record(z.string(), z.unknown()).safeParse(original[key]).data ?? {};
      const edited = z.record(z.string(), z.unknown()).parse(values[key]);
      const preserved = Object.fromEntries(Object.entries(previous).filter(([path]) => !baseline[key].some((rule) => rule.path === path)));
      if (key === 'numeric_ranges') for (const [path, rule] of Object.entries(edited)) {
        const extra = z.record(z.string(), z.unknown()).safeParse(previous[path]).data ?? {};
        const { min: _min, max: _max, ...metadata } = extra;
        void _min; void _max;
        edited[path] = { ...metadata, ...z.record(z.string(), z.unknown()).parse(rule) };
      }
      values[key] = { ...preserved, ...edited };
    }
  }
  return values;
}
