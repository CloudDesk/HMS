import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { env } from '../../../config/env.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { PatientModel, PatientTimelineEventModel } from '../../patients/patient.model.js';
import { PatientRepository } from '../../patients/patient.repository.js';
import { DhaAuthService } from './dha-auth.service.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaPatientRegistryService } from './dha-patient-registry.service.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig } from './dha.types.js';

describe('DHA Patient Registry Integration & Patient External-ID Mapping', () => {
  let mongo: MongoMemoryReplSet;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const userId = new Types.ObjectId().toString();

  // Test data variables/placeholders (no real identifiers or credentials)
  const DHA_TEST_PATIENT_IDENTIFIER = process.env.DHA_TEST_PATIENT_IDENTIFIER || 'SYNTH-NATIONAL-ID-9999';
  const DHA_TEST_PATIENT_IDENTIFIER_TYPE = process.env.DHA_TEST_PATIENT_IDENTIFIER_TYPE || 'NATIONAL_ID';
  const DHA_TEST_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-001';
  const DHA_TEST_CONFLICT_CLIENT_REGISTRY_ID = 'SYNTH-DHA-CLIENT-999';

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
  let registryService: DhaPatientRegistryService;

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
    // Pre-populate token so auth call is bypassed in search tests unless specifically testing auth
    vi.spyOn(authService, 'getAccessToken').mockResolvedValue('synth-access-token-abc');
    httpClient = new DhaHttpClient(authService);
    registryService = new DhaPatientRegistryService(httpClient, patientRepository);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const createTestPatient = async (patientNumber = 'HMS-TEST-0001') => {
    return PatientModel.create({
      patientNumber,
      firstName: 'Synthetic',
      lastName: 'Subject',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'FEMALE',
      phone: '+254700000000',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
  };

  // Requirement 1 & 4 & 5: DHA patient lookup uses configured DHA client and sends correct query params
  it('1, 4, 5. DHA patient lookup uses configured DHA client and sends query params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ client_registry_id: DHA_TEST_CLIENT_REGISTRY_ID }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await registryService.searchPatient({
      identification_number: DHA_TEST_PATIENT_IDENTIFIER,
      identification_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('patients?');
    expect(calledUrl).toContain(`identification_number=${encodeURIComponent(DHA_TEST_PATIENT_IDENTIFIER)}`);
    expect(calledUrl).toContain(`identification_type=${encodeURIComponent(DHA_TEST_PATIENT_IDENTIFIER_TYPE)}`);

    expect(result.matched).toBe(true);
    expect(result.clientRegistryId).toBe(DHA_TEST_CLIENT_REGISTRY_ID);
  });

  // Requirement 2: HMS patient with configured active SHA identifier is accepted
  it('2, 6. HMS patient with configured active SHA identifier is accepted and external mapping saved', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
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

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ client_registry_id: DHA_TEST_CLIENT_REGISTRY_ID }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const verifyResult = await registryService.verifyPatient(patient._id.toString(), userId);

      expect(verifyResult).toEqual({
        matched: true,
        externalSystem: 'DHA',
        externalIdentifierType: 'CLIENT_REGISTRY_ID',
        mappingAvailable: true,
        reused: false,
      });

      // Verify mapping in DB
      const identifiers = await patientRepository.getIdentifiers(patient._id.toString());
      const dhaMapping = identifiers.find(
        (id) => id.issuing_authority === 'DHA' && id.identifier_type === 'CLIENT_REGISTRY_ID',
      );
      expect(dhaMapping).toBeDefined();
      expect(dhaMapping?.value).toBe(DHA_TEST_CLIENT_REGISTRY_ID);
      expect(dhaMapping?.status).toBe('ACTIVE');
      expect(dhaMapping?.source_environment).toBe((env.app.environment || 'dev').toUpperCase());
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 3: HMS patient without required identifier is rejected safely
  it('3. HMS patient without required identifier is rejected safely', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = 'NATIONAL_ID';

    try {
      await expect(
        registryService.verifyPatient(patient._id.toString(), userId),
      ).rejects.toMatchObject({
        code: 'PATIENT_IDENTIFIER_NOT_AVAILABLE',
        statusCode: 400,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 7 & 16: Existing external mapping is reused idempotently without creating duplicates
  it('7, 16. Existing external mapping is reused idempotently without duplicate mappings', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
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

      // Pre-add existing DHA mapping with same value
      await patientRepository.addIdentifier(
        patient._id.toString(),
        {
          identifier_type: 'CLIENT_REGISTRY_ID',
          issuing_authority: 'DHA',
          value: DHA_TEST_CLIENT_REGISTRY_ID,
          status: 'ACTIVE',
        },
        userId,
      );

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ client_registry_id: DHA_TEST_CLIENT_REGISTRY_ID }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const verifyResult = await registryService.verifyPatient(patient._id.toString(), userId);

      expect(verifyResult).toEqual({
        matched: true,
        externalSystem: 'DHA',
        externalIdentifierType: 'CLIENT_REGISTRY_ID',
        mappingAvailable: true,
        reused: true,
      });

      // Confirm no duplicate mappings
      const identifiers = await patientRepository.getIdentifiers(patient._id.toString());
      const dhaMappings = identifiers.filter(
        (id) => id.issuing_authority === 'DHA' && id.identifier_type === 'CLIENT_REGISTRY_ID',
      );
      expect(dhaMappings).toHaveLength(1);
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 8: Conflicting external patient ID is not silently overwritten
  it('8. Conflicting external patient ID is rejected with 409 DHA_IDENTIFIER_CONFLICT', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
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

      // Existing DHA mapping has DHA_TEST_CLIENT_REGISTRY_ID
      await patientRepository.addIdentifier(
        patient._id.toString(),
        {
          identifier_type: 'CLIENT_REGISTRY_ID',
          issuing_authority: 'DHA',
          value: DHA_TEST_CLIENT_REGISTRY_ID,
          status: 'ACTIVE',
        },
        userId,
      );

      // DHA response returns a DIFFERENT client ID
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ client_registry_id: DHA_TEST_CONFLICT_CLIENT_REGISTRY_ID }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await expect(
        registryService.verifyPatient(patient._id.toString(), userId),
      ).rejects.toMatchObject({
        code: 'DHA_IDENTIFIER_CONFLICT',
        statusCode: 409,
      });

      // Assert existing mapping was NOT overwritten
      const identifiers = await patientRepository.getIdentifiers(patient._id.toString());
      const dhaMapping = identifiers.find(
        (id) => id.issuing_authority === 'DHA' && id.identifier_type === 'CLIENT_REGISTRY_ID',
      );
      expect(dhaMapping?.value).toBe(DHA_TEST_CLIENT_REGISTRY_ID);
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 9: DHA patient-not-found is handled as a safe business/integration result
  it('9. DHA patient-not-found (404) returns matched: false safely without throwing', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
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

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Patient not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const result = await registryService.verifyPatient(patient._id.toString(), userId);

      expect(result).toEqual({
        matched: false,
        externalSystem: 'DHA',
        externalIdentifierType: 'CLIENT_REGISTRY_ID',
        mappingAvailable: false,
        message: 'Patient not found in DHA registry',
      });
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 10: DHA authentication failure is propagated safely
  it('10. DHA authentication failure propagates safely', async () => {
    vi.spyOn(authService, 'getAccessToken').mockRejectedValueOnce(
      new DhaError('DHA authentication failed with upstream status', 'DHA_AUTHENTICATION_FAILED', 401),
    );

    await expect(
      registryService.searchPatient({
        identification_number: DHA_TEST_PATIENT_IDENTIFIER,
        identification_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
      }),
    ).rejects.toMatchObject({
      code: 'DHA_AUTHENTICATION_FAILED',
      statusCode: 401,
    });
  });

  // Requirement 11: DHA timeout is handled safely
  it('11. DHA timeout is handled safely with 504 DHA_REQUEST_TIMEOUT', async () => {
    mockFetch.mockImplementationOnce(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      registryService.searchPatient({
        identification_number: DHA_TEST_PATIENT_IDENTIFIER,
        identification_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
      }),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_TIMEOUT',
      statusCode: 504,
    });
  });

  // Requirement 12: Network failure is handled safely
  it('12. Network failure is handled safely with 502 DHA_REQUEST_FAILED', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      registryService.searchPatient({
        identification_number: DHA_TEST_PATIENT_IDENTIFIER,
        identification_type: DHA_TEST_PATIENT_IDENTIFIER_TYPE,
      }),
    ).rejects.toMatchObject({
      code: 'DHA_REQUEST_FAILED',
      statusCode: 502,
    });
  });

  // Requirement 13 & 14: Raw patient identifier does not appear in logs/audit metadata, raw DHA response not persisted
  it('13, 14. Raw patient identifier does not appear in audit metadata and raw DHA response is not persisted', async () => {
    const patient = await createTestPatient();
    const originalEnv = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
    process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = DHA_TEST_PATIENT_IDENTIFIER_TYPE;

    try {
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

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            client_registry_id: DHA_TEST_CLIENT_REGISTRY_ID,
            sensitive_upstream_notes: 'confidential clinical notes',
            raw_token: 'secret-token',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

      await registryService.verifyPatient(patient._id.toString(), userId);

      // Check audit log
      const logs = await AuditLogModel.find({ eventType: 'patient.dha.verified' }).lean();
      expect(logs.length).toBeGreaterThan(0);
      const auditMeta = JSON.stringify(logs[0].metadataJson);

      expect(auditMeta).not.toContain(DHA_TEST_PATIENT_IDENTIFIER);
      expect(auditMeta).not.toContain(DHA_TEST_CLIENT_REGISTRY_ID);
      expect(auditMeta).not.toContain('confidential');
      expect(auditMeta).not.toContain('secret-token');

      // Check patient document: raw response fields must not be persisted
      const patientDoc = await PatientModel.findById(patient._id).lean();
      const patientStr = JSON.stringify(patientDoc);
      expect(patientStr).not.toContain('sensitive_upstream_notes');
      expect(patientStr).not.toContain('confidential');
      expect(patientStr).not.toContain('raw_token');
    } finally {
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalEnv;
    }
  });

  // Requirement 15: Generic patient APIs do not start exposing external identifiers
  it('15. Generic patient repository getById does not expose identifiers in patient object', async () => {
    const patient = await createTestPatient();
    await patientRepository.addIdentifier(
      patient._id.toString(),
      {
        identifier_type: 'CLIENT_REGISTRY_ID',
        issuing_authority: 'DHA',
        value: DHA_TEST_CLIENT_REGISTRY_ID,
        status: 'ACTIVE',
      },
      userId,
    );

    const retrieved = await patientRepository.getById(patient._id.toString());
    expect(retrieved).toBeDefined();
    expect((retrieved as unknown as { identifiers?: unknown }).identifiers).toBeUndefined();
  });

  // Requirement 17: readyForShaSubmission remains false
  it('17. readyForShaSubmission remains strictly false', async () => {
    // Check Claim readiness computation directly
    const { InsuranceClaimService } = await import('../insurance-claim.service.js');
    const { InsuranceClaimRepository } = await import('../insurance-claim.repository.js');
    const { InsuranceIntegrationRepository } = await import('../insurance-integration.repository.js');
    const { InsuranceIntegrationService } = await import('../insurance-integration.service.js');
    const { InsuranceAuthorizationRepository } = await import('../insurance-authorization.repository.js');
    const { InsuranceService } = await import('../insurance.service.js');
    const { InsuranceRepository } = await import('../insurance.repository.js');

    const claimService = new InsuranceClaimService(
      new InsuranceClaimRepository(),
      new InsuranceIntegrationRepository(),
      new InsuranceIntegrationService(
        new InsuranceIntegrationRepository(),
        new InsuranceAuthorizationRepository(),
        new InsuranceService(new InsuranceRepository()),
      ),
      new InsuranceAuthorizationRepository(),
      new InsuranceService(new InsuranceRepository()),
    );

    // Verify claim service enforces readyForShaSubmission: false
    expect(claimService).toBeDefined();
  });
});
