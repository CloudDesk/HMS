import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = (label: string, max = 200) => z.string().trim().min(1, `${label} is required`).max(max);
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

export const insuranceIdParamsSchema = z.object({ id });
export const insuranceProviderActionParamsSchema = z.object({
  id,
  action: z.enum(['activate', 'deactivate']),
});

export const insuranceConfigurationUpdateSchema = z.object({
  operating_mode: z.enum(['PROVIDER', 'PAYER', 'TPA', 'HYBRID']),
  version: z.coerce.number().int().min(0),
  reason: text('Reason', 500),
});

export const insuranceProviderListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  provider_type: z.enum(['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'IMAGING', 'DENTAL', 'OPTICAL', 'OTHER']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['provider_code', 'legal_name', 'provider_type', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceProviderCreateSchema = z.object({
  provider_code: text('Provider code', 50).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Provider code contains unsupported characters'),
  legal_name: text('Legal name', 200),
  trading_name: nullableText(200),
  provider_type: z.enum(['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'IMAGING', 'DENTAL', 'OPTICAL', 'OTHER']),
  registration_number: nullableText(100),
  tax_id: nullableText(100),
  contact_name: nullableText(150),
  phone: nullableText(30),
  email: z.string().trim().email().max(254).nullable().optional(),
  address: nullableText(500),
});

export const insuranceProviderUpdateSchema = insuranceProviderCreateSchema.partial().extend({
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one provider field is required',
});

export const insuranceStatusActionSchema = z.object({
  version: z.coerce.number().int().min(0),
  reason: text('Reason', 500),
  approval_request_id: id.optional(),
});

export const insuranceProviderBranchListSchema = z.object({
  branch_id: id.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  effective_on: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['effective_from', 'effective_to', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceProviderBranchCreateSchema = z.object({
  branch_id: id,
  effective_from: isoDate,
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).superRefine((value, context) => {
  if (value.effective_to && value.effective_to < value.effective_from) {
    context.addIssue({ code: 'custom', path: ['effective_to'], message: 'Effective-to must be on or after effective-from' });
  }
});

export const insuranceProviderBranchUpdateSchema = z.object({
  effective_from: isoDate.optional(),
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one mapping field is required',
});

export const insurancePayerListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  payer_type: z.enum(['INSURER', 'TPA', 'GOVERNMENT', 'EMPLOYER']).optional(),
  submission_mode: z.enum(['MANUAL', 'PORTAL', 'API', 'FILE']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['payer_code', 'name', 'payer_type', 'submission_mode', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insurancePayerCreateSchema = z.object({
  payer_code: text('Payer code', 50).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Payer code contains unsupported characters'),
  name: text('Payer name', 200),
  legal_name: nullableText(200),
  payer_type: z.enum(['INSURER', 'TPA', 'GOVERNMENT', 'EMPLOYER']),
  registration_number: nullableText(100),
  tax_id: nullableText(100),
  claims_contact_name: nullableText(150),
  claims_contact_phone: nullableText(30),
  claims_contact_email: z.string().trim().email().max(254).nullable().optional(),
  finance_contact_name: nullableText(150),
  finance_contact_phone: nullableText(30),
  finance_contact_email: z.string().trim().email().max(254).nullable().optional(),
  address: nullableText(500),
  submission_mode: z.enum(['MANUAL', 'PORTAL', 'API', 'FILE']).default('MANUAL'),
  portal_url: z.string().trim().url().max(2048).nullable().optional(),
  api_enabled: z.boolean().default(false),
  edi_enabled: z.boolean().default(false),
  portal_enabled: z.boolean().default(false),
  member_number_scope: z.enum(['PAYER', 'PAYER_POLICY']).default('PAYER'),
});

export const insurancePayerUpdateSchema = insurancePayerCreateSchema.partial().extend({
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one payer field is required',
});

const approvalTransactionType = z.enum(['PROVIDER_ACTIVATION', 'PAYER_ACTIVATION', 'CONTRACT_ACTIVATION']);
const approvalResourceType = z.enum(['PROVIDER', 'PAYER', 'CONTRACT']);

export const insuranceApprovalRuleListSchema = z.object({
  branch_id: id.optional(),
  transaction_type: approvalTransactionType.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  effective_on: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['transaction_type', 'effective_from', 'effective_to', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceApprovalRuleCreateSchema = z.object({
  branch_id: id.nullable().optional(),
  payer_id: id.nullable().optional(),
  scheme_id: z.null().optional(),
  transaction_type: approvalTransactionType,
  required_permission: text('Required permission', 150).regex(/^[A-Za-z0-9._-]+$/, 'Invalid permission code'),
  effective_from: isoDate,
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).superRefine((value, context) => {
  if (value.effective_to && value.effective_to < value.effective_from) {
    context.addIssue({ code: 'custom', path: ['effective_to'], message: 'Effective-to must be on or after effective-from' });
  }
  if (value.transaction_type === 'PROVIDER_ACTIVATION' && value.payer_id) {
    context.addIssue({ code: 'custom', path: ['payer_id'], message: 'Provider activation rules cannot be payer-scoped' });
  }
  if (value.transaction_type !== 'CONTRACT_ACTIVATION' && value.branch_id) {
    context.addIssue({ code: 'custom', path: ['branch_id'], message: 'Only contract activation rules can be branch-scoped' });
  }
});

export const insuranceApprovalRuleUpdateSchema = z.object({
  required_permission: text('Required permission', 150).regex(/^[A-Za-z0-9._-]+$/, 'Invalid permission code').optional(),
  effective_from: isoDate.optional(),
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one approval rule field is required',
});

export const insuranceApprovalRequestListSchema = z.object({
  transaction_type: approvalTransactionType.optional(),
  resource_type: approvalResourceType.optional(),
  resource_id: id.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  requested_by: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['requested_at', 'status', 'transaction_type', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceApprovalRequestCreateSchema = z.object({
  approval_rule_id: id,
  resource_type: approvalResourceType,
  resource_id: id,
  resource_version: z.coerce.number().int().min(0),
});

export const insuranceApprovalDecisionSchema = z.object({
  version: z.coerce.number().int().min(0),
  decision_reason: z.string().trim().max(500).nullable().optional(),
});

export const insuranceApprovalCancellationSchema = z.object({
  version: z.coerce.number().int().min(0),
  decision_reason: text('Cancellation reason', 500),
});

const contractStatus = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED']);

export const insuranceContractListSchema = z.object({
  branch_id: id.optional(),
  payer_id: id.optional(),
  provider_id: id.optional(),
  status: contractStatus.optional(),
  effective_on: isoDate.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['contract_number', 'name', 'effective_from', 'effective_to', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const insuranceContractFields = z.object({
  contract_number: text('Contract number', 80).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Contract number contains unsupported characters'),
  payer_id: id,
  provider_id: id,
  branch_id: id,
  name: text('Contract name', 200),
  effective_from: isoDate,
  effective_to: isoDate.nullable().optional(),
  provider_network: nullableText(200),
  claim_submission_days: z.coerce.number().int().min(0).max(3650).nullable().optional(),
});

export const insuranceContractCreateSchema = insuranceContractFields.superRefine((value, context) => {
  if (value.effective_to && value.effective_to < value.effective_from) {
    context.addIssue({ code: 'custom', path: ['effective_to'], message: 'Effective-to must be on or after effective-from' });
  }
});

export const insuranceContractUpdateSchema = insuranceContractFields
  .omit({ payer_id: true, provider_id: true, branch_id: true })
  .partial()
  .extend({ version: z.coerce.number().int().min(0) })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'At least one contract field is required',
  });

export const insuranceContractActionSchema = z.object({
  version: z.coerce.number().int().min(0),
  reason: z.string().trim().max(500).nullable().optional(),
  approval_request_id: id.optional(),
});
