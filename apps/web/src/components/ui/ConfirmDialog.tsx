import { Modal } from './Modal';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      <p className="dialog-message">{message}</p>
    </Modal>
  );
}
