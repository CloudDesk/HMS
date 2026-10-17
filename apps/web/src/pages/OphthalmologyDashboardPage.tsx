import type { OphthalmologyDashboardSnapshot } from '../api/ophthalmology-dashboard';
import { useTimezone } from '../api/useSettings';
import { useOphthalmologyDashboardFeature } from '../hooks/ophthalmology/useOphthalmologyDashboardFeature';
import { formatRegionalDateTime } from '../utils/localization-utils';
import '../styles/ophthalmology.css';

const metrics: Array<{ key: keyof OphthalmologyDashboardSnapshot['metrics']; label: string; detail: string; icon: string; tone: string }> = [
  { key: 'waiting', label: 'Waiting', detail: 'Ordered, waiting or called tasks', icon: 'ph-hourglass', tone: 'orange' },
  { key: 'in_progress', label: 'In progress', detail: 'In-progress and draft results', icon: 'ph-activity', tone: 'cyan' },
  { key: 'pending_review', label: 'Pending review', detail: 'Explicitly submitted for review', icon: 'ph-magnifying-glass', tone: 'purple' },
  { key: 'reviewed', label: 'Reviewed', detail: 'Doctor-reviewed test tasks', icon: 'ph-check-circle', tone: 'green' },
  { key: 'repeat_required', label: 'Repeat required', detail: 'Tasks requiring repeat acquisition', icon: 'ph-arrow-counter-clockwise', tone: 'blue' },
  { key: 'unable', label: 'Unable to perform', detail: 'Recorded unable-to-perform tasks', icon: 'ph-warning-circle', tone: 'red' },
];

export function OphthalmologyDashboardPage() {
  const feature = useOphthalmologyDashboardFeature();
  const timezone = useTimezone();
  if (!feature.canView) return <section className="doc-card" role="alert">Ophthalmology Reports View permission is required.</section>;
  return <div className="opd-page oph-workspace">
    <section className="opd-page-header">
      <div className="opd-page-title"><h2>Ophthalmology operations dashboard</h2><p>Branch-wide test workflow snapshot</p></div>
      {feature.canRefresh && <button className="doc-btn primary" type="button" disabled={!feature.query || feature.refreshMutation.isPending} onClick={() => void feature.refresh()}><i className="ph ph-arrows-clockwise" aria-hidden="true" />{feature.refreshMutation.isPending ? 'Refreshing snapshot…' : feature.snapshot ? 'Refresh snapshot' : 'Generate snapshot'}</button>}
    </section>
    <section className="doc-card oph-dashboard-controls">
      <label className="doc-field">Branch<span className="required-asterisk">*</span><select value={feature.branchId} onChange={(event) => feature.setBranch(event.target.value)}><option value="">Select branch</option>{feature.branchId && !feature.branches.some((branch) => branch.id === feature.branchId) && <option value={feature.branchId}>Selected branch</option>}{feature.branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
      {feature.canReadBranches && feature.branchesQuery.isLoading && <p role="status">Loading branches…</p>}
      {feature.canReadBranches && feature.branchesQuery.isError && <p role="alert">Branch lookup unavailable. <button className="doc-btn" type="button" onClick={() => void feature.branchesQuery.refetch()}>Retry branches</button></p>}
      <p>Counts include all Ophthalmology test tasks currently stored for the selected branch. They are not date-filtered or live-streamed.</p>
    </section>
    {feature.invalid && <section className="doc-card" role="alert">{feature.invalid}</section>}
    {feature.query && feature.snapshotQuery.isLoading && <section className="doc-card" role="status"><span className="loading-spinner" /> Loading Ophthalmology dashboard snapshot…</section>}
    {feature.error && !feature.snapshot && <section className="doc-card form-error-banner" role="alert"><strong>Dashboard snapshot unavailable.</strong> {feature.error} <button className="doc-btn" type="button" onClick={() => void feature.snapshotQuery.refetch()}>Retry read</button>{feature.canRefresh && <button className="doc-btn" type="button" disabled={feature.refreshMutation.isPending} onClick={() => void feature.refresh()}>Generate current snapshot</button>}</section>}
    {feature.error && feature.snapshot && <section className="doc-card form-error-banner" role="alert">The latest refresh failed. The displayed snapshot may be stale. <button className="doc-btn" type="button" onClick={() => void feature.snapshotQuery.refetch()}>Retry read</button></section>}
    {feature.snapshot && <>
      <section className="doc-card oph-dashboard-meta"><div><strong>Snapshot generated</strong><time dateTime={feature.snapshot.generatedAt}>{formatRegionalDateTime(feature.snapshot.generatedAt, timezone)}</time></div><div><strong>Branch task-state total</strong><span>{feature.total}</span></div></section>
      <section className="doc-kpi-grid opd-kpi-grid" aria-label="Ophthalmology task metrics">{metrics.map((metric) => <article className="doc-kpi" key={metric.key}><span className={`doc-kpi-icon ${metric.tone}`}><i className={`ph ${metric.icon}`} aria-hidden="true" /></span><div className="doc-kpi-copy"><span>{metric.label}</span><strong>{feature.snapshot?.metrics[metric.key]}</strong><small>{metric.detail}</small></div></article>)}</section>
      {feature.total === 0 && <section className="doc-card oph-dashboard-empty"><i className="ph ph-chart-bar" aria-hidden="true" /><div><h3>No task activity in this snapshot</h3><p>The server returned zero tasks across all six dashboard states for this branch.</p></div></section>}
    </>}
    {!feature.snapshot && !feature.snapshotQuery.isLoading && !feature.error && feature.query && <section className="doc-card" role="status">No dashboard snapshot was returned.</section>}
    {!feature.canRefresh && feature.query && <section className="doc-card"><p>Ophthalmology Reports Export permission is required to generate or refresh the server snapshot. Dashboard viewing remains available independently.</p></section>}
  </div>;
}
