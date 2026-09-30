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
    <div className="hms-dash-wrapper">
      <div className="hms-dash-header">
        <div className="hms-dash-title">
          <h2>Laboratory Dashboard</h2>
          <p>Live laboratory workload, sample progress, and result verification</p>
        </div>
        <div className="hms-dash-actions">
          {feature.branches.length > 1 ? (
            <select
              aria-label="Laboratory dashboard branch"
              className="hms-dash-select"
              onChange={(event) => feature.updateFilters({ branch_id: event.target.value, page: 1 })}
              value={feature.filters.selectedBranch}
            >
              <option value="">All accessible branches</option>
              {feature.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="hms-dash-kpi-grid">
        <button className="hms-dash-kpi-card clickable" onClick={() => openQueue()} type="button">
          <div className="hms-kpi-top">
            <span className="hms-kpi-icon blue"><i className="ph ph-flask" aria-hidden="true" /></span>
            <i className="ph ph-arrow-up-right" style={{ color: '#94a3b8', fontSize: '14px' }} />
          </div>
          <div>
            <div className="hms-kpi-label">Total Orders</div>
            <div className="hms-kpi-value">{feature.isSummaryLoading ? '—' : summary?.total ?? '—'}</div>
            <div className="hms-kpi-sub">Within authorized scope · View queue</div>
          </div>
        </button>
        {workflow.map((item) => (
          <button className="hms-dash-kpi-card clickable" key={item.status} onClick={() => openQueue(item.status)} type="button">
            <div className="hms-kpi-top">
              <span className={`hms-kpi-icon ${item.tone}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span>
              <i className="ph ph-arrow-up-right" style={{ color: '#94a3b8', fontSize: '14px' }} />
            </div>
            <div>
              <div className="hms-kpi-label">{item.label}</div>
              <div className="hms-kpi-value">{feature.isSummaryLoading ? '—' : count(item.status) ?? '—'}</div>
              <div className="hms-kpi-sub">{item.note} · View queue</div>
            </div>
          </button>
        ))}
      </div>

      <div className="hms-dash-grid two-col-7-5">
        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Laboratory Workflow</h3>
              <p className="hms-card-desc">Orders distributed across the current processing lifecycle</p>
            </div>
          </div>
          <div className="hms-card-body">
            {feature.isSummaryLoading ? (
              <div className="um-state-cell">Loading laboratory summary...</div>
            ) : !summary ? (
              <div className="um-state-cell">Laboratory summary is currently unavailable.</div>
            ) : (
              <div className="laboratory-workflow-steps">
                {workflow.map((item) => {
                  const value = count(item.status) ?? 0;
                  const percent = summary.total > 0 ? Math.round((value / summary.total) * 100) : 0;
                  return (
                    <button className="laboratory-workflow-step" key={item.status} onClick={() => openQueue(item.status)} type="button">
                      <span className={`hms-kpi-icon ${item.tone}`}><i className={`ph ${item.icon}`} aria-hidden="true" /></span>
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
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Workload Attention</h3>
              <p className="hms-card-desc">Current operational focus</p>
            </div>
          </div>
          <div className="hms-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon orange"><i className="ph ph-clock-countdown" aria-hidden="true" /></span>
                <div className="hms-attention-text">
                  <strong>{summary ? activeWork : '—'} active laboratory orders</strong>
                  <small>Orders undergoing sample and test processing</small>
                </div>
              </div>
            </div>
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #9333ea' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon purple"><i className="ph ph-file-search" aria-hidden="true" /></span>
                <div className="hms-attention-text">
                  <strong>{count('RESULT_ENTERED') ?? '—'} awaiting verification</strong>
                  <small>Results entered and ready for quality review</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
