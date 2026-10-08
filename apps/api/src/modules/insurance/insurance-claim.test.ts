import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InsuranceClaimRepository } from './insurance-claim.repository.js';
import { InsuranceClaimService } from './insurance-claim.service.js';
import { InsuranceClaimModel } from './insurance-claim.model.js';
import { InsuranceIntegrationRepository } from './insurance-integration.repository.js';
import { InsuranceIntegrationService } from './insurance-integration.service.js';
import { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import { InsuranceService } from './insurance.service.js';
import { InsuranceRepository } from './insurance.repository.js';
import { InsuranceAuthorizationModel } from './insurance-authorization.model.js';
import { ShaServiceMappingModel } from './insurance-integration.model.js';
import { InsuranceMemberModel, InsurancePolicyModel } from './insurance.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { ServiceModel } from '../services/service.model.js';
import { BillingInvoiceModel, BillingInvoiceItemModel } from '../billing/billing.model.js';
import { AuditLogModel } from '../auth/auth.model.js';


describe('Insurance Phase 8 claim validation and submission readiness service', () => {
  let mongo: MongoMemoryReplSet;
  const claimRepo = new InsuranceClaimRepository();
  const integrationRepo = new InsuranceIntegrationRepository();
  const access = new InsuranceAuthorizationRepository();
  const insuranceRepo = new InsuranceRepository();
  const insurance = new InsuranceService(insuranceRepo);
  const integration = new InsuranceIntegrationService(integrationRepo, access, insurance);
  const claims = new InsuranceClaimService(claimRepo, integrationRepo, integration, access, insurance);

  const actor = new Types.ObjectId().toString();
  const branchId = new Types.ObjectId();
  const patientId = new Types.ObjectId();
  const encounterId = new Types.ObjectId();
  const serviceId1 = new Types.ObjectId();
  const serviceId2 = new Types.ObjectId();
  const payerId = new Types.ObjectId();
  const policyId = new Types.ObjectId();
  const memberId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId();
  const invoiceItemId1 = new Types.ObjectId();
  const invoiceItemId2 = new Types.ObjectId();

  const standardBenefit = {
    eligible: true,
    benefitStatus: 'COVERED' as const,
    authorizationRequired: false,
    memberId: memberId.toString(),
    serviceId: serviceId1.toString(),
    reasonCode: 'BENEFIT_COVERED',
    message: 'Covered',
    verifiedAt: '2026-10-08',
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await InsuranceClaimModel.init();
    await ShaServiceMappingModel.init();
    await InsuranceAuthorizationModel.init();

    await PatientModel.collection.insertOne({ _id: patientId, patientNumber: 'P-P8', firstName: 'John', lastName: 'Doe' });
    await OpdVisitModel.collection.insertOne({
      _id: encounterId,
      patientId,
      branchId,
      doctorId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      visitDate: new Date('2026-10-08'),
      patientName: 'John Doe',
    });
    await ServiceModel.collection.insertMany([
      { _id: serviceId1, code: 'SRV-01', status: 'ACTIVE' },
      { _id: serviceId2, code: 'SRV-02', status: 'ACTIVE' },
    ]);
  });

  beforeEach(async () => {
    await InsuranceClaimModel.deleteMany({});
    await InsuranceAuthorizationModel.deleteMany({});
    await ShaServiceMappingModel.deleteMany({});
    await InsuranceMemberModel.deleteMany({});
    await InsurancePolicyModel.deleteMany({});
    await BillingInvoiceModel.deleteMany({});
    await BillingInvoiceItemModel.deleteMany({});
    await OpdConsultationModel.deleteMany({});
    await AuditLogModel.deleteMany({});


    await InsurancePolicyModel.collection.insertOne({ _id: policyId, payerId, status: 'ACTIVE' });
    await InsuranceMemberModel.collection.insertOne({
      _id: memberId,
      patientId,
      policyId,
      memberNumber: 'MEM-001',
      status: 'ACTIVE',
      coverageStart: new Date('2026-01-01'),
    });

    await BillingInvoiceModel.collection.insertOne({
      _id: invoiceId,
      visitId: encounterId,
      patientId,
      branchId,
      sourceType: 'OPD',
      status: 'PENDING',
      totalAmount: 1500,
    });
    await BillingInvoiceItemModel.collection.insertMany([
      { _id: invoiceItemId1, invoiceId, serviceId: serviceId1, quantity: 2, unitPrice: 500, lineTotal: 1000 },
      { _id: invoiceItemId2, invoiceId, serviceId: serviceId2, quantity: 1, unitPrice: 500, lineTotal: 500 },
    ]);

    vi.spyOn(access, 'hasBranchAccess').mockResolvedValue(true);
    vi.spyOn(insurance, 'checkCoverage').mockResolvedValue({
      valid: true,
      reasonCode: 'LOCAL_COVERAGE_VALID',
      message: 'Valid',
      shaEligibilityStatus: 'NOT_VERIFIED',
      checkedAt: '2026-10-08',
    });
    vi.spyOn(insurance, 'verifyBenefit').mockResolvedValue(standardBenefit);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  const setupActiveMappings = async () => {
    await ShaServiceMappingModel.collection.insertMany([
      {
        serviceId: serviceId1,
        interventionCode: 'INT-01',
        effectiveFrom: '2026-01-01',
        status: 'ACTIVE',
        version: 0,
        createdBy: new Types.ObjectId(actor),
        updatedBy: new Types.ObjectId(actor),
      },
      {
        serviceId: serviceId2,
        interventionCode: 'INT-02',
        effectiveFrom: '2026-01-01',
        status: 'ACTIVE',
        version: 0,
        createdBy: new Types.ObjectId(actor),
        updatedBy: new Types.ObjectId(actor),
      },
    ]);
  };

  describe('Section 15 — Validation Scenarios', () => {
    it('1. Valid internal claim becomes VALIDATED, valid: true, readyForShaSubmission: false', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.status).toBe('DRAFT');

      const validated = await claims.validate(claim._id.toString(), 0, actor, { ipAddress: '127.0.0.1' });
      expect(validated.status).toBe('VALIDATED');
      expect(validated.valid).toBe(true);
      expect(validated.readyForShaSubmission).toBe(false);
      expect(validated.version).toBe(1);

      const issueCodes = validated.issues.map(i => i.code);
      expect(issueCodes).toContain('ICD11_NOT_AVAILABLE');
      expect(issueCodes).toContain('SHA_SUBMISSION_CONTRACT_UNCONFIRMED');
      expect(issueCodes).toContain('SHA_IDENTIFIER_MAPPING_UNCONFIRMED');
      expect(issueCodes).toContain('SHA_TERMINOLOGY_UNCONFIRMED');
      expect(issueCodes).toContain('CONFIGURED_NOT_SHA_VALIDATED');
    });

    it('1b. Claim with structured ICD-11 diagnosis in consultation omits ICD11_NOT_AVAILABLE but remains readyForShaSubmission: false', async () => {
      await setupActiveMappings();
      const consultationId = new Types.ObjectId();
      await OpdConsultationModel.collection.insertOne({
        _id: consultationId,
        visitId: encounterId,
        patientId,
        patientNumber: 'P-P8',
        patientName: 'John Doe',
        doctorId: new Types.ObjectId(),
        doctorName: 'Dr. Physician',
        status: 'COMPLETED',
        assessment: 'Type 2 Diabetes Mellitus',
        diagnoses: [
          {
            code: '5A11',
            display: 'Type 2 diabetes mellitus',
            codingSystem: 'ICD-11',
            type: 'PRIMARY',
            notes: 'Uncomplicated',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.status).toBe('DRAFT');

      const validated = await claims.validate(claim._id.toString(), 0, actor, { ipAddress: '127.0.0.1' });
      expect(validated.status).toBe('VALIDATED');
      expect(validated.valid).toBe(true);
      expect(validated.readyForShaSubmission).toBe(false);

      const issueCodes = validated.issues.map(i => i.code);
      expect(issueCodes).not.toContain('ICD11_NOT_AVAILABLE');
      expect(issueCodes).toContain('SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE');
      expect(issueCodes).toContain('SHA_SUBMISSION_CONTRACT_UNCONFIRMED');
      expect(issueCodes).toContain('SHA_IDENTIFIER_MAPPING_UNCONFIRMED');
      expect(issueCodes).toContain('SHA_TERMINOLOGY_UNCONFIRMED');
      expect(issueCodes).toContain('CONFIGURED_NOT_SHA_VALIDATED');
    });

    it('1c. Claim with structured ICD-11 diagnosis AND configured SHA patient identifier omits both ICD11_NOT_AVAILABLE and SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE but remains readyForShaSubmission: false', async () => {
      const originalSystem = process.env.SHA_PATIENT_IDENTIFIER_SYSTEM;
      process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = 'SHA_UPI';
      await setupActiveMappings();

      const consultationId = new Types.ObjectId();
      await OpdConsultationModel.collection.insertOne({
        _id: consultationId,
        visitId: encounterId,
        patientId,
        patientNumber: 'P-P8',
        patientName: 'John Doe',
        doctorId: new Types.ObjectId(),
        doctorName: 'Dr. Physician',
        status: 'COMPLETED',
        assessment: 'Type 2 Diabetes Mellitus',
        diagnoses: [
          {
            code: '5A11',
            display: 'Type 2 diabetes mellitus',
            codingSystem: 'ICD-11',
            type: 'PRIMARY',
            notes: 'Uncomplicated',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await PatientModel.collection.updateOne(
        { _id: patientId },
        {
          $set: {
            identifiers: [
              {
                _id: new Types.ObjectId(),
                identifierType: 'SHA_UPI',
                value: 'SYNTH-PAT-UPI-888',
                issuingAuthority: 'SHA',
                status: 'ACTIVE',
              },
            ],
          },
        },
      );

      try {
        const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
        expect(claim.status).toBe('DRAFT');

        const validated = await claims.validate(claim._id.toString(), 0, actor, { ipAddress: '127.0.0.1' });
        expect(validated.status).toBe('VALIDATED');
        expect(validated.valid).toBe(true);
        expect(validated.readyForShaSubmission).toBe(false);

        const issueCodes = validated.issues.map(i => i.code);
        expect(issueCodes).not.toContain('ICD11_NOT_AVAILABLE');
        expect(issueCodes).not.toContain('SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE');
        expect(issueCodes).toContain('SHA_SUBMISSION_CONTRACT_UNCONFIRMED');
        expect(issueCodes).toContain('SHA_IDENTIFIER_MAPPING_UNCONFIRMED');
        expect(issueCodes).toContain('SHA_TERMINOLOGY_UNCONFIRMED');
        expect(issueCodes).toContain('CONFIGURED_NOT_SHA_VALIDATED');
      } finally {
        process.env.SHA_PATIENT_IDENTIFIER_SYSTEM = originalSystem;
        await OpdConsultationModel.deleteOne({ _id: consultationId });
        await PatientModel.collection.updateOne({ _id: patientId }, { $set: { identifiers: [] } });
      }
    });



    it('2. Missing patient fails internal validation', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      vi.spyOn(integrationRepo, 'patient').mockResolvedValue(null);

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('ENCOUNTER_PATIENT_INVALID');
    });

    it('3. Invalid member fails internal validation', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      await InsuranceMemberModel.deleteMany({});

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('MEMBER_CONTEXT_REQUIRED');
    });

    it('4. Member belongs to another patient fails internal validation', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      await InsuranceMemberModel.updateOne({ _id: memberId }, { $set: { patientId: new Types.ObjectId() } });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('MEMBER_CONTEXT_REQUIRED');
    });

    it('5. Invalid policy fails internal validation', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      await InsurancePolicyModel.deleteMany({});

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('POLICY_NOT_FOUND');
    });

    it('6. Expired coverage fails internal validation with reasonCode', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      vi.mocked(insurance.checkCoverage).mockResolvedValue({
        valid: false,
        reasonCode: 'POLICY_EXPIRED',
        message: 'Policy has expired',
        shaEligibilityStatus: 'NOT_VERIFIED',
        checkedAt: '2026-10-08',
      });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('POLICY_EXPIRED');
    });

    it('7. Benefit failure marks claim DRAFT and records issue', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        eligible: false,
        benefitStatus: 'NOT_COVERED',
        reasonCode: 'BENEFIT_NOT_COVERED',
        message: 'Not covered',
      });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('BENEFIT_NOT_COVERED');
    });

    it('8. Authorization required but missing records issue and keeps claim in DRAFT', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
        reasonCode: 'PREAUTHORIZATION_REQUIRED',
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT');
    });

    it('9. Authorization with insufficient quantity does not qualify', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
        reasonCode: 'PREAUTHORIZATION_REQUIRED',
      });

      // serviceId1 has quantity 2 in invoice, but authorization only approves quantity 1
      await InsuranceAuthorizationModel.collection.insertOne({
        encounterId,
        patientId,
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status: 'APPROVED',
        integrationMode: 'LIVE',
        lines: [
          { serviceId: serviceId1, approvedQuantity: 1 },
          { serviceId: serviceId2, approvedQuantity: 5 },
        ],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT');
    });

    it('10. Wrong authorization patient is ignored', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
      });

      await InsuranceAuthorizationModel.collection.insertOne({
        encounterId,
        patientId: new Types.ObjectId(),
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status: 'APPROVED',
        integrationMode: 'LIVE',
        lines: [{ serviceId: serviceId1, approvedQuantity: 10 }],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT');
    });

    it('11. Wrong authorization encounter is ignored', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
      });

      await InsuranceAuthorizationModel.collection.insertOne({
        encounterId: new Types.ObjectId(),
        patientId,
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status: 'APPROVED',
        integrationMode: 'LIVE',
        lines: [{ serviceId: serviceId1, approvedQuantity: 10 }],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
    });

    it('12. Wrong authorization service is ignored', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
      });

      await InsuranceAuthorizationModel.collection.insertOne({
        encounterId,
        patientId,
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status: 'APPROVED',
        integrationMode: 'LIVE',
        lines: [{ serviceId: new Types.ObjectId(), approvedQuantity: 10 }],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
    });

    it.each(['REJECTED', 'PENDING', 'CANCELLED', 'EXPIRED'])('13. Authorization not APPROVED (%s) is ignored', async (status) => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
      });

      await InsuranceAuthorizationModel.collection.insertOne({
        encounterId,
        patientId,
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status,
        integrationMode: 'LIVE',
        lines: [{ serviceId: serviceId1, approvedQuantity: 10 }, { serviceId: serviceId2, approvedQuantity: 10 }],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
    });

    it('14. Valid authorization links and reports SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED', async () => {
      await setupActiveMappings();
      vi.mocked(insurance.verifyBenefit).mockResolvedValue({
        ...standardBenefit,
        benefitStatus: 'AUTHORIZATION_REQUIRED',
        authorizationRequired: true,
      });

      const authId = new Types.ObjectId();
      await InsuranceAuthorizationModel.collection.insertOne({
        _id: authId,
        encounterId,
        patientId,
        branchId,
        memberId,
        policyId,
        payerId,
        requestedDate: '2026-10-08',
        status: 'APPROVED',
        integrationMode: 'LIVE',
        lines: [{ serviceId: serviceId1, approvedQuantity: 5 }, { serviceId: serviceId2, approvedQuantity: 5 }],
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('VALIDATED');
      expect(validated.valid).toBe(true);
      expect(validated.issues.map(i => i.code)).toContain('SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED');
    });

    it('15. Missing SHA service mapping reports SHA_SERVICE_MAPPING_MISSING and remains DRAFT', async () => {
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});

      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('SHA_SERVICE_MAPPING_MISSING');
    });

    it('16. Inactive SHA mapping reports SHA_SERVICE_MAPPING_MISSING', async () => {
      await ShaServiceMappingModel.collection.insertOne({
        serviceId: serviceId1,
        interventionCode: 'INT-01',
        effectiveFrom: '2026-01-01',
        status: 'INACTIVE',
        version: 0,
        createdBy: new Types.ObjectId(actor),
        updatedBy: new Types.ObjectId(actor),
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('SHA_SERVICE_MAPPING_MISSING');
    });

    it('17. Mapping not effective for service date reports SHA_SERVICE_MAPPING_MISSING', async () => {
      await ShaServiceMappingModel.collection.insertOne({
        serviceId: serviceId1,
        interventionCode: 'INT-01',
        effectiveFrom: '2026-10-09', // future date, encounter is 2026-10-08
        status: 'ACTIVE',
        version: 0,
        createdBy: new Types.ObjectId(actor),
        updatedBy: new Types.ObjectId(actor),
      });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('SHA_SERVICE_MAPPING_MISSING');
    });

    it('18. CONFIGURED_NOT_SHA_VALIDATED reported when mapping is configured', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.issues.map(i => i.code)).toContain('CONFIGURED_NOT_SHA_VALIDATED');
    });

    it('19. ICD11_NOT_AVAILABLE reported', async () => {
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.issues.map(i => i.code)).toContain('ICD11_NOT_AVAILABLE');
    });

    it('20. SHA contract unconfirmed reported', async () => {
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.issues.map(i => i.code)).toContain('SHA_SUBMISSION_CONTRACT_UNCONFIRMED');
    });

    it('21. SHA identifier mapping and terminology unconfirmed reported', async () => {
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      const codes = claim.issues.map(i => i.code);
      expect(codes).toContain('SHA_IDENTIFIER_MAPPING_UNCONFIRMED');
      expect(codes).toContain('SHA_TERMINOLOGY_UNCONFIRMED');
    });

    it('22. Invoice amount mismatch reports INVALID_CLAIM_AMOUNT', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      // Corrupt invoice item line total
      await BillingInvoiceItemModel.updateOne({ _id: invoiceItemId1 }, { $set: { lineTotal: 999 } });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('INVALID_CLAIM_AMOUNT');
    });

    it('23. Invoice discount/tax allocation unresolved reported', async () => {
      await setupActiveMappings();
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { discountAmount: 100 } });

      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      expect(claim.issues.map(i => i.code)).toContain('INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED');

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.issues.map(i => i.code)).toContain('INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED');
    });

    it('24. Source invoice changed reports CLAIM_SOURCE_CHANGED and keeps claim in DRAFT', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      await BillingInvoiceItemModel.updateOne({ _id: invoiceItemId1 }, { $set: { unitPrice: 600, lineTotal: 1200 } });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('CLAIM_SOURCE_CHANGED');
    });

    it('25. Claim total mismatch reports CLAIM_TOTAL_MISMATCH', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      // Tamper with claim record's claimedTotal in DB
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { claimedTotal: 9999 } });

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).toBe('DRAFT');
      expect(validated.valid).toBe(false);
      expect(validated.issues.map(i => i.code)).toContain('CLAIM_TOTAL_MISMATCH');
    });

    it('26. Concurrent/stale validation is rejected with STALE_CLAIM', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      await expect(claims.validate(claim._id.toString(), 99, actor, {}))
        .rejects.toMatchObject({ code: 'STALE_CLAIM', statusCode: 409 });
    });

    it('27. Branch access denial returns 403', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      vi.mocked(access.hasBranchAccess).mockResolvedValue(false);
      await expect(claims.validate(claim._id.toString(), 0, actor, {}))
        .rejects.toMatchObject({ code: 'BRANCH_ACCESS_DENIED', statusCode: 403 });
    });

    it('28. Cancelled claim cannot be validated', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});
      await InsuranceClaimModel.updateOne({ _id: claim._id }, { $set: { status: 'CANCELLED' } });

      await expect(claims.validate(claim._id.toString(), 0, actor, {}))
        .rejects.toMatchObject({ code: 'CLAIM_CANCELLED', statusCode: 409 });
    });

    it('29. Successful internal validation emits audit log with valid: true', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      const validated = await claims.validate(claim._id.toString(), 0, actor, { ipAddress: '127.0.0.1' });
      expect(validated.status).toBe('VALIDATED');
      expect(validated.valid).toBe(true);

      const audit = await AuditLogModel.findOne({ eventType: 'INSURANCE_CLAIM_VALIDATED' });
      expect(audit).not.toBeNull();
      expect(audit?.metadataJson).toMatchObject({
        claimId: claim._id.toString(),
        status: 'VALIDATED',
        valid: true,
        readyForShaSubmission: false,
      });
    });

    it('30. Claim does NOT get submitted to SHA (remains VALIDATED with readyForShaSubmission: false)', async () => {
      await setupActiveMappings();
      const claim = await claims.create({ invoiceId: invoiceId.toString() }, actor, {});

      const validated = await claims.validate(claim._id.toString(), 0, actor, {});
      expect(validated.status).not.toBe('SUBMITTED');
      expect(validated.readyForShaSubmission).toBe(false);

      const readiness = await claims.readiness(claim._id.toString(), actor);
      expect(readiness.status).toBe('VALIDATED');
      expect(readiness.valid).toBe(true);
      expect(readiness.readyForShaSubmission).toBe(false);
      expect(readiness.summary.total).toBeGreaterThan(0);
    });
  });
});
