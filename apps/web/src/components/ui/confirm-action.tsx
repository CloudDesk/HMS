import { createRoot } from 'react-dom/client';
import { ConfirmDialog } from './ConfirmDialog';

let active = false;

/** Use the shared HMS dialog for confirmations requested by event handlers. */
export function confirmAction(message: string): Promise<boolean> {
  if (active) return Promise.resolve(false);
  active = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      active = false;
      window.removeEventListener('hms:navigation', cancel);
      window.removeEventListener('popstate', cancel);
      window.removeEventListener('pagehide', cancel);
      queueMicrotask(() => { root.unmount(); host.remove(); });
      resolve(accepted);
    };
    const cancel = () => finish(false);
    window.addEventListener('hms:navigation', cancel);
    window.addEventListener('popstate', cancel);
    window.addEventListener('pagehide', cancel);
    root.render(<ConfirmDialog open layer="top" title="Confirm action" message={message}
      onCancel={cancel} onConfirm={() => finish(true)} />);
  });
}
