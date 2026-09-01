import type { DispensingSourceType } from '../api/pharmacy-dispensing';

const sourceLabels: Record<DispensingSourceType, string> = {
  OPD_VISIT: 'OPD Consultation',
  EMERGENCY_ENCOUNTER: 'Emergency',
  INPATIENT_ADMISSION: 'Inpatient',
  PROCEDURE_BOOKING: 'Procedure',
};

export const dispensingSourceLabel = (source: DispensingSourceType) => sourceLabels[source];

export const roundDispensingMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateDispensingLineTotal = (unitPrice: number, quantity: number | null) =>
  roundDispensingMoney(unitPrice * (quantity ?? 0));

export const calculateDispensingTotal = (lines: ReadonlyArray<{ lineTotal: number }>) =>
  roundDispensingMoney(lines.reduce((total, line) => total + line.lineTotal, 0));
