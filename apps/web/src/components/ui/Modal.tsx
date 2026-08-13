import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = PropsWithChildren<{
  title: string;
  open: boolean;
  icon?: string;
  footer?: ReactNode;
  size?: 'default' | 'large';
  onClose: () => void;
}>;

export function Modal({ title, open, icon, footer, size = 'default', onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={`modal-overlay${open ? ' open' : ''}`} aria-hidden={!open}>
      <section
        aria-labelledby="foundation-modal-title"
        aria-modal="true"
        className={`modal-box${size === 'large' ? ' large' : ''}`}
        role="dialog"
      >
        <header className="modal-header">
          <h3 className="modal-title" id="foundation-modal-title">
            {icon ? <i className={`ph ${icon}`} aria-hidden="true" /> : null}
            {title}
          </h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close modal">
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
}
