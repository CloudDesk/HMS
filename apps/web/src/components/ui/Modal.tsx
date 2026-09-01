import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = PropsWithChildren<{
  title?: ReactNode;
  open: boolean;
  icon?: string;
  footer?: ReactNode;
  size?: 'default' | 'large' | 'xlarge';
  className?: string;
  layer?: 'default' | 'top';
  onClose: () => void;
}>;

// Global modal stack for Escape key handling across stacked/nested modals
const activeModalStack: (() => void)[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeModalStack.length > 0) {
      const topOnClose = activeModalStack[activeModalStack.length - 1];
      if (topOnClose) {
        event.preventDefault();
        event.stopPropagation();
        topOnClose();
      }
    }
  });
}

export function Modal({
  title,
  open,
  icon,
  footer,
  size = 'default',
  className = '',
  layer = 'default',
  onClose,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-backdrop');
      activeModalStack.push(onClose);
      return () => {
        const idx = activeModalStack.lastIndexOf(onClose);
        if (idx !== -1) {
          activeModalStack.splice(idx, 1);
        }
        if (activeModalStack.length === 0) {
          document.body.classList.remove('modal-backdrop');
        }
      };
    }
    const idx = activeModalStack.lastIndexOf(onClose);
    if (idx !== -1) {
      activeModalStack.splice(idx, 1);
    }
    if (activeModalStack.length === 0) {
      document.body.classList.remove('modal-backdrop');
    }
  }, [open, onClose]);

  if (!mounted) return null;

  const sizeClass = size === 'xlarge' ? ' xlarge' : size === 'large' ? ' large' : '';
  const layerClass = layer === 'top' ? ' layer-top' : '';

  return createPortal(
    <div
      className={`modal-overlay${layerClass}${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="foundation-modal-title"
        aria-modal="true"
        className={`modal-box${sizeClass}${layerClass}${className ? ` ${className}` : ''}`}
        role="dialog"
      >
        <header className="modal-header">
          {typeof title === 'string' ? (
            <h3 className="modal-title" id="foundation-modal-title">
              {icon ? <i className={`ph ${icon}`} aria-hidden="true" /> : null}
              {title}
            </h3>
          ) : (
            <div className="modal-title-custom">{title}</div>
          )}
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
