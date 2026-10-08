import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { InsuranceService } from './insurance.service.js';
import type { InsuranceAuthorizationRepository } from './insurance-authorization.repository.js';
import type { AuthorizationRecord } from './insurance-authorization.model.js';
import { authorizationDecisionSchema, authorizationRequestSchema, type AuthorizationRequest, type AuthorizationStatus } from './insurance-authorization.schemas.js';
import { UnavailableShaPreauthorizationAdapter, type ShaPreauthorizationAdapter } from './sha-preauthorization.adapter.js';
import type { RequestMetadata } from './insurance.types.js';

const transitions: Record<AuthorizationStatus, readonly AuthorizationStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'FAILED'],
  FAILED: ['SUBMITTED', 'CANCELLED'], PENDING: [], APPROVED: [], PARTIALLY_APPROVED: [], REJECTED: [], EXPIRED: [], CANCELLED: [],
};
export class InsuranceAuthorizationService {
  constructor(private readonly repository: InsuranceAuthorizationRepository, private readonly insurance: InsuranceService,
    private readonly adapter: ShaPreauthorizationAdapter = new UnavailableShaPreauthorizationAdapter()) {}

  private async scope(actor: string, branch: string) {
    if (!await this.repository.hasBranchAccess(actor, branch)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }
  async get(id: string, actor: string) {
    const record = await this.repository.get(id);
    if (!record) throw new AppError('Authorization not found', 404, 'AUTHORIZATION_NOT_FOUND');
    await this.scope(actor, record.branchId.toString());
    return record;
  }
  async list(query: { branchId: string; limit: number; offset: number }, actor: string) {
    await this.scope(actor, query.branchId);
    return this.repository.list(query.branchId, query.limit, query.offset);
  }
  private async validate(input: AuthorizationRequest, actor: string, metadata: RequestMetadata) {
    await this.scope(actor, input.branchId);
    const member = await this.repository.member(input.memberId);
    if (!member?.policyId) throw new AppError('Member or policy not found', 404, 'MEMBER_NOT_FOUND');
    if (!await this.repository.references(input, member.patientId.toString())) throw new AppError('Authorization references do not match patient and branch', 400, 'AUTHORIZATION_REFERENCE_MISMATCH');
    const lines = [];
    for (const line of input.lines) {
      // Phase 4 enforces local coverage and usable SHA eligibility before benefits.
      const benefit = await this.insurance.verifyBenefit({ memberId: input.memberId, serviceId: line.serviceId,
        quantity: line.requestedQuantity, requestedDate: input.requestedDate }, actor, metadata);
      if (!benefit.eligible || !benefit.authorizationRequired || benefit.benefitStatus !== 'AUTHORIZATION_REQUIRED') {
        throw new AppError('Coverage, SHA eligibility and an authorization-required benefit are required', 409, 'PREAUTH_PREREQUISITE_FAILED');
      }
      if (benefit.serviceId !== line.serviceId || !benefit.serviceCode) throw new AppError('Service reference mismatch', 409, 'SERVICE_REFERENCE_MISMATCH');
      lines.push({ serviceId: new Types.ObjectId(line.serviceId), serviceCode: benefit.serviceCode, requestedQuantity: line.requestedQuantity });
    }
    return { member, lines };
  }
  async requestPreauthorization(raw: AuthorizationRequest, actor: string, metadata: RequestMetadata) {
    const input = authorizationRequestSchema.parse(raw);
    const { member, lines } = await this.validate(input, actor, metadata);
    const fingerprint = createHash('sha256').update(JSON.stringify({
      memberId: input.memberId, branchId: input.branchId, encounterId: input.encounterId ?? null,
      requestedDate: input.requestedDate, authorizationContext: input.authorizationContext,
      services: input.lines.map(line => line.serviceId).sort(),
    })).digest('hex');
    const existing = await this.repository.byFingerprint(fingerprint);
    if (existing) return this.sameRequest(existing, input);
    const correlationId = randomUUID();
    try {
      return await this.repository.saveNew({
        memberId: member._id, patientId: member.patientId, policyId: member.policyId._id,
        payerId: member.policyId.payerId, schemeId: member.policyId.schemeId,
        branchId: new Types.ObjectId(input.branchId),
        encounterId: input.encounterId ? new Types.ObjectId(input.encounterId) : undefined,
        requestingDoctorId: input.requestingDoctorId ? new Types.ObjectId(input.requestingDoctorId) : undefined,
        clinicalDocumentId: input.clinicalDocumentId ? new Types.ObjectId(input.clinicalDocumentId) : undefined,
        requestedDate: input.requestedDate, authorizationContext: input.authorizationContext,
        correlationId, fingerprint, version: 0, status: 'DRAFT', integrationMode: this.adapter.mode,
        reasonCode: this.adapter.mode === 'UNAVAILABLE' ? 'SHA_PREAUTH_CONTRACT_UNAVAILABLE' : 'AUTHORIZATION_DRAFT',
        lines, history: [{ to: 'DRAFT', actorId: new Types.ObjectId(actor), at: new Date(), correlationId }],
      }, actor, metadata);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const duplicate = await this.repository.byFingerprint(fingerprint);
        if (duplicate) return this.sameRequest(duplicate, input);
      }
      throw error;
    }
  }
  private sameRequest(record: AuthorizationRecord, input: AuthorizationRequest) {
    if (record.lines.some(line => input.lines.find(item => item.serviceId === line.serviceId.toString())?.requestedQuantity !== line.requestedQuantity)
      || (record.requestingDoctorId?.toString() ?? undefined) !== input.requestingDoctorId
      || (record.clinicalDocumentId?.toString() ?? undefined) !== input.clinicalDocumentId) {
      throw new AppError('Existing authorization context has different request details', 409, 'AUTHORIZATION_REQUEST_CONFLICT');
    }
    return record;
  }
  private async move(record: AuthorizationRecord, to: AuthorizationStatus, actor: string, metadata: RequestMetadata, event: string, changes: Partial<AuthorizationRecord> = {}, reason?: string) {
    if (!transitions[record.status].includes(to)) throw new AppError('Invalid authorization transition', 409, 'INVALID_AUTHORIZATION_TRANSITION');
    const updated = await this.repository.transition(record, to, actor, metadata, event, changes, reason);
    if (!updated) throw new AppError('Authorization changed; refresh and retry', 409, 'STALE_AUTHORIZATION');
    return updated;
  }
  async submit(id: string, version: number, actor: string, metadata: RequestMetadata) {
    const record = await this.get(id, actor);
    if (record.version !== version) throw new AppError('Authorization changed', 409, 'STALE_AUTHORIZATION');
    if (this.adapter.mode === 'UNAVAILABLE') throw new AppError('Confirmed SHA preauthorization contract is unavailable', 503, 'SHA_PREAUTH_CONTRACT_UNAVAILABLE');
    const request = authorizationRequestSchema.parse({ memberId: record.memberId.toString(), branchId: record.branchId.toString(),
      encounterId: record.encounterId?.toString(), requestingDoctorId: record.requestingDoctorId?.toString(),
      clinicalDocumentId: record.clinicalDocumentId?.toString(), requestedDate: record.requestedDate,
      authorizationContext: record.authorizationContext,
      lines: record.lines.map(line => ({ serviceId: line.serviceId.toString(), requestedQuantity: line.requestedQuantity })),
    });
    await this.validate(request, actor, metadata);
    const submitted = await this.move(record, 'SUBMITTED', actor, metadata, 'INSURANCE_AUTHORIZATION_SUBMITTED', {
      correlationId: record.status === 'FAILED' ? randomUUID() : record.correlationId,
      integrationMode: this.adapter.mode,
    });
    let decision;
    try {
      decision = authorizationDecisionSchema.parse(await this.adapter.submit({ ...request, correlationId: submitted.correlationId }));
      const seen = new Set<string>();
      for (const line of decision.lines) {
        const original = request.lines.find(item => item.serviceId === line.serviceId);
        if (!original || seen.has(line.serviceId) || (line.approvedQuantity ?? 0) + (line.rejectedQuantity ?? 0) > original.requestedQuantity) throw new Error('Invalid normalized decision');
        seen.add(line.serviceId);
      }
    } catch {
      // Never persist or log external error text, headers, credentials or raw payload.
      return this.move(submitted, 'FAILED', actor, metadata, 'INSURANCE_AUTHORIZATION_FAILED', { reasonCode: 'SHA_PREAUTH_TECHNICAL_FAILURE' });
    }
    return this.move(submitted, decision.status, actor, metadata, 'INSURANCE_AUTHORIZATION_DECISION_RECEIVED', {
      externalReference: decision.externalReference, decisionDate: new Date(), reasonCode: `AUTHORIZATION_${decision.status}`,
      lines: submitted.lines.map(line => {
        const result = decision.lines.find(item => item.serviceId === line.serviceId.toString());
        return { serviceId: line.serviceId, serviceCode: line.serviceCode, requestedQuantity: line.requestedQuantity,
          approvedQuantity: result?.approvedQuantity, approvedAmount: result?.approvedAmount, rejectedQuantity: result?.rejectedQuantity };
      }),
    });
  }
  async cancel(id: string, version: number, reason: string, actor: string, metadata: RequestMetadata) {
    const record = await this.get(id, actor);
    if (record.version !== version) throw new AppError('Authorization changed', 409, 'STALE_AUTHORIZATION');
    // Payer-submitted requests require a confirmed external cancellation contract.
    if (record.status !== 'DRAFT') throw new AppError('Only unsubmitted drafts can be cancelled locally', 409, 'EXTERNAL_CANCELLATION_UNAVAILABLE');
    return this.move(record, 'CANCELLED', actor, metadata, 'INSURANCE_AUTHORIZATION_CANCELLED', { reasonCode: 'CANCELLED_BY_USER' }, reason);
  }
}
