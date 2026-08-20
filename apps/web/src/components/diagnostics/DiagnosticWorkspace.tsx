import type { DiagnosticOrder } from '../../api/laboratory';
import { navigate } from '../../routing/navigation';

type Props = {
  module: 'laboratory' | 'imaging';
  statuses: string[];

  id: string;
  order: DiagnosticOrder | null;
  nextStatus?: string;
  isLoading: boolean;
  isError: boolean;
  isUpdating: boolean;

  permissions: {
    canVerify: boolean;
    canEdit: boolean;
    canEnter: boolean;
  };

  actions: {
    updateStatus: (status: string) => void;
  };
};

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function DiagnosticWorkspace({ module, statuses, id, order, nextStatus, isLoading, isError, isUpdating, permissions, actions }: Props) {
  const moduleName = module === 'laboratory' ? 'Laboratory' : 'Imaging';
  const resultPath = module === 'laboratory' ? 'results' : 'reports';

  if (!id) return <div className="diagnostic-empty card"><i className="ph ph-cursor-click" /><h3>Select an order</h3><p>Open an order from the work queue to begin.</p><button className="btn-primary" onClick={() => navigate(`/${module}/queue`)}>Open Work Queue</button></div>;
  if (isLoading) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading order workspace...</div>;
  if (isError || !order) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Order unavailable</h3><p>The order could not be loaded or is outside your branch access.</p><button className="btn-secondary" onClick={() => navigate(`/${module}/queue`)}>Return to Queue</button></div>;

  const requiresEntry = order.status === 'IN_PROGRESS';
  const permissionToUpdateStatus = nextStatus === 'VERIFIED' ? permissions.canVerify : permissions.canEdit;

  return <div className={`diagnostic-page ${module}`}>
    <section className="diagnostic-order-header card">
      <div><span className="eyebrow">{moduleName} order</span><h2>{order.patient_name}</h2><p>{order.patient_number} — Ordered by {order.doctor_name}</p></div>
      <div className="diagnostic-header-facts"><div><span>Priority</span><strong>{order.priority}</strong></div><div><span>Status</span><strong>{label(order.status)}</strong></div><div><span>Visit</span><strong>{order.visit_id.slice(-8).toUpperCase()}</strong></div></div>
    </section>
    <div className="diagnostic-workflow" aria-label="Order workflow">{statuses.map((status, index) => {
      const currentIndex = statuses.indexOf(order.status);
      return <div className={`diagnostic-step ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'current' : ''}`} key={status}><i className={`ph ${index < currentIndex ? 'ph-check' : 'ph-circle'}`} /><span>{label(status)}</span></div>;
    })}</div>
    <div className="diagnostic-workspace-grid">
      <section className="card diagnostic-panel"><div className="form-section-title">Ordered Services</div><div className="diagnostic-order-list">{order.items.map((item) => <div className="diagnostic-service" key={item.id}><div><strong>{item.service_name}</strong><span>{item.category}</span></div><i className="ph ph-check-circle" /></div>)}</div>
        {order.clinical_notes ? <div className="diagnostic-note"><strong>Clinical notes</strong><p>{order.clinical_notes}</p></div> : null}
        {order.instructions ? <div className="diagnostic-note"><strong>Instructions</strong><p>{order.instructions}</p></div> : null}
      </section>
      <aside className="card diagnostic-side"><h3>Workflow Actions</h3>
        {requiresEntry ? <button className="btn-primary" disabled={!permissions.canEnter} onClick={() => navigate(`/${module}/${resultPath}?id=${id}`)}><i className="ph ph-file-plus" /> Enter {module === 'laboratory' ? 'Results' : 'Report'}</button> : null}
        {nextStatus ? <button className="btn-primary" disabled={isUpdating || !permissionToUpdateStatus} onClick={() => actions.updateStatus(nextStatus)}>{isUpdating ? 'Updating...' : nextStatus === 'VERIFIED' ? `Verify ${module === 'laboratory' ? 'Results' : 'Report'}` : `Mark ${label(nextStatus)}`}</button> : null}
        {['RESULT_ENTERED', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.status) ? <button className="btn-secondary" onClick={() => navigate(`/${module}/${resultPath}?id=${id}`)}>View {module === 'laboratory' ? 'Results' : 'Report'}</button> : null}
        {order.status === 'COMPLETED' ? <div className="diagnostic-readonly"><i className="ph ph-lock" /> Completed orders are read-only.</div> : null}
        <button className="btn-secondary" onClick={() => navigate(`/${module}/queue`)}>Back to Queue</button>
      </aside>
    </div>
  </div>;
}
