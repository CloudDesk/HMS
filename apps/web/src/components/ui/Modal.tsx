import type { PropsWithChildren, ReactNode } from 'react';

type ModalProps = PropsWithChildren<{
  title: string;
  open: boolean;
  footer?: ReactNode;
  onClose: () => void;
}>;

export function Modal({ title, open, footer, onClose, children }: ModalProps) {
  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} aria-hidden={!open}>
      <section aria-labelledby="foundation-modal-title" aria-modal="true" className="modal-box" role="dialog">
        <header className="modal-header">
          <h3 id="foundation-modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close modal">
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
