import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { MedicalSpinner } from '../ui/MedicalLoader';
import type { OpdVisitResponse } from '../../api/opd';
import { opdApi } from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { toast } from 'sonner';

export type CloseOpdJourneyModalProps = {
  visit: OpdVisitResponse | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedVisit: OpdVisitResponse) => void;
};

export function CloseOpdJourneyModal({
  visit,
  open,
  onClose,
  onSuccess,
}: CloseOpdJourneyModalProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open || !visit) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await opdApi.closeJourney(visit.id, {
        notes: notes.trim() || undefined,
      });
      toast.success('OPD journey closed successfully');
      onSuccess(response.visit);
      onClose();
    } catch (error) {
      const msg = getOpdErrorMessage(error);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onClose}
      title="Close OPD Journey"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
          <button
            type="button"
            className="doc-btn"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="doc-btn success"
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {isSubmitting ? (
              <>
                <MedicalSpinner size="sm" />
                <span>Closing Journey...</span>
              </>
            ) : (
              'Confirm & Close Journey'
            )}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <div><strong>Patient:</strong> {visit.patient_name} ({visit.patient_number})</div>
          <div><strong>Visit Number:</strong> {visit.visit_number}</div>
          <div><strong>Current Status:</strong> <span className="doc-status signed" style={{ display: 'inline-block', marginTop: '4px' }}>Clinically Completed</span></div>
        </div>

        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          Doctor clinical sign-off has been recorded. Closing the OPD journey will verify authoritative billing settlement and medication dispensing checks before marking the encounter complete.
        </p>

        {errorMessage && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem', color: '#991b1b', fontSize: '0.85rem' }}>
            <strong>Closure Blocked:</strong> {errorMessage}
          </div>
        )}

        <div className="doc-field">
          <label htmlFor="closure-notes" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Administrative Notes (Optional)
          </label>
          <textarea
            id="closure-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder="Add any administrative or discharge clearance notes..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>
    </Modal>
  );
}
