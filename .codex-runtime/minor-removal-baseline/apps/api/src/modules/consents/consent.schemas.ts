import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const consentVisibilityRuleSchema = z.object({
  fieldKey: z.string().trim().min(1),
  operator: z.enum(['EQUALS', 'NOT_EQUALS', 'CONTAINS']),
  value: z.string(),
});

const consentFormFieldSchema = z.object({
  id: z.string().trim().min(1),
  fieldKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum([
    'TEXT',
    'LONG_TEXT',
    'NUMBER',
    'DATE',
    'DATE_TIME',
    'DROPDOWN',
    'RADIO',
    'CHECKBOX',
    'CHECKBOX_GROUP',
    'YES_NO',
    'EMAIL',
    'PHONE',
    'ADDRESS',
    'INSTRUCTION',
    'PATIENT_INFO',
    'DOCTOR_INFO',
    'PROCEDURE_INFO',
    'SIGNATURE',
  ]),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean(),
  readOnly: z.boolean().optional(),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(),
  systemFieldKey: z.enum([
    'patient_name',
    'patient_number',
    'date_of_birth',
    'gender',
    'phone',
    'address',
    'doctor_name',
    'department_name',
    'branch_name',
    'encounter_number',
    'encounter_date',
    'procedure_name',
    'admission_number',
  ]).optional(),
  visibilityRule: consentVisibilityRuleSchema.optional(),
  displayOrder: z.number().int().nonnegative(),
});

const consentFormSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  displayOrder: z.number().int().nonnegative(),
  required: z.boolean().optional(),
  fields: z.array(consentFormFieldSchema),
});

const consentDeclarationSchema = z.object({
  text: z.string().trim().min(1),
  required: z.boolean(),
});

const consentSignaturesConfigSchema = z.object({
  requiredSignatures: z.array(z.enum(['PATIENT', 'GUARDIAN', 'DOCTOR', 'WITNESS'])),
});

export const consentFormDefinitionSchema = z.object({
  sections: z.array(consentFormSectionSchema),
  declaration: consentDeclarationSchema.optional(),
  signatures: consentSignaturesConfigSchema.optional(),
});

export const consentTemplateListSchema = z.object({
  branch_id: objectId,
  context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
});

export const saveConsentTemplateSchema = z.object({
  branch_id: objectId,
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(100),
  context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']),
  mandatory: z.boolean(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  form_definition: consentFormDefinitionSchema.nullable().optional(),
});

export const updateFormDefinitionSchema = z.object({
  branch_id: objectId,
  form_definition: consentFormDefinitionSchema,
});

export const consentTemplateIdSchema = z.object({ id: objectId });

export const consentRequirementSchema = z.object({
  branch_id: objectId,
  patient_id: objectId,
  context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']),
  context_id: objectId,
});
