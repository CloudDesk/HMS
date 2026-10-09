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
import {
  DhaPreauthorizationService,
  createDhaConsentAdapter,
  createDhaPreauthorizationAdapter,
} from './dha-preauthorization.service.js';
import {
  MockDhaConsentAdapter,
  UnavailableDhaConsentAdapter,
} from './dha-consent.adapter.js';
import {
  MockDhaPreauthorizationAdapter,
  UnavailableDhaPreauthorizationAdapter,
} from './dha-preauthorization.adapter.js';
import { AppError } from '../../../shared/errors/app-error.js';

describe('DHA Mock Preauthorization & Consent Flow (Prerequisite 9B)', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  const DHA_TEST_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-9B-001';
  const DHA_TEST_FACILITY_ID = 'SYNTH-DHA-FACILITY-9B';
  const TEST_INTERVENTION_CODE = 'INTV-CONS-01';

  let patientRepository: PatientRepository;
  let authorizationRepository: InsuranceAuthorizationRepository;
  let insuranceRepository: InsuranceRepository;
  let insuranceService: InsuranceService;
  let integrationRepository: InsuranceIntegrationRepository;
  let interventionCoverageService: DhaInterventionCoverageService;
  let readinessService: DhaPreauthorizationReadinessService;
  let preauthorizationService: DhaPreauthorizationService;

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

    // Reset env config for deterministic tests
    env.dha.integrationMode = 'MOCK';
    env.dha.mockPreauthDecision = 'APPROVED';
    env.dha.mockConsentMode = 'VERIFIED';

    readinessService = new DhaPreauthorizationReadinessService(
      authorizationRepository,
      patientRepository,
      insuranceRepository,
      insuranceService,
      integrationRepository,
      interventionCoverageService,
    );

    preauthorizationService = new DhaPreauthorizationService(
      authorizationRepository,
      readinessService,
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
    requestedAmount?: number;
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
          requestedAmount: options?.requestedAmount ?? 2500,
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

  // 1. 9A readiness failure prevents submission
  it('1. 9A readiness failure prevents submission', async () => {
    const fixture = await setupAuthorizationFixture({ expiredPolicy: true });

    await expect(
      preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        actorUserId: userId,
        correlationId: 'corr-submit-fail-1',
      }),
    ).rejects.toThrowError(AppError);

    try {
      await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        actorUserId: userId,
        correlationId: 'corr-submit-fail-1',
      });
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.code).toBe('PREAUTHORIZATION_READINESS_FAILED');
      expect(error.statusCode).toBe(422);
    }
  });

  // 2. Missing DHA patient mapping prevents submission
  it('2. Missing DHA patient mapping prevents submission', async () => {
    const fixture = await setupAuthorizationFixture({ withoutDhaMapping: true });

    await expect(
      preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        actorUserId: userId,
        correlationId: 'corr-submit-fail-2',
      }),
    ).rejects.toThrowError(AppError);

    try {
      await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        actorUserId: userId,
        correlationId: 'corr-submit-fail-2',
      });
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.code).toBe('PREAUTHORIZATION_READINESS_FAILED');
      expect(error.message).toContain('DHA_PATIENT_MAPPING_REQUIRED');
    }
  });

  // 3. Consent mock returns deterministic result
  it('3. Consent mock returns deterministic result', async () => {
    const fixture = await setupAuthorizationFixture();

    // In VERIFIED mode:
    env.dha.mockConsentMode = 'VERIFIED';
    const verifiedResult = await preauthorizationService.processConsent(fixture.authorizationId, {
      otp: '123456',
      actorUserId: userId,
      correlationId: 'corr-consent-ok',
    });
    expect(verifiedResult.verified).toBe(true);
    expect(verifiedResult.consentReference).toMatch(/^MOCK-CONSENT-/);
    expect(verifiedResult.source).toBe('MOCK');

    // In FAILED mode:
    env.dha.mockConsentMode = 'FAILED';
    const failedResult = await preauthorizationService.processConsent(fixture.authorizationId, {
      otp: 'wrong',
      actorUserId: userId,
      correlationId: 'corr-consent-fail',
    });
    expect(failedResult.verified).toBe(false);
    expect(failedResult.failureReason).toBe('MOCK_CONSENT_VERIFICATION_FAILED');
  });

  // 4. Consent failure prevents preauthorization
  it('4. Consent failure prevents preauthorization when mock consent fails', async () => {
    const fixture = await setupAuthorizationFixture();
    env.dha.mockConsentMode = 'FAILED';

    await expect(
      preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        otp: '999999',
        actorUserId: userId,
        correlationId: 'corr-preauth-consent-fail',
      }),
    ).rejects.toThrowError(AppError);

    try {
      await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        otp: '999999',
        actorUserId: userId,
        correlationId: 'corr-preauth-consent-fail',
      });
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.code).toBe('PREAUTHORIZATION_CONSENT_REQUIRED');
      expect(error.statusCode).toBe(422);
    }
  });

  // 5. Mock APPROVED result updates existing authorization correctly
  it('5. Mock APPROVED result updates existing authorization correctly', async () => {
    const fixture = await setupAuthorizationFixture();
    env.dha.mockPreauthDecision = 'APPROVED';

    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-approve-1',
    });

    expect(result.status).toBe('APPROVED');
    expect(result.externalReference).toMatch(/^MOCK-PREAUTH-/);
    expect(result.source).toBe('MOCK');
    expect(result.approvedAmount).toBe(2500);

    const updatedAuth = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(updatedAuth).toBeDefined();
    expect(updatedAuth!.status).toBe('APPROVED');
    expect(updatedAuth!.integrationMode).toBe('MOCK');
    expect(updatedAuth!.externalReference).toBe(result.externalReference);
    expect(updatedAuth!.lines[0].approvedQuantity).toBe(1);
    expect(updatedAuth!.lines[0].approvedAmount).toBe(2500);

    const auditLogs = await AuditLogModel.find({
      eventType: 'INSURANCE_PREAUTHORIZATION_SUBMITTED',
      'metadataJson.authorizationId': fixture.authorizationId,
    }).lean();
    expect(auditLogs.length).toBe(1);
  });

  // 6. Mock PARTIALLY_APPROVED result updates authorization correctly
  it('6. Mock PARTIALLY_APPROVED result updates authorization correctly', async () => {
    const fixture = await setupAuthorizationFixture({ requestedAmount: 5000 });
    env.dha.mockPreauthDecision = 'PARTIALLY_APPROVED';

    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-part-app-1',
    });

    expect(result.status).toBe('PARTIALLY_APPROVED');
    expect(result.externalReference).toMatch(/^MOCK-PREAUTH-/);
    expect(result.approvedAmount).toBe(2500); // 50% of 5000

    const updatedAuth = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(updatedAuth!.status).toBe('PARTIALLY_APPROVED');
    expect(updatedAuth!.lines[0].approvedAmount).toBe(2500);
  });

  // 7. Mock REJECTED result updates authorization correctly
  it('7. Mock REJECTED result updates authorization correctly', async () => {
    const fixture = await setupAuthorizationFixture();
    env.dha.mockPreauthDecision = 'REJECTED';

    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-rej-1',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.denialReason).toBe('MOCK_PREAUTH_REJECTED_BY_CONFIG');
    expect(result.approvedAmount).toBe(0);

    const updatedAuth = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(updatedAuth!.status).toBe('REJECTED');
    expect(updatedAuth!.reasonCode).toBe('MOCK_PREAUTH_REJECTED_BY_CONFIG');
    expect(updatedAuth!.lines[0].approvedQuantity).toBe(0);
    expect(updatedAuth!.lines[0].approvedAmount).toBe(0);
  });

  // 8. Mock external reference stored safely
  it('8. Mock external reference stored safely with MOCK-PREAUTH prefix', async () => {
    const fixture = await setupAuthorizationFixture();
    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-ext-ref-1',
    });

    expect(result.externalReference).toMatch(/^MOCK-PREAUTH-[A-F0-9]{8}$/);
    const updated = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(updated!.externalReference).toBe(result.externalReference);
  });

  // 9. Mock source clearly recorded
  it('9. Mock source clearly recorded in response and audit history', async () => {
    const fixture = await setupAuthorizationFixture();
    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-source-1',
    });

    expect(result.source).toBe('MOCK');

    const updated = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    expect(updated!.integrationMode).toBe('MOCK');

    const auditLogs = await AuditLogModel.find({
      eventType: 'INSURANCE_PREAUTHORIZATION_SUBMITTED',
      'metadataJson.authorizationId': fixture.authorizationId,
    }).lean();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].metadataJson?.source).toBe('MOCK');
    expect(auditLogs[0].metadataJson?.status).toBe('APPROVED');
  });

  // 10. Repeated submission is idempotent
  it('10. Repeated submission is idempotent and returns existing decision without generating new external reference', async () => {
    const fixture = await setupAuthorizationFixture();

    const firstResult = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-idemp-1',
    });

    const secondResult = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-idemp-2',
    });

    expect(secondResult.status).toBe(firstResult.status);
    expect(secondResult.externalReference).toBe(firstResult.externalReference);
    expect(secondResult.approvedAmount).toBe(firstResult.approvedAmount);

    const auditLogs = await AuditLogModel.find({
      eventType: 'INSURANCE_PREAUTHORIZATION_SUBMITTED',
      'metadataJson.authorizationId': fixture.authorizationId,
    }).lean();
    expect(auditLogs.length).toBe(1);
  });

  // 11. No duplicate external references across separate authorizations
  it('11. No duplicate external references generated for distinct authorizations', async () => {
    const fixture1 = await setupAuthorizationFixture();
    const fixture2 = await setupAuthorizationFixture();

    const result1 = await preauthorizationService.submitPreauthorization(fixture1.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-uniq-1',
    });

    const result2 = await preauthorizationService.submitPreauthorization(fixture2.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-uniq-2',
    });

    expect(result1.externalReference).not.toBe(result2.externalReference);
  });

  // 12. No DHA network calls in MOCK mode
  it('12. No DHA network calls (fetch) made during MOCK mode consent or preauth', async () => {
    const fixture = await setupAuthorizationFixture();

    await preauthorizationService.processConsent(fixture.authorizationId, {
      otp: '123456',
      actorUserId: userId,
      correlationId: 'corr-no-fetch',
    });

    await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-no-fetch',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 13. REAL mode with unavailable adapter fails closed (503)
  it('13. REAL mode with unavailable adapter fails closed (503)', async () => {
    const fixture = await setupAuthorizationFixture();
    env.dha.integrationMode = 'REAL';

    // Consent in REAL mode:
    try {
      await preauthorizationService.processConsent(fixture.authorizationId, {
        actorUserId: userId,
        correlationId: 'corr-real-mode',
      });
      expect.fail('Expected processConsent to throw in REAL mode');
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.code).toBe('DHA_CONSENT_CONTRACT_UNCONFIRMED');
      expect(error.statusCode).toBe(503);
    }

    // Preauthorization submission in REAL mode:
    try {
      await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
        consentReference: 'MOCK-CONSENT-123',
        actorUserId: userId,
        correlationId: 'corr-real-mode',
      });
      expect.fail('Expected submitPreauthorization to throw in REAL mode');
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.code).toBe('DHA_PREAUTHORIZATION_CONTRACT_UNCONFIRMED');
      expect(error.statusCode).toBe(503);
    }
  });

  // 14. No OTP or biometric data persisted
  it('14. No OTP or biometric data persisted in database, audit logs, or timeline', async () => {
    const fixture = await setupAuthorizationFixture();
    const sensitiveOtp = 'SECRET-OTP-888999';

    await preauthorizationService.processConsent(fixture.authorizationId, {
      otp: sensitiveOtp,
      actorUserId: userId,
      correlationId: 'corr-no-leak',
    });

    await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      otp: sensitiveOtp,
      actorUserId: userId,
      correlationId: 'corr-no-leak',
    });

    // Check authorization document
    const authDoc = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    const authDocStr = JSON.stringify(authDoc);
    expect(authDocStr).not.toContain(sensitiveOtp);

    // Check timeline events
    const timelineEvents = await PatientTimelineEventModel.find({
      patientId: fixture.patientId,
    }).lean();
    const timelineStr = JSON.stringify(timelineEvents);
    expect(timelineStr).not.toContain(sensitiveOtp);

    // Check audit logs
    const auditLogs = await AuditLogModel.find({
      'metadataJson.authorizationId': fixture.authorizationId,
    }).lean();
    const auditStr = JSON.stringify(auditLogs);
    expect(auditStr).not.toContain(sensitiveOtp);
  });

  // 15. No raw DHA payload persisted
  it('15. No raw DHA payload persisted in authorization document', async () => {
    const fixture = await setupAuthorizationFixture();

    await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-no-raw-leak',
    });

    const authDoc = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    // rawResponse / rawRequest should not be set or exposed in production schema
    const rawDoc = authDoc as unknown as Record<string, unknown>;
    expect(rawDoc.rawResponse).toBeUndefined();
    expect(rawDoc.rawRequest).toBeUndefined();
  });

  // 16. Existing authorization lifecycle remains valid
  it('16. Existing authorization lifecycle remains valid and readyForShaSubmission remains false', async () => {
    const fixture = await setupAuthorizationFixture();

    const result = await preauthorizationService.submitPreauthorization(fixture.authorizationId, {
      actorUserId: userId,
      correlationId: 'corr-lifecycle-1',
    });

    expect(result.status).toBe('APPROVED');

    // SHA claim submission readiness must strictly remain false
    const readiness = await readinessService.getReadiness(fixture.authorizationId, {
      needsPreauth: true,
      contractConfirmed: true,
    });
    expect(readiness.ready).toBe(true);
    const { InsuranceClaimModel } = await import('../insurance-claim.model.js');
    const claimPath = InsuranceClaimModel.schema.path('readyForShaSubmission') as unknown as { defaultValue?: boolean };
    expect(claimPath.defaultValue).toBe(false);

    // Check history array in authorization
    const updated = await InsuranceAuthorizationModel.findById(fixture.authorizationId).lean();
    const toStatuses = updated!.history.map((h) => h.to);
    expect(toStatuses).toContain('DRAFT');
    expect(toStatuses).toContain('SUBMITTED');
    expect(toStatuses).toContain('APPROVED');
  });

  // Unit tests for adapter factories directly
  describe('Adapter Factories', () => {
    it('returns Mock adapters when DHA_INTEGRATION_MODE is MOCK', () => {
      env.dha.integrationMode = 'MOCK';
      const consentAdapter = createDhaConsentAdapter();
      const preauthAdapter = createDhaPreauthorizationAdapter();

      expect(consentAdapter).toBeInstanceOf(MockDhaConsentAdapter);
      expect(preauthAdapter).toBeInstanceOf(MockDhaPreauthorizationAdapter);
    });

    it('returns Unavailable fail-closed adapters when DHA_INTEGRATION_MODE is REAL', () => {
      env.dha.integrationMode = 'REAL';
      const consentAdapter = createDhaConsentAdapter();
      const preauthAdapter = createDhaPreauthorizationAdapter();

      expect(consentAdapter).toBeInstanceOf(UnavailableDhaConsentAdapter);
      expect(preauthAdapter).toBeInstanceOf(UnavailableDhaPreauthorizationAdapter);
    });
  });
});
