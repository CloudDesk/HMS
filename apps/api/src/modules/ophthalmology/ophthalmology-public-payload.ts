import { z } from 'zod';
import type { OphthalmologyPublicationSourceType } from './ophthalmology-phase10.types.js';

const object = (value: unknown) => { const parsed = z.record(z.string(), z.unknown()).safeParse(value); return parsed.success ? parsed.data : {}; };
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const scalar = (value: unknown): string | number | boolean | null | undefined => value instanceof Date ? value.toISOString()
  : value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const pick = (value: unknown, names: readonly string[]) => {
  const source = object(value); return Object.fromEntries(names.flatMap((name) => { const found = scalar(source[name]); return found === undefined ? [] : [[name, found]]; }));
};
const aliases = (value: unknown, fields: ReadonlyArray<readonly [string, string]>) => {
  const source = object(value); return Object.fromEntries(fields.flatMap(([wire, model]) => { const found = scalar(source[wire] ?? source[model]); return found === undefined ? [] : [[wire, found]]; }));
};
const diagnosis = (value: unknown) => pick(value, ['code', 'display', 'codingSystem', 'type', 'laterality', 'status', 'severity', 'stage', 'differential']);
const optical = (value: unknown) => {
  const source = object(value); const current = object(source.current ?? value); const power = object(current.power);
  return { ...pick(current, ['status', 'clinical_version', 'prescription_type', 'lens_type', 'material', 'usage_instructions', 'valid_until', 'review_date', 'approved_at']),
    power: { OD: pick(power.OD, ['sphere', 'cylinder', 'axis', 'addition', 'prism', 'prism_base']), OS: pick(power.OS, ['sphere', 'cylinder', 'axis', 'addition', 'prism', 'prism_base']) },
    pupillary_distance: pick(current.pupillary_distance, ['format', 'binocular', 'OD', 'OS']), segment_height: pick(current.segment_height, ['OD', 'OS']),
    coating_codes: rows(current.coating_codes).filter((code): code is string => typeof code === 'string') };
};
/** This allowlist is shared by publication writes and authenticated portal reads, including older stored payloads. */
export function publicOphthalmologyPayload(type: OphthalmologyPublicationSourceType, value: unknown): Record<string, unknown> {
  const source = object(value); const metadata = pick(source, ['clinical_version', 'approved_at']);
  if (type === 'OPTICAL_PRESCRIPTION') return { kind: type, ...metadata, ...optical(source) };
  if (type === 'TEST_RESULT') return { kind: type, ...pick(source, ['clinical_version', 'test_code', 'test_name', 'laterality', 'performed_at', 'completed_at', 'reviewed_at', 'reliability']),
    report_document_ids: rows(source.report_document_ids).filter((id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) };
  const consultation = object(source.consultation); const reviewRoot = object(source.clinical_review); const review = object(reviewRoot.current ?? source.clinical_review);
  const opticalRoot = object(source.optical_prescription); const opticalCurrent = object(opticalRoot.current ?? source.optical_prescription);
  const prescriptions = rows(source.medication_prescriptions).filter((item) => ['SUBMITTED', 'DISPENSED', 'PARTIALLY_DISPENSED'].includes(String(object(item).status)));
  return { kind: type, ...metadata,
    consultation: aliases(consultation, [['chief_complaint', 'chiefComplaint'], ['history_present_illness', 'historyPresentIllness'], ['past_history', 'pastHistory'],
      ['family_history', 'familyHistory'], ['allergies', 'allergies'], ['physical_examination', 'physicalExamination'], ['assessment', 'assessment'], ['treatment_plan', 'treatmentPlan']]),
    diagnoses: rows(source.diagnoses ?? consultation.diagnoses).map(diagnosis),
    clinical_review: { ...pick(review, ['clinical_summary', 'patient_instructions', 'follow_up_decision']),
      treatment_plans: rows(review.treatment_plans).map((plan) => pick(plan, ['diagnosis_code', 'diagnosis_laterality', 'treatment', 'category', 'priority', 'status'])) },
    optical_prescription: opticalRoot.status === 'APPROVED' || opticalCurrent.status === 'APPROVED' ? optical(source.optical_prescription) : null,
    medication_prescriptions: prescriptions.map((entry) => { const record = object(entry); return { ...aliases(record, [['status', 'status'], ['patient_instructions', 'patientInstructions'], ['submitted_at', 'submittedAt']]),
      items: rows(record.items).map((item) => aliases(item, [['medicine_name', 'medicineName'], ['strength', 'strength'], ['dosage', 'dosage'], ['route', 'route'], ['frequency', 'frequency'],
        ['duration', 'duration'], ['quantity', 'quantity'], ['intake_time', 'intakeTime'], ['instructions', 'instructions']])) }; }),
    procedure_recommendations: rows(source.procedure_recommendations).map((entry) => aliases(entry, [['procedure_name', 'serviceName'], ['clinical_reason', 'clinicalReason'], ['status', 'status'], ['doctor_name', 'recommendingDoctorName']])),
    referrals: rows(source.referrals).filter((entry) => object(entry).status === 'SUBMITTED').map((entry) => aliases(entry, [['specialty', 'specialty'], ['priority', 'priority'], ['facility', 'facility'], ['doctor_name', 'referredDoctorName'], ['reason', 'reason'], ['appointment_date', 'appointmentDate'], ['status', 'status']])),
    follow_ups: rows(source.follow_ups).filter((entry) => object(entry).status === 'SCHEDULED').map((entry) => aliases(entry, [['date', 'nextVisitDate'], ['doctor_name', 'assignedDoctorName'], ['reason', 'reason'], ['status', 'status']])),
  };
}
