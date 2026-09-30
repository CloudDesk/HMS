import { useMemo, useState } from 'react';
import { usePharmacyDispensingFeature } from '../hooks/pharmacy/usePharmacyDispensingFeature';
import { navigate } from '../routing/navigation';
import { dispensingSourceLabel } from '../utils/pharmacy-dispensing';

const formatSubmittedAt = (value: string | null) => value
  ? new Intl.DateTimeFormat('en', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  : 'Submission time unavailable';

export function PharmacyQueueDashboardPage() {
  const [requestedBranch, setRequestedBranch] = useState('');
  const queue = usePharmacyDispensingFeature({
    requestedBranch,
    search: '',
    status: 'PENDING',
    page: 1,
    limit: 5,
  });

  const workload = useMemo(() => {
    if (queue.pendingCount === null || queue.confirmedCount === null) return null;
    const total = queue.pendingCount + queue.confirmedCount;
    return {
      total,
      pendingPercent: total > 0 ? Math.round((queue.pendingCount / total) * 100) : 0,
      completedPercent: total > 0 ? Math.round((queue.confirmedCount / total) * 100) : 0,
    };
  }, [queue.confirmedCount, queue.pendingCount]);

  const openQueue = (status: 'PENDING' | 'CONFIRMED') => {
    const params = new URLSearchParams({ status });
    if (queue.activeBranchId) params.set('branch', queue.activeBranchId);
    navigate('/dashboard?tab=pharmacy', { replace: true });
    navigate(`/pharmacy/queue?${params.toString()}`);
  };

  const openPrescription = (prescriptionId: string) => {
    const params = new URLSearchParams({ status: 'PENDING', prescription: prescriptionId });
    if (queue.activeBranchId) params.set('branch', queue.activeBranchId);
    navigate('/dashboard?tab=pharmacy', { replace: true });
    navigate(`/pharmacy/queue?${params.toString()}`);
  };

  return (
    <div className="hms-dash-wrapper">
      <div className="hms-dash-header">
        <div className="hms-dash-title">
          <h2>Pharmacy Queue Dashboard</h2>
          <p>Live prescription workload and dispensing progress</p>
        </div>
        <div className="hms-dash-actions">
          {queue.branches.length > 0 ? (
            <select
              aria-label="Pharmacy dashboard branch"
              className="hms-dash-select"
              onChange={(event) => setRequestedBranch(event.target.value)}
              value={queue.activeBranchId}
            >
              {queue.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="hms-dash-kpi-grid">
        {([
          ['ph-hourglass', 'orange', 'Pending Prescriptions', queue.pendingCount, 'Awaiting dispensing', 'PENDING'],
          ['ph-check-circle', 'green', 'Dispensed Prescriptions', queue.confirmedCount, 'Successfully confirmed', 'CONFIRMED'],
          ['ph-prescription', 'blue', 'Tracked Workload', workload?.total ?? null, 'Pending and dispensed', null],
          ['ph-chart-donut', 'purple', 'Completion Rate', workload ? `${workload.completedPercent}%` : null, 'Of tracked workload', null],
        ] as const).map(([icon, tone, label, value, copy, targetStatus]) => (
          <button
            className={`hms-dash-kpi-card${targetStatus ? ' clickable' : ''}`}
            disabled={!targetStatus}
            key={label}
            onClick={targetStatus ? () => openQueue(targetStatus) : undefined}
            type="button"
          >
            <div className="hms-kpi-top">
              <span className={`hms-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span>
              {targetStatus ? <i className="ph ph-arrow-up-right" style={{ color: '#94a3b8', fontSize: '14px' }} /> : null}
            </div>
            <div>
              <div className="hms-kpi-label">{label}</div>
              <div className="hms-kpi-value">{queue.summaryLoading ? '—' : (value ?? '—')}</div>
              <div className="hms-kpi-sub">{queue.summaryError ? 'Summary unavailable' : targetStatus ? `${copy} · View queue` : copy}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="hms-dash-grid two-col-7-5">
        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Dispensing Progress</h3>
              <p className="hms-card-desc">Pending compared with successfully dispensed prescriptions</p>
            </div>
          </div>
          <div className="hms-card-body">
            {queue.summaryLoading ? (
              <div className="um-state-cell">Loading dispensing summary...</div>
            ) : queue.summaryError || !workload ? (
              <div className="um-state-cell">Dispensing progress is currently unavailable.</div>
            ) : (
              <div className="pharmacy-progress-content">
                <div className="pharmacy-progress-track" aria-label={`${workload.pendingPercent}% pending and ${workload.completedPercent}% dispensed`}>
                  <span className="pending" style={{ width: `${workload.pendingPercent}%` }} />
                  <span className="completed" style={{ width: `${workload.completedPercent}%` }} />
                </div>
                <div className="pharmacy-progress-legend">
                  <div><span className="legend-dot pending" /><strong>{queue.pendingCount}</strong><small>Pending ({workload.pendingPercent}%)</small></div>
                  <div><span className="legend-dot completed" /><strong>{queue.confirmedCount}</strong><small>Dispensed ({workload.completedPercent}%)</small></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Queue Attention</h3>
              <p className="hms-card-desc">Current operational status</p>
            </div>
          </div>
          <div className="hms-card-body">
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon orange"><i className="ph ph-clock-countdown" aria-hidden="true" /></span>
                <div className="hms-attention-text">
                  <strong>{queue.pendingCount ?? '—'} prescriptions waiting</strong>
                  <small>{queue.pendingCount === 0 ? 'The dispensing queue is clear.' : 'Pending prescriptions require pharmacy review.'}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hms-dash-card">
        <div className="hms-card-header">
          <div className="hms-card-header-left">
            <h3 className="hms-card-title">Recent Pending Prescriptions</h3>
            <p className="hms-card-desc">Latest queue details without dispensing actions</p>
          </div>
        </div>
        {queue.listLoading ? (
          <div className="um-state-cell">Loading recent prescriptions...</div>
        ) : queue.listError ? (
          <div className="um-state-cell">{queue.listError}</div>
        ) : queue.dispensings.length === 0 ? (
          <div className="um-state-cell">No pending prescriptions for this branch.</div>
        ) : (
          <div className="pharmacy-recent-grid">
            {queue.dispensings.map((dispensing) => (
              <button
                className="pharmacy-recent-card"
                key={dispensing.prescription_id}
                onClick={() => openPrescription(dispensing.prescription_id)}
                type="button"
              >
                <span className="doc-avatar">{dispensing.patient_name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{dispensing.patient_name}</strong>
                  <span>{dispensing.patient_number}</span>
                  <small>{dispensingSourceLabel(dispensing.source_type)} · {dispensing.doctor_name}</small>
                </div>
                <div className="pharmacy-recent-meta">
                  <strong>{dispensing.items.length} {dispensing.items.length === 1 ? 'medicine' : 'medicines'}</strong>
                  <span>{formatSubmittedAt(dispensing.submitted_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
