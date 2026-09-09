import { ICD10_DIAGNOSES, type Icd10Diagnosis } from '../data/icd10-diagnoses';
import type { DepartmentResponse } from '../api/departments';
import type {
  DentitionType,
  OpdVisitResponse,
  ToothMobility,
  ToothStatus,
  ToothSurface,
} from '../api/opd';

export const DENTAL_KEYWORDS_REGEX =
  /dental|dentist|dentistry|orthodont|endodont|periodont|pedodont|prosthodont|oral/i;

export function isDentalVisit(
  visit: OpdVisitResponse | null | undefined,
  departments: DepartmentResponse[] = [],
): boolean {
  if (!visit) return false;

  if (
    visit.doctor_specialization &&
    DENTAL_KEYWORDS_REGEX.test(visit.doctor_specialization)
  ) {
    return true;
  }

  const dept = departments.find((d) => d.id === visit.department_id);
  if (dept) {
    if (
      DENTAL_KEYWORDS_REGEX.test(dept.name) ||
      DENTAL_KEYWORDS_REGEX.test(dept.code) ||
      dept.code.toUpperCase().includes('DENT')
    ) {
      return true;
    }
  }

  return false;
}

export const isPermanentFdiTooth = (num: number): boolean => {
  if (!Number.isInteger(num)) return false;
  const quadrant = Math.floor(num / 10);
  const tooth = num % 10;
  return quadrant >= 1 && quadrant <= 4 && tooth >= 1 && tooth <= 8;
};

export const isPrimaryFdiTooth = (num: number): boolean => {
  if (!Number.isInteger(num)) return false;
  const quadrant = Math.floor(num / 10);
  const tooth = num % 10;
  return quadrant >= 5 && quadrant <= 8 && tooth >= 1 && tooth <= 5;
};

export const isValidFdiTooth = (num: number): boolean => {
  return isPermanentFdiTooth(num) || isPrimaryFdiTooth(num);
};

export const PERMANENT_QUADRANTS = {
  Q1_UPPER_RIGHT: [18, 17, 16, 15, 14, 13, 12, 11],
  Q2_UPPER_LEFT: [21, 22, 23, 24, 25, 26, 27, 28],
  Q4_LOWER_RIGHT: [48, 47, 46, 45, 44, 43, 42, 41],
  Q3_LOWER_LEFT: [31, 32, 33, 34, 35, 36, 37, 38],
} as const;

export const PRIMARY_QUADRANTS = {
  Q5_UPPER_RIGHT: [55, 54, 53, 52, 51],
  Q6_UPPER_LEFT: [61, 62, 63, 64, 65],
  Q8_LOWER_RIGHT: [85, 84, 83, 82, 81],
  Q7_LOWER_LEFT: [71, 72, 73, 74, 75],
} as const;

export const TOOTH_NAMES: Record<number, string> = {
  // Permanent Upper Right (11-18)
  11: 'Maxillary Right Central Incisor',
  12: 'Maxillary Right Lateral Incisor',
  13: 'Maxillary Right Canine',
  14: 'Maxillary Right First Premolar',
  15: 'Maxillary Right Second Premolar',
  16: 'Maxillary Right First Molar',
  17: 'Maxillary Right Second Molar',
  18: 'Maxillary Right Third Molar (Wisdom)',

  // Permanent Upper Left (21-28)
  21: 'Maxillary Left Central Incisor',
  22: 'Maxillary Left Lateral Incisor',
  23: 'Maxillary Left Canine',
  24: 'Maxillary Left First Premolar',
  25: 'Maxillary Left Second Premolar',
  26: 'Maxillary Left First Molar',
  27: 'Maxillary Left Second Molar',
  28: 'Maxillary Left Third Molar (Wisdom)',

  // Permanent Lower Left (31-38)
  31: 'Mandibular Left Central Incisor',
  32: 'Mandibular Left Lateral Incisor',
  33: 'Mandibular Left Canine',
  34: 'Mandibular Left First Premolar',
  35: 'Mandibular Left Second Premolar',
  36: 'Mandibular Left First Molar',
  37: 'Mandibular Left Second Molar',
  38: 'Mandibular Left Third Molar (Wisdom)',

  // Permanent Lower Right (41-48)
  41: 'Mandibular Right Central Incisor',
  42: 'Mandibular Right Lateral Incisor',
  43: 'Mandibular Right Canine',
  44: 'Mandibular Right First Premolar',
  45: 'Mandibular Right Second Premolar',
  46: 'Mandibular Right First Molar',
  47: 'Mandibular Right Second Molar',
  48: 'Mandibular Right Third Molar (Wisdom)',

  // Primary Upper Right (51-55)
  51: 'Primary Maxillary Right Central Incisor',
  52: 'Primary Maxillary Right Lateral Incisor',
  53: 'Primary Maxillary Right Canine',
  54: 'Primary Maxillary Right First Molar',
  55: 'Primary Maxillary Right Second Molar',

  // Primary Upper Left (61-65)
  61: 'Primary Maxillary Left Central Incisor',
  62: 'Primary Maxillary Left Lateral Incisor',
  63: 'Primary Maxillary Left Canine',
  64: 'Primary Maxillary Left First Molar',
  65: 'Primary Maxillary Left Second Molar',

  // Primary Lower Left (71-75)
  71: 'Primary Mandibular Left Central Incisor',
  72: 'Primary Mandibular Left Lateral Incisor',
  73: 'Primary Mandibular Left Canine',
  74: 'Primary Mandibular Left First Molar',
  75: 'Primary Mandibular Left Second Molar',

  // Primary Lower Right (81-85)
  81: 'Primary Mandibular Right Central Incisor',
  82: 'Primary Mandibular Right Lateral Incisor',
  83: 'Primary Mandibular Right Canine',
  84: 'Primary Mandibular Right First Molar',
  85: 'Primary Mandibular Right Second Molar',
};

export function getToothName(toothNumber: number): string {
  return TOOTH_NAMES[toothNumber] ?? `Tooth ${toothNumber}`;
}

export function isAnteriorTooth(toothNumber: number): boolean {
  const tooth = toothNumber % 10;
  return tooth >= 1 && tooth <= 3;
}

export function isUpperArch(toothNumber: number): boolean {
  const quadrant = Math.floor(toothNumber / 10);
  return quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;
}

export function getDentition(toothNumber: number): DentitionType {
  const quadrant = Math.floor(toothNumber / 10);
  return quadrant >= 5 ? 'PRIMARY' : 'PERMANENT';
}

export type ToothConditionOption = {
  id: string;
  label: string;
  color: string;
  badgeBg: string;
  description: string;
};

export const STANDARD_CONDITIONS: ToothConditionOption[] = [
  { id: 'HEALTHY', label: 'Healthy', color: '#16a34a', badgeBg: '#dcfce7', description: 'Intact, normal tooth structure' },
  { id: 'CARIOUS', label: 'Caries / Decay', color: '#dc2626', badgeBg: '#fee2e2', description: 'Active dental caries' },
  { id: 'FILLED', label: 'Filled / Restored', color: '#2563eb', badgeBg: '#dbeafe', description: 'Composite/GIC/Amalgam restoration' },
  { id: 'CROWN', label: 'Crown / Cap', color: '#d97706', badgeBg: '#fef3c7', description: 'Full coverage crown or prosthetic' },
  { id: 'ROOT_PIECE', label: 'Root Piece', color: '#9333ea', badgeBg: '#f3e8ff', description: 'Retained gross root / fractured crown' },
  { id: 'IMPACTED', label: 'Impacted', color: '#ea580c', badgeBg: '#ffedd5', description: 'Unerupted or partially impacted tooth' },
  { id: 'FRACTURED', label: 'Fractured', color: '#b91c1c', badgeBg: '#fecaca', description: 'Enamel/dentin fracture' },
  { id: 'PULPITIC', label: 'Pulpitis / RCT Needed', color: '#be123c', badgeBg: '#ffe4e6', description: 'Pulpal inflammation or non-vital' },
  { id: 'PERIAPICAL_LESION', label: 'Periapical Lesion', color: '#991b1b', badgeBg: '#fee2e2', description: 'Apical abscess / cyst / granuloma' },
  { id: 'MISSING', label: 'Missing', color: '#64748b', badgeBg: '#f1f5f9', description: 'Congenitally absent or lost' },
];

export const TOOTH_STATUSES: { value: ToothStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'IMPACTED', label: 'Impacted' },
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'UNERUPTED', label: 'Unerupted' },
];

export const TOOTH_SURFACES: { value: ToothSurface; label: string; short: string; desc: string }[] = [
  { value: 'OCCLUSAL', label: 'Occlusal / Incisal', short: 'O', desc: 'Biting surface' },
  { value: 'MESIAL', label: 'Mesial', short: 'M', desc: 'Towards midline' },
  { value: 'DISTAL', label: 'Distal', short: 'D', desc: 'Away from midline' },
  { value: 'BUCCAL', label: 'Buccal / Labial', short: 'B', desc: 'Cheek/lip side' },
  { value: 'LINGUAL', label: 'Lingual / Palatal', short: 'L', desc: 'Tongue/palate side' },
];

export const MOBILITY_LEVELS: { value: ToothMobility; label: string; desc: string }[] = [
  { value: 'NONE', label: 'Normal / None', desc: 'Physiological mobility' },
  { value: 'GRADE_I', label: 'Grade I', desc: 'Slightly greater than physiological (< 1mm horizontal)' },
  { value: 'GRADE_II', label: 'Grade II', desc: 'Moderately increased (1-2mm horizontal)' },
  { value: 'GRADE_III', label: 'Grade III', desc: 'Severe (> 2mm horizontal and/or vertical depression)' },
];

export const COMMON_MEDICAL_ALERTS = [
  'Hypertension',
  'Diabetes Mellitus',
  'Bleeding Disorder / Anticoagulant Therapy',
  'Allergy to Penicillin',
  'Allergy to Local Anesthetics',
  'Allergy to Latex',
  'Asthma / Respiratory Disease',
  'Cardiac Pacemaker / Heart Disease',
  'Infective Endocarditis Risk / Premedication Required',
  'Pregnancy / Nursing',
  'Hepatitis / Liver Disease',
  'Epilepsy / Seizure Disorder',
  'Steroid / Immunosuppressant Therapy',
  'Bisphosphonate Therapy (Osteonecrosis Risk)',
];

export const COMMON_DENTAL_HABITS = [
  'Smoking / Tobacco',
  'Betel Nut / Tobacco Chewing',
  'Alcohol Consumption',
  'Bruxism / Teeth Clenching',
  'Nail Biting',
  'Mouth Breathing',
  'Thumb Sucking',
  'Tongue Thrusting',
];

export const SOFT_TISSUE_OPTIONS = {
  gingiva: [
    'Normal (Pink, firm, stippled)',
    'Mild Marginal Gingivitis',
    'Moderate Gingivitis (Edematous, bleeding)',
    'Severe Gingivitis',
    'Generalized Chronic Periodontitis',
    'Gingival Enlargement / Hyperplasia',
    'Acute Necrotizing Ulcerative Gingivitis (ANUG)',
  ],
  calculusPlaque: [
    'Nil / Good Oral Hygiene',
    'Mild (Supragingival)',
    'Moderate (Supra & subgingival)',
    'Severe (Heavy deposits, stain)',
  ],
  oralMucosa: [
    'Normal',
    'Aphthous Ulcer',
    'Traumatic Ulcer',
    'Leukoplakia',
    'Lichen Planus',
    'Oral Submucous Fibrosis (OSMF)',
    'Candidiasis / Thrush',
    'Hyperpigmentation',
  ],
  tonguePalate: [
    'Normal',
    'Coated Tongue',
    'Geographic Tongue',
    'Macroglossia',
    'Ankyloglossia (Tongue-tie)',
    'High Arched Palate',
    'Torus Palatinus',
    'Torus Mandibularis',
    'Cleft Lip / Palate',
  ],
  tmj: [
    'Normal / Asymptomatic',
    'Clicking / Popping (Right)',
    'Clicking / Popping (Left)',
    'Bilateral TMJ Clicking',
    'Pain / Tenderness on Palpation',
    'Deviation to Right on Opening',
    'Deviation to Left on Opening',
    'Trismus / Limited Mouth Opening (< 35mm)',
    'Subluxation / Dislocation History',
  ],
  occlusion: [
    'Class I (Normal Molar Relationship)',
    'Class II Division 1 (Increased Overjet)',
    'Class II Division 2 (Retroclined Incisors)',
    'Class III (Prognathic / Edge-to-Edge)',
    'Anterior Crossbite',
    'Posterior Crossbite (Unilateral/Bilateral)',
    'Anterior Open Bite',
    'Deep Bite (Severe Overbite)',
  ],
};

export const COMMON_DENTAL_PROCEDURES = [
  'Composite Restoration',
  'Glass Ionomer Cement (GIC) Restoration',
  'Root Canal Treatment (RCT)',
  'Re-RCT',
  'Simple Dental Extraction',
  'Surgical Extraction / Disimpaction',
  'Scaling & Polishing (Prophylaxis)',
  'Deep Subgingival Scaling & Root Planing',
  'Crown & Bridge Prosthesis (PFM / Zirconia)',
  'Post & Core Build-up',
  'Dental Implant Placement',
  'Complete Denture (Maxillary / Mandibular)',
  'Removable Partial Denture',
  'Topical Fluoride Application',
  'Pit & Fissure Sealant',
  'Incisional / Excisional Biopsy',
  'Operculectomy',
  'Gingivectomy',
  'Orthodontic Consultation / Appliance',
];

export function getPainScaleInfo(scale: number | null | undefined): {
  label: string;
  color: string;
  badgeBg: string;
} {
  if (scale === null || scale === undefined) {
    return { label: 'Not Recorded', color: '#64748b', badgeBg: '#f1f5f9' };
  }
  if (scale === 0) return { label: '0 — No Pain', color: '#16a34a', badgeBg: '#dcfce7' };
  if (scale <= 3) return { label: `${scale} — Mild Pain`, color: '#ca8a04', badgeBg: '#fef9c3' };
  if (scale <= 6) return { label: `${scale} — Moderate Pain`, color: '#ea580c', badgeBg: '#ffedd5' };
  return { label: `${scale} — Severe Pain`, color: '#dc2626', badgeBg: '#fee2e2' };
}


export function parseDentalDiagnoses(assessment: string): Icd10Diagnosis[] {
    const lines = assessment.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedDiagnoses: Icd10Diagnosis[] = [];

    for (const line of lines) {
      const toothMatch = line.match(/\[Tooth #(\d+)\]/i);
      const toothNum = toothMatch && toothMatch[1] ? parseInt(toothMatch[1], 10) : null;
      const cleanLine = line.replace(/\[Tooth #\d+\]/i, '').trim();

      const exactCode = cleanLine.split(/\s+/)[0]?.toLowerCase();
      const matched = ICD10_DIAGNOSES.find((diagnosis) => diagnosis.code.toLowerCase() === exactCode) ?? ICD10_DIAGNOSES.find(
        (diagnosis) =>
          cleanLine.toLowerCase().startsWith(diagnosis.code.toLowerCase()) ||
          cleanLine.toLowerCase().includes(diagnosis.name.toLowerCase()) ||
          cleanLine.toLowerCase().includes(diagnosis.code.toLowerCase()),
      );

      if (matched) {
        parsedDiagnoses.push({
          ...matched,
          tooth_number: toothNum,
        });
      } else if (cleanLine.length > 0) {
        const dashIdx = cleanLine.indexOf(' - ');
        let code = `DX-${parsedDiagnoses.length + 1}`;
        let name = cleanLine;
        if (dashIdx > 0) {
          code = cleanLine.slice(0, dashIdx).trim();
          name = cleanLine.slice(dashIdx + 3).trim();
        }
        parsedDiagnoses.push({
          code,
          name,
          category: 'Clinical Diagnosis',
          tooth_number: toothNum,
        });
      }
    }

  return parsedDiagnoses;
}
