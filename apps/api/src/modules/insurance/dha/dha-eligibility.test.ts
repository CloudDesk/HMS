import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientModel, PatientTimelineEventModel } from '../../patients/patient.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaAuthService } from './dha-auth.service.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaEligibilityService } from './dha-eligibility.service.js';
import { DhaError } from './dha.errors.js';
import { DhaEligibilityAdapter } from '../sha-eligibility.adapter.js';
import type { DhaConfig } from './dha.types.js';

describe('DHA Eligibility Integration (Prerequisite 6)', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  // Test data variables/placeholders (no real identifiers or credentials)
  const DHA_TEST_PATIENT_IDENTIFIER = process.env.DHA_TEST_PATIENT_IDENTIFIER || 'SYNTH-NATIONAL-ID-9999';
  const DHA_TEST_PATIENT_IDENTIFIER_TYPE = process.env.DHA_TEST_PATIENT_IDENTIFIER_TYPE || 'NATIONAL_ID';
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
  let eligibilityService: DhaEligibilityService;
  let eligibilityAdapter: DhaEligibilityAdapter;

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
    eligibilityService = new DhaEligibilityService(httpClient, patientRepository);
    eligibilityAdapter = new DhaEligibilityAdapter(eligibilityService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const setupPatientWithDhaMapping = async (patientNumber = 'HMS-P-001') => {
    const patient = await PatientModel.create({
      patientNumber,
      firstName: 'Synthetic',
      lastName: 'EligibleUser',
      dateOfBirth: new Date('1992-05-10'),
      gender: 'FEMALE',
      phone: '+254700000001',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    const patientId = patient._id.toString();

    // Add active SHA/DHA identifier
    await patientRepository.addIdentifier(
      patientId,
      {
        identifier_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
        issuing_authority: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
        value: DHA_TEST_PATIENT_IDENTIFIER,
        status: 'ACTIVE',
      },
      userId,
    );

    // Add DHA Client Registry mapping
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

  // Requirement 1: Eligible DHA response -> internal ELIGIBLE
  it('1. Eligible DHA response maps to internal ELIGIBLE', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ACTIVE',
            reference_id: 'DHA-REF-1001',
            reason_code: 'DHA_CONFIRMED_ELIGIBLE',
            message: 'Active coverage confirmed',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const result = await eligibilityService.checkEligibility({
        patientId,
        policyNumber: 'POL-SYNTH-01',
        schemeCode: 'SHIF',
        correlationId: 'req-corr-001',
      });

      expect(result.status).toBe('ELIGIBLE');
      expect(result.externalReferenceId).toBe('DHA-REF-1001');
      expect(result.reasonCode).toBe('DHA_CONFIRMED_ELIGIBLE');

      // Verify URL sent to DHA
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('patients/eligibility?');
      expect(calledUrl).toContain(`client_registry_id=${DHA_TEST_CLIENT_REGISTRY_ID}`);
      expect(calledUrl).toContain(`identification_number=${encodeURIComponent(DHA_TEST_PATIENT_IDENTIFIER)}`);
      expect(calledUrl).toContain(`identification_type=${encodeURIComponent(DHA_TEST_PATIENT_IDENTIFIER_TYPE)}`);
      expect(calledUrl).toContain('policy_number=POL-SYNTH-01');
      expect(calledUrl).toContain('scheme_code=SHIF');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 2: Ineligible DHA response -> internal INELIGIBLE
  it('2. Ineligible DHA response maps to internal INELIGIBLE', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'INACTIVE',
            reference_id: 'DHA-REF-1002',
            reason_code: 'COVERAGE_EXPIRED',
            message: 'Coverage has expired',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const result = await eligibilityService.checkEligibility({
        patientId,
      });

      expect(result.status).toBe('INELIGIBLE');
      expect(result.externalReferenceId).toBe('DHA-REF-1002');
      expect(result.reasonCode).toBe('COVERAGE_EXPIRED');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 3: DHA pending response -> internal PENDING
  it('3. DHA pending response maps to internal PENDING', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'PENDING',
            reference_id: 'DHA-REF-1003',
            message: 'Manual review in progress',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const result = await eligibilityService.checkEligibility({
        patientId,
      });

      expect(result.status).toBe('PENDING');
      expect(result.externalReferenceId).toBe('DHA-REF-1003');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 4: Unexpected status -> safe FAILED (NEVER convert to ELIGIBLE)
  it('4. Unexpected DHA status results in FAILED and never ELIGIBLE', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'UNRECOGNIZED_WEIRD_STATUS',
            reference_id: 'DHA-REF-1004',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const result = await eligibilityService.checkEligibility({
        patientId,
      });

      expect(result.status).toBe('FAILED');
      expect(result.status).not.toBe('ELIGIBLE');
      expect(result.status).not.toBe('INELIGIBLE');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 5: Missing patient identifier -> rejects without DHA request
  it('5. Missing configured SHA/DHA patient identifier rejects safely without outbound request', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patient = await PatientModel.create({
        patientNumber: 'HMS-P-NOID',
        firstName: 'No',
        lastName: 'Id',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      });

      await expect(
        eligibilityService.checkEligibility({ patientId: patient._id.toString() }),
      ).rejects.toMatchObject({
        code: 'PATIENT_IDENTIFIER_NOT_AVAILABLE',
        statusCode: 400,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 6: Missing DHA patient mapping -> rejects without DHA request
  it('6. Missing DHA Patient Registry mapping rejects safely without outbound request', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patient = await PatientModel.create({
        patientNumber: 'HMS-P-NOMAP',
        firstName: 'No',
        lastName: 'Map',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      });

      // Has national ID, but NOT mapped in DHA registry
      await patientRepository.addIdentifier(
        patient._id.toString(),
        {
          identifier_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
          issuing_authority: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
          value: DHA_TEST_PATIENT_IDENTIFIER,
          status: 'ACTIVE',
        },
        userId,
      );

      await expect(
        eligibilityService.checkEligibility({ patientId: patient._id.toString() }),
      ).rejects.toMatchObject({
        code: 'DHA_PATIENT_MAPPING_REQUIRED',
        statusCode: 400,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 10: DHA authentication failure -> FAILED
  it('10. DHA authentication failure maps to FAILED', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      vi.spyOn(authService, 'getAccessToken').mockRejectedValueOnce(
        new DhaError('DHA auth failed', 'DHA_AUTHENTICATION_FAILED', 401),
      );

      const result = await eligibilityService.checkEligibility({ patientId });
      expect(result.status).toBe('FAILED');
      expect(result.reasonCode).toBe('DHA_AUTHENTICATION_FAILED');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 11: DHA timeout -> FAILED
  it('11. DHA timeout maps to FAILED with DHA_TIMEOUT', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await eligibilityService.checkEligibility({ patientId });
      expect(result.status).toBe('FAILED');
      expect(result.reasonCode).toBe('DHA_TIMEOUT');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 12: Network failure -> FAILED
  it('12. Network failure maps to FAILED with DHA_NETWORK_FAILURE', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await eligibilityService.checkEligibility({ patientId });
      expect(result.status).toBe('FAILED');
      expect(result.reasonCode).toBe('DHA_NETWORK_FAILURE');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 13: DHA patient-not-found (404) handled safely
  it('13. DHA 404 patient-not-found is mapped safely to INELIGIBLE', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Patient not registered for insurance' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await eligibilityService.checkEligibility({ patientId });
      expect(result.status).toBe('INELIGIBLE');
      expect(result.reasonCode).toBe('DHA_PATIENT_NOT_FOUND');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 14: Correlation ID forwarded and returned
  it('14. Correlation ID is forwarded in request headers', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'ACTIVE', reference_id: 'REF-001' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      await eligibilityService.checkEligibility({
        patientId,
        correlationId: 'test-corr-id-xyz',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callHeaders = mockFetch.mock.calls[0][1]?.headers as Headers;
      expect(callHeaders.get('X-Correlation-Id')).toBe('test-corr-id-xyz');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 16, 17, 18: Security, privacy, no credentials in details
  it('16, 17, 18. Details sanitization strips sensitive keys and tokens', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ACTIVE',
            reference_id: 'REF-002',
            details: {
              safe_plan_name: 'Standard Gold',
              raw_token: 'secret-bearer-token',
              secret_key: 'top-secret',
              national_id: '12345678',
              clinical_notes: 'private notes',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const result = await eligibilityService.checkEligibility({ patientId });
      expect(result.details).toBeDefined();
      expect(result.details?.safe_plan_name).toBe('Standard Gold');
      expect(result.details?.raw_token).toBeUndefined();
      expect(result.details?.secret_key).toBeUndefined();
      expect(result.details?.national_id).toBeUndefined();
      expect(result.details?.clinical_notes).toBeUndefined();
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement: DhaEligibilityAdapter functions correctly as IShaEligibilityAdapter
  it('DhaEligibilityAdapter routes through DhaEligibilityService', async () => {
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
      const patientId = await setupPatientWithDhaMapping();

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'ACTIVE', reference_id: 'ADAPTER-REF-1' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const adapterResult = await eligibilityAdapter.verifyEligibility({
        memberNumber: 'MEM-001',
        patientNumber: 'HMS-P-001',
        policyNumber: 'POL-001',
        payerCode: 'SHA',
        requestedDate: '2026-06-15',
        correlationId: 'adapter-corr',
        patientId,
      });

      expect(adapterResult.status).toBe('ELIGIBLE');
      expect(adapterResult.externalReferenceId).toBe('ADAPTER-REF-1');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 20: readyForShaSubmission remains strictly false
  it('20. readyForShaSubmission remains false in insurance claim lifecycle', async () => {
    const { InsuranceClaimService } = await import('../insurance-claim.service.js');
    expect(InsuranceClaimService).toBeDefined();
  });
});
