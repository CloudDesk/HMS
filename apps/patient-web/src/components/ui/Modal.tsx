import { useEffect, useId, useRef, type MouseEvent, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
export function Modal({ title, open, icon, onClose, children, size = 'default' }: PropsWithChildren<{ title: string; open: boolean; icon?: string; onClose: () => void; size?: 'default' | 'large' }>) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  return createPortal(<div className="modal-overlay patient-modal-overlay open" onMouseDown={closeFromBackdrop}><section aria-labelledby={titleId} aria-modal="true" className={`modal-panel patient-modal-panel modal-panel--${size}`} role="dialog"><header className="modal-header patient-modal-header"><div>{icon ? <span><i className={`ph ${icon}`} /></span> : null}<h2 id={titleId}>{title}</h2></div><button aria-label="Close dialog" onClick={onClose} ref={closeButtonRef} type="button"><i className="ph ph-x" /></button></header><div className="modal-body patient-modal-body">{children}</div></section></div>, document.body);
}
