import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

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

export const opdDentalVisitParamsSchema = z.object({
  visitId: id,
});

export const dentitionTypeSchema = z.enum(['PERMANENT', 'PRIMARY']);

export const toothStatusSchema = z.enum([
  'PRESENT',
  'MISSING',
  'IMPACTED',
  'EXTRACTED',
  'UNERUPTED',
]);

export const toothSurfaceSchema = z.enum([
  'MESIAL',
  'DISTAL',
  'OCCLUSAL',
  'BUCCAL',
  'LINGUAL',
]);

export const toothMobilitySchema = z.enum([
  'NONE',
  'GRADE_I',
  'GRADE_II',
  'GRADE_III',
]);

export const toothNumberSchema = z
  .number({ message: 'Tooth number is required' })
  .int('Tooth number must be an integer')
  .refine(isValidFdiTooth, {
    message:
      'Invalid FDI tooth number. Must be valid permanent (11-18, 21-28, 31-38, 41-48) or primary (51-55, 61-65, 71-75, 81-85)',
  });

export const toothFindingSchema = z
  .object({
    tooth_number: toothNumberSchema,
    dentition: dentitionTypeSchema,
    status: toothStatusSchema,
    surfaces: z.array(toothSurfaceSchema).default([]),
    conditions: z
      .array(z.string().trim().min(1, 'Condition cannot be empty').max(100))
      .default([]),
    mobility: toothMobilitySchema.nullable().optional().default(null),
    pocket_depth_mm: z
      .number()
      .min(0, 'Pocket depth cannot be negative')
      .max(20, 'Pocket depth cannot exceed 20mm')
      .nullable()
      .optional()
      .default(null),
    furcation_involvement: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional()
      .default(null),
    notes: z.string().trim().max(2000).nullable().optional().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.dentition === 'PERMANENT' && !isPermanentFdiTooth(data.tooth_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tooth number ${data.tooth_number} is not a valid permanent FDI tooth number (11-18, 21-28, 31-38, 41-48)`,
        path: ['tooth_number'],
      });
    }
    if (data.dentition === 'PRIMARY' && !isPrimaryFdiTooth(data.tooth_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tooth number ${data.tooth_number} is not a valid primary FDI tooth number (51-55, 61-65, 71-75, 81-85)`,
        path: ['tooth_number'],
      });
    }
  });

export const dentalHistorySchema = z
  .object({
    chief_complaint: z.string().trim().max(2000).nullable().optional().default(null),
    pain_scale: z
      .number()
      .int()
      .min(0, 'Pain scale minimum is 0')
      .max(10, 'Pain scale maximum is 10')
      .nullable()
      .optional()
      .default(null),
    bleeding_gums: z.boolean().nullable().optional().default(null),
    sensitivity_hot_cold_sweet: z.boolean().nullable().optional().default(null),
    bruxism: z.boolean().nullable().optional().default(null),
    habits: z
      .array(z.string().trim().min(1).max(100))
      .optional()
      .default([]),
    medical_alerts: z
      .array(z.string().trim().min(1).max(100))
      .optional()
      .default([]),
  })
  .strict();

export const softTissueSchema = z
  .object({
    gingiva_condition: z.string().trim().max(500).nullable().optional().default(null),
    calculus_plaque: z.string().trim().max(500).nullable().optional().default(null),
    oral_mucosa: z.string().trim().max(500).nullable().optional().default(null),
    tongue_palate_floor: z.string().trim().max(500).nullable().optional().default(null),
    tmj_evaluation: z.string().trim().max(500).nullable().optional().default(null),
    occlusion_class: z.string().trim().max(500).nullable().optional().default(null),
  })
  .strict();

export const dentalTreatmentPrioritySchema = z.enum([
  'ROUTINE',
  'URGENT',
  'ELECTIVE',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const dentalTreatmentStatusSchema = z.enum([
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
]);

export const dentalTreatmentPlanItemSchema = z
  .object({
    id: id.optional(),
    service_id: id.nullable().optional().default(null),
    tooth_number: z
      .number()
      .int()
      .refine(isValidFdiTooth, { message: 'Invalid FDI tooth number' })
      .nullable()
      .optional()
      .default(null),
    procedure_name: z
      .string()
      .trim()
      .min(1, 'Procedure name is required')
      .max(200),
    surfaces: z.array(toothSurfaceSchema).optional().default([]),
    priority: dentalTreatmentPrioritySchema.optional().default('ROUTINE'),
    estimated_cost: z
      .number()
      .min(0, 'Estimated cost cannot be negative')
      .nullable()
      .optional()
      .default(null),
    notes: z.string().trim().max(2000).nullable().optional().default(null),
    status: dentalTreatmentStatusSchema.optional().default('PROPOSED'),
  })
  .strict();

export const saveOpdDentalExaminationSchema = z
  .object({
    expected_updated_at: z.iso.datetime().optional(),
    dental_history: dentalHistorySchema.nullable().optional(),
    soft_tissue: softTissueSchema.nullable().optional(),
    teeth: z.array(toothFindingSchema).refine(
      (teeth) => new Set(teeth.map((tooth) => tooth.tooth_number)).size === teeth.length,
      'Each FDI tooth may have only one examination finding',
    ).optional(),
    treatment_plan_items: z
      .array(dentalTreatmentPlanItemSchema)
      .refine(
        (items) => {
          const persistedIds = items.flatMap((item) => (item.id ? [item.id] : []));
          return new Set(persistedIds).size === persistedIds.length;
        },
        'Each persisted Dental treatment item may appear only once',
      )
      .optional(),
  })
  .strict();
