import mongoose, { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { OpdClinicalOrderRepository } from '../opd/opd-clinical-order.repository.js';
import type { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import type { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { ServiceRepository } from '../services/service.repository.js';
import type { BillingRepository } from './billing.repository.js';
import { createBillingNumber } from './billing-number.js';
import type {
  BillingInvoice,
  BillingInvoiceListQuery,
  BillingRequestMetadata,
  BillingSourceType,
  BillingSummaryQuery,
  CollectBillingPaymentDTO,
  CreateBillingInvoiceDTO,
  ResolvedBillingItem,
  SaveBillingInvoiceItemDTO,
  UpdateBillingInvoiceDTO,
} from './billing.types.js';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const catalogueTypeByBillingType = {
  CONSULTATION: 'GENERAL',
  LAB_TEST: 'LAB_TEST',
  IMAGING_SERVICE: 'IMAGING_SERVICE',
} as const;

const sourceTypeForVisit = (visitType: string): BillingSourceType => {
  if (visitType === 'EMERGENCY') return 'EMERGENCY';
  if (visitType === 'PROCEDURE') return 'PROCEDURE';
  return 'OPD';
};

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly patientRepository: PatientRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly clinicalOrderRepository: OpdClinicalOrderRepository,
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async list(query: BillingInvoiceListQuery, actorUserId: string) {
    const scope = await this.repository.resolveBranchScope(actorUserId, query.branch_id);
    return this.repository.list(query, scope);
  }

  async getById(id: string, actorUserId: string) {
    this.requireObjectId(id, 'Invoice id is invalid');
    const scope = await this.repository.resolveBranchScope(actorUserId);
    const invoice = await this.repository.getHydratedById(id, scope);
    if (!invoice) throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
    return invoice;
  }

  async summary(query: BillingSummaryQuery, actorUserId: string) {
    const scope = await this.repository.resolveBranchScope(actorUserId, query.branch_id);
    return this.repository.summary(query, scope);
  }

  async create(data: CreateBillingInvoiceDTO, actorUserId: string, metadata: BillingRequestMetadata) {
    const context = await this.validateInvoiceContext(data, actorUserId);
    const items = await this.resolveItems(data.visit_id, data.items);
    const totals = this.calculateTotals(items, data.discount_amount ?? 0, data.tax_amount ?? 0, 0);
    const session = await mongoose.startSession();
    try {
      const createdId = await session.withTransaction(async () => {
        const created = await this.repository.createInvoice({
          invoiceNumber: createBillingNumber('INV'),
          patientId: data.patient_id,
          visitId: data.visit_id,
          sourceType: context.sourceType,
          encounterId: data.visit_id,
          admissionId: null,
          procedureId: null,
          appointmentId: context.appointmentId,
          branchId: data.branch_id,
          invoiceDate: data.invoice_date ? new Date(data.invoice_date) : new Date(),
          ...totals,
        }, items, actorUserId, session);
        await this.repository.audit('billing.invoice.created', actorUserId, metadata, {
          invoiceId: created.id,
          invoiceNumber: created.invoice_number,
          patientId: data.patient_id,
          visitId: data.visit_id,
          sourceType: context.sourceType,
          encounterId: data.visit_id,
          branchId: data.branch_id,
          totalAmount: totals.totalAmount,
          itemCount: items.length,
        }, session);
        return created.id;
      });
      if (!createdId) throw new AppError('Invoice creation failed', 500, 'BILLING_INVOICE_CREATE_FAILED');
      return this.getById(createdId, actorUserId);
    } finally {
      await session.endSession();
    }
  }

  async update(
    id: string,
    data: UpdateBillingInvoiceDTO,
    actorUserId: string,
    metadata: BillingRequestMetadata,
  ) {
    const existing = await this.getById(id, actorUserId);
    this.assertNotDispensingManaged(existing);
    this.assertFinanciallyMutable(existing);

    const items = data.items ? await this.resolveItems(existing.visit_id, data.items) : existing.items.map((item) => ({
      serviceId: item.service_id,
      serviceName: item.service_name,
      serviceType: item.service_type,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    }));
    const totals = this.calculateTotals(
      items,
      data.discount_amount ?? existing.discount_amount,
      data.tax_amount ?? existing.tax_amount,
      existing.paid_amount,
    );
    if (data.status === 'PENDING' && totals.totalAmount <= 0) {
      throw new AppError('A pending invoice must have a positive total', 409, 'INVOICE_TOTAL_REQUIRED');
    }

    const session = await mongoose.startSession();
    let updated: BillingInvoice | null = null;
    try {
      await session.withTransaction(async () => {
        updated = await this.repository.updateInvoice(id, {
          ...(data.invoice_date ? { invoiceDate: new Date(data.invoice_date) } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...totals,
        }, actorUserId, session);
        if (!updated) {
          throw new AppError('Invoice changed or is no longer editable', 409, 'BILLING_INVOICE_UPDATE_CONFLICT');
        }
        if (data.items) await this.repository.replaceItems(id, items, actorUserId, session);
        await this.repository.audit('billing.invoice.updated', actorUserId, metadata, {
          invoiceId: id,
          invoiceNumber: existing.invoice_number,
          previousStatus: existing.status,
          status: updated.status,
          totalAmount: totals.totalAmount,
          itemCount: items.length,
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return this.getById(id, actorUserId);
  }

  async cancel(id: string, actorUserId: string, metadata: BillingRequestMetadata) {
    const existing = await this.getById(id, actorUserId);
    this.assertNotDispensingManaged(existing);
    if (existing.status === 'CANCELLED') throw new AppError('Invoice is already cancelled', 409, 'INVOICE_CANCELLED');
    if (existing.status === 'PAID' || existing.paid_amount > 0) {
      throw new AppError('Invoices with collected payments cannot be cancelled because refunds are out of scope', 409, 'PAID_INVOICE_CANNOT_CANCEL');
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const cancelled = await this.repository.cancelInvoice(id, actorUserId, session);
        if (!cancelled) throw new AppError('Invoice is no longer cancellable', 409, 'INVOICE_CANCEL_CONFLICT');
        await this.repository.audit('billing.invoice.cancelled', actorUserId, metadata, {
          invoiceId: id,
          invoiceNumber: existing.invoice_number,
          patientId: existing.patient_id,
          visitId: existing.visit_id,
          previousStatus: existing.status,
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return this.getById(id, actorUserId);
  }

  async collectPayment(
    id: string,
    data: CollectBillingPaymentDTO,
    actorUserId: string,
    metadata: BillingRequestMetadata,
  ) {
    this.requireObjectId(id, 'Invoice id is invalid');
    const scope = await this.repository.resolveBranchScope(actorUserId);
    const session = await mongoose.startSession();
    let paymentId: string | null = null;
    try {
      await session.withTransaction(async () => {
        const invoice = await this.repository.getById(id, scope, session);
        if (!invoice) throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
        if (invoice.status === 'DRAFT') throw new AppError('Finalize the invoice before collecting payment', 409, 'INVOICE_NOT_PENDING');
        if (invoice.status === 'CANCELLED') throw new AppError('Cannot pay a cancelled invoice', 409, 'INVOICE_CANCELLED');
        if (invoice.status === 'PAID' || invoice.balance_amount === 0) throw new AppError('Invoice is already paid', 409, 'INVOICE_PAID');
        if (data.amount > invoice.balance_amount) {
          throw new AppError('Payment cannot exceed the invoice balance', 409, 'PAYMENT_EXCEEDS_BALANCE', {
            balance_amount: invoice.balance_amount,
          });
        }
        const payment = await this.repository.createPayment(invoice, createBillingNumber('PAY'), data, actorUserId, session);
        const updated = await this.repository.applyPayment(invoice, data.amount, actorUserId, session);
        if (!updated) throw new AppError('Invoice balance changed; refresh and retry', 409, 'PAYMENT_CONFLICT');
        paymentId = payment.id;
        await this.repository.audit('billing.payment.collected', actorUserId, metadata, {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          paymentId: payment.id,
          paymentNumber: payment.payment_number,
          amount: payment.amount,
          paymentMethod: payment.payment_method,
          status: updated.status,
          balanceAmount: updated.balance_amount,
        }, session);
      });
    } finally {
      await session.endSession();
    }
    if (!paymentId) throw new AppError('Payment collection failed', 500, 'PAYMENT_COLLECTION_FAILED');
    const payment = await this.repository.getPaymentById(paymentId, scope);
    if (!payment) throw new AppError('Payment not found', 404, 'BILLING_PAYMENT_NOT_FOUND');
    return { payment, invoice: await this.getById(id, actorUserId) };
  }

  async listPayments(id: string, actorUserId: string) {
    const invoice = await this.getById(id, actorUserId);
    const scope = await this.repository.resolveBranchScope(actorUserId);
    return this.repository.listPayments(invoice.id, scope);
  }

  async receipt(paymentId: string, actorUserId: string, metadata: BillingRequestMetadata) {
    this.requireObjectId(paymentId, 'Payment id is invalid');
    const scope = await this.repository.resolveBranchScope(actorUserId);
    const payment = await this.repository.getPaymentById(paymentId, scope);
    if (!payment) throw new AppError('Payment not found', 404, 'BILLING_PAYMENT_NOT_FOUND');
    const invoice = await this.getById(payment.invoice_id, actorUserId);
    const receipt = {
      receipt_number: payment.payment_number.replace(/^PAY-/, 'RCT-'),
      generated_at: new Date(),
      payment,
      invoice,
    };
    await this.repository.audit('billing.receipt.generated', actorUserId, metadata, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      paymentId: payment.id,
      paymentNumber: payment.payment_number,
      receiptNumber: receipt.receipt_number,
    });
    return receipt;
  }

  private async validateInvoiceContext(data: CreateBillingInvoiceDTO, actorUserId: string) {
    await this.repository.resolveBranchScope(actorUserId, data.branch_id);
    const [patient, visit] = await Promise.all([
      this.patientRepository.getById(data.patient_id),
      this.visitRepository.getById(data.visit_id),
    ]);
    if (!patient || patient.status !== 'ACTIVE') throw new AppError('Active patient is required', 400, 'INVALID_PATIENT');
    if (!visit) throw new AppError('OPD visit not found', 400, 'INVALID_VISIT');
    if (visit.patient_id !== data.patient_id) throw new AppError('Visit does not belong to the selected patient', 409, 'VISIT_PATIENT_MISMATCH');
    if (visit.branch_id !== data.branch_id) throw new AppError('Visit does not belong to the selected branch', 409, 'VISIT_BRANCH_MISMATCH');
    const appointmentId = data.appointment_id ?? visit.appointment_id;
    if (data.appointment_id && visit.appointment_id !== data.appointment_id) {
      throw new AppError('Appointment does not belong to the selected visit', 409, 'VISIT_APPOINTMENT_MISMATCH');
    }
    if (appointmentId) {
      const appointment = await this.appointmentRepository.getById(appointmentId);
      if (!appointment || appointment.patient_id !== data.patient_id || appointment.branch_id !== data.branch_id) {
        throw new AppError('Appointment context is invalid', 409, 'INVALID_APPOINTMENT_CONTEXT');
      }
    }
    return {
      appointmentId: appointmentId ?? null,
      sourceType: sourceTypeForVisit(visit.visit_type),
    };
  }

  private async resolveItems(visitId: string, requestedItems: SaveBillingInvoiceItemDTO[]): Promise<ResolvedBillingItem[]> {
    const serviceIds = requestedItems.map((item) => item.service_id);
    const services = await this.serviceRepository.getActiveBillingServices(serviceIds);
    const serviceById = new Map(services.map((service) => [service._id.toString(), service]));
    if (serviceById.size !== new Set(serviceIds).size) {
      throw new AppError('Every invoice item must reference an active Service Catalogue entry', 409, 'INVALID_BILLING_SERVICE');
    }

    const types = new Set(requestedItems.map((item) => item.service_type));
    if (types.has('CONSULTATION')) {
      const consultation = await this.consultationRepository.getByVisit(visitId);
      if (!consultation || consultation.status !== 'COMPLETED') {
        throw new AppError('A completed consultation is required for consultation charges', 409, 'CONSULTATION_CHARGE_NOT_ALLOWED');
      }
    }
    const laboratoryOrder = types.has('LAB_TEST')
      ? await this.clinicalOrderRepository.getByVisitAndType(visitId, 'LABORATORY')
      : null;
    const imagingOrder = types.has('IMAGING_SERVICE')
      ? await this.clinicalOrderRepository.getByVisitAndType(visitId, 'IMAGING')
      : null;

    return requestedItems.map((item) => {
      const service = serviceById.get(item.service_id)!;
      const expectedCatalogueType = catalogueTypeByBillingType[item.service_type];
      if (service.serviceType !== expectedCatalogueType) {
        throw new AppError(`Service ${service.name} is not valid for ${item.service_type}`, 409, 'BILLING_SERVICE_TYPE_MISMATCH');
      }
      if (item.service_type === 'LAB_TEST' && (!laboratoryOrder || laboratoryOrder.status === 'DRAFT' || !laboratoryOrder.items.some((ordered) => ordered.service_id === item.service_id))) {
        throw new AppError(`Laboratory service ${service.name} was not ordered for this visit`, 409, 'LAB_SERVICE_NOT_ORDERED');
      }
      if (item.service_type === 'IMAGING_SERVICE' && (!imagingOrder || imagingOrder.status === 'DRAFT' || !imagingOrder.items.some((ordered) => ordered.service_id === item.service_id))) {
        throw new AppError(`Imaging service ${service.name} was not ordered for this visit`, 409, 'IMAGING_SERVICE_NOT_ORDERED');
      }
      const unitPrice = roundMoney(service.standardPrice);
      return {
        serviceId: item.service_id,
        serviceName: service.name,
        serviceType: item.service_type,
        originatingOrderId: item.service_type === 'LAB_TEST'
          ? laboratoryOrder?.id ?? null
          : item.service_type === 'IMAGING_SERVICE' ? imagingOrder?.id ?? null : null,
        quantity: item.quantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * item.quantity),
      };
    });
  }

  private calculateTotals(items: ResolvedBillingItem[], discountAmount: number, taxAmount: number, paidAmount: number) {
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const discount = roundMoney(discountAmount);
    const tax = roundMoney(taxAmount);
    if (discount > subtotal) throw new AppError('Discount cannot exceed subtotal', 400, 'INVALID_DISCOUNT');
    const totalAmount = roundMoney(subtotal - discount + tax);
    const balanceAmount = roundMoney(totalAmount - paidAmount);
    if (balanceAmount < 0) throw new AppError('Updated total cannot be below the paid amount', 409, 'TOTAL_BELOW_PAID_AMOUNT');
    return { subtotal, discountAmount: discount, taxAmount: tax, totalAmount, balanceAmount };
  }

  private assertFinanciallyMutable(invoice: BillingInvoice) {
    if (invoice.status === 'PAID') throw new AppError('Paid invoices cannot be modified', 409, 'INVOICE_PAID');
    if (invoice.status === 'CANCELLED') throw new AppError('Cancelled invoices cannot be modified', 409, 'INVOICE_CANCELLED');
    if (invoice.paid_amount > 0) throw new AppError('Invoices with payments cannot be modified', 409, 'INVOICE_HAS_PAYMENTS');
  }

  private assertNotDispensingManaged(invoice: BillingInvoice) {
    if (invoice.items.some((item) => item.service_type === 'PHARMACY')) {
      throw new AppError(
        'Pharmacy invoices are managed by the dispensing workflow',
        409,
        'PHARMACY_INVOICE_MANAGED_BY_DISPENSING',
      );
    }
  }

  private requireObjectId(value: string, message: string) {
    if (!Types.ObjectId.isValid(value)) throw new AppError(message, 400, 'VALIDATION_ERROR');
  }
}
