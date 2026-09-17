import { describe, expect, it } from 'vitest';
import type { DepartmentResponse } from '../api/departments';
import type { OpdVisitResponse } from '../api/opd';
import {
  getDentition,
  parseDentalDiagnoses,
  getToothName,
  isAnteriorTooth,
  isDentalImagingService,
  isDentalLabService,
  isDentalMedication,
  isDentalVisit,
  isPermanentFdiTooth,
  isPrimaryFdiTooth,
  isUpperArch,
  isValidFdiTooth,
  COMMON_DENTAL_HABITS,
  COMMON_MEDICAL_ALERTS,
  COMMON_MEDICAL_ALERTS_GROUPED,
  DENTAL_MEDICAL_CONDITIONS,
  DENTAL_BLEEDING_MEDICATION_RISKS,
  DENTAL_ALLERGIES,
  STANDARD_CONDITIONS,
  TOOTH_STATUSES,
  getPatientAgeInYears,
  PEDIATRIC_DENTITION_AGE_THRESHOLD,
  getDefaultDentitionForAge,
  resolveInitialDentition,
} from './dental-utils';

describe('dental-utils tests', () => {
  describe('FDI tooth validation', () => {
    it('validates permanent FDI tooth numbers (11-18, 21-28, 31-38, 41-48)', () => {
      // Q1
      expect(isPermanentFdiTooth(11)).toBe(true);
      expect(isPermanentFdiTooth(18)).toBe(true);
      expect(isPermanentFdiTooth(19)).toBe(false);

      // Q2
      expect(isPermanentFdiTooth(21)).toBe(true);
      expect(isPermanentFdiTooth(28)).toBe(true);
      expect(isPermanentFdiTooth(29)).toBe(false);

      // Q3
      expect(isPermanentFdiTooth(31)).toBe(true);
      expect(isPermanentFdiTooth(38)).toBe(true);
      expect(isPermanentFdiTooth(30)).toBe(false);

      // Q4
      expect(isPermanentFdiTooth(41)).toBe(true);
      expect(isPermanentFdiTooth(48)).toBe(true);
      expect(isPermanentFdiTooth(49)).toBe(false);

      // Non-permanent
      expect(isPermanentFdiTooth(51)).toBe(false);
      expect(isPermanentFdiTooth(99)).toBe(false);
    });

    it('validates primary FDI tooth numbers (51-55, 61-65, 71-75, 81-85)', () => {
      // Q5
      expect(isPrimaryFdiTooth(51)).toBe(true);
      expect(isPrimaryFdiTooth(55)).toBe(true);
      expect(isPrimaryFdiTooth(56)).toBe(false);

      // Q6
      expect(isPrimaryFdiTooth(61)).toBe(true);
      expect(isPrimaryFdiTooth(65)).toBe(true);
      expect(isPrimaryFdiTooth(66)).toBe(false);

      // Q7
      expect(isPrimaryFdiTooth(71)).toBe(true);
      expect(isPrimaryFdiTooth(75)).toBe(true);
      expect(isPrimaryFdiTooth(76)).toBe(false);

      // Q8
      expect(isPrimaryFdiTooth(81)).toBe(true);
      expect(isPrimaryFdiTooth(85)).toBe(true);
      expect(isPrimaryFdiTooth(86)).toBe(false);

      // Non-primary
      expect(isPrimaryFdiTooth(11)).toBe(false);
      expect(isPrimaryFdiTooth(0)).toBe(false);
    });

    it('isValidFdiTooth validates all permanent and primary teeth and rejects invalid values', () => {
      expect(isValidFdiTooth(36)).toBe(true);
      expect(isValidFdiTooth(46)).toBe(true);
      expect(isValidFdiTooth(16)).toBe(true);
      expect(isValidFdiTooth(65)).toBe(true);

      expect(isValidFdiTooth(0)).toBe(false);
      expect(isValidFdiTooth(99)).toBe(false);
      expect(isValidFdiTooth(-1)).toBe(false);
      expect(isValidFdiTooth(12.5)).toBe(false);
    });
  });

  describe('Tooth anatomy helpers', () => {
    it('identifies dentition type accurately', () => {
      expect(getDentition(16)).toBe('PERMANENT');
      expect(getDentition(36)).toBe('PERMANENT');
      expect(getDentition(54)).toBe('PRIMARY');
      expect(getDentition(75)).toBe('PRIMARY');
    });

    it('identifies arch and anterior status accurately', () => {
      expect(isUpperArch(16)).toBe(true);
      expect(isUpperArch(21)).toBe(true);
      expect(isUpperArch(36)).toBe(false);
      expect(isUpperArch(46)).toBe(false);

      expect(isAnteriorTooth(11)).toBe(true);
      expect(isAnteriorTooth(12)).toBe(true);
      expect(isAnteriorTooth(13)).toBe(true);
      expect(isAnteriorTooth(14)).toBe(false);
      expect(isAnteriorTooth(36)).toBe(false);
    });

    it('resolves tooth names correctly', () => {
      expect(getToothName(11)).toBe('Maxillary Right Central Incisor');
      expect(getToothName(36)).toBe('Mandibular Left First Molar');
      expect(getToothName(46)).toBe('Mandibular Right First Molar');
      expect(getToothName(51)).toBe('Primary Maxillary Right Central Incisor');
    });
  });

  describe('isDentalVisit detection', () => {
    const createMockVisit = (overrides: Partial<OpdVisitResponse>): OpdVisitResponse => ({
      id: 'v-1',
      visit_number: 'OPD-001',
      queue_token_number: 1,
      appointment_id: null,
      patient_id: 'p-1',
      patient_number: 'P001',
      patient_name: 'Jane Doe',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Smith',
      doctor_specialization: 'General Practitioner',
      branch_id: 'b-1',
      department_id: 'dept-1',
      visit_date: '2026-09-07',
      check_in_time: '2026-09-07T10:00:00Z',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'CHECKED_IN',
      reason: null,
      notes: null,
      created_by: 'staff-1',
      updated_by: 'staff-1',
      created_at: '2026-09-07T10:00:00Z',
      updated_at: '2026-09-07T10:00:00Z',
      ...overrides,
    });

    const createMockDept = (overrides: Partial<DepartmentResponse>): DepartmentResponse => ({
      id: 'd-1',
      code: 'GEN',
      name: 'General OPD',
      description: null,
      branch_ids: ['b-1'],
      status: 'ACTIVE',
      isClinical: true,
      created_by: 'staff-1',
      updated_by: 'staff-1',
      created_at: '2026-09-07T10:00:00Z',
      updated_at: '2026-09-07T10:00:00Z',
      ...overrides,
    });

    it('returns true when doctor specialization contains dental keywords', () => {
      expect(
        isDentalVisit(
          createMockVisit({ id: 'v1', doctor_specialization: 'Dental Surgeon' }),
          [],
        ),
      ).toBe(true);

      expect(
        isDentalVisit(
          createMockVisit({ id: 'v2', doctor_specialization: 'Orthodontist' }),
          [],
        ),
      ).toBe(true);
    });

    it('returns true when department matches dental code or name', () => {
      const depts: DepartmentResponse[] = [
        createMockDept({ id: 'd-dent', code: 'DENT', name: 'Dental Department' }),
        createMockDept({ id: 'd-card', code: 'CARD', name: 'Cardiology' }),
      ];

      expect(
        isDentalVisit(
          createMockVisit({ id: 'v1', department_id: 'd-dent' }),
          depts,
        ),
      ).toBe(true);

      expect(
        isDentalVisit(
          createMockVisit({ id: 'v2', department_id: 'd-card' }),
          depts,
        ),
      ).toBe(false);
    });

    it('returns false for null or non-dental visits', () => {
      expect(isDentalVisit(null, [])).toBe(false);
      expect(isDentalVisit(undefined, [])).toBe(false);
      expect(
        isDentalVisit(
          createMockVisit({ id: 'v3', doctor_specialization: 'Cardiologist', department_id: 'card-1' }),
          [createMockDept({ id: 'card-1', code: 'CARD', name: 'Cardiology' })],
        ),
      ).toBe(false);
    });
  });
});

describe('Phase 6 diagnosis persistence', () => {
  it('matches exact ICD codes before overlapping clinical names and preserves general/multiple tooth associations', () => {
    const diagnoses = parseDentalDiagnoses('K04.01 - Reversible pulpitis\nK04.02 - Irreversible pulpitis\nK02.9 - Dental caries, unspecified [Tooth #36]\nK02.9 - Dental caries, unspecified [Tooth #16]');
    expect(diagnoses.map((dx) => [dx.code, dx.tooth_number])).toEqual([['K04.01', null], ['K04.02', null], ['K02.9', 36], ['K02.9', 16]]);
  });
});

describe('Phase 8 service and medication prioritization helpers', () => {
  it('identifies dental imaging services correctly', () => {
    expect(isDentalImagingService({ name: 'IOPA X-Ray (Periapical)' })).toBe(true);
    expect(isDentalImagingService({ name: 'Dental OPG Panoramic' })).toBe(true);
    expect(isDentalImagingService({ name: 'CBCT Maxillofacial' })).toBe(true);
    expect(isDentalImagingService({ name: 'Bitewing Radiograph' })).toBe(true);
    expect(isDentalImagingService({ name: 'Chest X-Ray PA View' })).toBe(false);
    expect(isDentalImagingService({ name: 'MRI Brain' })).toBe(false);
  });

  it('identifies dental relevant lab services correctly', () => {
    expect(isDentalLabService({ name: 'Complete Blood Count (CBC)' })).toBe(true);
    expect(isDentalLabService({ name: 'Prothrombin Time (PT/INR)' })).toBe(true);
    expect(isDentalLabService({ name: 'Bleeding Time & Clotting Time (BT/CT)' })).toBe(true);
    expect(isDentalLabService({ name: 'Random Blood Glucose (RBS)' })).toBe(true);
    expect(isDentalLabService({ name: 'Oral Biopsy Histopathology' })).toBe(true);
    expect(isDentalLabService({ name: 'Serum Electrolytes' })).toBe(false);
    expect(isDentalLabService({ name: 'Lipid Profile' })).toBe(false);
  });

  it('identifies dental relevant medications correctly', () => {
    expect(isDentalMedication({ name: 'Amoxicillin 500mg' })).toBe(true);
    expect(isDentalMedication({ name: 'Augmentin (Amoxicillin + Clavulanate)' })).toBe(true);
    expect(isDentalMedication({ name: 'Metronidazole 400mg' })).toBe(true);
    expect(isDentalMedication({ name: 'Ibuprofen 400mg' })).toBe(true);
    expect(isDentalMedication({ name: 'Chlorhexidine 0.2% Mouthwash' })).toBe(true);
    expect(isDentalMedication({ name: 'Clotrimazole Oral Gel' })).toBe(true);
    expect(isDentalMedication({ name: 'Atorvastatin 20mg' })).toBe(false);
    expect(isDentalMedication({ name: 'Metformin 500mg' })).toBe(false);
  });
});

describe('Dental History & Medical Risk Assessment predefined options', () => {
  it('contains ONLY clinically approved dental & oral habits and removes minor ones', () => {
    expect(COMMON_DENTAL_HABITS).toEqual([
      'Smoking / Tobacco',
      'Betel Nut / Tobacco Chewing',
      'Alcohol Consumption',
      'Bruxism / Teeth Clenching',
      'Mouth Breathing',
    ]);
    expect(COMMON_DENTAL_HABITS).not.toContain('Nail Biting');
    expect(COMMON_DENTAL_HABITS).not.toContain('Thumb Sucking');
    expect(COMMON_DENTAL_HABITS).not.toContain('Tongue Thrusting');
  });

  it('organizes medical alerts into the three designated clinical categories', () => {
    expect(COMMON_MEDICAL_ALERTS_GROUPED).toHaveLength(3);
    expect(COMMON_MEDICAL_ALERTS_GROUPED.map((g) => g.category)).toEqual([
      'Medical Conditions',
      'Bleeding / Medication Risks',
      'Allergies',
    ]);

    expect(DENTAL_MEDICAL_CONDITIONS).toEqual([
      'Hypertension',
      'Diabetes Mellitus',
      'Asthma / Respiratory Disease',
      'Heart Disease',
      'Cardiac Pacemaker',
      'Epilepsy / Seizure Disorder',
      'Hepatitis / Liver Disease',
      'Pregnancy / Nursing',
    ]);

    expect(DENTAL_BLEEDING_MEDICATION_RISKS).toEqual([
      'Bleeding Disorder',
      'Anticoagulant Therapy',
      'Steroid / Immunosuppressant Therapy',
      'Bisphosphonate Therapy (Osteonecrosis Risk)',
      'Infective Endocarditis Risk / Premedication Required',
    ]);

    expect(DENTAL_ALLERGIES).toEqual([
      'Allergy to Penicillin',
      'Allergy to Local Anesthetics',
      'Allergy to Latex',
    ]);
  });

  it('splits combined conditions into separate options and eliminates legacy combined values', () => {
    // Verified split values are present
    expect(COMMON_MEDICAL_ALERTS).toContain('Bleeding Disorder');
    expect(COMMON_MEDICAL_ALERTS).toContain('Anticoagulant Therapy');
    expect(COMMON_MEDICAL_ALERTS).toContain('Heart Disease');
    expect(COMMON_MEDICAL_ALERTS).toContain('Cardiac Pacemaker');

    // Legacy combined values must NOT be present in predefined options
    expect(COMMON_MEDICAL_ALERTS).not.toContain('Bleeding Disorder / Anticoagulant Therapy');
    expect(COMMON_MEDICAL_ALERTS).not.toContain('Cardiac Pacemaker / Heart Disease');
  });

  it('keeps COMMON_MEDICAL_ALERTS completely aligned with grouped categories', () => {
    const expected = [
      ...DENTAL_MEDICAL_CONDITIONS,
      ...DENTAL_BLEEDING_MEDICATION_RISKS,
      ...DENTAL_ALLERGIES,
    ];
    expect(COMMON_MEDICAL_ALERTS).toEqual(expected);
    expect(COMMON_MEDICAL_ALERTS).toHaveLength(16);
  });
});

describe('Dental Tooth Status and Clinical Conditions constants', () => {
  it('TOOTH_STATUSES contains ONLY presence/absence values (Present and Missing)', () => {
    expect(TOOTH_STATUSES).toEqual([
      { value: 'PRESENT', label: 'Present' },
      { value: 'MISSING', label: 'Missing' },
    ]);
  });

  it('STANDARD_CONDITIONS contains the 9 approved clinical conditions and excludes Missing', () => {
    const conditionIds = STANDARD_CONDITIONS.map((c) => c.id);
    expect(conditionIds).toEqual([
      'HEALTHY',
      'CARIOUS',
      'FILLED',
      'CROWN',
      'ROOT_PIECE',
      'IMPACTED',
      'FRACTURED',
      'PULPITIC',
      'PERIAPICAL_LESION',
    ]);

    expect(conditionIds).not.toContain('MISSING');

    const conditionLabels = STANDARD_CONDITIONS.map((c) => c.label);
    expect(conditionLabels).toEqual([
      'Healthy',
      'Caries / Decay',
      'Filled / Restored',
      'Crown / Cap',
      'Root Piece',
      'Impacted',
      'Fractured',
      'Pulpitis / RCT Needed',
      'Periapical Lesion',
    ]);
    expect(conditionLabels).not.toContain('Missing');
  });
});

describe('Age-based dentition classification', () => {
  describe('getPatientAgeInYears', () => {
    it('calculates exact completed years correctly for adult and pediatric birthdates', () => {
      const today = new Date();
      // 36 years ago
      const birth36 = new Date(today.getFullYear() - 36, today.getMonth(), today.getDate() - 1);
      expect(getPatientAgeInYears(birth36.toISOString())).toBe(36);

      // 7 years ago
      const birth7 = new Date(today.getFullYear() - 7, today.getMonth(), today.getDate() - 1);
      expect(getPatientAgeInYears(birth7.toISOString())).toBe(7);
    });

    it('accounts for upcoming birthday in the current calendar year', () => {
      const today = new Date();
      // Birthday is next month (has not occurred yet this year)
      const futureMonthBirth = new Date(today.getFullYear() - 10, today.getMonth() + 1, 15);
      expect(getPatientAgeInYears(futureMonthBirth.toISOString())).toBe(9);
    });

    it('returns null for missing, invalid, or future dates of birth without guessing', () => {
      expect(getPatientAgeInYears(null)).toBeNull();
      expect(getPatientAgeInYears(undefined)).toBeNull();
      expect(getPatientAgeInYears('')).toBeNull();
      expect(getPatientAgeInYears('invalid-date-string')).toBeNull();

      // Future date
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      expect(getPatientAgeInYears(futureDate)).toBeNull();
    });
  });

  describe('getDefaultDentitionForAge and clinical threshold', () => {
    it('uses 12 years as the clinical pedodontic dentition threshold', () => {
      expect(PEDIATRIC_DENTITION_AGE_THRESHOLD).toBe(12);
    });

    it('classifies age < 12 as PRIMARY (Pediatric / Deciduous)', () => {
      expect(getDefaultDentitionForAge(0)).toBe('PRIMARY');
      expect(getDefaultDentitionForAge(4)).toBe('PRIMARY');
      expect(getDefaultDentitionForAge(7)).toBe('PRIMARY');
      expect(getDefaultDentitionForAge(8)).toBe('PRIMARY');
      expect(getDefaultDentitionForAge(11)).toBe('PRIMARY');
    });

    it('classifies age >= 12 as PERMANENT (Adult)', () => {
      expect(getDefaultDentitionForAge(12)).toBe('PERMANENT');
      expect(getDefaultDentitionForAge(13)).toBe('PERMANENT');
      expect(getDefaultDentitionForAge(18)).toBe('PERMANENT');
      expect(getDefaultDentitionForAge(36)).toBe('PERMANENT');
      expect(getDefaultDentitionForAge(75)).toBe('PERMANENT');
    });

    it('defaults safely to PERMANENT when age is null/unavailable without guessing', () => {
      expect(getDefaultDentitionForAge(null)).toBe('PERMANENT');
    });
  });

  describe('resolveInitialDentition', () => {
    it('resolves age-based default when no completed teeth exist', () => {
      const today = new Date();
      const birth36 = new Date(today.getFullYear() - 36, today.getMonth(), today.getDate()).toISOString();
      expect(resolveInitialDentition({ dateOfBirth: birth36 })).toBe('PERMANENT');

      const birth7 = new Date(today.getFullYear() - 7, today.getMonth(), today.getDate()).toISOString();
      expect(resolveInitialDentition({ dateOfBirth: birth7 })).toBe('PRIMARY');
    });

    it('preserves existing recorded primary teeth when reopening a completed exam', () => {
      const today = new Date();
      const birth36 = new Date(today.getFullYear() - 36, today.getMonth(), today.getDate()).toISOString();
      // Patient is 36, but completed exam has primary teeth recorded (e.g. retained deciduous tooth 55)
      const result = resolveInitialDentition({
        dateOfBirth: birth36,
        isCompleted: true,
        existingTeeth: [
          {
            tooth_number: 55,
            dentition: 'PRIMARY',
            status: 'PRESENT',
            conditions: ['CARIOUS'],
            surfaces: ['OCCLUSAL'],
          },
        ],
      });
      expect(result).toBe('PRIMARY');
    });

    it('preserves existing recorded permanent teeth when reopening a completed exam', () => {
      const today = new Date();
      const birth8 = new Date(today.getFullYear() - 8, today.getMonth(), today.getDate()).toISOString();
      // Patient is 8, but completed exam recorded permanent first molars (tooth 16)
      const result = resolveInitialDentition({
        dateOfBirth: birth8,
        isCompleted: true,
        existingTeeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            conditions: ['FILLED'],
            surfaces: ['OCCLUSAL'],
          },
        ],
      });
      expect(result).toBe('PERMANENT');
    });
  });
});


