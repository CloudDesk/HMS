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
    <div className="pharmacy-dashboard">
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Pharmacy Queue Dashboard</h2>
          <p>Live prescription workload and dispensing progress</p>
          <small>Read-only operational summary</small>
        </div>
        {queue.branches.length > 0 ? (
          <label className="pharmacy-dashboard-branch">
            <span>Branch</span>
            <select
              aria-label="Pharmacy dashboard branch"
              onChange={(event) => setRequestedBranch(event.target.value)}
              value={queue.activeBranchId}
            >
              {queue.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="doc-kpi-grid pharmacy-dashboard-kpis">
        {([
          ['ph-hourglass', 'orange', 'Pending Prescriptions', queue.pendingCount, 'Awaiting dispensing', 'PENDING'],
          ['ph-check-circle', 'green', 'Dispensed Prescriptions', queue.confirmedCount, 'Successfully confirmed', 'CONFIRMED'],
          ['ph-prescription', 'blue', 'Tracked Workload', workload?.total ?? null, 'Pending and dispensed', null],
          ['ph-chart-donut', 'purple', 'Completion Rate', workload ? `${workload.completedPercent}%` : null, 'Of tracked workload', null],
        ] as const).map(([icon, tone, label, value, copy, targetStatus]) => (
          <button
            className={`doc-kpi pharmacy-dashboard-kpi${targetStatus ? ' clickable' : ''}`}
            disabled={!targetStatus}
            key={label}
            onClick={targetStatus ? () => openQueue(targetStatus) : undefined}
            type="button"
          >
            <span className={`doc-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span>
            <div className="doc-kpi-copy">
              <span>{label}</span>
              <strong>{queue.summaryLoading ? '—' : (value ?? '—')}</strong>
              <small>{queue.summaryError ? 'Summary unavailable' : targetStatus ? `${copy} · View queue` : copy}</small>
            </div>
          </button>
        ))}
      </section>

      <section className="pharmacy-dashboard-grid">
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Dispensing Progress</h3>
              <p>Pending compared with successfully dispensed prescriptions</p>
            </div>
          </div>
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
        </article>

        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Queue Attention</h3>
              <p>Current operational status</p>
            </div>
          </div>
          <div className="pharmacy-attention-card">
            <span className="doc-kpi-icon orange"><i className="ph ph-clock-countdown" aria-hidden="true" /></span>
            <div>
              <strong>{queue.pendingCount ?? '—'} prescriptions waiting</strong>
              <span>{queue.pendingCount === 0 ? 'The dispensing queue is clear.' : 'Pending prescriptions require pharmacy review.'}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="doc-card">
        <div className="doc-card-header">
          <div>
            <h3>Recent Pending Prescriptions</h3>
            <p>Latest queue details without dispensing actions</p>
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
      </section>
    </div>
  );
}
