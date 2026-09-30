import { useAdministrationDashboardFeature } from '../hooks/admin/useAdministrationDashboardFeature';
import type { DashboardMetric } from '../api/administration-dashboard';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/ui/KpiCard';

import { formatRegionalDateTime } from '../utils/localization-utils';
import { useTimezone } from '../api/useSettings';

function MetricBars({ items }: { items: DashboardMetric[] }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);

  if (!items.length) {
    return <EmptyState icon="ph-chart-bar" title="No statistics yet" message="Statistics appear as administration records are added." />;
  }

  return (
    <div className="admin-metric-list">
      {items.map((item) => (
        <div className="admin-metric" key={item.label}>
          <div><span>{item.label}</span><strong>{item.value}</strong></div>
          <span className="admin-metric__track"><span style={{ width: `${(item.value / maximum) * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

export function AdministrationDashboardPage() {
  const timezone = useTimezone();
  const formatDate = (value: string) => formatRegionalDateTime(value, timezone);
  const { data, status, actions } = useAdministrationDashboardFeature();
  const { dashboard, kpis } = data;
  const { isFetching: loading, loadError: error } = status;
  const { refetch } = actions;

  if (loading) {
    return <div className="admin-dashboard-state" role="status"><span className="loading-spinner" /> Loading administration dashboard...</div>;
  }

  if (error || !dashboard) {
    return (
      <div className="admin-dashboard-state admin-dashboard-state--error" role="alert">
        <i className="ph ph-warning-circle" aria-hidden="true" />
        <strong>Administration dashboard unavailable</strong>
        <span>{error}</span>
        <button className="btn-secondary" onClick={() => void refetch()} type="button"><i className="ph ph-arrows-clockwise" aria-hidden="true" /> Try again</button>
      </div>
    );
  }

  return (
    <div className="hms-dash-wrapper">
      <div className="hms-dash-header">
        <div className="hms-dash-title">
          <h2>Administration Dashboard</h2>
          <p>Operational system metrics, account status, and audit activity</p>
        </div>
        <div className="hms-dash-actions">
          <button className="hms-dash-btn secondary" onClick={() => void refetch()} type="button">
            <i className="ph ph-arrows-clockwise" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="hms-dash-kpi-grid">
        {kpis.map((item) => (
          <div className="hms-dash-kpi-card" key={item.label}>
            <div className="hms-kpi-top">
              <span className={`hms-kpi-icon ${item.tone}`}>
                <i className={`ph ${item.icon}`} aria-hidden="true" />
              </span>
            </div>
            <div>
              <div className="hms-kpi-label">{item.label}</div>
              <div className="hms-kpi-value">{String(item.value)}</div>
              <div className="hms-kpi-sub">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hms-dash-grid three-col-equal">
        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Users by Status</h3>
              <p className="hms-card-desc">Current account availability</p>
            </div>
          </div>
          <div className="hms-card-body">
            <MetricBars items={dashboard.usersByStatus} />
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Users by Role</h3>
              <p className="hms-card-desc">Active role assignments</p>
            </div>
          </div>
          <div className="hms-card-body">
            <MetricBars items={dashboard.usersByRole} />
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Services by Department</h3>
              <p className="hms-card-desc">Catalogue distribution</p>
            </div>
          </div>
          <div className="hms-card-body">
            <MetricBars items={dashboard.servicesByDepartment} />
          </div>
        </div>
      </div>

      <div className="hms-dash-card">
        <div className="hms-card-header">
          <div className="hms-card-header-left">
            <h3 className="hms-card-title">Recent Audit Activity</h3>
            <p className="hms-card-desc">Snapshot updated {formatDate(dashboard.generatedAt)}</p>
          </div>
        </div>
        <div className="hms-card-body">
          {dashboard.recentActivity.length ? (
            <div className="admin-activity-list">
              {dashboard.recentActivity.map((activity) => (
                <article key={activity.id}>
                  <span className="admin-activity-icon"><i className="ph ph-clock-counter-clockwise" aria-hidden="true" /></span>
                  <div><strong>{activity.actorName}</strong><span>{activity.eventType} in {activity.module}</span></div>
                  <time dateTime={activity.createdAt}>{formatDate(activity.createdAt)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="hms-dash-empty">
              <i className="ph ph-clock-counter-clockwise" />
              <div className="hms-dash-empty-title">No recent activity</div>
              <div className="hms-dash-empty-desc">Audited administration actions will appear here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
