import { describe, expect, it } from 'vitest';
import {
  imagingReportRecordSchema,
  labResultItemSchema,
  labResultRecordSchema,
  recordsDataSchema,
} from './contracts';

describe('Records Contracts & Schemas', () => {
  it('validates a single lab result item', () => {
    const validItem = {
      serviceName: 'Hemoglobin (Hb)',
      value: '14.2',
      unit: 'g/dL',
      referenceRange: '13.0 - 17.0',
      comments: 'Normal range for adult male',
    };

    const parsed = labResultItemSchema.parse(validItem);
    expect(parsed.serviceName).toBe('Hemoglobin (Hb)');
    expect(parsed.value).toBe('14.2');
    expect(parsed.unit).toBe('g/dL');
    expect(parsed.referenceRange).toBe('13.0 - 17.0');
  });

  it('validates a complete verified lab result record', () => {
    const validRecord = {
      id: 'lab-001',
      result_items: [
        {
          serviceName: 'Fasting Blood Sugar',
          value: '95',
          unit: 'mg/dL',
          referenceRange: '70 - 100',
        },
        {
          serviceName: 'Postprandial Blood Sugar',
          value: '130',
          unit: 'mg/dL',
          referenceRange: '< 140',
        },
      ],
      remarks: 'Normal fasting and postprandial glucose levels.',
      entered_at: '2026-09-20T08:00:00.000Z',
      verified_at: '2026-09-20T10:30:00.000Z',
    };

    const parsed = labResultRecordSchema.parse(validRecord);
    expect(parsed.id).toBe('lab-001');
    expect(parsed.result_items).toHaveLength(2);
    expect(parsed.remarks).toBe('Normal fasting and postprandial glucose levels.');
  });

  it('validates a verified diagnostic imaging report record', () => {
    const validReport = {
      id: 'img-001',
      findings: 'Lungs are clear bilaterally with no active focal consolidation, pleural effusion, or pneumothorax. Cardiomediastinal silhouette is within normal limits.',
      impression: 'Normal chest radiograph (CXR PA view). No acute cardiopulmonary abnormality.',
      recommendations: 'No acute imaging follow-up indicated.',
      entered_at: '2026-09-22T11:00:00.000Z',
      verified_at: '2026-09-22T12:15:00.000Z',
    };

    const parsed = imagingReportRecordSchema.parse(validReport);
    expect(parsed.id).toBe('img-001');
    expect(parsed.impression).toContain('Normal chest radiograph');
    expect(parsed.recommendations).toBe('No acute imaging follow-up indicated.');
  });

  it('validates combined records data schema', () => {
    const validData = {
      laboratory_results: [],
      imaging_reports: [],
    };

    const parsed = recordsDataSchema.parse(validData);
    expect(parsed.laboratory_results).toEqual([]);
    expect(parsed.imaging_reports).toEqual([]);
  });
});
