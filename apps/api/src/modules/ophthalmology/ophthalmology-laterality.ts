import { AppError } from '../../shared/errors/app-error.js';
import type { OphthalmologyLaterality } from './ophthalmology.types.js';

export type OphthalmologyLateralityRecordType =
  | 'MEASUREMENT_IMAGE'
  | 'BILATERAL_FINDING_TREATMENT'
  | 'DIAGNOSIS'
  | 'CONTEXT';

const allowed: Record<OphthalmologyLateralityRecordType, readonly OphthalmologyLaterality[]> = {
  MEASUREMENT_IMAGE: ['OD', 'OS'],
  BILATERAL_FINDING_TREATMENT: ['OD', 'OS', 'OU'],
  DIAGNOSIS: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'],
  CONTEXT: ['OD', 'OS', 'OU', 'NOT_SPECIFIED'],
};

export const assertOphthalmologyLaterality = (
  recordType: OphthalmologyLateralityRecordType,
  laterality: OphthalmologyLaterality,
) => {
  if (!allowed[recordType].includes(laterality)) {
    throw new AppError(
      `Laterality ${laterality} is not valid for ${recordType.toLowerCase().replaceAll('_', ' ')}`,
      400,
      'OPHTHALMOLOGY_LATERALITY_REQUIRED',
    );
  }
};
