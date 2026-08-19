import { useAdministrationDashboardFeature } from '../hooks/admin/useAdministrationDashboardFeature';
import type { DashboardMetric } from '../api/administration-dashboard';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/ui/KpiCard';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

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
        <button className="btn-secondary" onClick={() => void refetch()} type="button">Try again</button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="um-kpi-row admin-dashboard-kpis">
        {kpis.map((item) => <KpiCard detail={item.detail} icon={item.icon} key={item.label} label={item.label} tone={item.tone} value={String(item.value)} />)}
      </div>

      <div className="admin-dashboard-grid">
        <Card title="Users by Status" description="Current account availability"><MetricBars items={dashboard.usersByStatus} /></Card>
        <Card title="Users by Role" description="Active role assignments"><MetricBars items={dashboard.usersByRole} /></Card>
        <Card title="Services by Department" description="Catalogue distribution"><MetricBars items={dashboard.servicesByDepartment} /></Card>
      </div>

      <div className="admin-dashboard-lower admin-dashboard-lower--single">
        <Card className="admin-activity-card" title="Recent Audit Activity" description={`Snapshot updated ${formatDate(dashboard.generatedAt)}`}>
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
          ) : <EmptyState icon="ph-clock-counter-clockwise" title="No recent activity" message="Audited administration actions will appear here." />}
        </Card>

      </div>
    </div>
  );
}
