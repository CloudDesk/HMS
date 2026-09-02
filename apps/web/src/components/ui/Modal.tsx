import { useEffect, useId, useState, type PropsWithChildren, type ReactNode } from 'react';
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

type ActiveModalItem = {
  id: string;
  onClose: () => void;
  updateDepth: (depth: number) => void;
};

// Global modal stack for Escape key handling and dynamic z-index layering across stacked/nested modals
const activeModalStack: ActiveModalItem[] = [];

function notifyStackDepths() {
  activeModalStack.forEach((item, index) => {
    item.updateDepth(index);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeModalStack.length > 0) {
      const topModal = activeModalStack[activeModalStack.length - 1];
      if (topModal) {
        event.preventDefault();
        event.stopPropagation();
        topModal.onClose();
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
  const modalId = useId();
  const [mounted, setMounted] = useState(false);
  const [stackDepth, setStackDepth] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-backdrop');
      const item: ActiveModalItem = {
        id: modalId,
        onClose,
        updateDepth: (depth: number) => setStackDepth(depth),
      };
      // Avoid duplicate registration
      const existingIdx = activeModalStack.findIndex((m) => m.id === modalId);
      if (existingIdx !== -1) {
        activeModalStack[existingIdx] = item;
      } else {
        activeModalStack.push(item);
      }
      notifyStackDepths();

      return () => {
        const idx = activeModalStack.findIndex((m) => m.id === modalId);
        if (idx !== -1) {
          activeModalStack.splice(idx, 1);
          notifyStackDepths();
        }
        if (activeModalStack.length === 0) {
          document.body.classList.remove('modal-backdrop');
        }
      };
    } else {
      const idx = activeModalStack.findIndex((m) => m.id === modalId);
      if (idx !== -1) {
        activeModalStack.splice(idx, 1);
        notifyStackDepths();
      }
      if (activeModalStack.length === 0) {
        document.body.classList.remove('modal-backdrop');
      }
    }
  }, [open, onClose, modalId]);

  if (!mounted) return null;

  const sizeClass = size === 'xlarge' ? ' xlarge' : size === 'large' ? ' large' : '';
  const layerClass = layer === 'top' ? ' layer-top' : '';

  const baseZIndex = layer === 'top' ? 100050 : 100000;
  const overlayZIndex = baseZIndex + stackDepth * 20;
  const boxZIndex = overlayZIndex + 1;

  return createPortal(
    <div
      className={`modal-overlay${layerClass}${open ? ' open' : ''}`}
      aria-hidden={!open}
      style={{ zIndex: overlayZIndex }}
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
        style={{ zIndex: boxZIndex }}
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

