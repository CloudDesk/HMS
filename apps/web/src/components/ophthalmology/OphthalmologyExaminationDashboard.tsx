import type { OphthalmologyResultFeature, OphthalmologyResultWorkspace } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';

type Props = { feature: OphthalmologyResultFeature; workspace: OphthalmologyResultWorkspace };
export function OphthalmologyExaminationDashboard({ feature: f, workspace }: Props) {
  return <section className="doc-card">
    <h3>Preliminary examination</h3>
    {f.tasksQuery.isLoading ? <p role="status">Loading examination tasks…</p>
      : f.tasksQuery.isError ? <p role="alert">Examination tasks could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.tasksQuery.refetch()}>Retry</button></p>
      : <>
        {f.tasks.length === 0 ? <p>No examination performed yet. Please select an assigned station task or record preliminary findings.</p>
          : <p>Select a station task to view or record its saved findings. No measurements are assumed.</p>}
        <div className="oph-toolbar">{f.tasks.map((task) => <button type="button" className="doc-btn" key={task.id} onClick={() => workspace.setQuery('task_id', task.id)}>{task.test_name} · {task.laterality} · {task.status}</button>)}</div>
        {f.tasksQuery.data && <div className="oph-toolbar"><button type="button" className="doc-btn" disabled={f.page <= 1} onClick={() => workspace.setQuery('task_page', String(f.page - 1))}>Previous tasks</button><span>Page {f.page}</span><button type="button" className="doc-btn" disabled={f.page >= f.tasksQuery.data.meta.totalPages} onClick={() => workspace.setQuery('task_page', String(f.page + 1))}>Next tasks</button></div>}
      </>}
    <p>Open a task to upload images or reports using its attachment controls. Camera capture is unavailable without connected hardware.</p>
    <button type="button" className="doc-btn" disabled>Camera capture unavailable</button>
    {workspace.canEscalate && <button type="button" className="doc-btn danger" onClick={() => {
      const reason = window.prompt('Emergency escalation clinical reason identified during preliminary examination:');
      if (reason?.trim() && workspace.escalate) void workspace.escalate(reason.trim(), ['PRELIMINARY_EXAM_FINDING'], 'EMERGENCY');
    }}>Escalate Emergency Finding</button>}
  </section>;
}
