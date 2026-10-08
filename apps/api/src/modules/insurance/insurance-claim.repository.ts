import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../billing/billing.model.js';
import { InsuranceClaimModel, type ClaimFields, type ClaimIssue, type ClaimLine } from './insurance-claim.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { RequestMetadata } from './insurance.types.js';

export class InsuranceClaimRepository {
  async source(invoiceId: string, session?: mongoose.ClientSession) {
    const invoice = await BillingInvoiceModel.findOne({ _id: invoiceId, deletedAt: null }).session(session ?? null).lean();
    const items = await BillingInvoiceItemModel.find({ invoiceId, deletedAt: null }).sort({ _id: 1 }).limit(101).session(session ?? null).lean();
    const fingerprint = createHash('sha256').update(JSON.stringify({ invoice: invoice && {
      patientId: invoice.patientId, visitId: invoice.visitId, branchId: invoice.branchId, sourceType: invoice.sourceType,
      status: invoice.status, discount: invoice.discountAmount, tax: invoice.taxAmount,
    }, items: items.map(row => ({ id: row._id, serviceId: row.serviceId, quantity: row.quantity, unitPrice: row.unitPrice, lineTotal: row.lineTotal })) })).digest('hex');
    return { invoice, items, fingerprint };
  }
  get(id: string) { return InsuranceClaimModel.findById(id).lean(); }
  existing(invoiceId: string, memberId: string) { return InsuranceClaimModel.findOne({ invoiceId, memberId }).lean(); }
  async list(branchId: string, limit: number, offset: number) {
    const [items, total] = await Promise.all([InsuranceClaimModel.find({ branchId }).select('-lines -sourceFingerprint').sort({ createdAt: -1 }).skip(offset).limit(limit).lean(), InsuranceClaimModel.countDocuments({ branchId })]);
    return { items, total, limit, offset };
  }
  async create(data: Omit<ClaimFields, 'createdAt' | 'updatedAt'>, actor: string, metadata: RequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const current = await this.source(data.invoiceId.toString(), session);
        if (current.fingerprint !== data.sourceFingerprint) throw new AppError('Invoice changed during claim preparation', 409, 'CLAIM_SOURCE_CHANGED');
        const [record] = await InsuranceClaimModel.create([data], { session });
        if (!record) throw new Error('Claim creation failed');
        await AuditLogModel.create([{ eventType: 'INSURANCE_CLAIM_CREATED', actorUserId: actor, ...metadata, metadataJson: { claimId: record._id.toString(), invoiceId: data.invoiceId.toString(), status: 'DRAFT' } }], { session });
        return record.toObject();
      });
    } finally { await session.endSession(); }
  }
  async validate(id: string, version: number, status: 'DRAFT' | 'VALIDATED', issues: ClaimIssue[], lines: ClaimLine[] | undefined, actor: string, metadata: RequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const update: Record<string, unknown> = { status, issues, readyForShaSubmission: false, updatedBy: actor };
        if (lines) update.lines = lines;
        const record = await InsuranceClaimModel.findOneAndUpdate({ _id: id, version, status: { $in: ['DRAFT', 'VALIDATED'] } }, { $set: update, $inc: { version: 1 } }, { returnDocument: 'after', session }).lean();
        if (!record) throw new AppError('Claim changed or is not draft/validated', 409, 'STALE_CLAIM');
        await AuditLogModel.create([{ eventType: 'INSURANCE_CLAIM_VALIDATED', actorUserId: actor, ...metadata, metadataJson: { claimId: id, status: record.status, valid: status === 'VALIDATED', readyForShaSubmission: false, issueCodes: issues.map(issue => issue.code) } }], { session });
        return { ...record, claimId: record._id.toString(), valid: status === 'VALIDATED' };
      });
    } finally { await session.endSession(); }
  }
}
