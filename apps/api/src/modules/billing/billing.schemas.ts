import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Object id is invalid');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const money = z.number().finite().min(0).max(1_000_000_000).multipleOf(0.01);
const positiveMoney = z.number().finite().positive().max(1_000_000_000).multipleOf(0.01);
const serviceType = z.enum(['CONSULTATION', 'LAB_TEST', 'IMAGING_SERVICE', 'PHARMACY']);

const invoiceItemSchema = z.object({
  service_id: objectId,
  service_type: serviceType,
  quantity: z.number().int().min(1).max(10_000),
}).strict();

const invoiceItems = z.array(invoiceItemSchema).min(1).max(100).superRefine((items, context) => {
  const ids = items.map((item) => item.service_id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', message: 'Duplicate invoice service', path: [] });
  }
});

const invoiceListSchema = z.object({
  invoice_number: z.string().trim().max(100).optional(),
  patient_id: objectId.optional(),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  date_from: dateOnly.optional(),
  date_to: dateOnly.optional(),
  branch_id: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['invoice_number', 'invoice_date', 'status', 'total_amount', 'balance_amount', 'created_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).strict().refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
  message: 'date_from must be on or before date_to',
  path: ['date_from'],
});

const summarySchema = z.object({
  branch_id: objectId.optional(),
  date_from: dateOnly.optional(),
  date_to: dateOnly.optional(),
}).strict().refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
  message: 'date_from must be on or before date_to',
  path: ['date_from'],
});

const createInvoiceSchema = z.object({
  patient_id: objectId,
  visit_id: objectId,
  appointment_id: objectId.nullable().optional(),
  branch_id: objectId,
  invoice_date: dateOnly.optional(),
  discount_amount: money.optional(),
  tax_amount: money.optional(),
  items: invoiceItems,
}).strict();

const updateInvoiceSchema = z.object({
  invoice_date: dateOnly.optional(),
  discount_amount: money.optional(),
  tax_amount: money.optional(),
  items: invoiceItems.optional(),
  status: z.literal('PENDING').optional(),
}).strict().refine((data) => Object.keys(data).length > 0, { message: 'At least one invoice change is required' });

const paymentSchema = z.object({
  amount: positiveMoney,
  payment_method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']),
  payment_date: dateOnly.optional(),
  reference_number: z.string().trim().max(100).nullable().optional(),
}).strict().superRefine((data, context) => {
  if (data.payment_method !== 'CASH' && !data.reference_number?.trim()) {
    context.addIssue({
      code: 'custom',
      message: 'Reference number is required for non-cash payments',
      path: ['reference_number'],
    });
  }
});

const invoiceParamsSchema = z.object({ id: objectId }).strict();
const paymentParamsSchema = z.object({ id: objectId }).strict();
const admissionContextSchema = z.object({ patient_id: objectId, branch_id: objectId, request_id: objectId }).strict();
const procedureContextSchema = z.object({ patient_id: objectId, branch_id: objectId, booking_id: objectId }).strict();

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
};

export const parseBillingInvoiceListQuery = (value: unknown) => parse(invoiceListSchema, value);
export const parseBillingSummaryQuery = (value: unknown) => parse(summarySchema, value);
export const parseCreateBillingInvoiceBody = (value: unknown) => parse(createInvoiceSchema, value);
export const parseUpdateBillingInvoiceBody = (value: unknown) => parse(updateInvoiceSchema, value);
export const parseCollectBillingPaymentBody = (value: unknown) => parse(paymentSchema, value);
export const parseBillingInvoiceParams = (value: unknown) => parse(invoiceParamsSchema, value);
export const parseBillingPaymentParams = (value: unknown) => parse(paymentParamsSchema, value);
export const parseAdmissionContextBody = (value: unknown) => parse(admissionContextSchema, value);
export const parseProcedureContextBody = (value: unknown) => parse(procedureContextSchema, value);

