export type Icd10Diagnosis = {
  code: string;
  name: string;
  category: string;
  tooth_number?: number | null;
  is_primary?: boolean;
  notes?: string | null;
};

export function isDentalIcd10(code: string): boolean {
  return /^K0[0-8]|^K1[2-4]/i.test(code.trim());
}

export const ICD10_DIAGNOSES: Icd10Diagnosis[] = [
  // Dental & Oral Health (ICD-10 K00–K14)
  { code: 'K02.9', name: 'Dental caries, unspecified', category: 'Dental & Oral Health' },
  { code: 'K02.51', name: 'Dental caries on pit and fissure surface penetrating into dentin', category: 'Dental & Oral Health' },
  { code: 'K02.61', name: 'Dental caries on smooth surface penetrating into dentin', category: 'Dental & Oral Health' },
  { code: 'K02.3', name: 'Arrested dental caries', category: 'Dental & Oral Health' },
  { code: 'K04.01', name: 'Reversible pulpitis', category: 'Dental & Oral Health' },
  { code: 'K04.02', name: 'Irreversible pulpitis', category: 'Dental & Oral Health' },
  { code: 'K04.1', name: 'Necrosis of pulp (Non-vital tooth)', category: 'Dental & Oral Health' },
  { code: 'K04.4', name: 'Acute apical periodontitis of pulpal origin', category: 'Dental & Oral Health' },
  { code: 'K04.5', name: 'Chronic apical periodontitis (Periapical granuloma)', category: 'Dental & Oral Health' },
  { code: 'K04.7', name: 'Periapical abscess without sinus', category: 'Dental & Oral Health' },
  { code: 'K04.6', name: 'Periapical abscess with sinus', category: 'Dental & Oral Health' },
  { code: 'K05.00', name: 'Acute gingivitis, plaque induced', category: 'Dental & Oral Health' },
  { code: 'K05.10', name: 'Chronic gingivitis, plaque induced', category: 'Dental & Oral Health' },
  { code: 'K05.20', name: 'Aggressive periodontitis, unspecified', category: 'Dental & Oral Health' },
  { code: 'K05.30', name: 'Chronic periodontitis, unspecified', category: 'Dental & Oral Health' },
  { code: 'K05.311', name: 'Chronic periodontitis, localized, slight', category: 'Dental & Oral Health' },
  { code: 'K05.312', name: 'Chronic periodontitis, localized, moderate', category: 'Dental & Oral Health' },
  { code: 'K05.313', name: 'Chronic periodontitis, localized, severe', category: 'Dental & Oral Health' },
  { code: 'K05.321', name: 'Chronic periodontitis, generalized, slight', category: 'Dental & Oral Health' },
  { code: 'K05.322', name: 'Chronic periodontitis, generalized, moderate', category: 'Dental & Oral Health' },
  { code: 'K05.323', name: 'Chronic periodontitis, generalized, severe', category: 'Dental & Oral Health' },
  { code: 'K03.0', name: 'Excessive attrition of teeth', category: 'Dental & Oral Health' },
  { code: 'K03.1', name: 'Abrasion of teeth (Cervical / Wedge defect)', category: 'Dental & Oral Health' },
  { code: 'K03.2', name: 'Erosion of teeth (Acid erosion)', category: 'Dental & Oral Health' },
  { code: 'K03.81', name: 'Cracked tooth / Enamel infraction', category: 'Dental & Oral Health' },
  { code: 'K01.1', name: 'Impacted teeth (Third molar / Canine)', category: 'Dental & Oral Health' },
  { code: 'K00.6', name: 'Disturbances in tooth eruption (Delayed / Premature)', category: 'Dental & Oral Health' },
  { code: 'K00.0', name: 'Anodontia / Hypodontia (Congenitally missing teeth)', category: 'Dental & Oral Health' },
  { code: 'K06.0', name: 'Gingival recession (Localized / Generalized)', category: 'Dental & Oral Health' },
  { code: 'K06.1', name: 'Gingival enlargement / Hyperplasia', category: 'Dental & Oral Health' },
  { code: 'K07.20', name: 'Malocclusion, unspecified', category: 'Dental & Oral Health' },
  { code: 'K07.21', name: "Angle's Class I malocclusion (Crowding / Spacing)", category: 'Dental & Oral Health' },
  { code: 'K07.22', name: "Angle's Class II malocclusion (Overjet / Distocclusion)", category: 'Dental & Oral Health' },
  { code: 'K07.23', name: "Angle's Class III malocclusion (Prognathism / Mesiocclusion)", category: 'Dental & Oral Health' },
  { code: 'K07.60', name: 'Temporomandibular joint disorder (TMJ), unspecified', category: 'Dental & Oral Health' },
  { code: 'K08.3', name: 'Retained dental root (Gross root piece)', category: 'Dental & Oral Health' },
  { code: 'K08.10', name: 'Complete loss of teeth, unspecified cause', category: 'Dental & Oral Health' },
  { code: 'K08.409', name: 'Partial loss of teeth, unspecified cause', category: 'Dental & Oral Health' },
  { code: 'K12.0', name: 'Recurrent aphthous stomatitis (Canker sores)', category: 'Dental & Oral Health' },
  { code: 'K12.1', name: 'Other forms of stomatitis / Oral mucositis', category: 'Dental & Oral Health' },
  { code: 'K13.0', name: 'Diseases of lips (Cheilitis / Angular cheilitis)', category: 'Dental & Oral Health' },
  { code: 'K13.21', name: 'Leukoplakia of oral mucosa', category: 'Dental & Oral Health' },
  { code: 'K13.22', name: 'Oral submucous fibrosis (OSMF)', category: 'Dental & Oral Health' },
  { code: 'K14.0', name: 'Glossitis', category: 'Dental & Oral Health' },
  { code: 'K14.1', name: 'Geographic tongue', category: 'Dental & Oral Health' },
  // Gastroenterology
  { code: 'K21.9', name: 'Gastro-esophageal reflux disease without esophagitis', category: 'Gastroenterology' },
  { code: 'K21.0', name: 'Gastro-esophageal reflux disease with esophagitis', category: 'Gastroenterology' },
  { code: 'K29.70', name: 'Gastritis, unspecified, without bleeding', category: 'Gastroenterology' },
  { code: 'K25.9', name: 'Gastric ulcer, unspecified as acute or chronic, without hemorrhage or perforation', category: 'Gastroenterology' },
  { code: 'K58.9', name: 'Irritable bowel syndrome without diarrhea', category: 'Gastroenterology' },
  { code: 'K58.0', name: 'Irritable bowel syndrome with diarrhea', category: 'Gastroenterology' },
  { code: 'K59.00', name: 'Constipation, unspecified', category: 'Gastroenterology' },
  { code: 'A09', name: 'Infectious gastroenteritis and colitis, unspecified', category: 'Gastroenterology' },
  { code: 'K80.20', name: 'Calculus of gallbladder without cholecystitis without obstruction', category: 'Gastroenterology' },

  // Musculoskeletal
  { code: 'M54.5', name: 'Low back pain', category: 'Musculoskeletal' },
  { code: 'M54.2', name: 'Cervicalgia (Neck pain)', category: 'Musculoskeletal' },
  { code: 'M25.561', name: 'Pain in right knee', category: 'Musculoskeletal' },
  { code: 'M25.562', name: 'Pain in left knee', category: 'Musculoskeletal' },
  { code: 'M17.9', name: 'Osteoarthritis of knee, unspecified', category: 'Musculoskeletal' },
  { code: 'M19.90', name: 'Primary osteoarthritis, unspecified site', category: 'Musculoskeletal' },
  { code: 'M79.1', name: 'Myalgia', category: 'Musculoskeletal' },
  { code: 'M77.9', name: 'Enthesopathy, unspecified', category: 'Musculoskeletal' },
  { code: 'M62.838', name: 'Other muscle spasm', category: 'Musculoskeletal' },

  // Neurology & Headache
  { code: 'R51.9', name: 'Headache, unspecified', category: 'Neurology' },
  { code: 'G43.909', name: 'Migraine, unspecified, not intractable, without status migrainosus', category: 'Neurology' },
  { code: 'G44.209', name: 'Tension-type headache, unspecified, not intractable', category: 'Neurology' },
  { code: 'R42', name: 'Dizziness and giddiness (Vertigo)', category: 'Neurology' },
  { code: 'G47.00', name: 'Insomnia, unspecified', category: 'Neurology' },

  // Respiratory
  { code: 'J45.909', name: 'Unspecified asthma, uncomplicated', category: 'Respiratory' },
  { code: 'J45.40', name: 'Moderate persistent asthma, uncomplicated', category: 'Respiratory' },
  { code: 'J06.9', name: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'J20.9', name: 'Acute bronchitis, unspecified', category: 'Respiratory' },
  { code: 'J30.9', name: 'Allergic rhinitis, unspecified', category: 'Respiratory' },
  { code: 'J01.90', name: 'Acute sinusitis, unspecified', category: 'Respiratory' },
  { code: 'J02.9', name: 'Acute pharyngitis, unspecified', category: 'Respiratory' },
  { code: 'J18.9', name: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'J44.9', name: 'Chronic obstructive pulmonary disease, unspecified', category: 'Respiratory' },

  // Cardiovascular
  { code: 'I10', name: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  { code: 'I11.9', name: 'Hypertensive heart disease without heart failure', category: 'Cardiovascular' },
  { code: 'I25.10', name: 'Atherosclerotic heart disease of native coronary artery', category: 'Cardiovascular' },
  { code: 'I20.9', name: 'Angina pectoris, unspecified', category: 'Cardiovascular' },
  { code: 'I48.91', name: 'Unspecified atrial fibrillation', category: 'Cardiovascular' },
  { code: 'R00.0', name: 'Tachycardia, unspecified', category: 'Cardiovascular' },
  { code: 'R07.9', name: 'Chest pain, unspecified', category: 'Cardiovascular' },
  { code: 'I50.9', name: 'Heart failure, unspecified', category: 'Cardiovascular' },

  // Endocrinology & Metabolic
  { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', category: 'Endocrinology' },
  { code: 'E11.65', name: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrinology' },
  { code: 'E10.9', name: 'Type 1 diabetes mellitus without complications', category: 'Endocrinology' },
  { code: 'E78.5', name: 'Hyperlipidemia, unspecified', category: 'Endocrinology' },
  { code: 'E03.9', name: 'Hypothyroidism, unspecified', category: 'Endocrinology' },
  { code: 'E05.90', name: 'Thyrotoxicosis without goiter, unspecified', category: 'Endocrinology' },
  { code: 'E66.9', name: 'Obesity, unspecified', category: 'Endocrinology' },
  { code: 'E86.0', name: 'Dehydration', category: 'Endocrinology' },

  // Nephrology & Urology
  { code: 'N39.0', name: 'Urinary tract infection, site not specified', category: 'Urology' },
  { code: 'N20.0', name: 'Calculus of kidney', category: 'Urology' },
  { code: 'N40.0', name: 'Benign prostatic hyperplasia without lower urinary tract symptoms', category: 'Urology' },
  { code: 'N18.9', name: 'Chronic kidney disease, unspecified', category: 'Nephrology' },

  // Dermatology
  { code: 'L20.9', name: 'Atopic dermatitis, unspecified', category: 'Dermatology' },
  { code: 'L30.9', name: 'Dermatitis, unspecified', category: 'Dermatology' },
  { code: 'L50.9', name: 'Urticaria, unspecified', category: 'Dermatology' },
  { code: 'L70.0', name: 'Acne vulgaris', category: 'Dermatology' },
  { code: 'B35.9', name: 'Dermatophytosis, unspecified (Fungal infection)', category: 'Dermatology' },

  // General & Systemic
  { code: 'R50.9', name: 'Fever, unspecified', category: 'General' },
  { code: 'R53.83', name: 'Other fatigue', category: 'General' },
  { code: 'D50.9', name: 'Iron deficiency anemia, unspecified', category: 'Hematology' },
  { code: 'D64.9', name: 'Anemia, unspecified', category: 'Hematology' },
  { code: 'F41.9', name: 'Anxiety disorder, unspecified', category: 'Psychiatry' },
  { code: 'F32.9', name: 'Major depressive disorder, single episode, unspecified', category: 'Psychiatry' },
];
