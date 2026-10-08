import mongoose, { Types } from 'mongoose';
import { InsuranceAuthorizationModel, type AuthorizationRecord } from './insurance-authorization.model.js';
import { InsuranceMemberModel, type InsurancePolicyFields } from './insurance.model.js';
import { UserModel } from '../users/user.model.js';
import { RoleModel } from '../roles/role.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { BranchModel } from '../branches/branch.model.js';
import type { RequestMetadata } from './insurance.types.js';
import type { AuthorizationRequest, AuthorizationStatus } from './insurance-authorization.schemas.js';

export class InsuranceAuthorizationRepository {
  async hasBranchAccess(actorId: string, branchId: string) {
    const user = await UserModel.findOne({ _id: actorId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean();
    if (!user || !await BranchModel.exists({ _id: branchId })) return false;
    return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null })) || user.branchIds.some(id => id.toString() === branchId);
  }
  member(id: string) {
    return InsuranceMemberModel.findById(id).populate<{ policyId: InsurancePolicyFields & { _id: Types.ObjectId } }>('policyId').lean();
  }
  async references(input: AuthorizationRequest, patientId: string) {
    if (input.encounterId && !await OpdVisitModel.exists({ _id: input.encounterId, patientId, branchId: input.branchId, deletedAt: null, ...(input.requestingDoctorId ? { doctorId: input.requestingDoctorId } : {}) })) return false;
    if (input.requestingDoctorId && !await DoctorModel.exists({ _id: input.requestingDoctorId, branchId: input.branchId, status: 'ACTIVE' })) return false;
    if (input.clinicalDocumentId && !await PatientDocumentModel.exists({ _id: input.clinicalDocumentId, patientId, status: 'ACTIVE' })) return false;
    return true;
  }
  get(id: string) { return InsuranceAuthorizationModel.findById(id).lean(); }
  byFingerprint(fingerprint: string) { return InsuranceAuthorizationModel.findOne({ fingerprint }).lean(); }
  async list(branchId: string, limit: number, offset: number) {
    const filter = { branchId };
    const [items, total] = await Promise.all([
      InsuranceAuthorizationModel.find(filter).select('-history -clinicalDocumentId -authorizationContext').sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      InsuranceAuthorizationModel.countDocuments(filter),
    ]);
    return { items, total, limit, offset };
  }
  async saveNew(data: Omit<AuthorizationRecord, '_id' | 'createdAt' | 'updatedAt'>, actorId: string, metadata: RequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const [doc] = await InsuranceAuthorizationModel.create([data], { session });
        if (!doc) throw new Error('Authorization creation failed');
        await this.audit(doc.toObject(), 'INSURANCE_AUTHORIZATION_CREATED', actorId, metadata, session);
        return doc.toObject();
      });
    } finally { await session.endSession(); }
  }
  async transition(record: AuthorizationRecord, to: AuthorizationStatus, actorId: string, metadata: RequestMetadata, event: string, changes: Partial<AuthorizationRecord> = {}, reason?: string) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const updated = await InsuranceAuthorizationModel.findOneAndUpdate(
          { _id: record._id, version: record.version, status: record.status },
          { $set: { ...changes, status: to }, $inc: { version: 1 }, $push: { history: {
            from: record.status, to, actorId, at: new Date(), correlationId: changes.correlationId ?? record.correlationId, reason,
          } } }, { new: true, session }
        ).lean();
        if (updated) await this.audit(updated, event, actorId, metadata, session);
        return updated;
      });
    } finally { await session.endSession(); }
  }
  private async audit(record: AuthorizationRecord, eventType: string, actorUserId: string, metadata: RequestMetadata, session: mongoose.ClientSession) {
    await AuditLogModel.create([{ eventType, actorUserId, ...metadata, metadataJson: {
      authorizationId: record._id.toString(), memberId: record.memberId.toString(), patientId: record.patientId.toString(),
      correlationId: record.correlationId, externalReference: record.externalReference, status: record.status,
      integrationMode: record.integrationMode,
    } }], { session });
  }
}
