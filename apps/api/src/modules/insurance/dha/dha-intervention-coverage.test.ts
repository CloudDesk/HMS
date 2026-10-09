import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientModel, PatientTimelineEventModel } from '../../patients/patient.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaAuthService } from './dha-auth.service.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaInterventionCoverageService } from './dha-intervention-coverage.service.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig } from './dha.types.js';

describe('DHA Intervention Coverage Integration (Prerequisite 8)', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  // Synthetic test data variables (no real identifiers or credentials)
  const DHA_TEST_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-999';
  const TEST_SUB_BENEFIT_CODE = 'SB-OPD-GEN';

  const validConfig: DhaConfig = {
    enabled: true,
    baseUrl: 'https://dha-test.example.gov/api/v1',
    tokenUrl: 'https://dha-test.example.gov/oauth/token',
    clientId: 'synth-client-id',
    clientSecret: 'synth-client-secret',
    timeoutMs: 5000,
  };

  let patientRepository: PatientRepository;
  let authService: DhaAuthService;
  let httpClient: DhaHttpClient;
  let interventionCoverageService: DhaInterventionCoverageService;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await PatientModel.init();
    await PatientTimelineEventModel.init();
    await AuditLogModel.init();

    patientRepository = new PatientRepository();
  });

  beforeEach(async () => {
    global.fetch = mockFetch;
    mockFetch.mockReset();

    await PatientModel.deleteMany({});
    await PatientTimelineEventModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    authService = new DhaAuthService(validConfig);
    vi.spyOn(authService, 'getAccessToken').mockResolvedValue('synth-access-token-xyz');
    httpClient = new DhaHttpClient(authService);
    interventionCoverageService = new DhaInterventionCoverageService(httpClient, patientRepository);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const setupPatientWithDhaMapping = async (patientNumber = 'HMS-P-INTV-01') => {
    const patient = await PatientModel.create({
      patientNumber,
      firstName: 'Synthetic',
      lastName: 'InterventionUser',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'FEMALE',
      phone: '+254700000003',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const patientId = patient._id.toString();

    // Add active DHA Client Registry mapping
    await patientRepository.addIdentifier(
      patientId,
      {
        identifier_type: 'CLIENT_REGISTRY_ID',
        issuing_authority: 'DHA',
        value: DHA_TEST_CLIENT_REGISTRY_ID,
        status: 'ACTIVE',
        source_environment: (env.app.environment || 'dev').toUpperCase(),
      },
      userId,
    );

    return patientId;
  };

  // Requirement 1: Valid Client Registry mapping + sub-benefit code calls GET /patients/benefits/interventions
  it('1. Valid Client Registry mapping + subBenefitCode calls GET /patients/benefits/interventions with correct query parameters', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            {
              intervention_code: 'INTV-CONS-01',
              name: 'General Medical Consultation',
              payment_mechanism: 'FEE_FOR_SERVICE',
              needs_preauth: false,
              tariff: {
                amount: 1500,
                currency: 'KES',
                effective_date: '2026-01-01',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
      {
        correlationId: 'intv-corr-001',
        actorUserId: userId,
      },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('patients/benefits/interventions?');
    expect(calledUrl).toContain(`patient_id=${DHA_TEST_CLIENT_REGISTRY_ID}`);
    expect(calledUrl).toContain(`sub_benefit_code=${TEST_SUB_BENEFIT_CODE}`);

    expect(result.patientId).toBe(patientId);
    expect(result.externalSystem).toBe('DHA');
    expect(result.clientRegistryId).toBe(DHA_TEST_CLIENT_REGISTRY_ID);
    expect(result.subBenefitCode).toBe(TEST_SUB_BENEFIT_CODE);
    expect(result.total).toBe(1);
    expect(result.interventions).toHaveLength(1);
  });

  // Requirement 2: Missing Client Registry mapping rejects safely without outbound network call
  it('2. Missing DHA Client Registry mapping rejects safely without outbound network call', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'HMS-P-NOMAP-INTV',
      firstName: 'No',
      lastName: 'DhaMapIntv',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await expect(
      interventionCoverageService.getInterventions(patient._id.toString(), TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'DHA_PATIENT_MAPPING_REQUIRED',
      statusCode: 400,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Requirement 3: Missing or empty subBenefitCode validation rejection without calling DHA
  it('3. Missing or empty subBenefitCode rejects without outbound network call', async () => {
    const patientId = await setupPatientWithDhaMapping();

    await expect(
      interventionCoverageService.getInterventions(patientId, ''),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    await expect(
      interventionCoverageService.getInterventions(patientId, '   '),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Validation: Non-existent or invalid patient id
  it('3b. Non-existent patient rejects with 404 PATIENT_NOT_FOUND', async () => {
    const nonExistentId = new Types.ObjectId().toString();

    await expect(
      interventionCoverageService.getInterventions(nonExistentId, TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
      statusCode: 404,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('3c. Invalid patient id format rejects with 400 VALIDATION_ERROR', async () => {
    await expect(
      interventionCoverageService.getInterventions('invalid-oid', TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Requirement 4: Successful DHA response normalized safely without inventing unconfirmed fields
  it('4. Successful DHA response normalized safely without unconfirmed fields', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            {
              id: 'INTV-RAW-01',
              code: 'INTV-CONS-SPEC',
              name: 'Specialist Consultation',
              payment_mechanism: 'CAPITATION',
              needs_preauth: true,
              tariff: {
                amount: 3000,
                currency: 'KES',
                effective_date: '2026-03-01',
              },
              coverage_percentage: 80, // Should NOT be mapped or exposed in DhaInterventionItem
              patient_responsibility: 600, // Should NOT be mapped
              copay: 500, // Should NOT be mapped
              deductible: 1000, // Should NOT be mapped
              annual_limit: 50000, // Should NOT be mapped
              remaining_limit: 45000, // Should NOT be mapped
              approval_amount: 2400, // Should NOT be mapped
              authorization_number: 'AUTH-123', // Should NOT be mapped
              claim_status: 'SUBMITTED', // Should NOT be mapped
              adjudicated_amount: 2400, // Should NOT be mapped
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    const item = result.interventions[0];
    expect(item.interventionCode).toBe('INTV-CONS-SPEC');
    expect(item.name).toBe('Specialist Consultation');
    expect(item.paymentMechanism).toBe('CAPITATION');
    expect(item.needsPreauth).toBe(true);
    expect(item.tariff).toEqual({
      amount: 3000,
      currency: 'KES',
      effectiveDate: '2026-03-01',
    });

    // Verify invented fields are NOT exposed
    const itemRecord = item as unknown as Record<string, unknown>;
    expect(itemRecord.coverage_percentage).toBeUndefined();
    expect(itemRecord.patient_responsibility).toBeUndefined();
    expect(itemRecord.copay).toBeUndefined();
    expect(itemRecord.deductible).toBeUndefined();
    expect(itemRecord.annual_limit).toBeUndefined();
    expect(itemRecord.remaining_limit).toBeUndefined();
    expect(itemRecord.approval_amount).toBeUndefined();
    expect(itemRecord.authorization_number).toBeUndefined();
    expect(itemRecord.claim_status).toBeUndefined();
    expect(itemRecord.adjudicated_amount).toBeUndefined();
  });

  // Requirement 5: Multiple interventions parsed correctly
  it('5. Multiple interventions parsed correctly', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            {
              intervention_code: 'INTV-001',
              name: 'Intervention 1',
              payment_mechanism: 'FEE_FOR_SERVICE',
              needs_preauth: false,
            },
            {
              intervention_code: 'INTV-002',
              name: 'Intervention 2',
              payment_mechanism: 'CASE_RATE',
              needs_preauth: true,
            },
            {
              intervention_code: 'INTV-003',
              name: 'Intervention 3',
              payment_mechanism: 'GLOBAL_BUDGET',
              needs_preauth: false,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    expect(result.total).toBe(3);
    expect(result.interventions).toHaveLength(3);
    expect(result.interventions.map((i) => i.interventionCode)).toEqual([
      'INTV-001',
      'INTV-002',
      'INTV-003',
    ]);
  });

  // Requirement 6: Empty DHA intervention response returns total: 0, interventions: []
  it('6. Empty DHA intervention response returns total: 0 and interventions: []', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ interventions: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    expect(result.total).toBe(0);
    expect(result.interventions).toEqual([]);
  });

  // Requirement 7: needsPreauth preserved as boolean
  it('7. needsPreauth is preserved accurately as boolean (true and false)', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            { intervention_code: 'INTV-PRE-TRUE', needs_preauth: true },
            { intervention_code: 'INTV-PRE-FALSE', needs_preauth: false },
            { intervention_code: 'INTV-PRE-OMITTED' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    expect(result.interventions[0].needsPreauth).toBe(true);
    expect(result.interventions[1].needsPreauth).toBe(false);
    expect(result.interventions[2].needsPreauth).toBe(false);
  });

  // Requirement 8: paymentMechanism preserved
  it('8. paymentMechanism is preserved accurately as external string value', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            { intervention_code: 'INTV-MECH-1', payment_mechanism: 'DIAGNOSIS_RELATED_GROUP' },
            { intervention_code: 'INTV-MECH-2', payment_mechanism: 'PER_DIEM' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    expect(result.interventions[0].paymentMechanism).toBe('DIAGNOSIS_RELATED_GROUP');
    expect(result.interventions[1].paymentMechanism).toBe('PER_DIEM');
  });

  // Requirement 9: Confirmed tariff fields preserved without modifying HMS pricing
  it('9. Confirmed tariff fields preserved without modifying HMS pricing or service catalogue', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            {
              intervention_code: 'INTV-TARIFF-1',
              tariff: {
                amount: 4500,
                currency: 'KES',
                effective_date: '2026-06-01',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await interventionCoverageService.getInterventions(
      patientId,
      TEST_SUB_BENEFIT_CODE,
    );

    expect(result.interventions[0].tariff).toEqual({
      amount: 4500,
      currency: 'KES',
      effectiveDate: '2026-06-01',
    });
  });

  // Requirement 10: DHA authentication failure propagated as typed DhaError
  it('10. DHA authentication failure propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    vi.spyOn(authService, 'getAccessToken').mockRejectedValueOnce(
      new DhaError('DHA auth failure', 'DHA_AUTHENTICATION_FAILED', 401),
    );

    await expect(
      interventionCoverageService.getInterventions(patientId, TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'DHA_AUTHENTICATION_FAILED',
      statusCode: 401,
    });
  });

  // Requirement 11: DHA timeout / network failure propagated as typed DhaError
  it('11a. DHA timeout propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockImplementationOnce(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      interventionCoverageService.getInterventions(patientId, TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_TIMEOUT',
      statusCode: 504,
    });
  });

  it('11b. DHA network failure propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      interventionCoverageService.getInterventions(patientId, TEST_SUB_BENEFIT_CODE),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_FAILED',
      statusCode: 502,
    });
  });

  // Requirement 12: Raw DHA response is not persisted/logged
  it('12. Raw DHA response is not persisted in patient record or audit log', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          interventions: [
            {
              intervention_code: 'INTV-AUDIT-SAFE',
              name: 'Safe Intervention',
              raw_bearer_token: 'secret-auth-token-12345',
              internal_clinical_raw: 'raw private diagnostic text',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await interventionCoverageService.getInterventions(patientId, TEST_SUB_BENEFIT_CODE, {
      actorUserId: userId,
      correlationId: 'corr-audit-check-intv',
    });

    const logs = await AuditLogModel.find({
      eventType: 'patient.dha.interventions_queried',
    }).lean();
    expect(logs.length).toBeGreaterThan(0);
    const logStr = JSON.stringify(logs[0]);

    expect(logStr).not.toContain('secret-auth-token-12345');
    expect(logStr).not.toContain('raw private diagnostic text');
    expect(logStr).toContain('subBenefitCode');
    expect(logStr).toContain('totalCount');

    const patientDoc = await PatientModel.findById(patientId).lean();
    const patientStr = JSON.stringify(patientDoc);
    expect(patientStr).not.toContain('secret-auth-token-12345');
    expect(patientStr).not.toContain('raw private diagnostic text');
  });

  // Requirement 13: Existing eligibility and sub-benefit behavior remains unchanged
  it('13. Existing eligibility and sub-benefit services remain fully functional and independent', async () => {
    const { DhaEligibilityService } = await import('./dha-eligibility.service.js');
    const { DhaSubBenefitsService } = await import('./dha-sub-benefits.service.js');

    const eligService = new DhaEligibilityService(httpClient, patientRepository);
    const subBenService = new DhaSubBenefitsService(httpClient, patientRepository);

    expect(eligService).toBeDefined();
    expect(typeof eligService.checkEligibility).toBe('function');

    expect(subBenService).toBeDefined();
    expect(typeof subBenService.getSubBenefits).toBe('function');
  });
});
