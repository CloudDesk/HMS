import { useEffect, useId, useRef, type MouseEvent, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  title,
  open,
  icon,
  onClose,
  children,
  footer,
  size = 'default',
}: PropsWithChildren<{
  title: string;
  open: boolean;
  icon?: string;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'default' | 'large';
}>) {
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
  return createPortal(
    <div className="modal-overlay patient-modal-overlay open" onMouseDown={closeFromBackdrop}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-panel patient-modal-panel modal-panel--${size}`}
        role="dialog"
      >
        <header className="modal-header patient-modal-header">
          <div>
            {icon ? <span><i className={`ph ${icon}`} /></span> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            aria-label="Close dialog"
            className="patient-modal-close-btn"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="20"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <div className="modal-body patient-modal-body">{children}</div>
        {footer ? <footer className="modal-footer patient-modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
