import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { InsuranceClaimRepository } from './insurance-claim.repository.js';
import type { InsuranceIntegrationRepository } from './insurance-integration.repository.js';
import type { InsuranceIntegrationService } from './insurance-integration.service.js';
import type { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import type { InsuranceService } from './insurance.service.js';
import type { ClaimLine, ClaimIssue, ClaimIssueSeverity } from './insurance-claim.model.js';
import type { RequestMetadata } from './insurance.types.js';
import { createClaimSchema } from './insurance-claim.schemas.js';

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const issue = (code: string, invoiceItemId?: string, message?: string, severity: ClaimIssueSeverity = 'ERROR'): ClaimIssue => ({
  code,
  severity,
  ...(message ? { message } : {}),
  ...(invoiceItemId ? { invoiceItemId } : {}),
});

export const externalReadinessCodes = new Set([
  'ICD11_NOT_AVAILABLE',
  'SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE',
  'SHA_FACILITY_IDENTIFIER_NOT_AVAILABLE',
  'SHA_SUBMISSION_CONTRACT_UNCONFIRMED',
  'SHA_IDENTIFIER_MAPPING_UNCONFIRMED',
  'SHA_TERMINOLOGY_UNCONFIRMED',
  'CONFIGURED_NOT_SHA_VALIDATED',
  'SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED',
  'INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED',
]);

const generalReadinessIssues = (params: {
  icd11Available?: boolean;
  patientIdentifierAvailable?: boolean;
  facilityIdentifierAvailable?: boolean;
} = {}): ClaimIssue[] => [
  ...(!params.icd11Available ? [issue('ICD11_NOT_AVAILABLE', undefined, 'Structured ICD-11 diagnosis coding is required for SHA claim submission but unavailable in OPD encounter', 'ERROR')] : []),
  ...(!params.patientIdentifierAvailable ? [issue('SHA_PATIENT_IDENTIFIER_NOT_AVAILABLE', undefined, 'Patient SHA unique personal identifier (UPI) is required for SHA claim submission but unavailable', 'ERROR')] : []),
  ...(!params.facilityIdentifierAvailable ? [issue('SHA_FACILITY_IDENTIFIER_NOT_AVAILABLE', undefined, 'Facility DHA/SHA identifier is required for claim submission but unavailable', 'ERROR')] : []),
  issue('SHA_SUBMISSION_CONTRACT_UNCONFIRMED', undefined, 'SHA claim submission endpoint and FHIR Bundle contract are unconfirmed', 'ERROR'),
  issue('SHA_IDENTIFIER_MAPPING_UNCONFIRMED', undefined, 'SHA facility, practitioner, and claim identifier mappings are unconfirmed', 'ERROR'),
  issue('SHA_TERMINOLOGY_UNCONFIRMED', undefined, 'SHA clinical and administrative terminology mappings are unconfirmed', 'ERROR'),
];



export class InsuranceClaimService {
  constructor(
    private readonly repository: InsuranceClaimRepository,
    private readonly integrationRepo: InsuranceIntegrationRepository,
    private readonly integration: InsuranceIntegrationService,
    private readonly access: InsuranceAuthorizationRepository,
    private readonly insurance: InsuranceService
  ) {}

  private async scope(actor: string, branchId: string) {
    if (!await this.access.hasBranchAccess(actor, branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }

  async get(id: string, actor: string) {
    const record = await this.repository.get(id);
    if (!record) throw new AppError('Claim not found', 404, 'CLAIM_NOT_FOUND');
    await this.scope(actor, record.branchId.toString());
    return {
      ...record,
      claimId: record._id.toString(),
      valid: record.status === 'VALIDATED',
    };
  }

  async list(query: { branchId: string; limit: number; offset: number }, actor: string) {
    await this.scope(actor, query.branchId);
    return this.repository.list(query.branchId, query.limit, query.offset);
  }

  async readiness(id: string, actor: string) {
    const record = await this.get(id, actor);
    return {
      claimId: record._id.toString(),
      status: record.status,
      valid: record.status === 'VALIDATED',
      readyForShaSubmission: false,
      issues: record.issues,
      summary: {
        total: record.issues.length,
        errors: record.issues.filter(i => i.severity === 'ERROR').length,
        warnings: record.issues.filter(i => i.severity === 'WARNING').length,
        infos: record.issues.filter(i => i.severity === 'INFO').length,
      },
    };
  }

  private async prepare(input: { invoiceId: string; memberId?: string }, actor: string, metadata: RequestMetadata) {
    const source = await this.repository.source(input.invoiceId);
    const invoice = source.invoice;
    if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    await this.scope(actor, invoice.branchId.toString());
    if (invoice.sourceType !== 'OPD' || !['PENDING', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status)) {
      throw new AppError('Finalized OPD invoice required', 409, 'INVOICE_NOT_CLAIMABLE');
    }
    const context = await this.integration.context(invoice.visitId.toString(), 'OPD', actor);
    if (context.patientId !== invoice.patientId.toString() || context.branchId !== invoice.branchId.toString()) {
      throw new AppError('Invoice encounter ownership mismatch', 409, 'INVOICE_CONTEXT_MISMATCH');
    }
    const members = await this.integrationRepo.members(context.patientId, context.encounterDate, input.memberId);
    const member = members.length === 1 ? members[0] : undefined;
    if (!member) throw new AppError('Select one valid patient membership', 409, 'MEMBER_CONTEXT_REQUIRED');
    const policy = await this.integrationRepo.policy(member.policyId.toString());
    if (!policy) throw new AppError('Policy not found', 409, 'POLICY_NOT_FOUND');
    const coverage = await this.insurance.checkCoverage({ memberId: member._id.toString(), asOfDate: context.encounterDate });
    if (!coverage.valid) throw new AppError('Local insurance coverage is invalid', 409, coverage.reasonCode);
    if (!source.items.length || source.items.length > 100) {
      throw new AppError('Invoice must contain between 1 and 100 items', 422, 'CLAIM_ITEM_COUNT_INVALID');
    }

    const icd11Available = context.diagnosis.icd11Readiness === 'AVAILABLE';
    const patientIdentifierAvailable = context.patientIdentifierReadiness?.identifierAvailable === true;
    const facilityIdentifierAvailable = context.facilityIdentifierReadiness?.identifierAvailable === true;
    const issues: ClaimIssue[] = generalReadinessIssues({ icd11Available, patientIdentifierAvailable, facilityIdentifierAvailable });
    if (invoice.discountAmount || invoice.taxAmount) {
      issues.push(issue('INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED', undefined, 'Invoice header discounts or taxes cannot be deterministically allocated across claim lines', 'WARNING'));
    }


    const lines: ClaimLine[] = [];
    // Check cumulative service quantity so repeated invoice items cannot reuse an insufficient authorization.
    const quantities = new Map<string, number>();
    for (const item of source.items) quantities.set(item.serviceId.toString(), (quantities.get(item.serviceId.toString()) ?? 0) + item.quantity);

    for (const item of source.items) {
      const amount = round(item.quantity * item.unitPrice);
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isSafeInteger(Math.round(amount * 100)) || amount !== item.lineTotal) {
        throw new AppError('Invalid invoice item amount', 409, 'INVALID_CLAIM_AMOUNT');
      }
      const service = context.services.find(row => row.serviceId === item.serviceId.toString());
      if (!service || !context.invoiceItems.some(row => row.invoiceItemId === item._id.toString() && row.invoiceId === input.invoiceId)) {
        throw new AppError('Invoice item service is not in encounter', 409, 'SERVICE_NOT_IN_ENCOUNTER');
      }
      const benefit = await this.integration.coverage(invoice.visitId.toString(), 'OPD', service.serviceId, { memberId: member._id.toString(), quantity: quantities.get(service.serviceId) ?? item.quantity }, actor, metadata);
      const reasons: ClaimIssue[] = [
        ...(!icd11Available ? [issue('ICD11_NOT_AVAILABLE', item._id.toString(), 'Structured ICD-11 diagnosis coding is required for SHA claim submission', 'ERROR')] : []),
        issue(benefit.shaMapping ? 'CONFIGURED_NOT_SHA_VALIDATED' : 'SHA_SERVICE_MAPPING_MISSING', item._id.toString(), benefit.shaMapping ? 'Service mapping is configured locally but intervention code is unconfirmed against SHA tariff master' : 'No active SHA service mapping exists for this service', benefit.shaMapping ? 'WARNING' : 'ERROR'),
      ];

      if (!benefit.eligible) {
        reasons.push(issue(benefit.reasonCode, item._id.toString(), benefit.message ?? 'Service is not covered under insurance benefit rules', 'ERROR'));
      }
      if (benefit.authorizationRequired) {
        reasons.push(issue(benefit.authorization ? 'SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED' : 'AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT', item._id.toString(), benefit.authorization ? 'Preauthorization is approved locally but SHA payer-side validity and expiry semantics are unconfirmed' : 'Benefit requires preauthorization but no approved live authorization was found with sufficient quantity', benefit.authorization ? 'WARNING' : 'ERROR'));
      }
      lines.push({
        invoiceItemId: item._id, serviceId: item.serviceId, serviceCode: service.serviceCode,
        quantity: item.quantity, claimedUnitAmount: item.unitPrice, claimedAmount: amount,
        ...(benefit.shaMapping ? { mappingId: new Types.ObjectId(benefit.shaMapping.mappingId), interventionCode: benefit.shaMapping.interventionCode } : {}),
        ...(benefit.authorization ? { authorizationId: new Types.ObjectId(benefit.authorization.authorizationId) } : {}),
        benefitStatus: benefit.benefitStatus, readiness: 'NOT_READY_FOR_SHA_SUBMISSION', issues: reasons,
      });
      issues.push(...reasons);
    }
    return { source, invoice, member, policy, context, lines, issues };
  }

  async create(raw: { invoiceId: string; memberId?: string }, actor: string, metadata: RequestMetadata) {
    const input = createClaimSchema.parse(raw);
    const prepared = await this.prepare(input, actor, metadata);
    const { invoice, member, policy, context, lines, issues, source } = prepared;
    const existing = await this.repository.existing(input.invoiceId, member._id.toString());
    if (existing) {
      if (existing.status === 'DRAFT' && existing.sourceFingerprint === source.fingerprint) return existing;
      throw new AppError('Claim already exists for this invoice and membership', 409, 'DUPLICATE_CLAIM');
    }
    try {
      return await this.repository.create({
        invoiceId: invoice._id, patientId: invoice.patientId, encounterId: invoice.visitId, branchId: invoice.branchId,
        memberId: member._id, policyId: member.policyId, payerId: policy.payerId, schemeId: policy.schemeId,
        serviceDate: context.encounterDate, status: 'DRAFT', version: 0, sourceFingerprint: source.fingerprint,
        lines, claimedTotal: round(lines.reduce((total, line) => total + line.claimedAmount, 0)), readyForShaSubmission: false, issues,
        createdBy: new Types.ObjectId(actor), updatedBy: new Types.ObjectId(actor),
      }, actor, metadata);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw new AppError('Claim already exists', 409, 'DUPLICATE_CLAIM');
      throw error;
    }
  }

  async validate(id: string, version: number, actor: string, metadata: RequestMetadata) {
    const record = await this.get(id, actor);
    if (record.status === 'CANCELLED') throw new AppError('Claim is cancelled', 409, 'CLAIM_CANCELLED');
    if (record.version !== version || (record.status !== 'DRAFT' && record.status !== 'VALIDATED')) {
      throw new AppError('Claim changed or is not draft/validated', 409, 'STALE_CLAIM');
    }

    let issues: ClaimIssue[];
    let lines: ClaimLine[] | undefined;
    let internalValid: boolean;

    try {
      const prepared = await this.prepare({ invoiceId: record.invoiceId.toString(), memberId: record.memberId.toString() }, actor, metadata);
      issues = prepared.issues;
      lines = prepared.lines;

      if (prepared.source.fingerprint !== record.sourceFingerprint) {
        issues.push(issue('CLAIM_SOURCE_CHANGED', undefined, 'Underlying invoice or invoice items have changed since claim creation', 'ERROR'));
      }

      const lineSum = round(lines.reduce((total, l) => total + l.claimedAmount, 0));
      if (lineSum !== record.claimedTotal) {
        issues.push(issue('CLAIM_TOTAL_MISMATCH', undefined, 'Sum of claim lines does not equal claim total amount', 'ERROR'));
      }

      // Internal validation succeeds only if no internal error issues exist
      internalValid = !issues.some(i => !externalReadinessCodes.has(i.code));
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode === 403) throw error;
      if (error.code === 'STALE_CLAIM' || error.code === 'CLAIM_CANCELLED') throw error;
      issues = [
        issue(error.code, undefined, error.message, 'ERROR'),
        ...generalReadinessIssues({ icd11Available: false, patientIdentifierAvailable: false, facilityIdentifierAvailable: false }),
      ];
      internalValid = false;

    }

    const nextStatus = internalValid ? 'VALIDATED' : 'DRAFT';
    return this.repository.validate(id, version, nextStatus, issues, lines, actor, metadata);
  }
}
