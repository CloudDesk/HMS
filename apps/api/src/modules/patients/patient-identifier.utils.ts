import { env } from '../../config/env.js';
import type { ShaPatientIdentifierReadiness } from './patient.types.js';

export type PatientIdentifierLike = {
  identifierType: string;
  issuingAuthority: string;
  status: string;
  value?: string;
};

export const evaluatePatientIdentifierReadiness = (
  identifiers: PatientIdentifierLike[] | undefined,
  configuredSystem?: string,
): ShaPatientIdentifierReadiness => {
  const activeConfig = configuredSystem !== undefined ? configuredSystem : (process.env.SHA_PATIENT_IDENTIFIER_SYSTEM || env.sha.patientIdentifierSystem);
  const sys = activeConfig?.trim();
  if (!sys) {
    return {
      status: 'SHA_IDENTIFIER_SYSTEM_UNCONFIGURED',
      identifierSystemConfigured: false,
      identifierAvailable: false,
      identifierSystem: null,
      identifierType: null,
    };
  }

  const activeMatching = (identifiers ?? []).find(
    (id) =>
      id.status === 'ACTIVE' &&
      (id.issuingAuthority.trim().toLowerCase() === sys.toLowerCase() ||
        id.identifierType.trim().toLowerCase() === sys.toLowerCase()),
  );

  if (activeMatching && activeMatching.value && activeMatching.value.trim().length > 0) {
    return {
      status: 'SHA_PATIENT_IDENTIFIER_AVAILABLE',
      identifierSystemConfigured: true,
      identifierAvailable: true,
      identifierSystem: activeMatching.issuingAuthority,
      identifierType: activeMatching.identifierType,
    };
  }

  return {
    status: 'SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE',
    identifierSystemConfigured: true,
    identifierAvailable: false,
    identifierSystem: sys,
    identifierType: null,
  };
};
