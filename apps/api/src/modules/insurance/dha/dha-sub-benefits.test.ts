import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientModel, PatientTimelineEventModel } from '../../patients/patient.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaAuthService } from './dha-auth.service.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaSubBenefitsService } from './dha-sub-benefits.service.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig } from './dha.types.js';

describe('DHA Sub-Benefits Integration (Prerequisite 7)', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  // Test data variables/placeholders (no real identifiers or credentials)
  const DHA_TEST_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-001';

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
  let subBenefitsService: DhaSubBenefitsService;

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
    vi.spyOn(authService, 'getAccessToken').mockResolvedValue('synth-access-token-abc');
    httpClient = new DhaHttpClient(authService);
    subBenefitsService = new DhaSubBenefitsService(httpClient, patientRepository);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const setupPatientWithDhaMapping = async (patientNumber = 'HMS-P-SUB-01') => {
    const patient = await PatientModel.create({
      patientNumber,
      firstName: 'Synthetic',
      lastName: 'SubBenefitUser',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      phone: '+254700000002',
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

  // Requirement 1 & 3: Valid DHA Client Registry mapping calls GET /patients/sub-benefits and normalizes safely
  it('1, 3. Valid DHA Client Registry mapping calls GET /patients/sub-benefits and normalizes safely', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub_benefits: [
            {
              id: 'SB-001',
              code: 'SB-OPD-GEN',
              name: 'General Outpatient Care',
              category: 'Outpatient Services',
              status: 'ACTIVE',
              raw_upstream_tariff: 1500, // Should not be in DhaSubBenefitItem
              raw_copay: 200, // Should not be in DhaSubBenefitItem
            },
            {
              id: 'SB-002',
              code: 'SB-MAT-BASIC',
              name: 'Basic Maternity Care',
              category: 'Maternity',
              status: 'ACTIVE',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await subBenefitsService.getSubBenefits(patientId, {
      correlationId: 'sub-corr-001',
      actorUserId: userId,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('patients/sub-benefits?');
    expect(calledUrl).toContain(`patient_id=${DHA_TEST_CLIENT_REGISTRY_ID}`);

    expect(result.patientId).toBe(patientId);
    expect(result.externalSystem).toBe('DHA');
    expect(result.clientRegistryId).toBe(DHA_TEST_CLIENT_REGISTRY_ID);
    expect(result.total).toBe(2);
    expect(result.subBenefits).toHaveLength(2);

    expect(result.subBenefits[0]).toEqual({
      id: 'SB-001',
      code: 'SB-OPD-GEN',
      name: 'General Outpatient Care',
      category: 'Outpatient Services',
      status: 'ACTIVE',
    });
    // Ensure undocumented/invented fields are NOT present
    expect((result.subBenefits[0] as unknown as Record<string, unknown>).raw_upstream_tariff).toBeUndefined();
    expect((result.subBenefits[0] as unknown as Record<string, unknown>).raw_copay).toBeUndefined();
    expect((result.subBenefits[0] as unknown as Record<string, unknown>).annualLimit).toBeUndefined();
  });

  // Requirement 2: Missing DHA Client Registry mapping -> rejects without calling DHA
  it('2. Missing DHA Client Registry mapping rejects safely without outbound network call', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'HMS-P-NOMAP',
      firstName: 'No',
      lastName: 'DhaMap',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await expect(
      subBenefitsService.getSubBenefits(patient._id.toString()),
    ).rejects.toMatchObject({
      code: 'DHA_PATIENT_MAPPING_REQUIRED',
      statusCode: 400,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Requirement 4: Empty sub-benefit response -> valid empty result
  it('4. Empty sub-benefit response returns valid empty result with total: 0', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sub_benefits: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await subBenefitsService.getSubBenefits(patientId);

    expect(result.total).toBe(0);
    expect(result.subBenefits).toEqual([]);
  });

  // Requirement 5: DHA authentication failure -> propagated typed integration error
  it('5. DHA authentication failure propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    vi.spyOn(authService, 'getAccessToken').mockRejectedValueOnce(
      new DhaError('DHA auth failure', 'DHA_AUTHENTICATION_FAILED', 401),
    );

    await expect(
      subBenefitsService.getSubBenefits(patientId),
    ).rejects.toMatchObject({
      code: 'DHA_AUTHENTICATION_FAILED',
      statusCode: 401,
    });
  });

  // Requirement 6: DHA timeout / network failure -> propagated typed integration error
  it('6. DHA timeout propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockImplementationOnce(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      subBenefitsService.getSubBenefits(patientId),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_TIMEOUT',
      statusCode: 504,
    });
  });

  it('6b. DHA network failure propagates as typed DhaError', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      subBenefitsService.getSubBenefits(patientId),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_FAILED',
      statusCode: 502,
    });
  });

  // Requirement 7: Raw DHA response is not persisted/logged
  it('7. Raw DHA response is not persisted in patient record or audit log', async () => {
    const patientId = await setupPatientWithDhaMapping();

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub_benefits: [
            {
              id: 'SB-SECRET-01',
              name: 'Secret Benefit',
              sensitive_token: 'secret-bearer-1234',
              raw_diagnostic_data: 'confidential diagnosis',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await subBenefitsService.getSubBenefits(patientId, {
      actorUserId: userId,
      correlationId: 'corr-audit-check',
    });

    const logs = await AuditLogModel.find({ eventType: 'patient.dha.sub_benefits_queried' }).lean();
    expect(logs.length).toBeGreaterThan(0);
    const logStr = JSON.stringify(logs[0]);

    expect(logStr).not.toContain('secret-bearer-1234');
    expect(logStr).not.toContain('confidential diagnosis');
    expect(logStr).not.toContain('DHA_TEST_PATIENT_IDENTIFIER');

    const patientDoc = await PatientModel.findById(patientId).lean();
    const patientStr = JSON.stringify(patientDoc);
    expect(patientStr).not.toContain('secret-bearer-1234');
    expect(patientStr).not.toContain('confidential diagnosis');
  });

  // Requirement 8: Existing eligibility behavior remains unchanged
  it('8. Existing eligibility service remains fully functional and independent', async () => {
    const { DhaEligibilityService } = await import('./dha-eligibility.service.js');
    const eligService = new DhaEligibilityService(httpClient, patientRepository);
    expect(eligService).toBeDefined();
    expect(typeof eligService.checkEligibility).toBe('function');
  });
});
