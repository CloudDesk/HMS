import { AppError } from '../../shared/errors/app-error.js';
import type { AdministrationDashboardRepository } from './administration-dashboard.repository.js';
import type { PhaseTwoReportRepository } from './phase-two-report.repository.js';
import type { PhaseTwoReportQuery } from './phase-two-report.types.js';

export class AdministrationDashboardService {
  constructor(private readonly repository: AdministrationDashboardRepository, private readonly phaseTwoReports: PhaseTwoReportRepository) {}

  async get() {
    const snapshot = await this.repository.getSnapshot();
    if (!snapshot) {
      throw new AppError('Administration dashboard snapshot is not ready', 503, 'DASHBOARD_NOT_READY');
    }
    return snapshot;
  }

  refresh() {
    return this.repository.refreshSnapshot();
  }

  async getExecutiveOverview(userId: string, branchId?: string, financialAccess = true) {
    return this.repository.getExecutiveOverview(userId, branchId, financialAccess);
  }

  async getPhaseTwoReports(query: PhaseTwoReportQuery, actor: string, financialAccess: boolean) {
    await this.phaseTwoReports.authorizeBranch(actor, query.branch_id);
    return this.phaseTwoReports.bundle(query, financialAccess);
  }
}
