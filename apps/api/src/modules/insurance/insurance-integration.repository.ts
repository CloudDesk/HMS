import mongoose from 'mongoose';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../billing/billing.model.js';
import { ServiceModel } from '../services/service.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { InsuranceMemberModel, InsurancePolicyModel } from './insurance.model.js';
import { InsuranceAuthorizationModel } from './insurance-authorization.model.js';
import { ShaServiceMappingModel } from './insurance-integration.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import type { ShaMappingInput } from './insurance-integration.schemas.js';
import type { RequestMetadata } from './insurance.types.js';

export class InsuranceIntegrationRepository {
  encounter(id: string) { return OpdVisitModel.findOne({ _id: id, deletedAt: null }).select('patientId branchId departmentId doctorId appointmentId visitDate').lean(); }
  patient(id: string) { return PatientModel.exists({ _id: id, deletedAt: null }); }
  patientRecord(id: string) { return PatientModel.findOne({ _id: id, deletedAt: null }).select('_id identifiers').lean(); }
  branchRecord(id: string) { return BranchModel.findOne({ _id: id, deletedAt: null }).select('_id identifiers').lean(); }

  async references(encounterId: string, patientId: string, branchId: string) {
    const invoices = await BillingInvoiceModel.find({ visitId: encounterId, patientId, branchId, sourceType: 'OPD', deletedAt: null, status: { $ne: 'CANCELLED' } }).select('_id').limit(101).lean();
    const [items, orders, consultation] = await Promise.all([
      BillingInvoiceItemModel.find({ invoiceId: { $in: invoices.map(row => row._id) }, deletedAt: null }).select('invoiceId serviceId').limit(1001).lean(),
      OpdClinicalOrderModel.find({ sourceType: 'OPD_VISIT', sourceId: encounterId, patientId, branchId, deletedAt: null }).select('items.serviceId').limit(101).lean(),
      OpdConsultationModel.findOne({ visitId: encounterId, patientId, deletedAt: null }).select('_id assessment diagnoses').lean(),
    ]);
    return { invoices, items, orders, consultation };
  }
  services(ids: string[]) { return ServiceModel.find({ _id: { $in: ids }, deletedAt: null }).select('code status').lean(); }
  service(id: string) { return ServiceModel.findOne({ _id: id, deletedAt: null, status: 'ACTIVE' }).select('code').lean(); }
  members(patientId: string, date: string, memberId?: string) {
    return InsuranceMemberModel.find({ patientId, ...(memberId ? { _id: memberId } : {}), status: 'ACTIVE', coverageStart: { $lte: new Date(date) }, $or: [{ coverageEnd: null }, { coverageEnd: { $gte: new Date(date) } }] }).select('policyId').limit(2).lean();
  }
  policy(id: string) { return InsurancePolicyModel.findById(id).select('payerId schemeId').lean(); }
  authorization(params: { encounterId: string; patientId: string; branchId: string; memberId: string; policyId: string; payerId: string; schemeId: string | null; serviceId: string; requestedDate: string; quantity: number }) {
    const { serviceId, quantity, ...scope } = params;
    return InsuranceAuthorizationModel.findOne({ ...scope, status: 'APPROVED', integrationMode: 'LIVE',
      lines: { $elemMatch: { serviceId, approvedQuantity: { $gte: quantity } } },
    }).select('_id status externalReference requestedDate').sort({ decisionDate: -1 }).lean();
  }
  mapping(serviceId: string, date: string) {
    return ShaServiceMappingModel.findOne({ serviceId, status: 'ACTIVE', effectiveFrom: { $lte: date }, $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }] }).select('serviceId interventionCode effectiveFrom effectiveTo').lean();
  }
  async listMappings(serviceId: string | undefined, limit: number, offset: number) {
    const filter = serviceId ? { serviceId } : {};
    const [items, total] = await Promise.all([ShaServiceMappingModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(), ShaServiceMappingModel.countDocuments(filter)]);
    return { items, total, limit, offset };
  }
  async createMapping(input: ShaMappingInput, actor: string, metadata: RequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const [record] = await ShaServiceMappingModel.create([{ ...input, createdBy: actor, updatedBy: actor }], { session });
        if (!record) throw new Error('Mapping creation failed');
        await AuditLogModel.create([{ eventType: 'INSURANCE_SHA_MAPPING_CREATED', actorUserId: actor, ...metadata, metadataJson: { mappingId: record._id.toString(), serviceId: input.serviceId } }], { session });
        return record.toObject();
      });
    } finally { await session.endSession(); }
  }
  async deactivateMapping(id: string, version: number, reason: string, actor: string, metadata: RequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const record = await ShaServiceMappingModel.findOneAndUpdate({ _id: id, version, status: 'ACTIVE' }, { $set: { status: 'INACTIVE', updatedBy: actor }, $inc: { version: 1 } }, { new: true, session }).lean();
        if (record) await AuditLogModel.create([{ eventType: 'INSURANCE_SHA_MAPPING_DEACTIVATED', actorUserId: actor, ...metadata, metadataJson: { mappingId: id, reason, before: 'ACTIVE', after: 'INACTIVE', version: record.version } }], { session });
        return record;
      });
    } finally { await session.endSession(); }
  }
}
