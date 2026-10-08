import { describe, expect, it, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { InsuranceService } from './insurance.service.js';
import type { InsuranceRepository } from './insurance.repository.js';
import { sanitizeDetails, HttpShaEligibilityAdapter } from './sha-eligibility.adapter.js';
import { buildApp } from '../../app.js';

describe('Insurance Domain - Phase 1, Phase 2 & Phase 3', () => {
  let mockRepository: Partial<Record<keyof InsuranceRepository, any>>;
  let mockShaAdapter: { verifyEligibility: any };
  let service: InsuranceService;

  const mockMetadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };
  const userId = 'user-admin-123';

  beforeEach(() => {
    mockShaAdapter = {
      verifyEligibility: vi.fn(),
    };
    mockRepository = {
      isDuplicateKeyError: vi.fn().mockReturnValue(false),
      audit: vi.fn().mockResolvedValue(undefined),
      getPayerById: vi.fn(),
      getPayerByCode: vi.fn(),
      createPayer: vi.fn(),
      listPayers: vi.fn(),
      updatePayer: vi.fn(),
      getSchemeById: vi.fn(),
      getSchemeByCode: vi.fn(),
      createScheme: vi.fn(),
      listSchemes: vi.fn(),
      updateScheme: vi.fn(),
      getPolicyById: vi.fn(),
      getPolicyByNumber: vi.fn(),
      createPolicy: vi.fn(),
      listPolicies: vi.fn(),
      updatePolicy: vi.fn(),
      getMemberById: vi.fn(),
      getMemberByNumber: vi.fn(),
      createMember: vi.fn(),
      listMembers: vi.fn(),
      updateMember: vi.fn(),
      getPatientById: vi.fn(),
      getActiveMemberForPatient: vi.fn().mockResolvedValue(null),
      findMemberForCoverageCheck: vi.fn(),
      createEligibilityVerification: vi.fn(),
      getEligibilityVerificationById: vi.fn(),
      findRecentEligibilityVerification: vi.fn().mockResolvedValue(null),
      listEligibilityVerifications: vi.fn(),
      createBenefitConfig: vi.fn(),
      getBenefitConfigById: vi.fn(),
      listBenefitConfigs: vi.fn(),
      updateBenefitConfig: vi.fn(),
      findConflictingBenefitConfig: vi.fn().mockResolvedValue(null),
      findMatchingBenefitConfigs: vi.fn().mockResolvedValue([]),
      getServiceByIdOrCode: vi.fn(),
    };
    service = new InsuranceService(
      mockRepository as unknown as InsuranceRepository,
      mockShaAdapter as any
    );
  });

  // ================= PHASE 1 TESTS =================
  describe('1. Payer Management & Duplicate Prevention', () => {
    it('creates a payer successfully', async () => {
      mockRepository.getPayerByCode.mockResolvedValue(null);
      mockRepository.createPayer.mockResolvedValue({
        _id: 'payer-sha-id',
        payerCode: 'SHA',
        name: 'Social Health Authority',
        type: 'SHA',
        status: 'ACTIVE',
      });

      const result = await service.createPayer(
        {
          payerCode: 'SHA',
          name: 'Social Health Authority',
          type: 'SHA',
        },
        userId,
        mockMetadata
      );

      expect(result).toBeDefined();
      expect(result.payerCode).toBe('SHA');
      expect(mockRepository.createPayer).toHaveBeenCalled();
    });

    it('prevents duplicate payer code', async () => {
      mockRepository.getPayerByCode.mockResolvedValue({
        _id: 'existing-payer-id',
        payerCode: 'SHA',
      });

      await expect(
        service.createPayer(
          {
            payerCode: 'SHA',
            name: 'Duplicate SHA',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'PAYER_CODE_EXISTS',
      });
    });

    it('validates effective dates for payer', async () => {
      await expect(
        service.createPayer(
          {
            payerCode: 'SHA',
            name: 'SHA',
            effectiveFrom: '2026-12-31',
            effectiveTo: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DATE_RANGE',
      });
    });
  });

  describe('2. Scheme Management & Hierarchical Integrity', () => {
    it('creates scheme under valid payer', async () => {
      mockRepository.getPayerById.mockResolvedValue({
        _id: 'payer-sha-id',
        payerCode: 'SHA',
        status: 'ACTIVE',
      });
      mockRepository.getSchemeByCode.mockResolvedValue(null);
      mockRepository.createScheme.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'payer-sha-id',
        schemeCode: 'SHIF',
        name: 'Social Health Insurance Fund',
        status: 'ACTIVE',
      });

      const result = await service.createScheme(
        {
          payerId: 'payer-sha-id',
          schemeCode: 'SHIF',
          name: 'Social Health Insurance Fund',
        },
        userId,
        mockMetadata
      );

      expect(result).toBeDefined();
      expect(result.schemeCode).toBe('SHIF');
    });

    it('rejects scheme creation if payer does not exist', async () => {
      mockRepository.getPayerById.mockResolvedValue(null);

      await expect(
        service.createScheme(
          {
            payerId: 'non-existent-payer',
            schemeCode: 'SHIF',
            name: 'Social Health Insurance Fund',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'PAYER_NOT_FOUND',
      });
    });

    it('prevents duplicate scheme code under same payer', async () => {
      mockRepository.getPayerById.mockResolvedValue({
        _id: 'payer-sha-id',
      });
      mockRepository.getSchemeByCode.mockResolvedValue({
        _id: 'existing-scheme-id',
        schemeCode: 'SHIF',
      });

      await expect(
        service.createScheme(
          {
            payerId: 'payer-sha-id',
            schemeCode: 'SHIF',
            name: 'Social Health Insurance Fund',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SCHEME_CODE_EXISTS',
      });
    });

    it('validates scheme effective dates', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });

      await expect(
        service.createScheme(
          {
            payerId: 'payer-sha-id',
            schemeCode: 'SHIF',
            name: 'Social Health Insurance Fund',
            effectiveFrom: '2026-06-01',
            effectiveTo: '2026-05-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DATE_RANGE',
      });
    });
  });

  describe('3. Policy Management & Patient Linking', () => {
    it('creates policy linked to valid patient and scheme belonging to payer', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'payer-sha-id',
      });
      mockRepository.getPatientById.mockResolvedValue({
        _id: 'patient-hms-001',
        patientNumber: 'P-1001',
      });
      mockRepository.getPolicyByNumber.mockResolvedValue(null);
      mockRepository.createPolicy.mockResolvedValue({
        _id: 'policy-001',
        payerId: 'payer-sha-id',
        schemeId: 'scheme-shif-id',
        policyNumber: 'POL-SHA-999',
        holderPatientId: 'patient-hms-001',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
      });

      const result = await service.createPolicy(
        {
          payerId: 'payer-sha-id',
          schemeId: 'scheme-shif-id',
          policyNumber: 'POL-SHA-999',
          holderPatientId: 'patient-hms-001',
          startDate: '2026-01-01',
        },
        userId,
        mockMetadata
      );

      expect(result).toBeDefined();
      expect(result.policyNumber).toBe('POL-SHA-999');
    });

    it('rejects policy creation if patient does not exist in HMS patient master', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'payer-sha-id',
      });
      mockRepository.getPatientById.mockResolvedValue(null);

      await expect(
        service.createPolicy(
          {
            payerId: 'payer-sha-id',
            schemeId: 'scheme-shif-id',
            policyNumber: 'POL-SHA-999',
            holderPatientId: 'non-existent-patient',
            startDate: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'PATIENT_NOT_FOUND',
      });
    });

    it('rejects policy creation if scheme does not belong to specified payer', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'another-payer-id',
      });

      await expect(
        service.createPolicy(
          {
            payerId: 'payer-sha-id',
            schemeId: 'scheme-shif-id',
            policyNumber: 'POL-SHA-999',
            holderPatientId: 'patient-hms-001',
            startDate: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SCHEME_PAYER_RELATION',
      });
    });

    it('prevents duplicate policy number for payer', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'payer-sha-id',
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-hms-001' });
      mockRepository.getPolicyByNumber.mockResolvedValue({
        _id: 'existing-pol',
        policyNumber: 'POL-SHA-999',
      });

      await expect(
        service.createPolicy(
          {
            payerId: 'payer-sha-id',
            schemeId: 'scheme-shif-id',
            policyNumber: 'POL-SHA-999',
            holderPatientId: 'patient-hms-001',
            startDate: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'POLICY_NUMBER_EXISTS',
      });
    });

    it('validates policy date range', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({
        _id: 'scheme-shif-id',
        payerId: 'payer-sha-id',
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-hms-001' });

      await expect(
        service.createPolicy(
          {
            payerId: 'payer-sha-id',
            schemeId: 'scheme-shif-id',
            policyNumber: 'POL-SHA-999',
            holderPatientId: 'patient-hms-001',
            startDate: '2026-12-31',
            endDate: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DATE_RANGE',
      });
    });
  });

  describe('4. Member Management & Policy Linking', () => {
    it('creates member linked to valid policy and patient', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        policyNumber: 'POL-SHA-999',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue({
        _id: 'patient-hms-002',
        patientNumber: 'P-1002',
      });
      mockRepository.getMemberByNumber.mockResolvedValue(null);
      mockRepository.createMember.mockResolvedValue({
        _id: 'member-001',
        policyId: 'policy-001',
        patientId: 'patient-hms-002',
        memberNumber: 'MEM-001',
        relationship: 'SPOUSE',
        coverageStart: new Date('2026-01-01'),
        status: 'ACTIVE',
      });

      const result = await service.createMember(
        {
          policyId: 'policy-001',
          patientId: 'patient-hms-002',
          memberNumber: 'MEM-001',
          relationship: 'SPOUSE',
          coverageStart: '2026-01-01',
        },
        userId,
        mockMetadata
      );

      expect(result).toBeDefined();
      expect(result.memberNumber).toBe('MEM-001');
    });

    it('rejects member creation if policy does not exist', async () => {
      mockRepository.getPolicyById.mockResolvedValue(null);

      await expect(
        service.createMember(
          {
            policyId: 'non-existent-policy',
            patientId: 'patient-hms-002',
            memberNumber: 'MEM-001',
            relationship: 'SELF',
            coverageStart: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'POLICY_NOT_FOUND',
      });
    });

    it('rejects member creation if patient does not exist', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue(null);

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'non-existent-patient',
            memberNumber: 'MEM-001',
            relationship: 'SELF',
            coverageStart: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'PATIENT_NOT_FOUND',
      });
    });

    it('prevents duplicate member number for policy', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-hms-002' });
      mockRepository.getMemberByNumber.mockResolvedValue({
        _id: 'existing-mem',
        memberNumber: 'MEM-001',
      });

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'patient-hms-002',
            memberNumber: 'MEM-001',
            relationship: 'SELF',
            coverageStart: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'MEMBER_NUMBER_EXISTS',
      });
    });

    it('validates member coverage date range', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-hms-002' });

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'patient-hms-002',
            memberNumber: 'MEM-001',
            relationship: 'SELF',
            coverageStart: '2026-12-31',
            coverageEnd: '2026-01-01',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DATE_RANGE',
      });
    });
  });

  // ================= PHASE 2 TESTS: MEMBER & COVERAGE READINESS =================
  describe('5. Policy Date Containment & Duplicate Active Member Safety', () => {
    it('rejects member coverage starting before policy start date', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-12-31'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-001' });

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'patient-001',
            memberNumber: 'MEM-EARLY',
            relationship: 'SELF',
            coverageStart: '2026-01-01', // earlier than policy 2026-06-01
            coverageEnd: '2026-12-31',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'COVERAGE_OUTSIDE_POLICY_PERIOD',
      });
    });

    it('rejects member coverage extending past policy end date', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-001' });

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'patient-001',
            memberNumber: 'MEM-LATE',
            relationship: 'SELF',
            coverageStart: '2026-01-01',
            coverageEnd: '2027-01-15', // exceeds policy 2026-12-31
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'COVERAGE_OUTSIDE_POLICY_PERIOD',
      });
    });

    it('prevents duplicate ACTIVE membership for same patient under same policy', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-001' });
      mockRepository.getActiveMemberForPatient.mockResolvedValue({
        _id: 'existing-active-mem-id',
        status: 'ACTIVE',
      });

      await expect(
        service.createMember(
          {
            policyId: 'policy-001',
            patientId: 'patient-001',
            memberNumber: 'MEM-NEW-ACTIVE',
            relationship: 'SELF',
            coverageStart: '2026-01-01',
            status: 'ACTIVE',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_ACTIVE_MEMBER',
      });
    });

    it('allows creating active membership when previous record was inactive or expired', async () => {
      mockRepository.getPolicyById.mockResolvedValue({
        _id: 'policy-001',
        startDate: new Date('2026-01-01'),
      });
      mockRepository.getPatientById.mockResolvedValue({ _id: 'patient-001' });
      mockRepository.getActiveMemberForPatient.mockResolvedValue(null); // No active member
      mockRepository.getMemberByNumber.mockResolvedValue(null);
      mockRepository.createMember.mockResolvedValue({
        _id: 'new-active-mem',
        status: 'ACTIVE',
        memberNumber: 'MEM-RENEWED',
      });

      const result = await service.createMember(
        {
          policyId: 'policy-001',
          patientId: 'patient-001',
          memberNumber: 'MEM-RENEWED',
          relationship: 'SELF',
          coverageStart: '2026-01-01',
          status: 'ACTIVE',
        },
        userId,
        mockMetadata
      );

      expect(result).toBeDefined();
      expect(result.memberNumber).toBe('MEM-RENEWED');
    });
  });

  describe('6. Internal Coverage Readiness Check (Deterministic Business Rules)', () => {
    const validMember = {
      _id: 'member-001',
      memberNumber: 'MEM-SHA-001',
      relationship: 'SELF',
      coverageStart: new Date('2026-01-01'),
      coverageEnd: new Date('2026-12-31'),
      status: 'ACTIVE',
      policyId: {
        _id: 'policy-001',
        policyNumber: 'POL-001',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        payerId: { _id: 'payer-sha-id', payerCode: 'SHA', name: 'SHA' },
        schemeId: { _id: 'scheme-shif-id', schemeCode: 'SHIF', name: 'SHIF' },
        holderPatientId: 'patient-001',
      },
      patientId: {
        _id: 'patient-001',
        patientNumber: 'P-100',
        firstName: 'John',
        lastName: 'Doe',
      },
    };

    const validPolicy = {
      _id: 'policy-001',
      policyNumber: 'POL-001',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      payerId: { _id: 'payer-sha-id', payerCode: 'SHA', name: 'SHA' },
      schemeId: { _id: 'scheme-shif-id', schemeCode: 'SHIF', name: 'SHIF' },
      holderPatientId: 'patient-001',
    };

    const validPatient = {
      _id: 'patient-001',
      patientNumber: 'P-100',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('returns LOCAL_COVERAGE_VALID and shaEligibilityStatus: NOT_VERIFIED when all criteria met', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        patientId: 'patient-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(true);
      expect(result.reasonCode).toBe('LOCAL_COVERAGE_VALID');
      expect(result.shaEligibilityStatus).toBe('NOT_VERIFIED');
      expect(result.memberNumber).toBe('MEM-SHA-001');
      expect(result.policyNumber).toBe('POL-001');
      expect(result.payerCode).toBe('SHA');
    });

    it('returns MEMBER_COVERAGE_NOT_STARTED when asOfDate precedes coverageStart', async () => {
      const lateStartMember = {
        ...validMember,
        coverageStart: new Date('2026-07-01'),
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(lateStartMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-03-01', // Policy effective since 2026-01-01, but member coverage starts 2026-07-01
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('MEMBER_COVERAGE_NOT_STARTED');
      expect(result.shaEligibilityStatus).toBe('NOT_VERIFIED');
    });

    it('returns MEMBER_COVERAGE_EXPIRED when asOfDate is after coverageEnd', async () => {
      const earlyEndMember = {
        ...validMember,
        coverageEnd: new Date('2026-06-30'),
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(earlyEndMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-08-01', // Policy active until 2026-12-31, but member coverage ended 2026-06-30
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('MEMBER_COVERAGE_EXPIRED');
    });

    it('returns POLICY_NOT_EFFECTIVE when asOfDate precedes policy startDate', async () => {
      const futurePolicy = {
        ...validPolicy,
        startDate: new Date('2026-09-01'),
      };
      const futureMember = {
        ...validMember,
        coverageStart: new Date('2026-09-01'),
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(futureMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(futurePolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-01', // before policy start 2026-09-01
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('POLICY_NOT_EFFECTIVE');
    });

    it('returns POLICY_EXPIRED when policy endDate is in the past', async () => {
      const expiredPolicy = {
        ...validPolicy,
        endDate: new Date('2026-05-31'),
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(expiredPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('POLICY_EXPIRED');
    });

    it('returns MEMBER_INACTIVE when member status is INACTIVE', async () => {
      const inactiveMember = {
        ...validMember,
        status: 'INACTIVE',
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(inactiveMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('MEMBER_INACTIVE');
    });

    it('returns MEMBER_SUSPENDED when member status is SUSPENDED', async () => {
      const suspendedMember = {
        ...validMember,
        status: 'SUSPENDED',
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(suspendedMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('MEMBER_SUSPENDED');
    });

    it('returns POLICY_INACTIVE when policy status is INACTIVE', async () => {
      const inactivePolicy = {
        ...validPolicy,
        status: 'INACTIVE',
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(inactivePolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('POLICY_INACTIVE');
    });

    it('returns MEMBER_NOT_FOUND when member cannot be resolved', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(null);

      const result = await service.checkCoverage({
        memberId: 'non-existent-member',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('MEMBER_NOT_FOUND');
    });

    it('returns PATIENT_MISMATCH when patientId provided does not match member', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        patientId: 'different-patient-id',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('PATIENT_MISMATCH');
    });

    it('returns PATIENT_NOT_FOUND when member patient no longer exists in HMS master', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(null); // Missing from Patient master

      const result = await service.checkCoverage({
        memberId: 'member-001',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('PATIENT_NOT_FOUND');
    });

    it('returns COVERAGE_OUTSIDE_POLICY_PERIOD when member dates exceed policy bounds', async () => {
      const misalignedMember = {
        ...validMember,
        coverageStart: new Date('2025-10-01'), // earlier than policy 2026-01-01
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(misalignedMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      const result = await service.checkCoverage({
        memberId: 'member-001',
        asOfDate: '2026-06-15',
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('COVERAGE_OUTSIDE_POLICY_PERIOD');
    });
  });

  // ================= RBAC & ROUTE CONTRACT TESTS =================
  describe('7. RBAC & Route Authorization Checks', () => {
    let built: Awaited<ReturnType<typeof buildApp>>;
    const testStaffUser = {
      id: 'staff-user-id',
      username: 'insurance-staff',
      fullName: 'Insurance Staff',
      email: 'staff@example.test',
      status: 'active' as const,
      patientId: null,
    };

    beforeAll(async () => {
      built = await buildApp();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(async () => {
      await built.app.close();
    });

    it.each([
      ['GET', '/api/insurance/authorizations', 'View'],
      ['POST', '/api/insurance/authorizations', 'Manage'],
      ['POST', '/api/insurance/authorizations/507f1f77bcf86cd799439011/submit', 'Submit'],
      ['POST', '/api/insurance/authorizations/507f1f77bcf86cd799439011/cancel', 'Manage'],
    ] as const)('enforces Authorization permission for %s %s', async (method, url, action) => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      const permission = vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined);
      const response = await built.app.inject({ method, url, headers: { authorization: 'Bearer test-token' } });
      expect(response.statusCode).toBe(403);
      expect(permission).toHaveBeenCalledWith(testStaffUser.id, 'Insurance', 'Authorization', action);
    });

    it.each([
      ['GET', '/api/insurance/encounters/507f1f77bcf86cd799439011/context', 'View'],
      ['POST', '/api/insurance/encounters/507f1f77bcf86cd799439011/services/507f1f77bcf86cd799439012/coverage', 'Verify'],
      ['POST', '/api/insurance/sha-service-mappings', 'Manage'],
      ['GET', '/api/insurance/sha-service-mappings', 'View'],
      ['POST', '/api/insurance/sha-service-mappings/507f1f77bcf86cd799439011/deactivate', 'Manage'],
    ] as const)('enforces Phase 6 Benefits permission for %s %s', async (method, url, action) => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      const permission = vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined);
      const response = await built.app.inject({ method, url, headers: { authorization: 'Bearer test-token' } });
      expect(response.statusCode).toBe(403);
      expect(permission).toHaveBeenCalledWith(testStaffUser.id, 'Insurance', 'Benefits', action);
    });

    it.each([
      ['GET', '/api/insurance/claims', 'View'],
      ['GET', '/api/insurance/claims/507f1f77bcf86cd799439011', 'View'],
      ['GET', '/api/insurance/claims/507f1f77bcf86cd799439011/readiness', 'View'],
      ['POST', '/api/insurance/claims', 'Create'],
      ['POST', '/api/insurance/claims/507f1f77bcf86cd799439011/validate', 'Validate'],
    ] as const)('enforces Phase 7 Claims permission for %s %s', async (method, url, action) => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      const permission = vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined);
      const response = await built.app.inject({ method, url, headers: { authorization: 'Bearer test-token' } });
      expect(response.statusCode).toBe(403);
      expect(permission).toHaveBeenCalledWith(testStaffUser.id, 'Insurance', 'Claims', action);
    });

    it('rejects access to list payers when user lacks Insurance.Configuration.View permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as any);

      const response = await built.app.inject({
        method: 'GET',
        url: '/api/insurance/payers',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('allows access to list payers when user has Insurance.Configuration.View permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'listPayers').mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      const response = await built.app.inject({
        method: 'GET',
        url: '/api/insurance/payers',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: {
          items: [],
          total: 0,
          limit: 50,
          offset: 0,
        },
      });
    });

    it('rejects creating a payer when user lacks Insurance.Configuration.Create permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/payers',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          payerCode: 'SHA',
          name: 'Social Health Authority',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('allows creating a payer when user has Insurance.Configuration.Create permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'createPayer').mockResolvedValue({
        _id: 'payer-id',
        payerCode: 'SHA',
        name: 'Social Health Authority',
        type: 'SHA',
        status: 'ACTIVE',
        version: 0,
      } as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/payers',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          payerCode: 'SHA',
          name: 'Social Health Authority',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        data: expect.objectContaining({
          payerCode: 'SHA',
          name: 'Social Health Authority',
        }),
      });
    });

    it('verifies coverage check endpoint executes with proper response contract and NOT_VERIFIED SHA status', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'checkCoverage').mockResolvedValue({
        valid: true,
        reasonCode: 'LOCAL_COVERAGE_VALID',
        shaEligibilityStatus: 'NOT_VERIFIED',
        memberId: 'mem-123',
        policyId: 'pol-123',
        patientId: 'pat-123',
        payerCode: 'SHA',
        schemeCode: 'SHIF',
        message: 'Local insurance coverage is active and valid (SHA eligibility not yet verified)',
        checkedAt: '2026-06-15T10:00:00.000Z',
      });

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/coverage/check',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          memberId: 'mem-123',
          patientId: 'pat-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.valid).toBe(true);
      expect(body.data.reasonCode).toBe('LOCAL_COVERAGE_VALID');
      expect(body.data.shaEligibilityStatus).toBe('NOT_VERIFIED');
    });

    it('verifies member coverage-status endpoint executes correctly', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'checkCoverage').mockResolvedValue({
        valid: true,
        reasonCode: 'LOCAL_COVERAGE_VALID',
        shaEligibilityStatus: 'NOT_VERIFIED',
        memberId: 'mem-123',
        message: 'Local insurance coverage is active and valid',
        checkedAt: '2026-06-15T10:00:00.000Z',
      });

      const response = await built.app.inject({
        method: 'GET',
        url: '/api/insurance/members/mem-123/coverage-status',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.valid).toBe(true);
      expect(body.data.reasonCode).toBe('LOCAL_COVERAGE_VALID');
      expect(body.data.shaEligibilityStatus).toBe('NOT_VERIFIED');
    });

    it('rejects eligibility verification when user lacks Insurance.Eligibility.Verify permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/eligibility/verify',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          memberId: 'mem-123',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('allows eligibility verification when user has Insurance.Eligibility.Verify permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'verifyEligibility').mockResolvedValue({
        id: 'ver-123',
        memberId: 'mem-123',
        patientId: 'pat-123',
        policyId: 'pol-123',
        payerId: 'pay-123',
        memberNumber: 'MEM-001',
        policyNumber: 'POL-001',
        payerCode: 'SHA',
        requestedDate: '2026-06-15T00:00:00.000Z',
        correlationId: 'corr-123',
        externalReferenceId: 'SHA-REF-999',
        status: 'ELIGIBLE',
        reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
        message: 'SHA confirmed active member eligibility',
        requestTimestamp: '2026-06-15T10:00:00.000Z',
        createdAt: '2026-06-15T10:00:00.000Z',
      });

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/eligibility/verify',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          memberId: 'mem-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.status).toBe('ELIGIBLE');
      expect(body.data.externalReferenceId).toBe('SHA-REF-999');
      expect(body.data.rawResponse).toBeUndefined();
      expect(body.data.rawResponsePayload).toBeUndefined();
      expect(body.data.rawResponseReference).toBeUndefined();
    });

    it('allows listing eligibility verifications when user has Insurance.Eligibility.View permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'listEligibilityVerifications').mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      const response = await built.app.inject({
        method: 'GET',
        url: '/api/insurance/eligibility/verifications',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: {
          items: [],
          total: 0,
          limit: 50,
          offset: 0,
        },
      });
    });

    it('rejects creating benefit configuration when user lacks Insurance.Benefits.Manage permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/benefits',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          payerId: 'pay-123',
          coverageRule: 'COVERED',
          startDate: '2026-01-01',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('allows creating benefit configuration when user has Insurance.Benefits.Manage permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'createBenefitConfig').mockResolvedValue({
        id: 'ben-123',
        payerId: 'pay-123',
        coverageRule: 'COVERED',
      } as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/benefits',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          payerId: 'pay-123',
          coverageRule: 'COVERED',
          startDate: '2026-01-01',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.id).toBe('ben-123');
    });

    it('rejects verifying service benefit when user lacks Insurance.Benefits.Verify permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(built.services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as any);

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/benefits/verify',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          memberId: 'mem-123',
          serviceCode: 'SRV-001',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('allows verifying service benefit when user has Insurance.Benefits.Verify permission', async () => {
      vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(testStaffUser);
      vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
      vi.spyOn(built.services.insurance, 'verifyBenefit').mockResolvedValue({
        eligible: true,
        benefitStatus: 'COVERED',
        memberId: 'mem-123',
        serviceCode: 'SRV-001',
        reasonCode: 'BENEFIT_COVERED',
        message: 'Service is fully covered',
        authorizationRequired: false,
        verifiedAt: new Date().toISOString(),
      });

      const response = await built.app.inject({
        method: 'POST',
        url: '/api/insurance/benefits/verify',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          memberId: 'mem-123',
          serviceCode: 'SRV-001',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.benefitStatus).toBe('COVERED');
    });
  });

  // ================= PHASE 3 TESTS: SHA ELIGIBILITY VERIFICATION =================
  describe('8. SHA Eligibility Verification Precondition & Adapter Boundary', () => {
    const validMember = {
      _id: 'member-001',
      memberNumber: 'MEM-SHA-001',
      subscriberId: 'SUB-123',
      relationship: 'SELF',
      coverageStart: new Date('2026-01-01'),
      coverageEnd: new Date('2026-12-31'),
      status: 'ACTIVE',
      policyId: {
        _id: 'policy-001',
        policyNumber: 'POL-001',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        payerId: { _id: 'payer-sha-id', payerCode: 'SHA', name: 'SHA' },
        schemeId: { _id: 'scheme-shif-id', schemeCode: 'SHIF', name: 'SHIF' },
        holderPatientId: 'patient-001',
      },
      patientId: {
        _id: 'patient-001',
        patientNumber: 'P-100',
        firstName: 'John',
        lastName: 'Doe',
      },
    };

    const validPolicy = {
      _id: 'policy-001',
      policyNumber: 'POL-001',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      payerId: { _id: 'payer-sha-id', payerCode: 'SHA', name: 'SHA' },
      schemeId: { _id: 'scheme-shif-id', schemeCode: 'SHIF', name: 'SHIF' },
      holderPatientId: 'patient-001',
    };

    const validPatient = {
      _id: 'patient-001',
      patientNumber: 'P-100',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('rejects SHA verification and does NOT call SHA adapter when local coverage check fails', async () => {
      // Member coverage has expired
      const expiredMember = {
        ...validMember,
        coverageEnd: new Date('2026-05-30'),
      };
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(expiredMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      await expect(
        service.verifyEligibility(
          {
            memberId: 'member-001',
            requestedDate: '2026-06-15',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'MEMBER_COVERAGE_EXPIRED',
      });

      // Crucial: SHA adapter must NOT be called when local coverage is invalid!
      expect(mockShaAdapter.verifyEligibility).not.toHaveBeenCalled();
    });

    it('calls SHA adapter when local coverage is valid and records ELIGIBLE status with external reference', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'ELIGIBLE',
        externalReferenceId: 'SHA-EXT-12345',
        reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
        message: 'SHA verified member eligibility',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-001',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(mockShaAdapter.verifyEligibility).toHaveBeenCalledWith(
        expect.objectContaining({
          memberNumber: 'MEM-SHA-001',
          patientNumber: 'P-100',
          policyNumber: 'POL-001',
          payerCode: 'SHA',
          schemeCode: 'SHIF',
        })
      );
      expect(result.status).toBe('ELIGIBLE');
      expect(result.externalReferenceId).toBe('SHA-EXT-12345');
      expect(mockRepository.createEligibilityVerification).toHaveBeenCalled();
    });

    it('records INELIGIBLE status when SHA confirms member is not eligible', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'INELIGIBLE',
        externalReferenceId: 'SHA-REF-INEL-01',
        reasonCode: 'SHA_NOT_ELIGIBLE',
        message: 'Member has lapsed SHA contributions',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-002',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(result.status).toBe('INELIGIBLE');
      expect(result.reasonCode).toBe('SHA_NOT_ELIGIBLE');
    });

    it('records PENDING status when SHA returns pending review', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'PENDING',
        externalReferenceId: 'SHA-REF-PEND-01',
        reasonCode: 'SHA_PENDING_REVIEW',
        message: 'Request pending SHA administrative review',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-003',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(result.status).toBe('PENDING');
      expect(result.reasonCode).toBe('SHA_PENDING_REVIEW');
    });

    it('records FAILED status when SHA network or communication fails', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'FAILED',
        externalReferenceId: null,
        reasonCode: 'SHA_TIMEOUT',
        message: 'SHA gateway timed out',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-004',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(result.status).toBe('FAILED');
      expect(result.reasonCode).toBe('SHA_TIMEOUT');
      expect(result.errorMessage).toBe('SHA gateway timed out');
    });

    it('reuses existing verification when identical request is sent within cache window (idempotency)', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'cached-ver-001',
        memberId: 'member-001',
        patientId: 'patient-001',
        policyId: 'policy-001',
        payerId: 'payer-sha-id',
        schemeId: 'scheme-shif-id',
        memberNumber: 'MEM-SHA-001',
        policyNumber: 'POL-001',
        payerCode: 'SHA',
        schemeCode: 'SHIF',
        requestedDate: new Date('2026-06-15'),
        correlationId: 'corr-cached',
        externalReferenceId: 'SHA-EXT-CACHED',
        status: 'ELIGIBLE',
        reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
        message: 'SHA confirmed active member eligibility',
        requestTimestamp: new Date(),
        responseTimestamp: new Date(),
        createdAt: new Date(),
      });

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(result.id).toBe('cached-ver-001');
      expect(result.externalReferenceId).toBe('SHA-EXT-CACHED');
      // Did NOT call SHA adapter again!
      expect(mockShaAdapter.verifyEligibility).not.toHaveBeenCalled();
    });

    it('bypasses cache and calls SHA adapter when forceRefresh is requested', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'ELIGIBLE',
        externalReferenceId: 'SHA-EXT-FRESH',
        reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
        message: 'SHA fresh verification successful',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-fresh',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
          forceRefresh: true, // Force fresh check
        },
        userId,
        mockMetadata
      );

      expect(mockShaAdapter.verifyEligibility).toHaveBeenCalled();
      expect(result.externalReferenceId).toBe('SHA-EXT-FRESH');
    });
  });

  describe('7. SHA Response Security & Data Protection (Phase 3 Hotfix)', () => {
    const validMember = {
      _id: 'member-001',
      memberNumber: 'MEM-SHA-001',
      relationship: 'SELF',
      coverageStart: new Date('2026-01-01'),
      coverageEnd: new Date('2026-12-31'),
      status: 'ACTIVE',
      patientId: {
        _id: 'patient-001',
        patientNumber: 'P-100',
      },
      policyId: {
        _id: 'policy-001',
        policyNumber: 'POL-001',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        payerId: {
          _id: 'payer-sha-id',
          payerCode: 'SHA',
          name: 'Social Health Authority',
        },
        schemeId: {
          _id: 'scheme-shif-id',
          schemeCode: 'SHIF',
          name: 'Social Health Insurance Fund',
        },
      },
    };

    const validPatient = {
      _id: 'patient-001',
      patientNumber: 'P-100',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const validPolicy = {
      _id: 'policy-001',
      policyNumber: 'POL-001',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      payerId: {
        _id: 'payer-sha-id',
        payerCode: 'SHA',
      },
      schemeId: {
        _id: 'scheme-shif-id',
        schemeCode: 'SHIF',
      },
    };

    it('sanitizes external response details and strips tokens, passwords, and demographics', () => {
      const rawDetails = {
        schemeCode: 'SHIF',
        verifiedAsOf: '2026-10-07',
        authToken: 'Bearer secret-token-xyz',
        apiKey: 'api-secret-key-123',
        bearerToken: 'token-abc',
        nationalId: '12345678',
        idNumber: 'ID-999',
        dob: '1985-05-15',
        dateOfBirth: '1985-05-15',
        phone: '+254700000000',
        email: 'patient@example.com',
        address: '123 Hospital Road, Nairobi',
        clinicalDiagnosis: 'Confidential Diagnosis',
        ssn: '000-00-0000',
        copayAmount: 200,
      };

      const sanitized = sanitizeDetails(rawDetails);

      expect(sanitized).toBeDefined();
      expect(sanitized!.schemeCode).toBe('SHIF');
      expect(sanitized!.verifiedAsOf).toBe('2026-10-07');
      expect(sanitized!.copayAmount).toBe(200);

      // Sensitive fields stripped
      expect(sanitized).not.toHaveProperty('authToken');
      expect(sanitized).not.toHaveProperty('apiKey');
      expect(sanitized).not.toHaveProperty('bearerToken');
      expect(sanitized).not.toHaveProperty('nationalId');
      expect(sanitized).not.toHaveProperty('idNumber');
      expect(sanitized).not.toHaveProperty('dob');
      expect(sanitized).not.toHaveProperty('dateOfBirth');
      expect(sanitized).not.toHaveProperty('phone');
      expect(sanitized).not.toHaveProperty('email');
      expect(sanitized).not.toHaveProperty('address');
      expect(sanitized).not.toHaveProperty('clinicalDiagnosis');
      expect(sanitized).not.toHaveProperty('ssn');
    });

    it('proves raw SHA response and sensitive authorization tokens are NOT passed to repository persistence', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'ELIGIBLE',
        externalReferenceId: 'SHA-EXT-SEC-01',
        reasonCode: 'SHA_CONFIRMED_ELIGIBLE',
        message: 'SHA confirmed eligibility',
        details: {
          schemeCode: 'SHIF',
          verifiedAsOf: '2026-06-15',
        },
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-sec-01',
        ...data,
        createdAt: new Date(),
      }));

      await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      expect(mockRepository.createEligibilityVerification).toHaveBeenCalled();
      const createCallArg = mockRepository.createEligibilityVerification.mock.calls[0][0];

      // Verifies rawResponse is NOT passed or persisted
      expect(createCallArg).not.toHaveProperty('rawResponse');
      expect(createCallArg).not.toHaveProperty('rawResponsePayload');
      expect(createCallArg).not.toHaveProperty('rawResponseReference');

      // Verifies normalized eligibility fields ARE persisted
      expect(createCallArg.status).toBe('ELIGIBLE');
      expect(createCallArg.reasonCode).toBe('SHA_CONFIRMED_ELIGIBLE');
      expect(createCallArg.externalReferenceId).toBe('SHA-EXT-SEC-01');
      expect(createCallArg.details).toEqual({
        schemeCode: 'SHIF',
        verifiedAsOf: '2026-06-15',
      });
    });

    it('proves failure reason and error messages are still persisted on FAILED evaluation without leaking raw payload', async () => {
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);

      mockShaAdapter.verifyEligibility.mockResolvedValue({
        status: 'FAILED',
        externalReferenceId: null,
        reasonCode: 'SHA_HTTP_ERROR',
        message: 'SHA gateway returned HTTP 503 Service Unavailable',
      });

      mockRepository.createEligibilityVerification.mockImplementation(async (data: any) => ({
        _id: 'ver-doc-failed-01',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.verifyEligibility(
        {
          memberId: 'member-001',
          requestedDate: '2026-06-15',
        },
        userId,
        mockMetadata
      );

      const createCallArg = mockRepository.createEligibilityVerification.mock.calls[0][0];

      // Persists normalized failure information
      expect(createCallArg.status).toBe('FAILED');
      expect(createCallArg.reasonCode).toBe('SHA_HTTP_ERROR');
      expect(createCallArg.errorMessage).toBe('SHA gateway returned HTTP 503 Service Unavailable');
      expect(createCallArg.externalReferenceId).toBeNull();
      expect(createCallArg).not.toHaveProperty('rawResponse');

      // Result returned to caller
      expect(result.status).toBe('FAILED');
      expect(result.reasonCode).toBe('SHA_HTTP_ERROR');
      expect(result.errorMessage).toBe('SHA gateway returned HTTP 503 Service Unavailable');
      expect((result as any).rawResponse).toBeUndefined();
    });

    it('HttpShaEligibilityAdapter strips rawResponse and sanitizes data.details in memory', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            eligibilityStatus: 'ACTIVE',
            referenceId: 'SHA-HTTP-REF-01',
            message: 'Member active',
            details: {
              schemeCode: 'SHIF',
              verifiedAsOf: '2026-10-07',
              authToken: 'leak-token-123',
              nationalId: '98765432',
            },
            unredactedDemographics: {
              secretField: 'xyz',
            },
          }),
        } as any);

        const adapter = new HttpShaEligibilityAdapter('https://sha-test.example.com', 'test-key', 'FAC-01', 5000);
        const response = await adapter.verifyEligibility({
          memberNumber: 'MEM-001',
          patientNumber: 'P-100',
          policyNumber: 'POL-001',
          payerCode: 'SHA',
          requestedDate: '2026-10-07',
          correlationId: 'corr-http-01',
        });

        expect(response.status).toBe('ELIGIBLE');
        expect(response.externalReferenceId).toBe('SHA-HTTP-REF-01');
        expect((response as any).rawResponse).toBeUndefined();
        expect(response.details).toEqual({
          schemeCode: 'SHIF',
          verifiedAsOf: '2026-10-07',
        });
        expect((response.details as any).authToken).toBeUndefined();
        expect((response.details as any).nationalId).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ================= PHASE 4 TESTS: BENEFITS VERIFICATION & SERVICE COVERAGE RULES =================
  describe('8. Benefits Verification & Service Coverage Rules (Phase 4)', () => {
    const validMember = {
      _id: 'member-001',
      memberNumber: 'MEM-SHA-001',
      relationship: 'SELF',
      coverageStart: new Date('2026-01-01'),
      coverageEnd: new Date('2026-12-31'),
      status: 'ACTIVE',
      patientId: {
        _id: 'patient-001',
        patientNumber: 'P-100',
      },
      policyId: {
        _id: 'policy-001',
        policyNumber: 'POL-001',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        payerId: {
          _id: 'payer-sha-id',
          payerCode: 'SHA',
          name: 'Social Health Authority',
        },
        schemeId: {
          _id: 'scheme-shif-id',
          schemeCode: 'SHIF',
          name: 'Social Health Insurance Fund',
        },
      },
    };

    const validPatient = {
      _id: 'patient-001',
      patientNumber: 'P-100',
    };

    const validPolicy = {
      _id: 'policy-001',
      policyNumber: 'POL-001',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      payerId: { _id: 'payer-sha-id', payerCode: 'SHA' },
      schemeId: { _id: 'scheme-shif-id', schemeCode: 'SHIF' },
    };

    const validService = {
      _id: 'srv-consult-001',
      code: 'CONS-GEN',
      name: 'General Consultation',
      serviceType: 'GENERAL',
      category: 'CONSULTATION',
      standardPrice: 1500,
      status: 'ACTIVE',
    };

    beforeEach(() => {
      mockRepository.getMemberById.mockResolvedValue(validMember);
      mockRepository.findMemberForCoverageCheck.mockResolvedValue(validMember);
      mockRepository.getPatientById.mockResolvedValue(validPatient);
      mockRepository.getPolicyById.mockResolvedValue(validPolicy);
      mockRepository.getServiceByIdOrCode.mockResolvedValue(validService);
    });

    it('creates benefit configuration successfully and checks payer and dates', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.getSchemeById.mockResolvedValue({ _id: 'scheme-shif-id', payerId: 'payer-sha-id' });
      mockRepository.findConflictingBenefitConfig.mockResolvedValue(null);
      mockRepository.createBenefitConfig.mockResolvedValue({
        _id: 'ben-001',
        payerId: 'payer-sha-id',
        coverageRule: 'COVERED',
      });

      const res = await service.createBenefitConfig(
        {
          payerId: 'payer-sha-id',
          schemeId: 'scheme-shif-id',
          serviceCode: 'CONS-GEN',
          coverageRule: 'COVERED',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
        userId,
        mockMetadata
      );

      expect(mockRepository.createBenefitConfig).toHaveBeenCalled();
      expect(res._id).toBe('ben-001');
    });

    it('prevents duplicate or conflicting active benefit configuration for overlapping dates', async () => {
      mockRepository.getPayerById.mockResolvedValue({ _id: 'payer-sha-id' });
      mockRepository.findConflictingBenefitConfig.mockResolvedValue({
        _id: 'existing-ben-conflict',
        status: 'ACTIVE',
      });

      await expect(
        service.createBenefitConfig(
          {
            payerId: 'payer-sha-id',
            serviceCode: 'CONS-GEN',
            coverageRule: 'COVERED',
            startDate: '2026-06-01',
            endDate: '2026-12-31',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICTING_BENEFIT_CONFIG',
      });
    });

    it('blocks benefit verification if local coverage check fails', async () => {
      // Member expired locally
      mockRepository.findMemberForCoverageCheck.mockResolvedValue({
        ...validMember,
        status: 'INACTIVE',
      });

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(false);
      expect(result.benefitStatus).toBe('NOT_COVERED');
      expect(result.reasonCode).toBe('MEMBER_INACTIVE');
    });

    it('requires usable SHA eligibility before evaluating benefit coverage', async () => {
      // Local coverage valid, but no SHA eligibility record
      mockRepository.findRecentEligibilityVerification.mockResolvedValue(null);

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(false);
      expect(result.benefitStatus).toBe('NOT_COVERED');
      expect(result.reasonCode).toBe('ELIGIBILITY_VERIFICATION_REQUIRED');
    });

    it('returns COVERED when service is fully covered under active benefit', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'ver-sha-ok',
        status: 'ELIGIBLE',
      });

      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        {
          _id: 'ben-covered-01',
          coverageRule: 'COVERED',
          authorizationRequired: false,
          serviceCode: 'CONS-GEN',
          coverageLimit: { maxAmount: 5000, frequency: 'PER_VISIT' },
        },
      ]);

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(true);
      expect(result.benefitStatus).toBe('COVERED');
      expect(result.reasonCode).toBe('BENEFIT_COVERED');
      expect(result.authorizationRequired).toBe(false);
      expect(result.coverageLimit?.maxAmount).toBe(5000);
      expect(mockRepository.audit).toHaveBeenCalledWith(
        'INSURANCE_BENEFIT_VERIFIED',
        userId,
        mockMetadata,
        expect.objectContaining({
          benefitStatus: 'COVERED',
          eligible: true,
        })
      );
    });

    it('returns PARTIALLY_COVERED when service has copay or partial coverage', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'ver-sha-ok',
        status: 'ELIGIBLE',
      });

      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        {
          _id: 'ben-partial-01',
          coverageRule: 'PARTIALLY_COVERED',
          authorizationRequired: false,
          copay: { type: 'PERCENTAGE', value: 20 },
        },
      ]);

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(true);
      expect(result.benefitStatus).toBe('PARTIALLY_COVERED');
      expect(result.reasonCode).toBe('BENEFIT_PARTIALLY_COVERED');
      expect(result.patientResponsibility).toEqual({ type: 'PERCENTAGE', value: 20 });
    });

    it('returns NOT_COVERED when service is explicitly marked as excluded', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'ver-sha-ok',
        status: 'ELIGIBLE',
      });

      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        {
          _id: 'ben-excl-01',
          coverageRule: 'NOT_COVERED',
          isExcluded: true,
          exclusionReason: 'COSMETIC_NOT_COVERED',
        },
      ]);

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(false);
      expect(result.benefitStatus).toBe('NOT_COVERED');
      expect(result.reasonCode).toBe('COSMETIC_NOT_COVERED');
    });

    it('returns AUTHORIZATION_REQUIRED when service requires prior pre-authorization', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'ver-sha-ok',
        status: 'ELIGIBLE',
      });

      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        {
          _id: 'ben-auth-01',
          coverageRule: 'COVERED',
          authorizationRequired: true,
        },
      ]);

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(true);
      expect(result.benefitStatus).toBe('AUTHORIZATION_REQUIRED');
      expect(result.authorizationRequired).toBe(true);
      expect(result.reasonCode).toBe('PREAUTHORIZATION_REQUIRED');
    });

    it('returns NO_BENEFIT_CONFIGURED when no active benefit matches the service', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({
        _id: 'ver-sha-ok',
        status: 'ELIGIBLE',
      });

      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([]); // No match

      const result = await service.verifyBenefit(
        {
          memberId: 'member-001',
          serviceCode: 'CONS-GEN',
        },
        userId,
        mockMetadata
      );

      expect(result.eligible).toBe(false);
      expect(result.benefitStatus).toBe('NOT_COVERED');
      expect(result.reasonCode).toBe('NO_BENEFIT_CONFIGURED');
    });

    it('rejects verification if catalogue service does not exist in Service Catalogue master', async () => {
      mockRepository.getServiceByIdOrCode.mockResolvedValue(null);

      await expect(
        service.verifyBenefit(
          {
            memberId: 'member-001',
            serviceCode: 'NON-EXISTENT',
          },
          userId,
          mockMetadata
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SERVICE_NOT_FOUND',
      });
    });

    const hierarchy = [
      { _id: 'policy-service', policyId: 'policy-001', serviceId: 'srv-consult-001' },
      { _id: 'policy-code', policyId: 'policy-001', serviceCode: 'CONS-GEN' },
      { _id: 'policy-category', policyId: 'policy-001', category: 'CONSULTATION' },
      { _id: 'scheme-service', schemeId: 'scheme-shif-id', serviceId: 'srv-consult-001' },
      { _id: 'scheme-code', schemeId: 'scheme-shif-id', serviceCode: 'CONS-GEN' },
      { _id: 'scheme-category', schemeId: 'scheme-shif-id', category: 'CONSULTATION' },
      { _id: 'payer-service', serviceId: 'srv-consult-001' },
      { _id: 'payer-code', serviceCode: 'CONS-GEN' },
      { _id: 'payer-category', category: 'CONSULTATION' },
    ];

    it.each(hierarchy.map((config, index) => ({ ...config, index })))(
      'resolves $_id with all lower-priority fallbacks present (level $index)',
      async ({ _id, index }) => {
        mockRepository.findRecentEligibilityVerification.mockResolvedValue({ status: 'ELIGIBLE' });
        mockRepository.findMatchingBenefitConfigs.mockResolvedValue(
          hierarchy.slice(index).reverse().map((config) => ({ ...config, coverageRule: 'COVERED' }))
        );
        const result = await service.verifyBenefit(
          { memberId: 'member-001', serviceCode: 'CONS-GEN', requestedDate: '2026-06-15' },
          userId, mockMetadata
        );
        expect(result.benefitId).toBe(_id);
        expect(mockRepository.findMatchingBenefitConfigs).toHaveBeenCalledWith(expect.objectContaining({
          policyId: 'policy-001', schemeId: 'scheme-shif-id', payerId: 'payer-sha-id',
          asOfDate: new Date('2026-06-15'),
        }));
      }
    );

    it('does not fall back from an authoritative policy exclusion to covered scheme or payer benefits', async () => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({ status: 'ELIGIBLE' });
      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        { ...hierarchy[3], coverageRule: 'COVERED' },
        { ...hierarchy[6], coverageRule: 'COVERED' },
        { ...hierarchy[2], coverageRule: 'NOT_COVERED', isExcluded: true },
      ]);
      const result = await service.verifyBenefit(
        { memberId: 'member-001', serviceCode: 'CONS-GEN' }, userId, mockMetadata
      );
      expect(result.benefitId).toBe('policy-category');
      expect(result.eligible).toBe(false);
      expect(result.benefitStatus).toBe('NOT_COVERED');
    });

    it.each(['FIXED', 'PERCENTAGE'] as const)('returns %s copay as configured terms without calculating liability', async (type) => {
      mockRepository.findRecentEligibilityVerification.mockResolvedValue({ status: 'ELIGIBLE' });
      mockRepository.findMatchingBenefitConfigs.mockResolvedValue([
        { ...hierarchy[0], coverageRule: 'COVERED', copay: { type, value: 20 },
          coverageLimit: { maxAmount: 5000 }, authorizationRequired: true },
      ]);
      const result = await service.verifyBenefit(
        { memberId: 'member-001', serviceCode: 'CONS-GEN', quantity: 5 }, userId, mockMetadata
      );
      expect(result.configuredPatientResponsibility).toEqual({ type, value: 20 });
      expect(result.patientResponsibility).toEqual(result.configuredPatientResponsibility);
      expect(result.financialTermsBasis).toBe('CONFIGURED_ONLY');
      expect(result.coverageLimit).toEqual({ maxAmount: 5000 });
      expect(result.authorizationRequired).toBe(true);
      for (const field of ['finalInvoiceLiability', 'payerApprovedAmount', 'claimAdjudicationResult', 'patientOutstandingBalance']) {
        expect(result).not.toHaveProperty(field);
      }
    });

    it('allows querying historical benefit configurations via listBenefitConfigs', async () => {
      mockRepository.listBenefitConfigs.mockResolvedValue({
        items: [
          { _id: 'ben-hist-01', status: 'INACTIVE', startDate: '2025-01-01', endDate: '2025-12-31' },
          { _id: 'ben-act-01', status: 'ACTIVE', startDate: '2026-01-01' },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      });

      const res = await service.listBenefitConfigs({});
      expect(res.total).toBe(2);
      expect(res.items.some((b: any) => b.status === 'INACTIVE')).toBe(true);
    });
  });
});
