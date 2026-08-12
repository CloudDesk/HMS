import { AppError } from '../../shared/errors/app-error.js';
import type { AdministrationDashboardRepository } from './administration-dashboard.repository.js';

export class AdministrationDashboardService {
  constructor(private readonly repository: AdministrationDashboardRepository) {}

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
}
