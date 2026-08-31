export const LEGACY_INPATIENT_CLINICAL_STORAGE_KEYS = [
  'hms_inpatient_round_notes',
  'hms_inpatient_vitals',
  'hms_inpatient_orders',
] as const;

export function removeLegacyInpatientClinicalStorage(storage: Pick<Storage, 'removeItem'>) {
  for (const key of LEGACY_INPATIENT_CLINICAL_STORAGE_KEYS) {
    try { storage.removeItem(key); } catch { /* Storage may be disabled; never read or migrate untrusted clinical values. */ }
  }
}
