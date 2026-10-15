import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/app-error.js';
import type { InsuranceRepository } from './insurance.repository.js';
import {
  createShaEligibilityAdapter,
  type IShaEligibilityAdapter,
} from './sha-eligibility.adapter.js';
import type {
  CheckCoverageInput,
  CoverageCheckResult,
  CoverageRule,
  CreateBenefitConfigInput,
  CreateMemberInput,
  CreatePayerInput,
  CreatePolicyInput,
  CreateSchemeInput,
  EligibilityVerificationResult,
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
  VerifyBenefitInput,
  VerifyBenefitResult,
  VerifyEligibilityInput,
} from './insurance.types.js';

export class InsuranceService {
  constructor(
    private readonly repository: InsuranceRepository,
    private readonly shaAdapter: IShaEligibilityAdapter = createShaEligibilityAdapter()
  ) {}

  private validateDates(from?: string | null, to?: string | null, label = 'Effective') {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (fromDate.getTime() > toDate.getTime()) {
        throw new AppError(
          `${label} start/from date cannot be later than end/to date`,
          400,
          'INVALID_DATE_RANGE'
        );
      }
    }
  }

  // ================= PAYERS =================
  async createPayer(input: CreatePayerInput, userId: string, metadata: RequestMetadata) {
    this.validateDates(input.effectiveFrom, input.effectiveTo, 'Effective');

    const existingCode = await this.repository.getPayerByCode(input.payerCode);
    if (existingCode) {
      throw new AppError('Payer code already exists', 409, 'PAYER_CODE_EXISTS');
    }

    try {
      return await this.repository.createPayer(input, userId, metadata);
    } catch (error) {
      if (this.repository.isDuplicateKeyError(error)) {
        throw new AppError('Payer code already exists', 409, 'PAYER_CODE_EXISTS');
      }
      throw error;
    }
  }

  async getPayer(id: string) {
    const payer = await this.repository.getPayerById(id);
    if (!payer) {
      throw new AppError('Payer not found', 404, 'PAYER_NOT_FOUND');
    }
    return payer;
  }

  async listPayers(query: ListPayersQuery) {
    return this.repository.listPayers(query);
  }

  async updatePayer(id: string, input: UpdatePayerInput, userId: string, metadata: RequestMetadata) {
    const existing = await this.getPayer(id);

    const effectiveFrom = input.effectiveFrom !== undefined ? input.effectiveFrom : existing.effectiveFrom?.toISOString();
    const effectiveTo = input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo?.toISOString();
    this.validateDates(effectiveFrom, effectiveTo, 'Effective');

    const updated = await this.repository.updatePayer(id, input, userId, metadata);
    if (!updated) {
      throw new AppError('Payer not found', 404, 'PAYER_NOT_FOUND');
    }
    return updated;
  }

  // ================= SCHEMES =================
  async createScheme(input: CreateSchemeInput, userId: string, metadata: RequestMetadata) {
    // 1. Verify payer exists
    const payer = await this.repository.getPayerById(input.payerId);
    if (!payer) {
      throw new AppError('Payer not found', 404, 'PAYER_NOT_FOUND');
    }

    // 2. Validate dates
    this.validateDates(input.effectiveFrom, input.effectiveTo, 'Effective');

    // 3. Check duplicate scheme code under payer
    const existing = await this.repository.getSchemeByCode(input.payerId, input.schemeCode);
    if (existing) {
      throw new AppError('Scheme code already exists for this payer', 409, 'SCHEME_CODE_EXISTS');
    }

    try {
      return await this.repository.createScheme(input, userId, metadata);
    } catch (error) {
      if (this.repository.isDuplicateKeyError(error)) {
        throw new AppError('Scheme code already exists for this payer', 409, 'SCHEME_CODE_EXISTS');
      }
      throw error;
    }
  }

  async getScheme(id: string) {
    const scheme = await this.repository.getSchemeById(id);
    if (!scheme) {
      throw new AppError('Insurance scheme not found', 404, 'SCHEME_NOT_FOUND');
    }
    return scheme;
  }

  async listSchemes(query: ListSchemesQuery) {
    return this.repository.listSchemes(query);
  }

  async updateScheme(id: string, input: UpdateSchemeInput, userId: string, metadata: RequestMetadata) {
    const existing = await this.getScheme(id);

    const effectiveFrom = input.effectiveFrom !== undefined ? input.effectiveFrom : existing.effectiveFrom?.toISOString();
    const effectiveTo = input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo?.toISOString();
    this.validateDates(effectiveFrom, effectiveTo, 'Effective');

    if (input.schemeCode && input.schemeCode.toUpperCase() !== existing.schemeCode) {
      const payerId = (existing.payerId as { _id?: unknown })._id?.toString() ?? existing.payerId.toString();
      const duplicate = await this.repository.getSchemeByCode(payerId, input.schemeCode);
      if (duplicate && duplicate._id.toString() !== id) {
        throw new AppError('Scheme code already exists for this payer', 409, 'SCHEME_CODE_EXISTS');
      }
    }

    const updated = await this.repository.updateScheme(id, input, userId, metadata);
    if (!updated) {
      throw new AppError('Insurance scheme not found', 404, 'SCHEME_NOT_FOUND');
    }
    return updated;
  }

  // ================= POLICIES =================
  async createPolicy(input: CreatePolicyInput, userId: string, metadata: RequestMetadata) {
    // 1. Verify payer exists
    const payer = await this.repository.getPayerById(input.payerId);
    if (!payer) {
      throw new AppError('Payer not found', 404, 'PAYER_NOT_FOUND');
    }

    // 2. Verify scheme exists and belongs to payer
    const scheme = await this.repository.getSchemeById(input.schemeId);
    if (!scheme) {
      throw new AppError('Insurance scheme not found', 404, 'SCHEME_NOT_FOUND');
    }
    const schemePayerId = (scheme.payerId as { _id?: unknown })._id?.toString() ?? scheme.payerId.toString();
    if (schemePayerId !== input.payerId) {
      throw new AppError('Insurance scheme does not belong to the specified payer', 400, 'INVALID_SCHEME_PAYER_RELATION');
    }

    // 3. Verify holder patient exists in HMS Patient records
    const patient = await this.repository.getPatientById(input.holderPatientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // 4. Validate dates
    this.validateDates(input.startDate, input.endDate, 'Policy');

    // 5. Check duplicate policy number for payer
    const existing = await this.repository.getPolicyByNumber(input.payerId, input.policyNumber);
    if (existing) {
      throw new AppError('Policy number already exists for this payer', 409, 'POLICY_NUMBER_EXISTS');
    }

    try {
      return await this.repository.createPolicy(input, userId, metadata);
    } catch (error) {
      if (this.repository.isDuplicateKeyError(error)) {
        throw new AppError('Policy number already exists for this payer', 409, 'POLICY_NUMBER_EXISTS');
      }
      throw error;
    }
  }

  async getPolicy(id: string) {
    const policy = await this.repository.getPolicyById(id);
    if (!policy) {
      throw new AppError('Insurance policy not found', 404, 'POLICY_NOT_FOUND');
    }
    return policy;
  }

  async listPolicies(query: ListPoliciesQuery) {
    return this.repository.listPolicies(query);
  }

  async updatePolicy(id: string, input: UpdatePolicyInput, userId: string, metadata: RequestMetadata) {
    const existing = await this.getPolicy(id);

    const startDate = input.startDate !== undefined ? input.startDate : existing.startDate.toISOString();
    const endDate = input.endDate !== undefined ? input.endDate : existing.endDate?.toISOString();
    this.validateDates(startDate, endDate, 'Policy');

    if (input.policyNumber && input.policyNumber.toUpperCase() !== existing.policyNumber) {
      const payerId = (existing.payerId as { _id?: unknown })._id?.toString() ?? existing.payerId.toString();
      const duplicate = await this.repository.getPolicyByNumber(payerId, input.policyNumber);
      if (duplicate && duplicate._id.toString() !== id) {
        throw new AppError('Policy number already exists for this payer', 409, 'POLICY_NUMBER_EXISTS');
      }
    }

    const updated = await this.repository.updatePolicy(id, input, userId, metadata);
    if (!updated) {
      throw new AppError('Insurance policy not found', 404, 'POLICY_NOT_FOUND');
    }
    return updated;
  }

  // ================= MEMBERS =================
  async createMember(input: CreateMemberInput, userId: string, metadata: RequestMetadata) {
    // 1. Verify policy exists
    const policy = await this.repository.getPolicyById(input.policyId);
    if (!policy) {
      throw new AppError('Insurance policy not found', 404, 'POLICY_NOT_FOUND');
    }

    // 2. Verify patient exists in HMS Patient records
    const patient = await this.repository.getPatientById(input.patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // 3. Validate member coverage dates
    this.validateDates(input.coverageStart, input.coverageEnd, 'Member coverage');

    // 4. Validate coverage dates fit within policy validity period
    const policyStartDate = new Date(policy.startDate).getTime();
    const memberCoverageStart = new Date(input.coverageStart).getTime();
    if (memberCoverageStart < policyStartDate) {
      throw new AppError('Member coverage start date cannot precede policy start date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
    }
    if (policy.endDate) {
      const policyEndDate = new Date(policy.endDate).getTime();
      if (!input.coverageEnd) {
        throw new AppError('Member coverage end date cannot exceed policy end date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
      }
      const memberCoverageEnd = new Date(input.coverageEnd).getTime();
      if (memberCoverageEnd > policyEndDate) {
        throw new AppError('Member coverage end date cannot exceed policy end date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
      }
    }

    // 5. Prevent duplicate active member for the same patient under this policy
    const memberStatus = input.status ?? 'ACTIVE';
    if (memberStatus === 'ACTIVE') {
      const activeExisting = await this.repository.getActiveMemberForPatient(input.policyId, input.patientId);
      if (activeExisting) {
        throw new AppError('An active membership already exists for this patient under this policy', 409, 'DUPLICATE_ACTIVE_MEMBER');
      }
    }

    // 6. Check duplicate member number under policy
    const existing = await this.repository.getMemberByNumber(input.policyId, input.memberNumber);
    if (existing) {
      throw new AppError('Member number already exists for this policy', 409, 'MEMBER_NUMBER_EXISTS');
    }

    try {
      return await this.repository.createMember(input, userId, metadata);
    } catch (error) {
      if (this.repository.isDuplicateKeyError(error)) {
        throw new AppError('Member record or member number already exists for this policy', 409, 'MEMBER_NUMBER_EXISTS');
      }
      throw error;
    }
  }

  async getMember(id: string) {
    const member = await this.repository.getMemberById(id);
    if (!member) {
      throw new AppError('Insurance member not found', 404, 'MEMBER_NOT_FOUND');
    }
    return member;
  }

  async listMembers(query: ListMembersQuery) {
    return this.repository.listMembers(query);
  }

  async updateMember(id: string, input: UpdateMemberInput, userId: string, metadata: RequestMetadata) {
    const existing = await this.getMember(id);

    const coverageStart = input.coverageStart !== undefined ? input.coverageStart : existing.coverageStart.toISOString();
    const coverageEnd = input.coverageEnd !== undefined ? input.coverageEnd : existing.coverageEnd?.toISOString();
    this.validateDates(coverageStart, coverageEnd, 'Member coverage');

    const policyId = (existing.policyId as { _id?: unknown })._id?.toString() ?? existing.policyId.toString();
    const policy = await this.repository.getPolicyById(policyId);
    if (policy) {
      const policyStartDate = new Date(policy.startDate).getTime();
      const memberCoverageStart = new Date(coverageStart).getTime();
      if (memberCoverageStart < policyStartDate) {
        throw new AppError('Member coverage start date cannot precede policy start date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
      }
      if (policy.endDate) {
        const policyEndDate = new Date(policy.endDate).getTime();
        if (!coverageEnd) {
          throw new AppError('Member coverage end date cannot exceed policy end date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
        }
        const memberCoverageEnd = new Date(coverageEnd).getTime();
        if (memberCoverageEnd > policyEndDate) {
          throw new AppError('Member coverage end date cannot exceed policy end date', 400, 'COVERAGE_OUTSIDE_POLICY_PERIOD');
        }
      }
    }

    if (input.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      const patientId = (existing.patientId as { _id?: unknown })._id?.toString() ?? existing.patientId.toString();
      const activeExisting = await this.repository.getActiveMemberForPatient(policyId, patientId);
      if (activeExisting && activeExisting._id.toString() !== id) {
        throw new AppError('An active membership already exists for this patient under this policy', 409, 'DUPLICATE_ACTIVE_MEMBER');
      }
    }

    if (input.memberNumber && input.memberNumber.toUpperCase() !== existing.memberNumber) {
      const duplicate = await this.repository.getMemberByNumber(policyId, input.memberNumber);
      if (duplicate && duplicate._id.toString() !== id) {
        throw new AppError('Member number already exists for this policy', 409, 'MEMBER_NUMBER_EXISTS');
      }
    }

    const updated = await this.repository.updateMember(id, input, userId, metadata);
    if (!updated) {
      throw new AppError('Insurance member not found', 404, 'MEMBER_NOT_FOUND');
    }
    return updated;
  }

  // ================= INTERNAL COVERAGE CHECK =================
  async checkCoverage(input: CheckCoverageInput): Promise<CoverageCheckResult> {
    const checkedAt = new Date().toISOString();
    const asOfTime = input.asOfDate ? new Date(input.asOfDate).getTime() : Date.now();

    // 1. Resolve member
    const member = await this.repository.findMemberForCoverageCheck(input);
    if (!member) {
      return {
        valid: false,
        reasonCode: 'MEMBER_NOT_FOUND',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Insurance member record not found',
        checkedAt,
      };
    }

    const memberId = member._id.toString();
    const policyId = (member.policyId as any)?._id?.toString() ?? member.policyId?.toString();
    const patientId = (member.patientId as any)?._id?.toString() ?? member.patientId?.toString();
    const memberNumber = member.memberNumber;

    // 2. Validate patient reference and matching
    if (input.patientId && patientId !== input.patientId) {
      return {
        valid: false,
        reasonCode: 'PATIENT_MISMATCH',
        shaEligibilityStatus: 'NOT_VERIFIED',
        memberId,
        policyId,
        patientId,
        memberNumber,
        message: 'Member does not belong to the specified patient',
        checkedAt,
      };
    }

    const patient = await this.repository.getPatientById(patientId);
    if (!patient) {
      return {
        valid: false,
        reasonCode: 'PATIENT_NOT_FOUND',
        shaEligibilityStatus: 'NOT_VERIFIED',
        memberId,
        policyId,
        patientId,
        memberNumber,
        message: 'Patient record not found in HMS master',
        checkedAt,
      };
    }

    // 3. Resolve policy
    const policy = await this.repository.getPolicyById(policyId);
    if (!policy) {
      return {
        valid: false,
        reasonCode: 'POLICY_NOT_FOUND',
        shaEligibilityStatus: 'NOT_VERIFIED',
        memberId,
        policyId,
        patientId,
        memberNumber,
        message: 'Insurance policy record not found',
        checkedAt,
      };
    }

    const payerId = (policy.payerId as any)?._id?.toString() ?? policy.payerId?.toString();
    const schemeId = (policy.schemeId as any)?._id?.toString() ?? policy.schemeId?.toString();
    const payerCode = (policy.payerId as any)?.payerCode;
    const schemeCode = (policy.schemeId as any)?.schemeCode;
    const policyNumber = policy.policyNumber;

    const baseResult = {
      memberId,
      policyId,
      patientId,
      payerId,
      schemeId,
      memberNumber,
      policyNumber,
      payerCode,
      schemeCode,
      checkedAt,
    };

    // 4. Check policy status
    if (policy.status === 'INACTIVE') {
      return {
        valid: false,
        reasonCode: 'POLICY_INACTIVE',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Insurance policy is currently inactive',
        ...baseResult,
      };
    }
    if (policy.status === 'EXPIRED') {
      return {
        valid: false,
        reasonCode: 'POLICY_EXPIRED',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Insurance policy has expired',
        ...baseResult,
      };
    }
    if (policy.status === 'SUSPENDED') {
      return {
        valid: false,
        reasonCode: 'POLICY_SUSPENDED',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Insurance policy is suspended',
        ...baseResult,
      };
    }
    if (policy.status !== 'ACTIVE') {
      return {
        valid: false,
        reasonCode: 'POLICY_INACTIVE',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: `Insurance policy status is ${policy.status}`,
        ...baseResult,
      };
    }

    // 5. Check policy effective dates
    const policyStartTime = new Date(policy.startDate).getTime();
    if (asOfTime < policyStartTime) {
      return {
        valid: false,
        reasonCode: 'POLICY_NOT_EFFECTIVE',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Insurance policy is not yet effective',
        ...baseResult,
      };
    }
    if (policy.endDate) {
      const policyEndTime = new Date(policy.endDate).getTime();
      if (asOfTime > policyEndTime) {
        return {
          valid: false,
          reasonCode: 'POLICY_EXPIRED',
          shaEligibilityStatus: 'NOT_VERIFIED',
          message: 'Insurance policy has expired',
          ...baseResult,
        };
      }
    }

    // 6. Check member status
    if (member.status === 'INACTIVE') {
      return {
        valid: false,
        reasonCode: 'MEMBER_INACTIVE',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Member insurance coverage is currently inactive',
        ...baseResult,
      };
    }
    if (member.status === 'SUSPENDED') {
      return {
        valid: false,
        reasonCode: 'MEMBER_SUSPENDED',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Member insurance coverage is suspended',
        ...baseResult,
      };
    }
    if (member.status !== 'ACTIVE') {
      return {
        valid: false,
        reasonCode: 'MEMBER_INACTIVE',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: `Member status is ${member.status}`,
        ...baseResult,
      };
    }

    // 7. Check member coverage dates
    const memberStartTime = new Date(member.coverageStart).getTime();
    if (asOfTime < memberStartTime) {
      return {
        valid: false,
        reasonCode: 'MEMBER_COVERAGE_NOT_STARTED',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Member insurance coverage has not yet started',
        ...baseResult,
      };
    }
    if (member.coverageEnd) {
      const memberEndTime = new Date(member.coverageEnd).getTime();
      if (asOfTime > memberEndTime) {
        return {
          valid: false,
          reasonCode: 'MEMBER_COVERAGE_EXPIRED',
          shaEligibilityStatus: 'NOT_VERIFIED',
          message: 'Member insurance coverage has expired',
          ...baseResult,
        };
      }
    }

    // 8. Check member coverage alignment with policy period
    if (memberStartTime < policyStartTime) {
      return {
        valid: false,
        reasonCode: 'COVERAGE_OUTSIDE_POLICY_PERIOD',
        shaEligibilityStatus: 'NOT_VERIFIED',
        message: 'Member coverage start date precedes policy start date',
        ...baseResult,
      };
    }
    if (policy.endDate) {
      const policyEndTime = new Date(policy.endDate).getTime();
      if (!member.coverageEnd || new Date(member.coverageEnd).getTime() > policyEndTime) {
        return {
          valid: false,
          reasonCode: 'COVERAGE_OUTSIDE_POLICY_PERIOD',
          shaEligibilityStatus: 'NOT_VERIFIED',
          message: 'Member coverage end date exceeds policy validity period',
          ...baseResult,
        };
      }
    }

    // 9. All local checks passed!
    return {
      valid: true,
      reasonCode: 'LOCAL_COVERAGE_VALID',
      shaEligibilityStatus: 'NOT_VERIFIED',
      message: 'Local insurance coverage is active and valid (SHA eligibility not yet verified)',
      ...baseResult,
      details: {
        relationship: member.relationship,
        subscriberId: member.subscriberId,
        coverageStart: member.coverageStart,
        coverageEnd: member.coverageEnd,
        holderType: policy.holderType,
        holderPatientId: policy.holderPatientId,
        coverageDetails: policy.coverageDetails,
      },
    };
  }

  // ================= SHA ELIGIBILITY VERIFICATION =================
  async verifyEligibility(
    input: VerifyEligibilityInput,
    userId: string,
    metadata: RequestMetadata
  ): Promise<EligibilityVerificationResult> {
    const requestedDateStr = input.requestedDate ?? new Date().toISOString();

    // 1. Mandatory Local Precondition Check
    const localCoverage = await this.checkCoverage({
      memberId: input.memberId,
      asOfDate: requestedDateStr,
    });

    if (!localCoverage.valid) {
      // Must NOT call SHA adapter. Return local coverage failure!
      throw new AppError(
        `Local coverage check failed: ${localCoverage.message}`,
        400,
        localCoverage.reasonCode,
        localCoverage
      );
    }

    // 2. Idempotency / Duplicate Safety Check
    if (!input.forceRefresh) {
      const recent = await this.repository.findRecentEligibilityVerification(
        input.memberId,
        requestedDateStr,
        60
      );
      if (recent) {
        return this.mapVerificationDocToResult(recent);
      }
    }

    // 3. Resolve Member, Policy, Patient details for SHA adapter payload
    const member = await this.repository.getMemberById(input.memberId);
    if (!member) {
      throw new AppError('Insurance member not found', 404, 'MEMBER_NOT_FOUND');
    }

    const patient = member.patientId as any;
    const policy = member.policyId as any;
    const payer = policy?.payerId as any;
    const scheme = policy?.schemeId as any;

    const correlationId = input.correlationId?.trim() || randomUUID();
    const requestTimestamp = new Date();

    // 4. Call SHA Client Adapter
    const shaResponse = await this.shaAdapter.verifyEligibility({
      memberNumber: member.memberNumber,
      patientNumber: patient?.patientNumber ?? '',
      subscriberId: member.subscriberId,
      policyNumber: policy?.policyNumber ?? '',
      schemeCode: scheme?.schemeCode,
      payerCode: payer?.payerCode ?? 'SHA',
      requestedDate: requestedDateStr,
      correlationId,
      patientId: patient?._id?.toString() ?? member.patientId?.toString(),
    });

    const responseTimestamp = new Date();

    // 5. Persist normalized eligibility verification record
    const created = await this.repository.createEligibilityVerification(
      {
        memberId: member._id.toString(),
        patientId: patient?._id?.toString() ?? member.patientId.toString(),
        policyId: policy?._id?.toString() ?? member.policyId.toString(),
        payerId: payer?._id?.toString() ?? policy?.payerId?.toString(),
        schemeId: scheme?._id?.toString() ?? policy?.schemeId?.toString() ?? null,
        requestedDate: requestedDateStr,
        correlationId,
        externalReferenceId: shaResponse.externalReferenceId ?? null,
        status: shaResponse.status,
        reasonCode: shaResponse.reasonCode,
        errorMessage: shaResponse.status === 'FAILED' ? shaResponse.message : null,
        details: shaResponse.details ?? null,
        requestTimestamp,
        responseTimestamp,
        branchId: member.branchId ? (member.branchId as any).toString() : null,
      },
      userId,
      metadata
    );

    return this.mapVerificationDocToResult(created);
  }

  async getEligibilityVerification(id: string) {
    const doc = await this.repository.getEligibilityVerificationById(id);
    if (!doc) {
      throw new AppError('Eligibility verification record not found', 404, 'VERIFICATION_NOT_FOUND');
    }
    return this.mapVerificationDocToResult(doc);
  }

  async listEligibilityVerifications(query: ListEligibilityVerificationsQuery) {
    const { items, total, limit, offset } = await this.repository.listEligibilityVerifications(query);
    return {
      items: items.map((doc) => this.mapVerificationDocToResult(doc)),
      total,
      limit,
      offset,
    };
  }

  private mapVerificationDocToResult(doc: any): EligibilityVerificationResult {
    return {
      id: doc._id.toString(),
      memberId: (doc.memberId?._id ?? doc.memberId).toString(),
      patientId: (doc.patientId?._id ?? doc.patientId).toString(),
      policyId: (doc.policyId?._id ?? doc.policyId).toString(),
      payerId: (doc.payerId?._id ?? doc.payerId).toString(),
      schemeId: doc.schemeId ? (doc.schemeId?._id ?? doc.schemeId).toString() : null,
      memberNumber: doc.memberId?.memberNumber ?? doc.memberNumber ?? '',
      policyNumber: doc.policyId?.policyNumber ?? doc.policyNumber ?? '',
      payerCode: doc.payerId?.payerCode ?? doc.payerCode ?? 'SHA',
      schemeCode: doc.schemeId?.schemeCode ?? doc.schemeCode ?? null,
      requestedDate: doc.requestedDate instanceof Date ? doc.requestedDate.toISOString() : String(doc.requestedDate),
      correlationId: doc.correlationId,
      externalReferenceId: doc.externalReferenceId ?? null,
      status: doc.status,
      reasonCode: doc.reasonCode,
      message: doc.errorMessage ?? (doc.status === 'ELIGIBLE' ? 'SHA confirmed member eligibility' : `Status: ${doc.status}`),
      errorMessage: doc.errorMessage ?? null,
      details: doc.details ?? undefined,
      requestTimestamp: doc.requestTimestamp instanceof Date ? doc.requestTimestamp.toISOString() : String(doc.requestTimestamp),
      responseTimestamp: doc.responseTimestamp ? (doc.responseTimestamp instanceof Date ? doc.responseTimestamp.toISOString() : String(doc.responseTimestamp)) : null,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    };
  }

  // ================= BENEFIT CONFIGURATION & SERVICE COVERAGE =================
  async createBenefitConfig(data: CreateBenefitConfigInput, userId: string, metadata: RequestMetadata) {
    const payer = await this.repository.getPayerById(data.payerId);
    if (!payer) {
      throw new AppError('Payer record not found', 404, 'PAYER_NOT_FOUND');
    }

    if (data.schemeId) {
      const scheme = await this.repository.getSchemeById(data.schemeId);
      if (!scheme) {
        throw new AppError('Insurance scheme not found', 404, 'SCHEME_NOT_FOUND');
      }
      const schemePayerId = (scheme.payerId as any)?._id?.toString() ?? scheme.payerId?.toString();
      if (schemePayerId !== data.payerId) {
        throw new AppError('Scheme does not belong to specified payer', 400, 'SCHEME_PAYER_MISMATCH');
      }
    }

    if (data.startDate && data.endDate) {
      if (new Date(data.startDate).getTime() > new Date(data.endDate).getTime()) {
        throw new AppError('Benefit start date cannot be after end date', 400, 'INVALID_DATE_RANGE');
      }
    }

    if (data.serviceId) {
      const service = await this.repository.getServiceByIdOrCode({ serviceId: data.serviceId });
      if (!service) {
        throw new AppError('Service not found in HMS Service Catalogue', 404, 'SERVICE_NOT_FOUND');
      }
    }

    // Check for conflicting active configuration
    const conflict = await this.repository.findConflictingBenefitConfig({
      payerId: data.payerId,
      schemeId: data.schemeId,
      policyId: data.policyId,
      serviceId: data.serviceId,
      serviceCode: data.serviceCode,
      category: data.category,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (conflict) {
      throw new AppError(
        'An active benefit configuration already exists for this service and effective period',
        409,
        'CONFLICTING_BENEFIT_CONFIG'
      );
    }

    return this.repository.createBenefitConfig(data, userId, metadata);
  }

  async getBenefitConfig(id: string) {
    const config = await this.repository.getBenefitConfigById(id);
    if (!config) {
      throw new AppError('Benefit configuration not found', 404, 'BENEFIT_CONFIG_NOT_FOUND');
    }
    return config;
  }

  async listBenefitConfigs(query: ListBenefitConfigsQuery) {
    return this.repository.listBenefitConfigs(query);
  }

  async updateBenefitConfig(id: string, data: UpdateBenefitConfigInput, userId: string, metadata: RequestMetadata) {
    const existing = await this.repository.getBenefitConfigById(id);
    if (!existing) {
      throw new AppError('Benefit configuration not found', 404, 'BENEFIT_CONFIG_NOT_FOUND');
    }

    const startDate = data.startDate ?? existing.startDate.toISOString();
    const endDate = data.endDate !== undefined ? data.endDate : (existing.endDate ? existing.endDate.toISOString() : null);

    if (startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        throw new AppError('Benefit start date cannot be after end date', 400, 'INVALID_DATE_RANGE');
      }
    }

    const payerId = data.payerId ?? existing.payerId._id.toString();
    const schemeId = data.schemeId !== undefined ? data.schemeId : (existing.schemeId ? (existing.schemeId as any)._id?.toString() : null);
    const serviceId = data.serviceId !== undefined ? data.serviceId : (existing.serviceId ? (existing.serviceId as any)._id?.toString() : null);
    const serviceCode = data.serviceCode !== undefined ? data.serviceCode : existing.serviceCode;
    const category = data.category !== undefined ? data.category : existing.category;

    if (data.status !== 'INACTIVE') {
      const conflict = await this.repository.findConflictingBenefitConfig({
        payerId,
        schemeId,
        policyId: existing.policyId?._id.toString() ?? null,
        serviceId,
        serviceCode,
        category,
        startDate,
        endDate,
        excludeId: id,
      });

      if (conflict) {
        throw new AppError(
          'An active benefit configuration already exists for this service and effective period',
          409,
          'CONFLICTING_BENEFIT_CONFIG'
        );
      }
    }

    return this.repository.updateBenefitConfig(id, data, userId, metadata);
  }

  async verifyBenefit(
    input: VerifyBenefitInput,
    userId: string,
    metadata: RequestMetadata
  ): Promise<VerifyBenefitResult> {
    const requestedDateStr = input.requestedDate ?? new Date().toISOString();
    const requestedDate = new Date(requestedDateStr);

    // 1. Resolve member
    const member = await this.repository.getMemberById(input.memberId);
    if (!member) {
      throw new AppError('Insurance member not found', 404, 'MEMBER_NOT_FOUND');
    }

    // 2. Resolve catalogue service
    const service = await this.repository.getServiceByIdOrCode({
      serviceId: input.serviceId,
      serviceCode: input.serviceCode,
    });

    if (!service) {
      throw new AppError('Service not found in HMS Service Catalogue', 404, 'SERVICE_NOT_FOUND');
    }

    // 3. Local coverage precondition check
    const localCoverage = await this.checkCoverage({
      memberId: input.memberId,
      asOfDate: requestedDateStr,
    });

    if (!localCoverage.valid) {
      return {
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        memberId: input.memberId,
        serviceId: service._id.toString(),
        serviceCode: service.code,
        serviceName: service.name,
        reasonCode: localCoverage.reasonCode,
        message: `Local coverage check failed: ${localCoverage.message}`,
        authorizationRequired: false,
        verifiedAt: new Date().toISOString(),
      };
    }

    // 4. Usable SHA eligibility precondition check
    const recentVerification = await this.repository.findRecentEligibilityVerification(
      input.memberId,
      requestedDateStr,
      60
    );

    if (!recentVerification || recentVerification.status !== 'ELIGIBLE') {
      return {
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        memberId: input.memberId,
        serviceId: service._id.toString(),
        serviceCode: service.code,
        serviceName: service.name,
        reasonCode: 'ELIGIBILITY_VERIFICATION_REQUIRED',
        message: 'Active SHA eligibility verification is required before evaluating benefit coverage',
        authorizationRequired: false,
        verifiedAt: new Date().toISOString(),
      };
    }

    // 5. Match applicable benefit configuration
    const policy = member.policyId as any;
    const payerId = (policy?.payerId as any)?._id?.toString() ?? policy?.payerId?.toString();
    const schemeId = (policy?.schemeId as any)?._id?.toString() ?? policy?.schemeId?.toString() ?? null;

    const matchingConfigs = await this.repository.findMatchingBenefitConfigs({
      payerId,
      schemeId,
      policyId: policy._id.toString(),
      serviceId: service._id.toString(),
      serviceCode: service.code,
      category: service.category,
      asOfDate: requestedDate,
    });

    if (!matchingConfigs || matchingConfigs.length === 0) {
      return {
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        memberId: input.memberId,
        serviceId: service._id.toString(),
        serviceCode: service.code,
        serviceName: service.name,
        reasonCode: 'NO_BENEFIT_CONFIGURED',
        message: 'No active benefit configuration found for this service under member policy, scheme or payer',
        authorizationRequired: false,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Scope takes precedence over target specificity. Exclusions are authoritative
    // decisions too; never retry a less-specific configuration after selection.
    matchingConfigs.sort((a, b) => {
      const getPriority = (c: typeof a) => {
        let score = c.policyId ? 20 : c.schemeId ? 10 : 0;
        if (c.serviceId) score += 3;
        else if (c.serviceCode) score += 2;
        else if (c.category) score += 1;
        return score;
      };
      return getPriority(b) - getPriority(a);
    });

    const selectedBenefit = matchingConfigs[0];
    if (!selectedBenefit) {
      return {
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        memberId: input.memberId,
        serviceId: service._id.toString(),
        serviceCode: service.code,
        serviceName: service.name,
        reasonCode: 'NO_BENEFIT_CONFIGURED',
        message: 'No active benefit configuration found for this service under member policy, scheme or payer',
        authorizationRequired: false,
        verifiedAt: new Date().toISOString(),
      };
    }

    // 6. Evaluate benefit coverage rules
    let benefitStatus: CoverageRule = selectedBenefit.coverageRule;
    let eligible = true;
    let reasonCode = 'BENEFIT_COVERED';
    let message = 'Service is covered under the configured benefit; final financial liability is not determined';
    let authorizationRequired = Boolean(selectedBenefit.authorizationRequired || benefitStatus === 'AUTHORIZATION_REQUIRED');

    if (selectedBenefit.isExcluded || benefitStatus === 'NOT_COVERED') {
      benefitStatus = 'NOT_COVERED';
      eligible = false;
      reasonCode = selectedBenefit.exclusionReason || 'SERVICE_EXCLUDED';
      message = selectedBenefit.exclusionReason ?? 'Service is explicitly excluded under benefit policy';
      authorizationRequired = false;
    } else if (authorizationRequired) {
      benefitStatus = 'AUTHORIZATION_REQUIRED';
      eligible = true;
      reasonCode = 'PREAUTHORIZATION_REQUIRED';
      message = 'Service is covered but requires prior authorization before procedure/service delivery';
    } else if (benefitStatus === 'PARTIALLY_COVERED' || (selectedBenefit.copay && selectedBenefit.copay.value > 0)) {
      benefitStatus = 'PARTIALLY_COVERED';
      eligible = true;
      reasonCode = 'BENEFIT_PARTIALLY_COVERED';
      message = 'Service is partially covered subject to configured copay or limit';
    }

    const result: VerifyBenefitResult = {
      eligible,
      benefitStatus,
      memberId: input.memberId,
      serviceId: service._id.toString(),
      serviceCode: service.code,
      serviceName: service.name,
      benefitId: selectedBenefit._id.toString(),
      coverageLimit: selectedBenefit.coverageLimit ?? null,
      configuredPatientResponsibility: selectedBenefit.copay ?? null,
      financialTermsBasis: 'CONFIGURED_ONLY',
      patientResponsibility: selectedBenefit.copay ?? null,
      reasonCode,
      message,
      authorizationRequired,
      verifiedAt: new Date().toISOString(),
    };

    await this.repository.audit('INSURANCE_BENEFIT_VERIFIED', userId, metadata, {
      memberId: input.memberId,
      serviceId: service._id.toString(),
      serviceCode: service.code,
      benefitId: selectedBenefit._id.toString(),
      benefitStatus,
      eligible,
      reasonCode,
    });

    return result;
  }
}
