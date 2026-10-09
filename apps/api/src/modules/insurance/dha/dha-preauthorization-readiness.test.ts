import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientModel, PatientTimelineEventModel } from '../../patients/patient.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { BranchModel } from '../../branches/branch.model.js';
import { ServiceModel } from '../../services/service.model.js';
import { OpdVisitModel } from '../../opd/opd-visit.model.js';
import {
  PayerModel,
  InsuranceSchemeModel,
  InsuranceMemberModel,
  InsurancePolicyModel,
  EligibilityVerificationModel,
} from '../insurance.model.js';
import { InsuranceAuthorizationModel } from '../insurance-authorization.model.js';
import { ShaServiceMappingModel } from '../insurance-integration.model.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { InsuranceRepository } from '../insurance.repository.js';
import { InsuranceService } from '../insurance.service.js';
import { InsuranceIntegrationRepository } from '../insurance-integration.repository.js';
import { DhaPreauthorizationReadinessService } from './dha-preauthorization-readiness.service.js';
import { DhaInterventionCoverageService } from './dha-intervention-coverage.service.js';
import { DhaHttpClient } from './dha-http.client.js';

describe('DHA Preauthorization Readiness Foundation (Prerequisite 9A)', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  const DHA_TEST_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-9A-001';
  const DHA_TEST_FACILITY_ID = 'SYNTH-DHA-FACILITY-001';
  const TEST_SUB_BENEFIT_CODE = 'SB-OPD-GEN';
  const TEST_INTERVENTION_CODE = 'INTV-CONS-01';

  let patientRepository: PatientRepository;
  let authorizationRepository: InsuranceAuthorizationRepository;
  let insuranceRepository: InsuranceRepository;
  let insuranceService: InsuranceService;
  let integrationRepository: InsuranceIntegrationRepository;
  let interventionCoverageService: DhaInterventionCoverageService;
  let readinessService: DhaPreauthorizationReadinessService;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());

    await PatientModel.init();
    await PatientTimelineEventModel.init();
    await AuditLogModel.init();
    await BranchModel.init();
    await ServiceModel.init();
    await OpdVisitModel.init();
    await PayerModel.init();
    await InsuranceSchemeModel.init();
    await InsurancePolicyModel.init();
    await InsuranceMemberModel.init();
    await EligibilityVerificationModel.init();
    await InsuranceAuthorizationModel.init();
    await ShaServiceMappingModel.init();

    patientRepository = new PatientRepository();
    authorizationRepository = new InsuranceAuthorizationRepository();
    insuranceRepository = new InsuranceRepository();
    insuranceService = new InsuranceService(insuranceRepository);
    integrationRepository = new InsuranceIntegrationRepository();
    interventionCoverageService = new DhaInterventionCoverageService(
      new DhaHttpClient(),
      patientRepository,
    );
  });

  beforeEach(async () => {
    global.fetch = mockFetch;
    mockFetch.mockReset();

    await PatientModel.deleteMany({});
    await PatientTimelineEventModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    await BranchModel.deleteMany({});
    await ServiceModel.deleteMany({});
    await OpdVisitModel.deleteMany({});
    await PayerModel.deleteMany({});
    await InsuranceSchemeModel.deleteMany({});
    await InsurancePolicyModel.deleteMany({});
    await InsuranceMemberModel.deleteMany({});
    await EligibilityVerificationModel.deleteMany({});
    await InsuranceAuthorizationModel.deleteMany({});
    await ShaServiceMappingModel.deleteMany({});

    readinessService = new DhaPreauthorizationReadinessService(
      authorizationRepository,
      patientRepository,
      insuranceRepository,
      insuranceService,
      integrationRepository,
      interventionCoverageService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  // Helper fixture builder
  const setupAuthorizationFixture = async (options?: {
    withoutDhaMapping?: boolean;
    withoutEligibility?: boolean;
    ineligible?: boolean;
    withoutServiceMapping?: boolean;
    withoutFacilityId?: boolean;
    expiredPolicy?: boolean;
    inactiveMember?: boolean;
  }) => {
    const uid = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Branch
    const branch = await BranchModel.create({
      code: `BR-${uid}`,
      name: `Main Hospital Branch ${uid}`,
      isMainBranch: true,
      status: 'ACTIVE',
      identifiers: options?.withoutFacilityId
        ? []
        : [
            {
              issuingAuthority: 'DHA',
              identifierType: 'FACILITY_ID',
              value: `${DHA_TEST_FACILITY_ID}-${uid}`,
              status: 'ACTIVE',
              isPrimary: true,
            },
          ],
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    // 2. Patient
    const patient = await PatientModel.create({
      patientNumber: `HMS-P-${uid}`,
      firstName: 'Synthetic',
      lastName: 'PreauthUser',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      phone: '+254700000004',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const patientId = patient._id.toString();

    if (!options?.withoutDhaMapping) {
      await patientRepository.addIdentifier(
        patientId,
        {
          identifier_type: 'CLIENT_REGISTRY_ID',
          issuing_authority: 'DHA',
          value: `${DHA_TEST_CLIENT_REGISTRY_ID}-${uid}`,
          status: 'ACTIVE',
          source_environment: (env.app.environment || 'dev').toUpperCase(),
        },
        userId,
      );
    }

    // 3. Service
    const service = await ServiceModel.create({
      code: `SRV-${uid}`,
      name: 'Specialist Consultation',
      category: 'CONSULTATION',
      departmentId: new Types.ObjectId(),
      status: 'ACTIVE',
      standardPrice: 2500,
      serviceType: 'GENERAL',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    // 4. SHA Service Mapping
    if (!options?.withoutServiceMapping) {
      await ShaServiceMappingModel.create({
        serviceId: service._id,
        interventionCode: TEST_INTERVENTION_CODE,
        effectiveFrom: '2026-01-01',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      });
    }

    // 5. Insurance Payer, Scheme, Policy & Member
    const payer = await PayerModel.create({
      payerCode: `PAY-${uid}`,
      name: 'Social Health Authority',
      type: 'SHA',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const scheme = await InsuranceSchemeModel.create({
      payerId: payer._id,
      schemeCode: `SCH-${uid}`,
      name: 'Social Health Insurance Fund',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const policy = await InsurancePolicyModel.create({
      policyNumber: `POL-${uid}`,
      payerId: payer._id,
      schemeId: scheme._id,
      holderPatientId: patient._id,
      holderType: 'SELF',
      startDate: new Date('2026-01-01'),
      endDate: options?.expiredPolicy ? new Date('2026-06-01') : new Date('2026-12-31'),
      status: options?.expiredPolicy ? 'EXPIRED' : 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const member = await InsuranceMemberModel.create({
      policyId: policy._id,
      patientId: patient._id,
      memberNumber: `MEM-${uid}`,
      subscriberId: `SUB-${uid}`,
      relationship: 'SELF',
      coverageStart: new Date('2026-01-01'),
      coverageEnd: options?.expiredPolicy ? new Date('2026-06-01') : new Date('2026-12-31'),
      status: options?.inactiveMember ? 'INACTIVE' : 'ACTIVE',
      version: 0,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    // 6. Eligibility Verification
    if (!options?.withoutEligibility) {
      await EligibilityVerificationModel.create({
        memberId: member._id,
        patientId: patient._id,
        policyId: policy._id,
        payerId: payer._id,
        schemeId: scheme._id,
        requestedDate: new Date('2026-10-08'),
        correlationId: `corr-elig-${uid}`,
        status: options?.ineligible ? 'INELIGIBLE' : 'ELIGIBLE',
        reasonCode: options?.ineligible ? 'COVERAGE_TERMINATED' : 'ELIGIBLE_ACTIVE',
        requestTimestamp: new Date(),
        responseTimestamp: new Date(),
        version: 0,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      });
    }

    // 7. Insurance Authorization Draft
    const authorization = await InsuranceAuthorizationModel.create({
      memberId: member._id,
      patientId: patient._id,
      policyId: policy._id,
      payerId: payer._id,
      schemeId: scheme._id,
      branchId: branch._id,
      authorizationContext: 'dha-preauth-test',
      requestedDate: '2026-10-08',
      correlationId: `corr-auth-${uid}`,
      status: 'DRAFT',
      integrationMode: 'UNAVAILABLE',
      fingerprint: `fp-${uid}`,
      version: 0,
      lines: [
        {
          serviceId: service._id,
          serviceCode: service.code,
          requestedQuantity: 1,
        },
      ],
      history: [
        {
          to: 'DRAFT',
          actorId: new Types.ObjectId(userId),
          at: new Date(),
          correlationId: 'corr-auth-001',
        },
      ],
    });

    return {
      branchId: branch._id.toString(),
      patientId,
      serviceId: service._id.toString(),
      memberId: member._id.toString(),
      authorizationId: authorization._id.toString(),
    };
  };

  // 1. Valid local authorization with all confirmed prerequisites calculated without DHA submission
  it('1. Valid local authorization with all currently confirmed prerequisites calculates readiness without DHA submission', async () => {
    const fixture = await setupAuthorizationFixture();

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
      actorUserId: userId,
      correlationId: 'corr-readiness-1',
    });

    expect(result.ready).toBe(true);
    expect(result.authorizationId).toBe(fixture.authorizationId);
    expect(result.patientId).toBe(fixture.patientId);
    expect(result.clientRegistryId).toContain(DHA_TEST_CLIENT_REGISTRY_ID);
    expect(result.interventionCode).toBe(TEST_INTERVENTION_CODE);
    expect(result.needsPreauth).toBe(true);
    expect(result.consentReadiness).toBe('READY');
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.checks.every((c) => c.passed)).toBe(true);

    // ZERO DHA submission network calls made
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 2. Missing DHA Client Registry mapping -> NOT_READY
  it('2. Missing DHA Client Registry mapping results in NOT_READY', async () => {
    const fixture = await setupAuthorizationFixture({ withoutDhaMapping: true });

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(result.ready).toBe(false);
    expect(result.clientRegistryId).toBeNull();
    expect(result.reasonCodes).toContain('DHA_PATIENT_MAPPING_REQUIRED');
    const mappingCheck = result.checks.find((c) => c.code === 'DHA_PATIENT_MAPPING');
    expect(mappingCheck?.passed).toBe(false);
  });

  // 3. Missing usable eligibility -> NOT_READY
  it('3. Missing usable eligibility results in NOT_READY', async () => {
    const fixture = await setupAuthorizationFixture({ withoutEligibility: true });

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain('DHA_ELIGIBILITY_REQUIRED');
  });

  it('3b. Ineligible status results in DHA_ELIGIBILITY_NOT_CONFIRMED', async () => {
    const fixture = await setupAuthorizationFixture({ ineligible: true });

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain('DHA_ELIGIBILITY_NOT_CONFIRMED');
  });

  // 4. Intervention missing -> NOT_READY
  it('4. Intervention missing results in NOT_READY', async () => {
    const fixture = await setupAuthorizationFixture({ withoutServiceMapping: true });

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain('SERVICE_NOT_LINKED');
  });

  // 5. Intervention has needsPreauth=false -> correctly reports preauthorization not required
  it('5. Intervention has needsPreauth=false reports PREAUTH_NOT_REQUIRED and consent NOT_REQUIRED', async () => {
    const fixture = await setupAuthorizationFixture();

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: false,
      contractConfirmed: true,
    });

    expect(result.ready).toBe(false);
    expect(result.needsPreauth).toBe(false);
    expect(result.consentReadiness).toBe('NOT_REQUIRED');
    expect(result.reasonCodes).toContain('PREAUTH_NOT_REQUIRED');
    const preauthCheck = result.checks.find((c) => c.code === 'PREAUTH_REQUIREMENT');
    expect(preauthCheck?.passed).toBe(false);
  });

  // 6. Intervention has needsPreauth=true -> readiness evaluates the remaining prerequisites
  it('6. Intervention has needsPreauth=true evaluates preauthorization requirement', async () => {
    const fixture = await setupAuthorizationFixture();

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(result.needsPreauth).toBe(true);
    const preauthCheck = result.checks.find((c) => c.code === 'PREAUTH_REQUIREMENT');
    expect(preauthCheck?.passed).toBe(true);
  });

  // 7. Missing/unknown DHA preauth contract -> contract-readiness blocker, not fabricated success
  it('7. Missing/unknown DHA preauth contract acts as contract-readiness blocker', async () => {
    const fixture = await setupAuthorizationFixture();

    // Default without contractConfirmed
    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
    });

    expect(result.ready).toBe(false);
    expect(result.consentReadiness).toBe('CONTRACT_UNCONFIRMED');
    expect(result.reasonCodes).toContain('DHA_PREAUTH_CONTRACT_UNCONFIRMED');
    expect(result.reasonCodes).toContain('DHA_CONSENT_CONTRACT_UNCONFIRMED');

    const contractCheck = result.checks.find((c) => c.code === 'DHA_PREAUTH_CONTRACT');
    expect(contractCheck?.passed).toBe(false);
    expect(contractCheck?.message).toContain('unconfirmed');
  });

  // 8. Existing authorization remains unchanged
  it('8. Existing authorization status and content remain unchanged in database', async () => {
    const fixture = await setupAuthorizationFixture();

    await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    const authDoc = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(authDoc).toBeDefined();
    // Status remains strictly DRAFT; readiness evaluation does NOT modify status
    expect(authDoc?.status).toBe('DRAFT');
    expect(authDoc?.version).toBe(0);
  });

  // 9. No DHA preauthorization request is made
  it('9. No outbound DHA preauthorization request is executed', async () => {
    const fixture = await setupAuthorizationFixture();

    await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 10. No OTP or biometric request is made
  it('10. No OTP or biometric operation is executed or stored', async () => {
    const fixture = await setupAuthorizationFixture();

    const result = await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: false,
    });

    // Consent readiness indicates contract is unconfirmed
    expect(result.consentReadiness).toBe('CONTRACT_UNCONFIRMED');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 11. No raw DHA response or secret is persisted/logged
  it('11. Safe audit logging: no tokens, secrets, or raw payloads in audit record', async () => {
    const fixture = await setupAuthorizationFixture();

    await readinessService.getReadiness(fixture.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
      actorUserId: userId,
      correlationId: 'corr-audit-safety-check',
    });

    const logs = await AuditLogModel.find({
      eventType: 'insurance.dha.preauthorization_readiness_evaluated',
    }).lean();

    expect(logs.length).toBeGreaterThan(0);
    const logStr = JSON.stringify(logs[0]);

    expect(logStr).toContain('EVALUATE_PREAUTH_READINESS');
    expect(logStr).toContain(fixture.authorizationId);
    expect(logStr).not.toContain('secret');
    expect(logStr).not.toContain('token');
    expect(logStr).not.toContain('bearer');
  });

  // Additional check: Policy or Member invalid locally
  it('12. Expired policy or inactive member blocks readiness with specific reason codes', async () => {
    const fixtureExpired = await setupAuthorizationFixture({ expiredPolicy: true });

    const resultExpired = await readinessService.getReadiness(fixtureExpired.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(resultExpired.ready).toBe(false);
    expect(resultExpired.reasonCodes).toContain('POLICY_NOT_VALID');

    const fixtureInactive = await setupAuthorizationFixture({ inactiveMember: true });

    const resultInactive = await readinessService.getReadiness(fixtureInactive.authorizationId, {
      subBenefitCode: TEST_SUB_BENEFIT_CODE,
      needsPreauth: true,
      contractConfirmed: true,
    });

    expect(resultInactive.ready).toBe(false);
    expect(resultInactive.reasonCodes).toContain('MEMBER_NOT_VALID');
  });

  // Non-existent or invalid authorization ID
  it('13. Non-existent authorization rejects with 404 AUTHORIZATION_NOT_FOUND', async () => {
    const nonExistentId = new Types.ObjectId().toString();

    await expect(readinessService.getReadiness(nonExistentId)).rejects.toMatchObject({
      code: 'AUTHORIZATION_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('14. Invalid authorization ID format rejects with 400 VALIDATION_ERROR', async () => {
    await expect(readinessService.getReadiness('invalid-id-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
