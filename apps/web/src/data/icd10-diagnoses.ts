export type Icd10Diagnosis = {
  code: string;
  name: string;
  category: string;
};

export const ICD10_DIAGNOSES: Icd10Diagnosis[] = [
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
