import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DiagnosticOrder } from '../../api/laboratory';
import { ApiError } from '../../api/api-error';
import { useAuth } from '../../auth/useAuth';
import { navigate, useAppLocation } from '../../routing/navigation';

type Props = {
  module: 'laboratory' | 'imaging';
  statuses: string[];
  getOrder: (id: string) => Promise<DiagnosticOrder>;
  updateStatus: (id: string, status: never) => Promise<DiagnosticOrder>;
};
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function DiagnosticWorkspace({ module, statuses, getOrder, updateStatus }: Props) {
  const { user } = useAuth();
  const location = useAppLocation();
  const queryClient = useQueryClient();
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const moduleName = module === 'laboratory' ? 'Laboratory' : 'Imaging';
  const resultPath = module === 'laboratory' ? 'results' : 'reports';
  const orderQuery = useQuery({ queryKey: [module, 'order', id], queryFn: () => getOrder(id), enabled: Boolean(id) });
  const order = orderQuery.data;
  const nextStatus: Record<string, string> = module === 'laboratory'
    ? { SUBMITTED: 'RECEIVED', RECEIVED: 'SAMPLE_COLLECTED', SAMPLE_COLLECTED: 'IN_PROGRESS', RESULT_ENTERED: 'VERIFIED', VERIFIED: 'COMPLETED' }
    : { SUBMITTED: 'RECEIVED', RECEIVED: 'IN_PROGRESS', REPORT_ENTERED: 'VERIFIED', VERIFIED: 'COMPLETED' };
  const next = order ? nextStatus[order.status] : undefined;
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const hasAction = (action: string) => superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === moduleName.toLowerCase() && permission.screen.toLowerCase() === 'orders' && permission.action.toLowerCase() === action.toLowerCase(),
  ));
  const statusMutation = useMutation({
    mutationFn: (status: string) => updateStatus(id, status as never),
    onSuccess: async (updated) => {
      toast.success(`${moduleName} order moved to ${label(updated.status)}.`);
      await queryClient.invalidateQueries({ queryKey: [module] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Unable to update order status.'),
  });

  if (!id) return <div className="diagnostic-empty card"><i className="ph ph-cursor-click" /><h3>Select an order</h3><p>Open an order from the work queue to begin.</p><button className="btn-primary" onClick={() => navigate(`/${module}/queue`)}>Open Work Queue</button></div>;
  if (orderQuery.isLoading) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading order workspace...</div>;
  if (orderQuery.isError || !order) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Order unavailable</h3><p>The order could not be loaded or is outside your branch access.</p><button className="btn-secondary" onClick={() => navigate(`/${module}/queue`)}>Return to Queue</button></div>;

  const requiresEntry = order.status === 'IN_PROGRESS';
  const permission = next === 'VERIFIED' ? (module === 'laboratory' ? 'VerifyResult' : 'VerifyReport') : 'Edit';
  return <div className={`diagnostic-page ${module}`}>
    <section className="diagnostic-order-header card">
      <div><span className="eyebrow">{moduleName} order</span><h2>{order.patient_name}</h2><p>{order.patient_number} · Ordered by {order.doctor_name}</p></div>
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
        {requiresEntry ? <button className="btn-primary" disabled={!hasAction(module === 'laboratory' ? 'EnterResult' : 'EnterReport')} onClick={() => navigate(`/${module}/${resultPath}?id=${id}`)}><i className="ph ph-file-plus" /> Enter {module === 'laboratory' ? 'Results' : 'Report'}</button> : null}
        {next ? <button className="btn-primary" disabled={statusMutation.isPending || !hasAction(permission)} onClick={() => statusMutation.mutate(next)}>{statusMutation.isPending ? 'Updating...' : next === 'VERIFIED' ? `Verify ${module === 'laboratory' ? 'Results' : 'Report'}` : `Mark ${label(next)}`}</button> : null}
        {['RESULT_ENTERED', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.status) ? <button className="btn-secondary" onClick={() => navigate(`/${module}/${resultPath}?id=${id}`)}>View {module === 'laboratory' ? 'Results' : 'Report'}</button> : null}
        {order.status === 'COMPLETED' ? <div className="diagnostic-readonly"><i className="ph ph-lock" /> Completed orders are read-only.</div> : null}
        <button className="btn-secondary" onClick={() => navigate(`/${module}/queue`)}>Back to Queue</button>
      </aside>
    </div>
  </div>;
}
