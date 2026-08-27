import { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import {
  BillingInvoiceItemModel,
  BillingInvoiceModel,
  BillingPaymentModel,
  type BillingInvoiceFields,
  type BillingInvoiceItemFields,
  type BillingPaymentFields,
} from './billing.model.js';
import type {
  BillingInvoice,
  BillingInvoiceItem,
  BillingInvoiceListQuery,
  BillingInvoiceStatus,
  BillingPayment,
  BillingRequestMetadata,
  BillingSourceType,
  BillingSummaryQuery,
  CollectBillingPaymentDTO,
  ResolvedBillingItem,
} from './billing.types.js';

type InvoiceLean = BillingInvoiceFields & { _id: Types.ObjectId };
type InvoiceItemLean = BillingInvoiceItemFields & { _id: Types.ObjectId };
type PaymentLean = BillingPaymentFields & { _id: Types.ObjectId };

type InvoiceListRow = InvoiceLean & {
  patientName?: string | null;
  patientNumber?: string | null;
  branchName?: string | null;
  visitNumber?: string | null;
  appointmentNumber?: string | null;
  visitType?: string | null;
};

export type CreateInvoiceRecord = {
  invoiceNumber: string;
  patientId: string;
  visitId: string;
  sourceType: BillingSourceType;
  encounterId: string;
  admissionId?: string | null;
  procedureId?: string | null;
  appointmentId?: string | null;
  branchId: string;
  invoiceDate: Date;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  balanceAmount: number;
};

type UpdateInvoiceRecord = {
  invoiceDate?: Date;
  status?: BillingInvoiceStatus;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  balanceAmount?: number;
};

const objectId = (value: string) => new Types.ObjectId(value);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sourceTypeForVisit = (visitType?: string | null): BillingSourceType => {
  if (visitType === 'EMERGENCY') return 'EMERGENCY';
  if (visitType === 'PROCEDURE') return 'PROCEDURE';
  return 'OPD';
};

const toItem = (item: InvoiceItemLean): BillingInvoiceItem => ({
  id: item._id.toString(),
  invoice_id: item.invoiceId.toString(),
  service_id: item.serviceId.toString(),
  service_name: item.serviceName,
  service_type: item.serviceType,
  originating_order_id: item.originatingOrderId?.toString() ?? null,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  line_total: item.lineTotal,
  created_by: item.createdBy?.toString() ?? null,
  updated_by: item.updatedBy?.toString() ?? null,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

const toInvoice = (
  invoice: InvoiceLean | InvoiceListRow,
  items: BillingInvoiceItem[] = [],
): BillingInvoice => {
  const row = invoice as InvoiceListRow;
  return {
    id: invoice._id.toString(),
    invoice_number: invoice.invoiceNumber,
    patient_id: invoice.patientId.toString(),
    patient_number: row.patientNumber ?? null,
    patient_name: row.patientName ?? null,
    visit_id: invoice.visitId.toString(),
    visit_number: row.visitNumber ?? null,
    source_type: invoice.sourceType ?? sourceTypeForVisit(row.visitType),
    encounter_id: invoice.encounterId?.toString() ?? invoice.visitId.toString(),
    admission_id: invoice.admissionId?.toString() ?? null,
    procedure_id: invoice.procedureId?.toString() ?? null,
    appointment_id: invoice.appointmentId?.toString() ?? null,
    appointment_number: row.appointmentNumber ?? null,
    branch_id: invoice.branchId.toString(),
    context_type: invoice.contextType ?? null,
    context_id: invoice.contextId?.toString() ?? null,
    branch_name: row.branchName ?? null,
    invoice_date: invoice.invoiceDate,
    status: invoice.status,
    subtotal: invoice.subtotal,
    discount_amount: invoice.discountAmount,
    tax_amount: invoice.taxAmount,
    total_amount: invoice.totalAmount,
    paid_amount: invoice.paidAmount,
    balance_amount: invoice.balanceAmount,
    items,
    created_by: invoice.createdBy?.toString() ?? null,
    updated_by: invoice.updatedBy?.toString() ?? null,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  };
};

const toPayment = (payment: PaymentLean): BillingPayment => ({
  id: payment._id.toString(),
  invoice_id: payment.invoiceId.toString(),
  patient_id: payment.patientId.toString(),
  branch_id: payment.branchId.toString(),
  payment_number: payment.paymentNumber,
  amount: payment.amount,
  payment_method: payment.paymentMethod,
  payment_date: payment.paymentDate,
  reference_number: payment.referenceNumber ?? null,
  created_by: payment.createdBy?.toString() ?? null,
  updated_by: payment.updatedBy?.toString() ?? null,
  created_at: payment.createdAt,
  updated_at: payment.updatedAt,
});

const invoiceLookupStages: PipelineStage[] = [
  { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' } },
  { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
  { $lookup: { from: 'opdvisits', localField: 'visitId', foreignField: '_id', as: 'visit' } },
  { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointment' } },
  {
    $set: {
      patientName: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: [{ $arrayElemAt: ['$patient.firstName', 0] }, ''] },
              ' ',
              { $ifNull: [{ $arrayElemAt: ['$patient.lastName', 0] }, ''] },
            ],
          },
        },
      },
      patientNumber: { $arrayElemAt: ['$patient.patientNumber', 0] },
      branchName: { $arrayElemAt: ['$branch.name', 0] },
      visitNumber: { $arrayElemAt: ['$visit.visitNumber', 0] },
      visitType: { $arrayElemAt: ['$visit.visitType', 0] },
      sourceType: {
        $ifNull: [
          '$sourceType',
          {
            $switch: {
              branches: [
                { case: { $eq: [{ $arrayElemAt: ['$visit.visitType', 0] }, 'EMERGENCY'] }, then: 'EMERGENCY' },
                { case: { $eq: [{ $arrayElemAt: ['$visit.visitType', 0] }, 'PROCEDURE'] }, then: 'PROCEDURE' },
              ],
              default: 'OPD',
            },
          },
        ],
      },
      encounterId: { $ifNull: ['$encounterId', '$visitId'] },
      appointmentNumber: { $arrayElemAt: ['$appointment.appointmentNumber', 0] },
    },
  },
  { $unset: ['patient', 'branch', 'visit', 'appointment'] },
];

export class BillingRepository {
  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');

    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }));

    if (requestedBranchId) {
      const branchExists = Boolean(await BranchModel.exists({
        _id: requestedBranchId,
        status: 'ACTIVE',
        deletedAt: null,
      }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) {
        throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      }
      return [requestedBranchId];
    }

    if (isSuperAdmin) return undefined;
    const activeBranches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] },
      status: 'ACTIVE',
      deletedAt: null,
    }).select('_id').lean();
    return activeBranches.map((branch) => String(branch._id));
  }

  async list(query: BillingInvoiceListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const match: Record<string, unknown> = { deletedAt: null };
    if (branchIds) match.branchId = { $in: branchIds.map(objectId) };
    if (query.invoice_number) match.invoiceNumber = new RegExp(escapeRegex(query.invoice_number), 'i');
    if (query.patient_id) match.patientId = objectId(query.patient_id);
    if (query.status) match.status = query.status;
    if (query.branch_id) match.branchId = objectId(query.branch_id);
    if (query.date_from || query.date_to) {
      match.invoiceDate = {
        ...(query.date_from ? { $gte: new Date(`${query.date_from}T00:00:00.000Z`) } : {}),
        ...(query.date_to ? { $lte: new Date(`${query.date_to}T23:59:59.999Z`) } : {}),
      };
    }

    const sortMap = {
      invoice_number: 'invoiceNumber',
      invoice_date: 'invoiceDate',
      status: 'status',
      total_amount: 'totalAmount',
      balance_amount: 'balanceAmount',
      created_at: 'createdAt',
    } as const;
    const sortField = sortMap[query.sortBy ?? 'created_at'];
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [records, total] = await Promise.all([
      BillingInvoiceModel.aggregate<InvoiceListRow>([
        { $match: match },
        { $sort: { [sortField]: sortOrder, _id: sortOrder } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...invoiceLookupStages,
      ]),
      BillingInvoiceModel.countDocuments(match),
    ]);

    return {
      data: records.map((record) => toInvoice(record)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getById(id: string, branchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id), deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    const query = BillingInvoiceModel.findOne(filter).lean<InvoiceLean>();
    if (session) query.session(session);
    const invoice = await query;
    return invoice ? toInvoice(invoice) : null;
  }

  async getInvoiceNumberMap(ids: string[], session?: ClientSession) {
    if (ids.length === 0) return new Map<string, string>();
    const query = BillingInvoiceModel.find({
      _id: { $in: ids.map(objectId) },
      deletedAt: null,
    }).select('_id invoiceNumber').lean<Array<{ _id: Types.ObjectId; invoiceNumber: string }>>();
    if (session) query.session(session);
    const invoices = await query;
    return new Map(invoices.map((invoice) => [invoice._id.toString(), invoice.invoiceNumber]));
  }

  async getHydratedById(id: string, branchIds?: string[]) {
    const filter: Record<string, unknown> = { _id: objectId(id), deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    const [invoice] = await BillingInvoiceModel.aggregate<InvoiceListRow>([
      { $match: filter },
      { $limit: 1 },
      ...invoiceLookupStages,
    ]);
    if (!invoice) return null;
    const items = await this.listItems(id);
    return toInvoice(invoice, items);
  }

  async linkContext(id: string, patientId: string, branchId: string, contextType: 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING', contextId: string, userId: string) {
    const invoice = await BillingInvoiceModel.findOneAndUpdate({ _id: objectId(id), patientId: objectId(patientId), branchId: objectId(branchId), status: { $ne: 'CANCELLED' }, deletedAt: null, $or: [{ contextId: null }, { contextType, contextId: objectId(contextId) }] }, { $set: { contextType, contextId: objectId(contextId), updatedBy: objectId(userId) } }, { new: true, lean: true, runValidators: true }).lean<InvoiceLean>();
    return invoice ? toInvoice(invoice) : null;
  }

  async listItems(invoiceId: string, session?: ClientSession) {
    const query = BillingInvoiceItemModel.find({ invoiceId: objectId(invoiceId), deletedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .lean<InvoiceItemLean[]>();
    if (session) query.session(session);
    return (await query).map(toItem);
  }

  async createInvoice(data: CreateInvoiceRecord, items: ResolvedBillingItem[], userId: string, session: ClientSession) {
    const invoices = await BillingInvoiceModel.create([{
      invoiceNumber: data.invoiceNumber,
      patientId: objectId(data.patientId),
      visitId: objectId(data.visitId),
      sourceType: data.sourceType,
      encounterId: objectId(data.encounterId),
      admissionId: data.admissionId ? objectId(data.admissionId) : null,
      procedureId: data.procedureId ? objectId(data.procedureId) : null,
      appointmentId: data.appointmentId ? objectId(data.appointmentId) : null,
      branchId: objectId(data.branchId),
      invoiceDate: data.invoiceDate,
      status: 'DRAFT',
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      taxAmount: data.taxAmount,
      totalAmount: data.totalAmount,
      paidAmount: 0,
      balanceAmount: data.balanceAmount,
      createdBy: objectId(userId),
      updatedBy: objectId(userId),
    }], { session, ordered: true });

    const invoice = invoices[0];
    if (!invoice) throw new AppError('Invoice creation failed', 500, 'BILLING_INVOICE_CREATE_FAILED');
    await this.createItems(invoice._id.toString(), items, userId, session);
    return toInvoice(invoice.toObject<InvoiceLean>());
  }

  async updateInvoice(id: string, data: UpdateInvoiceRecord, userId: string, session: ClientSession) {
    const invoice = await BillingInvoiceModel.findOneAndUpdate(
      { _id: objectId(id), status: { $in: ['DRAFT', 'PENDING'] }, paidAmount: 0, deletedAt: null },
      { $set: { ...data, updatedBy: objectId(userId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<InvoiceLean>();
    return invoice ? toInvoice(invoice) : null;
  }

  async replaceItems(invoiceId: string, items: ResolvedBillingItem[], userId: string, session: ClientSession) {
    await BillingInvoiceItemModel.updateMany(
      { invoiceId: objectId(invoiceId), deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: objectId(userId), updatedBy: objectId(userId) } },
      { session },
    );
    await this.createItems(invoiceId, items, userId, session);
  }

  async cancelInvoice(id: string, userId: string, session: ClientSession) {
    const invoice = await BillingInvoiceModel.findOneAndUpdate(
      {
        _id: objectId(id),
        status: { $in: ['DRAFT', 'PENDING'] },
        paidAmount: 0,
        deletedAt: null,
      },
      { $set: { status: 'CANCELLED', updatedBy: objectId(userId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<InvoiceLean>();
    return invoice ? toInvoice(invoice) : null;
  }

  async createPayment(
    invoice: BillingInvoice,
    paymentNumber: string,
    data: CollectBillingPaymentDTO,
    userId: string,
    session: ClientSession,
  ) {
    const payments = await BillingPaymentModel.create([{
      invoiceId: objectId(invoice.id),
      patientId: objectId(invoice.patient_id),
      branchId: objectId(invoice.branch_id),
      paymentNumber,
      amount: data.amount,
      paymentMethod: data.payment_method,
      paymentDate: data.payment_date ? new Date(data.payment_date) : new Date(),
      referenceNumber: data.reference_number?.trim() || null,
      createdBy: objectId(userId),
      updatedBy: objectId(userId),
    }], { session, ordered: true });
    const payment = payments[0];
    if (!payment) throw new AppError('Payment creation failed', 500, 'PAYMENT_COLLECTION_FAILED');
    return toPayment(payment.toObject<PaymentLean>());
  }

  async applyPayment(invoice: BillingInvoice, amount: number, userId: string, session: ClientSession) {
    const paidAmount = roundMoney(invoice.paid_amount + amount);
    const balanceAmount = roundMoney(invoice.total_amount - paidAmount);
    const status: BillingInvoiceStatus = balanceAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
    const updated = await BillingInvoiceModel.findOneAndUpdate(
      {
        _id: objectId(invoice.id),
        status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
        balanceAmount: { $gte: amount },
        deletedAt: null,
      },
      { $set: { paidAmount, balanceAmount, status, updatedBy: objectId(userId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<InvoiceLean>();
    return updated ? toInvoice(updated) : null;
  }

  async listPayments(invoiceId: string, branchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { invoiceId: objectId(invoiceId), deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    const query = BillingPaymentModel.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean<PaymentLean[]>();
    if (session) query.session(session);
    return (await query).map(toPayment);
  }

  async getPaymentById(id: string, branchIds?: string[]) {
    const filter: Record<string, unknown> = { _id: objectId(id), deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    const payment = await BillingPaymentModel.findOne(filter).lean<PaymentLean>();
    return payment ? toPayment(payment) : null;
  }

  async summary(query: BillingSummaryQuery, branchIds?: string[]) {
    const match: Record<string, unknown> = { deletedAt: null };
    if (branchIds) match.branchId = { $in: branchIds.map(objectId) };
    if (query.branch_id) match.branchId = objectId(query.branch_id);
    if (query.date_from || query.date_to) {
      match.invoiceDate = {
        ...(query.date_from ? { $gte: new Date(`${query.date_from}T00:00:00.000Z`) } : {}),
        ...(query.date_to ? { $lte: new Date(`${query.date_to}T23:59:59.999Z`) } : {}),
      };
    }
    const [result] = await BillingInvoiceModel.aggregate<{
      totalInvoices: number;
      billedAmount: number;
      collectedAmount: number;
      outstandingAmount: number;
      statusRows: Array<{ status: BillingInvoiceStatus; count: number }>;
    }>([
      { $match: match },
      {
        $facet: {
          totals: [{
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              billedAmount: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 0, '$totalAmount'] } },
              collectedAmount: { $sum: '$paidAmount' },
              outstandingAmount: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 0, '$balanceAmount'] } },
            },
          }],
          statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          totalInvoices: { $ifNull: [{ $arrayElemAt: ['$totals.totalInvoices', 0] }, 0] },
          billedAmount: { $ifNull: [{ $arrayElemAt: ['$totals.billedAmount', 0] }, 0] },
          collectedAmount: { $ifNull: [{ $arrayElemAt: ['$totals.collectedAmount', 0] }, 0] },
          outstandingAmount: { $ifNull: [{ $arrayElemAt: ['$totals.outstandingAmount', 0] }, 0] },
          statusRows: { $map: { input: '$statuses', as: 'row', in: { status: '$$row._id', count: '$$row.count' } } },
        },
      },
    ]);
    const statuses: BillingInvoiceStatus[] = ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
    const countMap = new Map((result?.statusRows ?? []).map((row) => [row.status, row.count]));
    return {
      total_invoices: result?.totalInvoices ?? 0,
      billed_amount: roundMoney(result?.billedAmount ?? 0),
      collected_amount: roundMoney(result?.collectedAmount ?? 0),
      outstanding_amount: roundMoney(result?.outstandingAmount ?? 0),
      by_status: Object.fromEntries(statuses.map((status) => [status, countMap.get(status) ?? 0])),
    };
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: BillingRequestMetadata,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    const auditEntry = {
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    };
    if (session) {
      const entries = await AuditLogModel.create([auditEntry], { session, ordered: true });
      return entries[0];
    }
    return AuditLogModel.create(auditEntry);
  }

  private async createItems(invoiceId: string, items: ResolvedBillingItem[], userId: string, session: ClientSession) {
    await BillingInvoiceItemModel.create(items.map((item) => ({
      invoiceId: objectId(invoiceId),
      serviceId: objectId(item.serviceId),
      serviceName: item.serviceName,
      serviceType: item.serviceType,
      originatingOrderId: item.originatingOrderId ? objectId(item.originatingOrderId) : null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      createdBy: objectId(userId),
      updatedBy: objectId(userId),
    })), { session, ordered: true });
  }
}
