import { env } from '../../config/env.js';
import type { ShaPatientIdentifierReadiness } from './patient.types.js';

export type PatientIdentifierLike = {
  identifierType?: string;
  identifier_type?: string;
  issuingAuthority?: string;
  issuing_authority?: string;
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
    (id) => {
      const authority = (id.issuingAuthority || id.issuing_authority || '').trim().toLowerCase();
      const type = (id.identifierType || id.identifier_type || '').trim().toLowerCase();
      return id.status === 'ACTIVE' && (authority === sys.toLowerCase() || type === sys.toLowerCase());
    },
  );

  if (activeMatching && activeMatching.value && activeMatching.value.trim().length > 0) {
    const authority = activeMatching.issuingAuthority || activeMatching.issuing_authority || sys;
    const type = activeMatching.identifierType || activeMatching.identifier_type || null;
    return {
      status: 'SHA_PATIENT_IDENTIFIER_AVAILABLE',
      identifierSystemConfigured: true,
      identifierAvailable: true,
      identifierSystem: authority,
      identifierType: type,
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

export const resolveActiveShaPatientIdentifier = (
  identifiers: PatientIdentifierLike[] | undefined,
  configuredSystem?: string,
): { value: string; identifierType: string; issuingAuthority: string } | null => {
  const activeConfig =
    configuredSystem !== undefined
      ? configuredSystem
      : (process.env.SHA_PATIENT_IDENTIFIER_SYSTEM || env.sha.patientIdentifierSystem);
  const sys = activeConfig?.trim();
  if (!sys) return null;

  const activeMatching = (identifiers ?? []).find(
    (id) => {
      const authority = (id.issuingAuthority || id.issuing_authority || '').trim().toLowerCase();
      const type = (id.identifierType || id.identifier_type || '').trim().toLowerCase();
      return id.status === 'ACTIVE' && (authority === sys.toLowerCase() || type === sys.toLowerCase());
    },
  );

  if (activeMatching && activeMatching.value && activeMatching.value.trim().length > 0) {
    const authority = activeMatching.issuingAuthority || activeMatching.issuing_authority || sys;
    const type = activeMatching.identifierType || activeMatching.identifier_type || '';
    return {
      value: activeMatching.value.trim(),
      identifierType: type,
      issuingAuthority: authority,
    };
  }

  return null;
};

