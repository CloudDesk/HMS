import { Types } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { ServiceModel } from '../services/service.model.js';
import {
  BenefitConfigModel,
  EligibilityVerificationModel,
  InsuranceMemberModel,
  InsurancePolicyModel,
  InsuranceSchemeModel,
  PayerModel,
  type BenefitConfigFields,
  type EligibilityVerificationFields,
  type InsuranceMemberFields,
  type InsurancePolicyFields,
  type InsuranceSchemeFields,
  type PayerFields,
} from './insurance.model.js';
import type {
  CreateBenefitConfigInput,
  CreateMemberInput,
  CreatePayerInput,
  CreatePolicyInput,
  CreateSchemeInput,
  ListBenefitConfigsQuery,
  ListEligibilityVerificationsQuery,
  ListMembersQuery,
  ListPayersQuery,
  ListPoliciesQuery,
  ListSchemesQuery,
  RequestMetadata,
  UpdateBenefitConfigInput,
  UpdateMemberInput,
  UpdatePayerInput,
  UpdatePolicyInput,
  UpdateSchemeInput,
} from './insurance.types.js';

export class InsuranceRepository {
  // --- Audit helper ---
  async audit(
    eventType: string,
    actorUserId: string,
    metadata: RequestMetadata,
    details: Record<string, unknown>
  ) {
    try {
      await AuditLogModel.create({
        eventType,
        actorUserId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadataJson: details,
      });
    } catch {
      // Audit failure must not fail the primary business action
    }
  }

  isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }

  // --- Patients Reference Check ---
  async getPatientById(patientId: string) {
    if (!Types.ObjectId.isValid(patientId)) return null;
    return PatientModel.findById(patientId).lean();
  }

  // ================= PAYERS =================
  async createPayer(data: CreatePayerInput, userId: string, metadata: RequestMetadata) {
    const doc = await PayerModel.create({
      payerCode: data.payerCode.trim().toUpperCase(),
      name: data.name.trim(),
      type: data.type ?? 'SHA',
      status: data.status ?? 'ACTIVE',
      branchId: data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      contactInfo: data.contactInfo ?? {},
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_PAYER_CREATED', userId, metadata, {
      payerId: doc._id.toString(),
      payerCode: doc.payerCode,
      name: doc.name,
      type: doc.type,
    });

    return doc.toObject();
  }

  async getPayerById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return PayerModel.findById(id).lean();
  }

  async getPayerByCode(payerCode: string) {
    return PayerModel.findOne({ payerCode: payerCode.trim().toUpperCase() }).lean();
  }

  async listPayers(query: ListPayersQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.branchId && Types.ObjectId.isValid(query.branchId)) {
      filter.$or = [{ branchId: null }, { branchId: new Types.ObjectId(query.branchId) }];
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { payerCode: regex }];
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      PayerModel.find(filter).sort({ name: 1 }).skip(offset).limit(limit).lean(),
      PayerModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  async updatePayer(id: string, data: UpdatePayerInput, userId: string, metadata: RequestMetadata) {
    if (!Types.ObjectId.isValid(id)) return null;

    const existing = await PayerModel.findById(id);
    if (!existing) return null;

    const updates: Partial<PayerFields> = {
      updatedBy: new Types.ObjectId(userId),
      version: existing.version + 1,
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.type !== undefined) updates.type = data.type;
    if (data.status !== undefined) updates.status = data.status;
    if (data.branchId !== undefined) {
      updates.branchId = data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null;
    }
    if (data.effectiveFrom !== undefined) {
      updates.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : null;
    }
    if (data.effectiveTo !== undefined) {
      updates.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
    }
    if (data.contactInfo !== undefined) {
      updates.contactInfo = { ...existing.contactInfo, ...data.contactInfo };
    }

    const updated = await PayerModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    await this.audit('INSURANCE_PAYER_UPDATED', userId, metadata, {
      payerId: id,
      previous: { status: existing.status, name: existing.name },
      updated: { status: updated?.status, name: updated?.name },
    });

    return updated;
  }

  // ================= SCHEMES =================
  async createScheme(data: CreateSchemeInput, userId: string, metadata: RequestMetadata) {
    const doc = await InsuranceSchemeModel.create({
      payerId: new Types.ObjectId(data.payerId),
      schemeCode: data.schemeCode.trim().toUpperCase(),
      name: data.name.trim(),
      planType: data.planType?.trim() ?? null,
      networkType: data.networkType?.trim() ?? null,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      status: data.status ?? 'ACTIVE',
      branchId: data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null,
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_SCHEME_CREATED', userId, metadata, {
      schemeId: doc._id.toString(),
      payerId: data.payerId,
      schemeCode: doc.schemeCode,
      name: doc.name,
    });

    return doc.toObject();
  }

  async getSchemeById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return InsuranceSchemeModel.findById(id).populate('payerId', 'payerCode name type status').lean();
  }

  async getSchemeByCode(payerId: string, schemeCode: string) {
    if (!Types.ObjectId.isValid(payerId)) return null;
    return InsuranceSchemeModel.findOne({
      payerId: new Types.ObjectId(payerId),
      schemeCode: schemeCode.trim().toUpperCase(),
    }).lean();
  }

  async listSchemes(query: ListSchemesQuery) {
    const filter: Record<string, unknown> = {};
    if (query.payerId && Types.ObjectId.isValid(query.payerId)) {
      filter.payerId = new Types.ObjectId(query.payerId);
    }
    if (query.status) filter.status = query.status;
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { schemeCode: regex }];
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      InsuranceSchemeModel.find(filter)
        .populate('payerId', 'payerCode name type')
        .sort({ name: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      InsuranceSchemeModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  async updateScheme(id: string, data: UpdateSchemeInput, userId: string, metadata: RequestMetadata) {
    if (!Types.ObjectId.isValid(id)) return null;

    const existing = await InsuranceSchemeModel.findById(id);
    if (!existing) return null;

    const updates: Partial<InsuranceSchemeFields> = {
      updatedBy: new Types.ObjectId(userId),
      version: existing.version + 1,
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.schemeCode !== undefined) updates.schemeCode = data.schemeCode.trim().toUpperCase();
    if (data.planType !== undefined) updates.planType = data.planType?.trim() ?? null;
    if (data.networkType !== undefined) updates.networkType = data.networkType?.trim() ?? null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.branchId !== undefined) {
      updates.branchId = data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null;
    }
    if (data.effectiveFrom !== undefined) {
      updates.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : null;
    }
    if (data.effectiveTo !== undefined) {
      updates.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
    }

    const updated = await InsuranceSchemeModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('payerId', 'payerCode name type')
      .lean();

    await this.audit('INSURANCE_SCHEME_UPDATED', userId, metadata, {
      schemeId: id,
      previous: { status: existing.status, name: existing.name },
      updated: { status: updated?.status, name: updated?.name },
    });

    return updated;
  }

  // ================= POLICIES =================
  async createPolicy(data: CreatePolicyInput, userId: string, metadata: RequestMetadata) {
    const doc = await InsurancePolicyModel.create({
      payerId: new Types.ObjectId(data.payerId),
      schemeId: new Types.ObjectId(data.schemeId),
      policyNumber: data.policyNumber.trim().toUpperCase(),
      holderPatientId: new Types.ObjectId(data.holderPatientId),
      holderType: data.holderType ?? 'SELF',
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status ?? 'ACTIVE',
      coverageDetails: data.coverageDetails ?? {},
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_POLICY_CREATED', userId, metadata, {
      policyId: doc._id.toString(),
      policyNumber: doc.policyNumber,
      payerId: data.payerId,
      schemeId: data.schemeId,
      holderPatientId: data.holderPatientId,
    });

    return doc.toObject();
  }

  async getPolicyById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return InsurancePolicyModel.findById(id)
      .populate('payerId', 'payerCode name type status')
      .populate('schemeId', 'schemeCode name planType networkType status')
      .populate('holderPatientId', 'patientNumber firstName lastName dateOfBirth gender phone')
      .lean();
  }

  async getPolicyByNumber(payerId: string, policyNumber: string) {
    if (!Types.ObjectId.isValid(payerId)) return null;
    return InsurancePolicyModel.findOne({
      payerId: new Types.ObjectId(payerId),
      policyNumber: policyNumber.trim().toUpperCase(),
    }).lean();
  }

  async listPolicies(query: ListPoliciesQuery) {
    const filter: Record<string, unknown> = {};
    if (query.payerId && Types.ObjectId.isValid(query.payerId)) {
      filter.payerId = new Types.ObjectId(query.payerId);
    }
    if (query.schemeId && Types.ObjectId.isValid(query.schemeId)) {
      filter.schemeId = new Types.ObjectId(query.schemeId);
    }
    if (query.patientId && Types.ObjectId.isValid(query.patientId)) {
      filter.holderPatientId = new Types.ObjectId(query.patientId);
    }
    if (query.policyNumber) {
      filter.policyNumber = query.policyNumber.trim().toUpperCase();
    }
    if (query.status) filter.status = query.status;

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      InsurancePolicyModel.find(filter)
        .populate('payerId', 'payerCode name type')
        .populate('schemeId', 'schemeCode name')
        .populate('holderPatientId', 'patientNumber firstName lastName phone')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      InsurancePolicyModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  async updatePolicy(id: string, data: UpdatePolicyInput, userId: string, metadata: RequestMetadata) {
    if (!Types.ObjectId.isValid(id)) return null;

    const existing = await InsurancePolicyModel.findById(id);
    if (!existing) return null;

    const updates: Partial<InsurancePolicyFields> = {
      updatedBy: new Types.ObjectId(userId),
      version: existing.version + 1,
    };

    if (data.policyNumber !== undefined) updates.policyNumber = data.policyNumber.trim().toUpperCase();
    if (data.holderType !== undefined) updates.holderType = data.holderType;
    if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updates.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.coverageDetails !== undefined) {
      updates.coverageDetails = { ...existing.coverageDetails, ...data.coverageDetails };
    }

    const updated = await InsurancePolicyModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('payerId', 'payerCode name type')
      .populate('schemeId', 'schemeCode name')
      .populate('holderPatientId', 'patientNumber firstName lastName phone')
      .lean();

    await this.audit('INSURANCE_POLICY_UPDATED', userId, metadata, {
      policyId: id,
      previous: { status: existing.status, policyNumber: existing.policyNumber },
      updated: { status: updated?.status, policyNumber: updated?.policyNumber },
    });

    return updated;
  }

  // ================= MEMBERS =================
  async createMember(data: CreateMemberInput, userId: string, metadata: RequestMetadata) {
    const doc = await InsuranceMemberModel.create({
      policyId: new Types.ObjectId(data.policyId),
      patientId: new Types.ObjectId(data.patientId),
      memberNumber: data.memberNumber.trim().toUpperCase(),
      subscriberId: data.subscriberId?.trim() ?? null,
      relationship: data.relationship,
      coverageStart: new Date(data.coverageStart),
      coverageEnd: data.coverageEnd ? new Date(data.coverageEnd) : null,
      status: data.status ?? 'ACTIVE',
      branchId: data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null,
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_MEMBER_CREATED', userId, metadata, {
      memberId: doc._id.toString(),
      policyId: data.policyId,
      patientId: data.patientId,
      memberNumber: doc.memberNumber,
    });

    return doc.toObject();
  }

  async getMemberById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return InsuranceMemberModel.findById(id)
      .populate({
        path: 'policyId',
        select: 'policyNumber status startDate endDate payerId schemeId holderPatientId',
        populate: [
          { path: 'payerId', select: 'payerCode name type status' },
          { path: 'schemeId', select: 'schemeCode name planType networkType status' },
        ],
      })
      .populate('patientId', 'patientNumber firstName lastName dateOfBirth gender phone')
      .lean();
  }

  async getMemberByNumber(policyId: string, memberNumber: string) {
    if (!Types.ObjectId.isValid(policyId)) return null;
    return InsuranceMemberModel.findOne({
      policyId: new Types.ObjectId(policyId),
      memberNumber: memberNumber.trim().toUpperCase(),
    }).lean();
  }

  async getActiveMemberForPatient(policyId: string, patientId: string) {
    if (!Types.ObjectId.isValid(policyId) || !Types.ObjectId.isValid(patientId)) return null;
    return InsuranceMemberModel.findOne({
      policyId: new Types.ObjectId(policyId),
      patientId: new Types.ObjectId(patientId),
      status: 'ACTIVE',
    }).lean();
  }

  async findMemberForCoverageCheck(params: {
    memberId?: string;
    policyId?: string;
    patientId?: string;
    memberNumber?: string;
  }) {
    if (params.memberId && Types.ObjectId.isValid(params.memberId)) {
      return this.getMemberById(params.memberId);
    }
    if (params.policyId && Types.ObjectId.isValid(params.policyId)) {
      if (params.memberNumber) {
        const member = await InsuranceMemberModel.findOne({
          policyId: new Types.ObjectId(params.policyId),
          memberNumber: params.memberNumber.trim().toUpperCase(),
        }).lean();
        if (member) return this.getMemberById(member._id.toString());
      }
      if (params.patientId && Types.ObjectId.isValid(params.patientId)) {
        const member = await InsuranceMemberModel.findOne({
          policyId: new Types.ObjectId(params.policyId),
          patientId: new Types.ObjectId(params.patientId),
          status: 'ACTIVE',
        }).lean();
        if (member) return this.getMemberById(member._id.toString());
      }
    }
    if (params.patientId && Types.ObjectId.isValid(params.patientId)) {
      const member = await InsuranceMemberModel.findOne({
        patientId: new Types.ObjectId(params.patientId),
        status: 'ACTIVE',
      })
        .sort({ createdAt: -1 })
        .lean();
      if (member) return this.getMemberById(member._id.toString());
    }
    return null;
  }

  async listMembers(query: ListMembersQuery) {
    const filter: Record<string, unknown> = {};
    if (query.policyId && Types.ObjectId.isValid(query.policyId)) {
      filter.policyId = new Types.ObjectId(query.policyId);
    }
    if (query.patientId && Types.ObjectId.isValid(query.patientId)) {
      filter.patientId = new Types.ObjectId(query.patientId);
    }
    if (query.memberNumber) {
      filter.memberNumber = query.memberNumber.trim().toUpperCase();
    }
    if (query.status) filter.status = query.status;
    if (query.branchId && Types.ObjectId.isValid(query.branchId)) {
      filter.$or = [{ branchId: null }, { branchId: new Types.ObjectId(query.branchId) }];
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      InsuranceMemberModel.find(filter)
        .populate('policyId', 'policyNumber status')
        .populate('patientId', 'patientNumber firstName lastName phone')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      InsuranceMemberModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  async updateMember(id: string, data: UpdateMemberInput, userId: string, metadata: RequestMetadata) {
    if (!Types.ObjectId.isValid(id)) return null;

    const existing = await InsuranceMemberModel.findById(id);
    if (!existing) return null;

    const updates: Partial<InsuranceMemberFields> = {
      updatedBy: new Types.ObjectId(userId),
      version: existing.version + 1,
    };

    if (data.memberNumber !== undefined) updates.memberNumber = data.memberNumber.trim().toUpperCase();
    if (data.subscriberId !== undefined) updates.subscriberId = data.subscriberId?.trim() ?? null;
    if (data.relationship !== undefined) updates.relationship = data.relationship;
    if (data.coverageStart !== undefined) updates.coverageStart = new Date(data.coverageStart);
    if (data.coverageEnd !== undefined) updates.coverageEnd = data.coverageEnd ? new Date(data.coverageEnd) : null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.branchId !== undefined) {
      updates.branchId = data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null;
    }

    const updated = await InsuranceMemberModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('policyId', 'policyNumber status')
      .populate('patientId', 'patientNumber firstName lastName phone')
      .lean();

    await this.audit('INSURANCE_MEMBER_UPDATED', userId, metadata, {
      memberId: id,
      previous: { status: existing.status, memberNumber: existing.memberNumber },
      updated: { status: updated?.status, memberNumber: updated?.memberNumber },
    });

    return updated;
  }

  // ================= ELIGIBILITY VERIFICATIONS =================
  async createEligibilityVerification(
    data: {
      memberId: string;
      patientId: string;
      policyId: string;
      payerId: string;
      schemeId?: string | null;
      requestedDate: string;
      correlationId: string;
      externalReferenceId?: string | null;
      status: 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'FAILED';
      reasonCode: string;
      errorMessage?: string | null;
      details?: Record<string, unknown> | null;
      requestTimestamp: Date;
      responseTimestamp?: Date | null;
      branchId?: string | null;
    },
    userId: string,
    metadata: RequestMetadata
  ) {
    const doc = await EligibilityVerificationModel.create({
      memberId: new Types.ObjectId(data.memberId),
      patientId: new Types.ObjectId(data.patientId),
      policyId: new Types.ObjectId(data.policyId),
      payerId: new Types.ObjectId(data.payerId),
      schemeId: data.schemeId && Types.ObjectId.isValid(data.schemeId) ? new Types.ObjectId(data.schemeId) : null,
      requestedDate: new Date(data.requestedDate),
      correlationId: data.correlationId,
      externalReferenceId: data.externalReferenceId ?? null,
      status: data.status,
      reasonCode: data.reasonCode,
      errorMessage: data.errorMessage ?? null,
      details: data.details ?? null,
      requestTimestamp: data.requestTimestamp,
      responseTimestamp: data.responseTimestamp ?? null,
      branchId: data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null,
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_ELIGIBILITY_VERIFIED', userId, metadata, {
      verificationId: doc._id.toString(),
      memberId: data.memberId,
      patientId: data.patientId,
      policyId: data.policyId,
      payerId: data.payerId,
      status: data.status,
      shaReferenceId: data.externalReferenceId ?? null,
      requestCorrelationId: data.correlationId,
    });

    return doc.toObject();
  }

  async getEligibilityVerificationById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EligibilityVerificationModel.findById(id)
      .populate('memberId', 'memberNumber relationship coverageStart coverageEnd status')
      .populate('patientId', 'patientNumber firstName lastName')
      .populate('policyId', 'policyNumber status')
      .populate('payerId', 'payerCode name')
      .populate('schemeId', 'schemeCode name')
      .lean();
  }

  async findRecentEligibilityVerification(
    memberId: string,
    requestedDate: string,
    maxAgeMinutes = 60
  ) {
    if (!Types.ObjectId.isValid(memberId)) return null;
    const reqDate = new Date(requestedDate);
    const startOfDay = new Date(reqDate.getFullYear(), reqDate.getMonth(), reqDate.getDate());
    const endOfDay = new Date(reqDate.getFullYear(), reqDate.getMonth(), reqDate.getDate(), 23, 59, 59, 999);
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    return EligibilityVerificationModel.findOne({
      memberId: new Types.ObjectId(memberId),
      requestedDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['ELIGIBLE', 'INELIGIBLE', 'PENDING'] },
      createdAt: { $gte: cutoffTime },
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async listEligibilityVerifications(query: ListEligibilityVerificationsQuery) {
    const filter: Record<string, unknown> = {};
    if (query.memberId && Types.ObjectId.isValid(query.memberId)) {
      filter.memberId = new Types.ObjectId(query.memberId);
    }
    if (query.patientId && Types.ObjectId.isValid(query.patientId)) {
      filter.patientId = new Types.ObjectId(query.patientId);
    }
    if (query.status) filter.status = query.status;
    if (query.correlationId) filter.correlationId = query.correlationId;

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      EligibilityVerificationModel.find(filter)
        .populate('memberId', 'memberNumber status')
        .populate('patientId', 'patientNumber firstName lastName')
        .populate('payerId', 'payerCode name')
        .populate('policyId', 'policyNumber')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      EligibilityVerificationModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  // ================= BENEFIT CONFIGURATIONS =================
  async createBenefitConfig(data: CreateBenefitConfigInput, userId: string, metadata: RequestMetadata) {
    const doc = await BenefitConfigModel.create({
      payerId: new Types.ObjectId(data.payerId),
      schemeId: data.schemeId && Types.ObjectId.isValid(data.schemeId) ? new Types.ObjectId(data.schemeId) : null,
      policyId: data.policyId && Types.ObjectId.isValid(data.policyId) ? new Types.ObjectId(data.policyId) : null,
      serviceId: data.serviceId && Types.ObjectId.isValid(data.serviceId) ? new Types.ObjectId(data.serviceId) : null,
      serviceCode: data.serviceCode?.trim().toUpperCase() ?? null,
      category: data.category?.trim() ?? null,
      coverageRule: data.coverageRule,
      authorizationRequired: data.authorizationRequired ?? false,
      coverageLimit: data.coverageLimit ?? null,
      copay: data.copay ?? null,
      isExcluded: data.isExcluded ?? false,
      exclusionReason: data.exclusionReason?.trim() ?? null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status ?? 'ACTIVE',
      branchId: data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null,
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.audit('INSURANCE_BENEFIT_CONFIG_CREATED', userId, metadata, {
      benefitConfigId: doc._id.toString(),
      payerId: data.payerId,
      schemeId: data.schemeId,
      serviceId: data.serviceId,
      serviceCode: data.serviceCode,
      category: data.category,
      coverageRule: data.coverageRule,
    });

    return doc.toObject();
  }

  async getBenefitConfigById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return BenefitConfigModel.findById(id)
      .populate('payerId', 'payerCode name type')
      .populate('schemeId', 'schemeCode name')
      .populate('policyId', 'policyNumber')
      .populate('serviceId', 'code name serviceType category standardPrice')
      .lean();
  }

  async listBenefitConfigs(query: ListBenefitConfigsQuery) {
    const filter: Record<string, unknown> = {};
    if (query.payerId && Types.ObjectId.isValid(query.payerId)) {
      filter.payerId = new Types.ObjectId(query.payerId);
    }
    if (query.schemeId && Types.ObjectId.isValid(query.schemeId)) {
      filter.schemeId = new Types.ObjectId(query.schemeId);
    }
    if (query.serviceId && Types.ObjectId.isValid(query.serviceId)) {
      filter.serviceId = new Types.ObjectId(query.serviceId);
    }
    if (query.serviceCode) {
      filter.serviceCode = query.serviceCode.trim().toUpperCase();
    }
    if (query.category) {
      filter.category = query.category.trim();
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.branchId && Types.ObjectId.isValid(query.branchId)) {
      filter.branchId = new Types.ObjectId(query.branchId);
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      BenefitConfigModel.find(filter)
        .populate('payerId', 'payerCode name')
        .populate('schemeId', 'schemeCode name')
        .populate('serviceId', 'code name serviceType category')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      BenefitConfigModel.countDocuments(filter),
    ]);

    return { items, total, limit, offset };
  }

  async updateBenefitConfig(id: string, data: UpdateBenefitConfigInput, userId: string, metadata: RequestMetadata) {
    if (!Types.ObjectId.isValid(id)) return null;
    const existing = await BenefitConfigModel.findById(id);
    if (!existing) return null;

    const updates: Partial<BenefitConfigFields> = {
      updatedBy: new Types.ObjectId(userId),
      version: existing.version + 1,
    };

    if (data.coverageRule !== undefined) updates.coverageRule = data.coverageRule;
    if (data.authorizationRequired !== undefined) updates.authorizationRequired = data.authorizationRequired;
    if (data.coverageLimit !== undefined) updates.coverageLimit = data.coverageLimit;
    if (data.copay !== undefined) updates.copay = data.copay;
    if (data.isExcluded !== undefined) updates.isExcluded = data.isExcluded;
    if (data.exclusionReason !== undefined) updates.exclusionReason = data.exclusionReason?.trim() ?? null;
    if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updates.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.status !== undefined) updates.status = data.status;
    if (data.branchId !== undefined) {
      updates.branchId = data.branchId && Types.ObjectId.isValid(data.branchId) ? new Types.ObjectId(data.branchId) : null;
    }

    const updated = await BenefitConfigModel.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('payerId', 'payerCode name')
      .populate('schemeId', 'schemeCode name')
      .populate('serviceId', 'code name serviceType category')
      .lean();

    await this.audit('INSURANCE_BENEFIT_CONFIG_UPDATED', userId, metadata, {
      benefitConfigId: id,
      updates: Object.keys(updates),
    });

    return updated;
  }

  async findConflictingBenefitConfig(params: {
    payerId: string;
    schemeId?: string | null;
    policyId?: string | null;
    serviceId?: string | null;
    serviceCode?: string | null;
    category?: string | null;
    startDate: string;
    endDate?: string | null;
    excludeId?: string;
  }) {
    if (!Types.ObjectId.isValid(params.payerId)) return null;

    const newStart = new Date(params.startDate);
    const newEnd = params.endDate ? new Date(params.endDate) : null;

    const filter: Record<string, unknown> = {
      payerId: new Types.ObjectId(params.payerId),
      policyId: params.policyId ? new Types.ObjectId(params.policyId) : null,
      status: 'ACTIVE',
    };

    if (params.excludeId && Types.ObjectId.isValid(params.excludeId)) {
      filter._id = { $ne: new Types.ObjectId(params.excludeId) };
    }

    if (params.schemeId && Types.ObjectId.isValid(params.schemeId)) {
      filter.schemeId = new Types.ObjectId(params.schemeId);
    } else {
      filter.schemeId = null;
    }

    if (params.serviceId && Types.ObjectId.isValid(params.serviceId)) {
      filter.serviceId = new Types.ObjectId(params.serviceId);
    } else if (params.serviceCode) {
      filter.serviceCode = params.serviceCode.trim().toUpperCase();
    } else if (params.category) {
      filter.category = params.category.trim();
    } else {
      return null;
    }

    const dateConditions: Record<string, unknown>[] = [
      {
        $or: [
          { endDate: null },
          { endDate: { $gte: newStart } },
        ],
      },
    ];

    if (newEnd) {
      dateConditions.push({
        startDate: { $lte: newEnd },
      });
    }

    filter.$and = dateConditions;

    return BenefitConfigModel.findOne(filter).lean();
  }

  async findMatchingBenefitConfigs(params: {
    payerId: string;
    schemeId?: string | null;
    policyId?: string | null;
    serviceId?: string;
    serviceCode?: string;
    category?: string;
    asOfDate: Date;
  }) {
    if (!Types.ObjectId.isValid(params.payerId)) return [];

    const date = params.asOfDate;
    const schemeIds: (Types.ObjectId | null)[] = [null];
    if (params.schemeId && Types.ObjectId.isValid(params.schemeId)) {
      schemeIds.push(new Types.ObjectId(params.schemeId));
    }
    const policyIds: (Types.ObjectId | null)[] = [null];
    if (params.policyId && Types.ObjectId.isValid(params.policyId)) {
      policyIds.push(new Types.ObjectId(params.policyId));
    }

    const targetConditions: Record<string, unknown>[] = [];
    if (params.serviceId && Types.ObjectId.isValid(params.serviceId)) {
      targetConditions.push({ serviceId: new Types.ObjectId(params.serviceId) });
    }
    if (params.serviceCode) {
      targetConditions.push({ serviceId: null, serviceCode: params.serviceCode.trim().toUpperCase() });
    }
    if (params.category) {
      targetConditions.push({ serviceId: null, serviceCode: null, category: params.category.trim() });
    }

    if (targetConditions.length === 0) return [];

    const query: Record<string, unknown> = {
      payerId: new Types.ObjectId(params.payerId),
      status: 'ACTIVE' as const,
      startDate: { $lte: date },
      $and: [
        { $or: [{ endDate: null }, { endDate: { $gte: date } }] },
        { schemeId: { $in: schemeIds } },
        { policyId: { $in: policyIds } },
        { $or: targetConditions },
      ],
    };

    return BenefitConfigModel.find(query).lean();
  }

  async getServiceByIdOrCode(idOrCode: { serviceId?: string; serviceCode?: string }) {
    if (idOrCode.serviceId && Types.ObjectId.isValid(idOrCode.serviceId)) {
      return ServiceModel.findById(idOrCode.serviceId).lean();
    }
    if (idOrCode.serviceCode) {
      return ServiceModel.findOne({ code: idOrCode.serviceCode.trim().toUpperCase() }).lean();
    }
    return null;
  }
}
