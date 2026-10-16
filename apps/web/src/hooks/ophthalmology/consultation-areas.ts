import { subtypeSchema } from '../../api/ophthalmology';

const sharedVisitTypes = { NEW_CONSULTATION: 'NEW_CONSULTATION', FOLLOW_UP: 'FOLLOW_UP', EMERGENCY: 'EMERGENCY', POST_OPERATIVE: 'REVIEW', SCREENING: 'REVIEW', PROCEDURE_REVIEW: 'REVIEW' };
export const compatibleSubtypes = (visitType: string | undefined) => subtypeSchema.options.filter((subtype) => visitType === 'WALK_IN' || sharedVisitTypes[subtype] === visitType);

export const consultationAreas = [
  { id: 'patient', label: 'Patient Summary', section: 'overview', screen: 'OPD Visits' },
  { id: 'complaint', label: 'Chief Complaint', section: 'intake', screen: 'Ophthalmology Intake' },
  { id: 'history', label: 'Ophthalmic History', section: 'intake', screen: 'Ophthalmology Intake' },
  { id: 'acuity', label: 'Visual Acuity', section: 'tests', screen: 'Ophthalmology Test Queue' },
  { id: 'refraction', label: 'Refraction', section: 'tests', screen: 'Ophthalmology Test Queue' },
  { id: 'examination', label: 'Eye Examination', section: 'tests', screen: 'Ophthalmology Test Queue' },
  { id: 'diagnostics', label: 'IOP and Diagnostics', section: 'tests', screen: 'Ophthalmology Test Queue' },
  { id: 'diagnosis', label: 'Assessment and Diagnosis', section: 'shared', screen: 'OPD Consultation', tab: 'Diagnosis' },
  { id: 'investigations', label: 'Investigations and Results', section: 'shared', screen: 'OPD Clinical Orders', tab: 'Lab Orders' },
  { id: 'treatment', label: 'Treatment Plan', section: 'clinical', screen: 'Ophthalmology Consultation' },
  { id: 'prescriptions', label: 'Prescriptions', section: 'shared', screen: 'OPD Prescription', tab: 'Prescription' },
  { id: 'continuing-care', label: 'Procedures, Referral and Follow-up', section: 'shared', screen: 'OPD Referral', tab: 'Referral' },
  { id: 'summary', label: 'Consultation Summary', section: 'completion', screen: 'Ophthalmology Consultation' },
] as const;
export type ConsultationArea = typeof consultationAreas[number];
