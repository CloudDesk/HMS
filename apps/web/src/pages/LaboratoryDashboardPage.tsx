import type { LaboratoryStatus } from '../api/laboratory';
import { useLaboratoryQueueFeature } from '../hooks/laboratory/useLaboratoryQueueFeature';
import { navigate } from '../routing/navigation';

const workflow: Array<{ status: LaboratoryStatus; label: string; icon: string; tone: string; note: string }> = [
  { status: 'SUBMITTED', label: 'New Orders', icon: 'ph-tray', tone: 'blue', note: 'Awaiting receipt' },
  { status: 'RECEIVED', label: 'Received', icon: 'ph-check-circle', tone: 'cyan', note: 'Awaiting collection' },
  { status: 'SAMPLE_COLLECTED', label: 'Samples Collected', icon: 'ph-test-tube', tone: 'purple', note: 'Ready for processing' },
  { status: 'IN_PROGRESS', label: 'In Progress', icon: 'ph-spinner-gap', tone: 'orange', note: 'Tests underway' },
  { status: 'RESULT_ENTERED', label: 'Results Entered', icon: 'ph-file-text', tone: 'green', note: 'Awaiting verification' },
  { status: 'VERIFIED', label: 'Verified', icon: 'ph-seal-check', tone: 'green', note: 'Quality review complete' },
  { status: 'COMPLETED', label: 'Completed', icon: 'ph-check-square', tone: 'green', note: 'Laboratory work closed' },
];

export function LaboratoryDashboardPage() {
  const feature = useLaboratoryQueueFeature({ embedded: true });
  const summary = feature.summary;
  const count = (status: LaboratoryStatus) => summary?.by_status[status] ?? null;

  const openQueue = (status?: LaboratoryStatus) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (feature.filters.selectedBranch) params.set('branch_id', feature.filters.selectedBranch);
    navigate('/dashboard?tab=laboratory', { replace: true });
    navigate(`/laboratory/queue${params.size ? `?${params.toString()}` : ''}`);
  };

  const activeWork = ['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED']
    .reduce((total, status) => total + (summary?.by_status[status] ?? 0), 0);

  return (
    <div className="pharmacy-dashboard diagnostic-dashboard">
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Laboratory Dashboard</h2>
          <p>Live laboratory workload, sample progress, and result verification</p>
          <small>Read-only operational summary</small>
        </div>
        {feature.branches.length > 1 ? (
          <label className="pharmacy-dashboard-branch">
            <span>Branch</span>
            <select aria-label="Laboratory dashboard branch" onChange={(event) => feature.updateFilters({ branch_id: event.target.value, page: 1 })} value={feature.filters.selectedBranch}>
              <option value="">All accessible branches</option>
              {feature.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
            </select>
          </label>
        ) : null}
      </section>

      <section className="doc-kpi-grid diagnostic-dashboard-kpis">
        <button className="doc-kpi pharmacy-dashboard-kpi clickable" onClick={() => openQueue()} type="button">
          <span className="doc-kpi-icon blue"><i className="ph ph-flask" aria-hidden="true" /></span>
          <div className="doc-kpi-copy"><span>Total Orders</span><strong>{feature.isSummaryLoading ? '—' : summary?.total ?? '—'}</strong><small>Within authorized scope · View queue</small></div>
        </button>
        {workflow.map((item) => (
          <button className="doc-kpi pharmacy-dashboard-kpi clickable" key={item.status} onClick={() => openQueue(item.status)} type="button">
            <span className={`doc-kpi-icon ${item.tone}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span>
            <div className="doc-kpi-copy"><span>{item.label}</span><strong>{feature.isSummaryLoading ? '—' : count(item.status) ?? '—'}</strong><small>{item.note} · View queue</small></div>
          </button>
        ))}
      </section>

      <section className="pharmacy-dashboard-grid">
        <article className="doc-card">
          <div className="doc-card-header"><div><h3>Laboratory Workflow</h3><p>Orders distributed across the current processing lifecycle</p></div></div>
          {feature.isSummaryLoading ? <div className="um-state-cell">Loading laboratory summary...</div> : !summary ? <div className="um-state-cell">Laboratory summary is currently unavailable.</div> : (
            <div className="laboratory-workflow-steps">
              {workflow.map((item) => {
                const value = count(item.status) ?? 0;
                const percent = summary.total > 0 ? Math.round((value / summary.total) * 100) : 0;
                return (
                  <button className="laboratory-workflow-step" key={item.status} onClick={() => openQueue(item.status)} type="button">
                    <span className={`doc-kpi-icon ${item.tone}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span>
                    <div className="laboratory-workflow-step-copy">
                      <span>{item.label}</span>
                      <strong>{value}</strong>
                      <small>{item.note}</small>
                    </div>
                    <div className="laboratory-workflow-step-footer">
                      <div className="diagnostic-workflow-track"><span style={{ width: `${percent}%` }} /></div>
                      <small>{percent}%</small>
                    </div>
                    <i className="ph ph-arrow-right laboratory-workflow-arrow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <article className="doc-card">
          <div className="doc-card-header"><div><h3>Workload Attention</h3><p>Current operational focus</p></div></div>
          <div className="diagnostic-attention">
            <span className="doc-kpi-icon orange"><i className="ph ph-clock-countdown" aria-hidden="true" /></span>
            <div><strong>{summary ? activeWork : '—'} active laboratory orders</strong><span>Orders not yet completed in the laboratory workflow.</span></div>
          </div>
          <div className="diagnostic-attention">
            <span className="doc-kpi-icon purple"><i className="ph ph-file-search" aria-hidden="true" /></span>
            <div><strong>{count('RESULT_ENTERED') ?? '—'} awaiting verification</strong><span>Results entered and pending verification.</span></div>
          </div>
        </article>
      </section>
    </div>
  );
}
