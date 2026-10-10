import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { InsuranceClaimRepository } from '../insurance-claim.repository.js';
import { InsuranceAuthorizationRepository } from '../insurance-authorization.repository.js';
import { InsuranceClaimModel } from '../insurance-claim.model.js';
import { AuditLogModel } from '../../auth/auth.model.js';
import { DhaMockClaimSubmissionModel } from './dha-claim-submission.model.js';
import { DhaMockClaimPreviewModel } from './dha-claim-preview.model.js';
import { DhaMockClaimDischargeModel } from './dha-claim-discharge.model.js';
import { DhaMockClaimAdjudicationModel } from './dha-claim-adjudication.model.js';
import { DhaMockClaimQueryModel } from './dha-claim-query.model.js';
import { DhaMockClaimAppealModel } from './dha-claim-appeal.model.js';
import { DhaMockRemittanceAdviceModel } from './dha-remittance-advice.model.js';
import { DhaMockPaymentAllocationModel } from './dha-payment-allocation.model.js';
import { DhaMockPaymentReconciliationModel } from './dha-payment-reconciliation.model.js';
import { DhaMockClaimClosureModel } from './dha-claim-closure.model.js';

export interface ClaimLifecycleSummaryResult {
  branchId: string;
  period: {
    startDate?: string;
    endDate?: string;
  };
  totalClaims: number;
  authoritativeStatusCounts: Record<string, number>;
  mockLifecycleOutcomeCounts: {
    submitted: number;
    previewAvailable: number;
    discharged: number;
    adjudication: {
      approved: number;
      partiallyApproved: number;
      rejected: number;
      pending: number;
      query: number;
    };
    queries: {
      open: number;
      responseSubmitted: number;
      resolved: number;
    };
    appeals: {
      open: number;
      submitted: number;
      upheld: number;
      overturned: number;
    };
    remittance: {
      remitted: number;
    };
    reconciliation: {
      reconciled: number;
      partiallyReconciled: number;
      discrepancy: number;
    };
    closure: {
      closedReconciled: number;
      closedNoSettlement: number;
    };
  };
}

export interface CurrencyRemittanceReconciliationSummary {
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedTotal: number;
  reconciledClaimsCount: number;
  partiallyReconciledClaimsCount: number;
  discrepancyClaimsCount: number;
  discrepancyDifferenceTotal: number;
}

export interface RemittanceReconciliationSummaryResult {
  branchId: string;
  period: {
    startDate?: string;
    endDate?: string;
  };
  totalClaimsWithRemittance: number;
  byCurrency: CurrencyRemittanceReconciliationSummary[];
}

export interface OutstandingWorkItem {
  claimId: string;
  category: 'OPEN_QUERIES' | 'OPEN_APPEALS' | 'INCOMPLETE_RECONCILIATION' | 'UNCLOSED_CLAIMS';
  title: string;
  description: string;
  authoritativeStatus: string;
  claimedTotal: number;
  currency?: string;
  issueDetails: {
    queryStatus?: string;
    queryReference?: string;
    appealStatus?: string;
    appealReference?: string;
    reconciliationStatus?: string;
    reconciliationReference?: string;
    unallocatedAmount?: number;
    discrepancyReasons?: string[];
    dischargeReference?: string;
    adjudicationStatus?: string;
  };
  createdAt: Date;
}

export interface OutstandingWorkReportResult {
  branchId: string;
  categoryFilter: string;
  items: OutstandingWorkItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ClaimTimelineEvent {
  timestamp: Date;
  stage:
    | 'SUBMISSION'
    | 'PREVIEW'
    | 'DISCHARGE'
    | 'ADJUDICATION'
    | 'QUERY'
    | 'APPEAL'
    | 'REMITTANCE'
    | 'ALLOCATION'
    | 'RECONCILIATION'
    | 'CLOSURE'
    | 'AUDIT';
  source: 'MOCK' | 'REAL';
  reference: string;
  status: string;
  description: string;
  details?: Record<string, unknown>;
  actorUserId?: string;
}

export interface ClaimAuditHistoryResult {
  claimId: string;
  branchId: string;
  authoritativeStatus: string;
  sourceFingerprint: string;
  claimedTotal: number;
  timeline: ClaimTimelineEvent[];
}

export class DhaClaimReportingService {
  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
  ) {}

  /**
   * Generates a read-only lifecycle summary grouping claims by authoritative and mock statuses.
   */
  async getClaimLifecycleSummary(
    query: { branchId: string; startDate?: string; endDate?: string },
    options: { actorUserId: string },
  ): Promise<ClaimLifecycleSummaryResult> {
    if (!Types.ObjectId.isValid(query.branchId)) {
      throw new AppError('Invalid branch ID format', 400, 'VALIDATION_ERROR');
    }

    const hasAccess = await this.access.hasBranchAccess(
      options.actorUserId,
      query.branchId,
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    const filter: Record<string, unknown> = {
      branchId: new Types.ObjectId(query.branchId),
    };

    if (query.startDate || query.endDate) {
      const createdAtFilter: Record<string, unknown> = {};
      if (query.startDate) {
        createdAtFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.$lte = end;
      }
      filter.createdAt = createdAtFilter;
    }

    const claims = await InsuranceClaimModel.find(filter)
      .select('_id status claimedTotal createdAt')
      .lean();

    const authoritativeStatusCounts: Record<string, number> = {};
    for (const c of claims) {
      authoritativeStatusCounts[c.status] = (authoritativeStatusCounts[c.status] || 0) + 1;
    }

    const claimIds = claims.map((c) => c._id);

    if (claimIds.length === 0) {
      return {
        branchId: query.branchId,
        period: { startDate: query.startDate, endDate: query.endDate },
        totalClaims: 0,
        authoritativeStatusCounts,
        mockLifecycleOutcomeCounts: {
          submitted: 0,
          previewAvailable: 0,
          discharged: 0,
          adjudication: { approved: 0, partiallyApproved: 0, rejected: 0, pending: 0, query: 0 },
          queries: { open: 0, responseSubmitted: 0, resolved: 0 },
          appeals: { open: 0, submitted: 0, upheld: 0, overturned: 0 },
          remittance: { remitted: 0 },
          reconciliation: { reconciled: 0, partiallyReconciled: 0, discrepancy: 0 },
          closure: { closedReconciled: 0, closedNoSettlement: 0 },
        },
      };
    }

    const [
      submittedCount,
      previewCount,
      dischargeCount,
      adjudicationAgg,
      queryAgg,
      appealAgg,
      remittanceCount,
      reconciliationAgg,
      closureAgg,
    ] = await Promise.all([
      DhaMockClaimSubmissionModel.countDocuments({ claimId: { $in: claimIds } }),
      DhaMockClaimPreviewModel.countDocuments({ claimId: { $in: claimIds } }),
      DhaMockClaimDischargeModel.countDocuments({ claimId: { $in: claimIds } }),
      DhaMockClaimAdjudicationModel.aggregate([
        { $match: { claimId: { $in: claimIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$claimId', latestStatus: { $first: '$status' } } },
        { $group: { _id: '$latestStatus', count: { $sum: 1 } } },
      ]),
      DhaMockClaimQueryModel.aggregate([
        { $match: { claimId: { $in: claimIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DhaMockClaimAppealModel.aggregate([
        { $match: { claimId: { $in: claimIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DhaMockRemittanceAdviceModel.countDocuments({ claimId: { $in: claimIds } }),
      DhaMockPaymentReconciliationModel.aggregate([
        { $match: { claimId: { $in: claimIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$claimId', latestStatus: { $first: '$status' } } },
        { $group: { _id: '$latestStatus', count: { $sum: 1 } } },
      ]),
      DhaMockClaimClosureModel.aggregate([
        { $match: { claimId: { $in: claimIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const adjMap = new Map<string, number>(adjudicationAgg.map((a: { _id: string; count: number }) => [a._id, a.count]));
    const qMap = new Map<string, number>(queryAgg.map((q: { _id: string; count: number }) => [q._id, q.count]));
    const appMap = new Map<string, number>(appealAgg.map((a: { _id: string; count: number }) => [a._id, a.count]));
    const reconMap = new Map<string, number>(reconciliationAgg.map((r: { _id: string; count: number }) => [r._id, r.count]));
    const clsMap = new Map<string, number>(closureAgg.map((c: { _id: string; count: number }) => [c._id, c.count]));

    return {
      branchId: query.branchId,
      period: { startDate: query.startDate, endDate: query.endDate },
      totalClaims: claims.length,
      authoritativeStatusCounts,
      mockLifecycleOutcomeCounts: {
        submitted: submittedCount,
        previewAvailable: previewCount,
        discharged: dischargeCount,
        adjudication: {
          approved: adjMap.get('MOCK_APPROVED') || 0,
          partiallyApproved: adjMap.get('MOCK_PARTIALLY_APPROVED') || 0,
          rejected: adjMap.get('MOCK_REJECTED') || 0,
          pending: adjMap.get('MOCK_PENDING') || 0,
          query: adjMap.get('MOCK_QUERY') || 0,
        },
        queries: {
          open: qMap.get('OPEN') || 0,
          responseSubmitted: qMap.get('RESPONSE_SUBMITTED') || 0,
          resolved: qMap.get('MOCK_RESOLVED') || 0,
        },
        appeals: {
          open: appMap.get('OPEN') || 0,
          submitted: appMap.get('SUBMITTED') || 0,
          upheld: appMap.get('MOCK_UPHELD') || 0,
          overturned: appMap.get('MOCK_OVERTURNED') || 0,
        },
        remittance: {
          remitted: remittanceCount,
        },
        reconciliation: {
          reconciled: reconMap.get('MOCK_RECONCILED') || 0,
          partiallyReconciled: reconMap.get('MOCK_PARTIALLY_RECONCILED') || 0,
          discrepancy: reconMap.get('MOCK_DISCREPANCY') || 0,
        },
        closure: {
          closedReconciled: clsMap.get('MOCK_CLOSED_RECONCILED') || 0,
          closedNoSettlement: clsMap.get('MOCK_CLOSED_NO_SETTLEMENT') || 0,
        },
      },
    };
  }

  /**
   * Generates a read-only remittance and reconciliation report grouped strictly by currency code.
   * Never combines or implicitly converts across differing currencies.
   */
  async getRemittanceReconciliationSummary(
    query: { branchId: string; currency?: string; startDate?: string; endDate?: string },
    options: { actorUserId: string },
  ): Promise<RemittanceReconciliationSummaryResult> {
    if (!Types.ObjectId.isValid(query.branchId)) {
      throw new AppError('Invalid branch ID format', 400, 'VALIDATION_ERROR');
    }

    const hasAccess = await this.access.hasBranchAccess(
      options.actorUserId,
      query.branchId,
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    const claimFilter: Record<string, unknown> = {
      branchId: new Types.ObjectId(query.branchId),
    };

    if (query.startDate || query.endDate) {
      const createdAtFilter: Record<string, unknown> = {};
      if (query.startDate) {
        createdAtFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.$lte = end;
      }
      claimFilter.createdAt = createdAtFilter;
    }

    const claims = await InsuranceClaimModel.find(claimFilter).select('_id').lean();
    const claimIds = claims.map((c) => c._id);

    if (claimIds.length === 0) {
      return {
        branchId: query.branchId,
        period: { startDate: query.startDate, endDate: query.endDate },
        totalClaimsWithRemittance: 0,
        byCurrency: [],
      };
    }

    const remFilter: Record<string, unknown> = {
      claimId: { $in: claimIds },
    };
    if (query.currency) {
      remFilter.currency = query.currency;
    }

    const remittances = await DhaMockRemittanceAdviceModel.find(remFilter)
      .sort({ createdAt: -1 })
      .lean();

    // Map claimId -> latest remittance
    const latestRemittanceByClaim = new Map<string, (typeof remittances)[number]>();
    for (const rem of remittances) {
      const cid = rem.claimId.toString();
      if (!latestRemittanceByClaim.has(cid)) {
        latestRemittanceByClaim.set(cid, rem);
      }
    }

    const reconDocs = await DhaMockPaymentReconciliationModel.find({
      claimId: { $in: claimIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Map claimId -> latest reconciliation
    const latestReconByClaim = new Map<string, (typeof reconDocs)[number]>();
    for (const rec of reconDocs) {
      const cid = rec.claimId.toString();
      if (!latestReconByClaim.has(cid)) {
        latestReconByClaim.set(cid, rec);
      }
    }

    // Group by currency strictly
    const currencyMap = new Map<
      string,
      {
        remittedTotal: number;
        allocatedTotal: number;
        unallocatedTotal: number;
        reconciledClaimsCount: number;
        partiallyReconciledClaimsCount: number;
        discrepancyClaimsCount: number;
        discrepancyDifferenceTotal: number;
      }
    >();

    for (const rem of latestRemittanceByClaim.values()) {
      const curr = rem.currency || 'UNKNOWN';
      let entry = currencyMap.get(curr);
      if (!entry) {
        entry = {
          remittedTotal: 0,
          allocatedTotal: 0,
          unallocatedTotal: 0,
          reconciledClaimsCount: 0,
          partiallyReconciledClaimsCount: 0,
          discrepancyClaimsCount: 0,
          discrepancyDifferenceTotal: 0,
        };
        currencyMap.set(curr, entry);
      }

      entry.remittedTotal += rem.remittedTotal;

      const recon = latestReconByClaim.get(rem.claimId.toString());
      if (recon) {
        entry.allocatedTotal += recon.allocatedTotal;
        entry.unallocatedTotal += recon.unallocatedAmount;

        if (recon.status === 'MOCK_RECONCILED') {
          entry.reconciledClaimsCount += 1;
        } else if (recon.status === 'MOCK_PARTIALLY_RECONCILED') {
          entry.partiallyReconciledClaimsCount += 1;
        } else if (recon.status === 'MOCK_DISCREPANCY') {
          entry.discrepancyClaimsCount += 1;
          entry.discrepancyDifferenceTotal += Math.abs(recon.allocationDifference);
        }
      } else {
        // Remitted but no reconciliation yet -> entirely unallocated
        entry.unallocatedTotal += rem.remittedTotal;
      }
    }

    const byCurrency: CurrencyRemittanceReconciliationSummary[] = Array.from(
      currencyMap.entries(),
    ).map(([currency, data]) => ({
      currency,
      remittedTotal: Math.round((data.remittedTotal + Number.EPSILON) * 100) / 100,
      allocatedTotal: Math.round((data.allocatedTotal + Number.EPSILON) * 100) / 100,
      unallocatedTotal: Math.round((data.unallocatedTotal + Number.EPSILON) * 100) / 100,
      reconciledClaimsCount: data.reconciledClaimsCount,
      partiallyReconciledClaimsCount: data.partiallyReconciledClaimsCount,
      discrepancyClaimsCount: data.discrepancyClaimsCount,
      discrepancyDifferenceTotal:
        Math.round((data.discrepancyDifferenceTotal + Number.EPSILON) * 100) / 100,
    }));

    return {
      branchId: query.branchId,
      period: { startDate: query.startDate, endDate: query.endDate },
      totalClaimsWithRemittance: latestRemittanceByClaim.size,
      byCurrency,
    };
  }

  /**
   * Retrieves outstanding work items across claims in a branch requiring operator action.
   */
  async getOutstandingWorkSummary(
    query: {
      branchId: string;
      page?: number;
      limit?: number;
      category?: 'ALL' | 'OPEN_QUERIES' | 'OPEN_APPEALS' | 'INCOMPLETE_RECONCILIATION' | 'UNCLOSED_CLAIMS';
    },
    options: { actorUserId: string },
  ): Promise<OutstandingWorkReportResult> {
    if (!Types.ObjectId.isValid(query.branchId)) {
      throw new AppError('Invalid branch ID format', 400, 'VALIDATION_ERROR');
    }

    const hasAccess = await this.access.hasBranchAccess(
      options.actorUserId,
      query.branchId,
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    const claims = await InsuranceClaimModel.find({
      branchId: new Types.ObjectId(query.branchId),
      status: { $ne: 'CANCELLED' },
    })
      .select('_id status claimedTotal createdAt')
      .lean();

    const claimIds = claims.map((c) => c._id);
    const claimMap = new Map(claims.map((c) => [c._id.toString(), c]));

    const [queries, appeals, reconciliations, closures, discharges, adjudications] =
      await Promise.all([
        DhaMockClaimQueryModel.find({
          claimId: { $in: claimIds },
          status: { $in: ['OPEN', 'RESPONSE_SUBMITTED'] },
        }).lean(),
        DhaMockClaimAppealModel.find({
          claimId: { $in: claimIds },
          status: { $in: ['OPEN', 'SUBMITTED'] },
        }).lean(),
        DhaMockPaymentReconciliationModel.find({
          claimId: { $in: claimIds },
          status: { $in: ['MOCK_PARTIALLY_RECONCILED', 'MOCK_DISCREPANCY'] },
        }).lean(),
        DhaMockClaimClosureModel.find({ claimId: { $in: claimIds } }).lean(),
        DhaMockClaimDischargeModel.find({ claimId: { $in: claimIds } }).lean(),
        DhaMockClaimAdjudicationModel.find({ claimId: { $in: claimIds } }).lean(),
      ]);

    const closedClaimIdSet = new Set(closures.map((c) => c.claimId.toString()));
    const dischargedClaimMap = new Map(discharges.map((d) => [d.claimId.toString(), d]));
    const latestAdjMap = new Map<string, (typeof adjudications)[number]>();
    for (const a of adjudications) {
      const cid = a.claimId.toString();
      if (!latestAdjMap.has(cid) || latestAdjMap.get(cid)!.adjudicatedAt < a.adjudicatedAt) {
        latestAdjMap.set(cid, a);
      }
    }

    const items: OutstandingWorkItem[] = [];

    // 1. Open queries
    for (const q of queries) {
      const c = claimMap.get(q.claimId.toString());
      if (c) {
        items.push({
          claimId: c._id.toString(),
          category: 'OPEN_QUERIES',
          title: `Unresolved Query: ${q.externalQueryReference}`,
          description: q.queryReason || 'Claim has an open insurer query requiring response',
          authoritativeStatus: c.status,
          claimedTotal: c.claimedTotal,
          issueDetails: {
            queryStatus: q.status,
            queryReference: q.externalQueryReference,
          },
          createdAt: q.createdAt,
        });
      }
    }

    // 2. Open appeals
    for (const a of appeals) {
      const c = claimMap.get(a.claimId.toString());
      if (c) {
        items.push({
          claimId: c._id.toString(),
          category: 'OPEN_APPEALS',
          title: `Pending Appeal: ${a.externalAppealReference}`,
          description: a.appealReason || 'Claim appeal is open or awaiting decision',
          authoritativeStatus: c.status,
          claimedTotal: c.claimedTotal,
          issueDetails: {
            appealStatus: a.status,
            appealReference: a.externalAppealReference,
          },
          createdAt: a.createdAt,
        });
      }
    }

    // 3. Incomplete / Discrepant Reconciliations
    for (const r of reconciliations) {
      const c = claimMap.get(r.claimId.toString());
      if (c && !closedClaimIdSet.has(c._id.toString())) {
        items.push({
          claimId: c._id.toString(),
          category: 'INCOMPLETE_RECONCILIATION',
          title: `Reconciliation Issue: ${r.status}`,
          description:
            r.status === 'MOCK_DISCREPANCY'
              ? `Discrepancy detected: ${r.discrepancyReasons?.join('; ') || 'amount mismatch'}`
              : `Partial reconciliation with unallocated balance of ${r.unallocatedAmount} ${r.currency}`,
          authoritativeStatus: c.status,
          claimedTotal: c.claimedTotal,
          currency: r.currency,
          issueDetails: {
            reconciliationStatus: r.status,
            reconciliationReference: r.externalReconciliationReference,
            unallocatedAmount: r.unallocatedAmount,
            discrepancyReasons: r.discrepancyReasons,
          },
          createdAt: r.reconciledAt || r.createdAt,
        });
      }
    }

    // 4. Unclosed Discharged/Adjudicated Claims
    for (const [cid, disc] of dischargedClaimMap.entries()) {
      if (!closedClaimIdSet.has(cid)) {
        const c = claimMap.get(cid);
        const adj = latestAdjMap.get(cid);
        if (c && adj && adj.status !== 'MOCK_PENDING') {
          // Check if not already captured under query or appeal
          const hasActiveQuery = queries.some((q) => q.claimId.toString() === cid);
          const hasActiveAppeal = appeals.some((a) => a.claimId.toString() === cid);

          if (!hasActiveQuery && !hasActiveAppeal) {
            items.push({
              claimId: c._id.toString(),
              category: 'UNCLOSED_CLAIMS',
              title: `Unclosed Claim awaiting closure snapshot`,
              description: `Adjudicated with outcome ${adj.status}; eligible for closure review`,
              authoritativeStatus: c.status,
              claimedTotal: c.claimedTotal,
              issueDetails: {
                dischargeReference: disc.externalDischargeReference,
                adjudicationStatus: adj.status,
              },
              createdAt: adj.adjudicatedAt || c.createdAt,
            });
          }
        }
      }
    }

    const category = query.category || 'ALL';
    const filteredItems =
      category === 'ALL' ? items : items.filter((item) => item.category === category);

    // Sort by latest createdAt descending
    filteredItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = query.page || 1;
    const limit = query.limit || 25;
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    return {
      branchId: query.branchId,
      categoryFilter: category,
      items: paginatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a chronological audit trail of all lifecycle events and references for a claim.
   */
  async getClaimAuditHistory(
    claimId: string,
    options: { actorUserId: string },
  ): Promise<ClaimAuditHistoryResult> {
    if (!Types.ObjectId.isValid(claimId)) {
      throw new AppError('Invalid claim ID format', 400, 'VALIDATION_ERROR');
    }

    const claim = await this.claimRepository.get(claimId);
    if (!claim) {
      throw new AppError('Insurance claim not found', 404, 'CLAIM_NOT_FOUND');
    }

    const hasAccess = await this.access.hasBranchAccess(
      options.actorUserId,
      claim.branchId.toString(),
    );
    if (!hasAccess) {
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    }

    const [
      submission,
      preview,
      discharge,
      adjudications,
      queries,
      appeals,
      remittances,
      allocations,
      reconciliations,
      closures,
      auditLogs,
    ] = await Promise.all([
      DhaMockClaimSubmissionModel.findOne({ claimId: claim._id }).lean(),
      DhaMockClaimPreviewModel.findOne({ claimId: claim._id }).lean(),
      DhaMockClaimDischargeModel.findOne({ claimId: claim._id }).lean(),
      DhaMockClaimAdjudicationModel.find({ claimId: claim._id }).lean(),
      DhaMockClaimQueryModel.find({ claimId: claim._id }).lean(),
      DhaMockClaimAppealModel.find({ claimId: claim._id }).lean(),
      DhaMockRemittanceAdviceModel.find({ claimId: claim._id }).lean(),
      DhaMockPaymentAllocationModel.find({ claimId: claim._id }).lean(),
      DhaMockPaymentReconciliationModel.find({ claimId: claim._id }).lean(),
      DhaMockClaimClosureModel.find({ claimId: claim._id }).lean(),
      AuditLogModel.find({
        $or: [
          { 'metadataJson.claimId': claim._id.toString() },
          { 'metadataJson.claimId': claim._id },
        ],
      }).lean(),
    ]);

    const timeline: ClaimTimelineEvent[] = [];

    // Initial claim creation
    timeline.push({
      timestamp: claim.createdAt,
      stage: 'AUDIT',
      source: 'MOCK',
      reference: claim._id.toString(),
      status: claim.status,
      description: `Insurance claim created with status ${claim.status} and claimedTotal ${claim.claimedTotal}`,
      details: {
        claimedTotal: claim.claimedTotal,
        sourceFingerprint: claim.sourceFingerprint,
      },
    });

    if (submission) {
      timeline.push({
        timestamp: submission.submittedAt,
        stage: 'SUBMISSION',
        source: 'MOCK',
        reference: submission.externalReference,
        status: submission.status,
        description: 'Simulated Phase 9.1 claim submission performed',
        actorUserId: submission.actorUserId,
      });
    }

    if (preview) {
      timeline.push({
        timestamp: preview.previewedAt,
        stage: 'PREVIEW',
        source: 'MOCK',
        reference: preview.mockSubmissionReference,
        status: preview.status,
        description: 'Simulated Phase 9.2 claim preview generated',
        actorUserId: preview.actorUserId,
      });
    }

    if (discharge) {
      timeline.push({
        timestamp: discharge.dischargedAt,
        stage: 'DISCHARGE',
        source: 'MOCK',
        reference: discharge.externalDischargeReference,
        status: discharge.status,
        description: 'Simulated Phase 9.3 claim discharge / final submission completed',
        actorUserId: discharge.actorUserId,
      });
    }

    for (const adj of adjudications) {
      timeline.push({
        timestamp: adj.adjudicatedAt,
        stage: 'ADJUDICATION',
        source: 'MOCK',
        reference: adj.externalAdjudicationReference,
        status: adj.status,
        description: `Simulated Phase 10.1 adjudication returned ${adj.status} with approved total ${adj.adjudicatedTotal}`,
        details: {
          claimedTotal: adj.claimedTotal,
          adjudicatedTotal: adj.adjudicatedTotal,
          disallowedTotal: Math.max(0, adj.claimedTotal - adj.adjudicatedTotal),
        },
        actorUserId: adj.actorUserId,
      });
    }

    for (const q of queries) {
      timeline.push({
        timestamp: q.createdAt,
        stage: 'QUERY',
        source: 'MOCK',
        reference: q.externalQueryReference,
        status: q.status,
        description: `Simulated Phase 10.2 claim query recorded: ${q.queryReason}`,
        details: {
          responsesCount: q.responses?.length || 0,
        },
        actorUserId: q.actorUserId,
      });

      if (q.responses) {
        for (const resp of q.responses) {
          timeline.push({
            timestamp: resp.respondedAt,
            stage: 'QUERY',
            source: 'MOCK',
            reference: resp.responseReference,
            status: resp.simulatedOutcome,
            description: `Query response recorded: ${resp.responseNote}`,
          });
        }
      }
    }

    for (const app of appeals) {
      timeline.push({
        timestamp: app.createdAt,
        stage: 'APPEAL',
        source: 'MOCK',
        reference: app.externalAppealReference,
        status: app.status,
        description: `Simulated Phase 10.3 appeal created: ${app.appealReason}`,
        actorUserId: app.actorUserId,
      });

      if (app.submissions) {
        for (const sub of app.submissions) {
          timeline.push({
            timestamp: sub.submittedAt,
            stage: 'APPEAL',
            source: 'MOCK',
            reference: sub.submissionReference,
            status: sub.simulatedOutcome,
            description: `Appeal submission: ${sub.appealNote} (outcome: ${sub.simulatedOutcome})`,
            actorUserId: sub.submittedBy,
          });
        }
      }
    }

    for (const rem of remittances) {
      timeline.push({
        timestamp: rem.remittedAt || rem.createdAt,
        stage: 'REMITTANCE',
        source: 'MOCK',
        reference: rem.externalRemittanceReference,
        status: rem.status,
        description: `Simulated Phase 10.4 remittance advice generated: remitted ${rem.remittedTotal} ${rem.currency} (disallowed ${rem.disallowedTotal})`,
        details: {
          claimedTotal: rem.claimedTotal,
          remittedTotal: rem.remittedTotal,
          disallowedTotal: rem.disallowedTotal,
          currency: rem.currency,
          payableBasis: rem.payableBasis,
        },
        actorUserId: rem.actorUserId,
      });
    }

    for (const alloc of allocations) {
      timeline.push({
        timestamp: alloc.allocatedAt || alloc.createdAt,
        stage: 'ALLOCATION',
        source: 'MOCK',
        reference: alloc.externalAllocationReference,
        status: alloc.status,
        description: `Simulated Phase 10.5 remittance allocation: allocated ${alloc.allocatedAmount} ${alloc.currency}`,
        details: {
          allocatedAmount: alloc.allocatedAmount,
          newlyAllocatedTotal: alloc.newlyAllocatedTotal,
          remainingAllocatableAmount: alloc.remainingAllocatableAmount,
          currency: alloc.currency,
        },
        actorUserId: alloc.actorUserId,
      });
    }

    for (const recon of reconciliations) {
      timeline.push({
        timestamp: recon.reconciledAt || recon.createdAt,
        stage: 'RECONCILIATION',
        source: 'MOCK',
        reference: recon.externalReconciliationReference,
        status: recon.status,
        description: `Simulated Phase 10.6 remittance reconciliation: ${recon.status} (remitted: ${recon.remittedTotal}, allocated: ${recon.allocatedTotal}, unallocated: ${recon.unallocatedAmount} ${recon.currency})`,
        details: {
          remittedTotal: recon.remittedTotal,
          allocatedTotal: recon.allocatedTotal,
          unallocatedAmount: recon.unallocatedAmount,
          allocationDifference: recon.allocationDifference,
          currency: recon.currency,
          discrepancyReasons: recon.discrepancyReasons,
        },
        actorUserId: recon.actorUserId,
      });
    }

    for (const cls of closures) {
      timeline.push({
        timestamp: cls.closedAt || cls.createdAt,
        stage: 'CLOSURE',
        source: 'MOCK',
        reference: cls.externalClosureReference,
        status: cls.status,
        description: `Simulated Phase 10.7 claim closure recorded via path ${cls.closurePath}: ${cls.closureReason}`,
        details: {
          closurePath: cls.closurePath,
          claimedTotal: cls.claimedTotal,
          remittedTotal: cls.remittedTotal,
          allocatedTotal: cls.allocatedTotal,
          reconciledTotal: cls.reconciledTotal,
        },
        actorUserId: cls.actorUserId,
      });
    }

    for (const log of auditLogs) {
      timeline.push({
        timestamp: log.createdAt,
        stage: 'AUDIT',
        source: 'MOCK',
        reference: (log.metadataJson as Record<string, unknown>)?.closureId?.toString() ||
          (log.metadataJson as Record<string, unknown>)?.reconciliationId?.toString() ||
          log._id.toString(),
        status: log.eventType,
        description: `System audit log event: ${log.eventType}`,
        details: log.metadataJson as Record<string, unknown>,
        actorUserId: log.actorUserId?.toString(),
      });
    }

    // Sort strictly chronologically
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      claimId: claim._id.toString(),
      branchId: claim.branchId.toString(),
      authoritativeStatus: claim.status,
      sourceFingerprint: claim.sourceFingerprint,
      claimedTotal: claim.claimedTotal,
      timeline,
    };
  }
}
