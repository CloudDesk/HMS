import { Modal } from './Modal';
import { MedicalSpinner } from './MedicalLoader';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  layer?: 'default' | 'top';
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  loading = false,
  layer = 'default',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      layer={layer}
      footer={
        <>
          <button className="btn-secondary" disabled={loading} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn-danger" disabled={loading} onClick={onConfirm} type="button">
            {loading ? (
              <>
                <MedicalSpinner size="sm" />
                <span>Processing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
      onClose={loading ? () => {} : onCancel}
      open={open}
      title={title}
    >
      <p className="dialog-message">{message}</p>
    </Modal>
  );
}
