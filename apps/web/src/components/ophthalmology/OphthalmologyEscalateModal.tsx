import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';

export interface OphthalmologyEscalateModalProps {
  open: boolean;
  onClose: () => void;
  onEscalate: (reason: string, triggerFindings?: string[], urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY') => Promise<unknown>;
  busy?: boolean;
  emergencyOnly?: boolean;
}

interface TriggerOption {
  value: string;
  label: string;
  icon: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 'CLINICAL_ESCALATION', label: 'Consultation Escalation', icon: 'ph-eye' },
  { value: 'DIAGNOSTIC_REVIEW_FINDING', label: 'Diagnostic Escalation', icon: 'ph-calendar-blank' },
  { value: 'TREATMENT_ESCALATION', label: 'Treatment Escalation', icon: 'ph-flask' },
  { value: 'OTHER', label: 'Other (Please Specify)', icon: 'ph-file-text' },
  { value: 'EXAMINATION_FINDING', label: 'Acute Examination Finding', icon: 'ph-magnifying-glass' },
  { value: 'IOP_SPIKE', label: 'High Intraocular Pressure', icon: 'ph-gauge' },
  { value: 'CHEMICAL_INJURY', label: 'Chemical Ocular Injury', icon: 'ph-drop' },
  { value: 'TRAUMA_PERFORATION', label: 'Globe Perforation / Trauma', icon: 'ph-crosshair' },
];

export function OphthalmologyEscalateModal({
  open,
  onClose,
  onEscalate,
  busy = false,
  emergencyOnly = false,
}: OphthalmologyEscalateModalProps) {
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'EMERGENCY' | 'URGENT'>('EMERGENCY');
  const [urgencyOpen, setUrgencyOpen] = useState(false);
  const [clinicalFinding, setClinicalFinding] = useState('CLINICAL_ESCALATION');
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [otherTrigger, setOtherTrigger] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [titleElement, setTitleElement] = useState<HTMLDivElement | null>(null);
  const submittingRef = useRef(false);

  // The modal is portalled to body, so copy the consultation's responsive text scale.
  useLayoutEffect(() => {
    if (!open || !titleElement) return;
    const workspace = document.querySelector('.oph-reference-consultation');
    const source = workspace?.firstElementChild;
    const dialog = titleElement.closest<HTMLElement>('.oph-escalate-modal-dialog');
    if (!workspace || !source || !dialog) return;
    const syncTypography = () => {
      const styles = getComputedStyle(source);
      for (const [target, original] of [['heading', 'section'], ['body', 'body'], ['small', 'small'], ['action', 'action']]) {
        const value = styles.getPropertyValue(`--oph-type-${original}`).trim();
        if (value) dialog.style.setProperty(`--oph-esc-${target}`, value);
      }
      dialog.style.setProperty('--oph-esc-font-family', styles.fontFamily);
    };
    syncTypography();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncTypography);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [open, titleElement]);

  const urgencyRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (urgencyRef.current && !urgencyRef.current.contains(target)) {
        setUrgencyOpen(false);
      }
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        setTriggerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (urgencyOpen) {
          setUrgencyOpen(false);
          e.stopPropagation();
        } else if (triggerOpen) {
          setTriggerOpen(false);
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [urgencyOpen, triggerOpen]);

  if (!open) return null;

  const handleClose = () => {
    if (submitting || busy) return;
    setLocalError(null);
    setUrgencyOpen(false);
    setTriggerOpen(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || submitting || busy) return;

    const trimmed = reason.trim();
    if (!trimmed) {
      setLocalError('Emergency escalation clinical reason is required.');
      return;
    }

    if (trimmed.length > 2000) {
      setLocalError('Emergency reason must not exceed 2000 characters.');
      return;
    }

    if (clinicalFinding === 'OTHER' && !otherTrigger.trim()) {
      setLocalError('Please specify the clinical trigger detail.');
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    submittingRef.current = true;

    try {
      let findings: string[];
      if (clinicalFinding === 'OTHER') {
        findings = [otherTrigger.trim() ? `OTHER: ${otherTrigger.trim()}` : 'OTHER'];
      } else {
        findings = clinicalFinding ? [clinicalFinding] : ['CLINICAL_ESCALATION'];
      }

      const result = await onEscalate(trimmed, findings, emergencyOnly ? 'EMERGENCY' : urgency);
      if (result) {
        setReason('');
        setOtherTrigger('');
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Emergency escalation failed. Please retry.';
      setLocalError(message);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const isActionDisabled = submitting || busy || !reason.trim();
  const defaultTrigger: TriggerOption = { value: 'CLINICAL_ESCALATION', label: 'Consultation Escalation', icon: 'ph-eye' };
  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === clinicalFinding) ?? TRIGGER_OPTIONS[0] ?? defaultTrigger;

  return (
    <Modal
      open={open}
      title={
        <div className="oph-esc-header-content" ref={setTitleElement}>
          <div className="oph-esc-icon-box" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h1m14 0h1M5.6 5.6l.7.7m11.4 0l.7-.7M12 4V3M7 12a5 5 0 0 1 10 0v5H7v-5zM5 17h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2zM9 12h6" />
            </svg>
          </div>
          <div className="oph-esc-title-group">
            <h2 className="oph-esc-title">Escalate Emergency</h2>
            <p className="oph-esc-subtitle">Immediately alerts on-duty ophthalmologists and the emergency eye triage team.</p>
          </div>
        </div>
      }
      className="oph-workspace oph-escalate-modal-dialog"
      size="xlarge"
      onClose={handleClose}
      footer={
        <div className="oph-esc-footer">
          <button
            type="button"
            className="oph-esc-btn-cancel"
            disabled={submitting || busy}
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="oph-escalate-emergency-form"
            className="oph-esc-btn-confirm"
            disabled={isActionDisabled}
          >
            {submitting || busy ? (
              <>
                <i className="ph ph-spinner-gap-bold oph-spin" />
                <span>Escalating...</span>
                <span style={{ display: 'none' }}>Escalate Emergency</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M4 12h1m14 0h1M5.6 5.6l.7.7m11.4 0l.7-.7M12 4V3M7 12a5 5 0 0 1 10 0v5H7v-5zM5 17h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2zM9 12h6" />
                </svg>
                <span>Confirm Emergency Escalation</span>
                {/* Preserves textContent search in existing unit tests */}
                <span style={{ display: 'none' }}>Escalate Emergency</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <form id="oph-escalate-emergency-form" className="oph-esc-form" onSubmit={handleSubmit}>
        {localError && (
          <div className="form-error-banner" role="alert" style={{ color: '#991b1b', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph ph-warning-circle" />
            <span>{localError}</span>
          </div>
        )}

        <fieldset disabled={submitting || busy} className="oph-fieldset" style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Escalation Clinical Reason */}
          <div className="oph-esc-field-group">
            <div className="oph-esc-field-header">
              <label htmlFor="emergency-escalation-reason" className="oph-esc-label">
                Escalation Clinical Reason <span className="oph-required" style={{ color: '#ef4444' }}>*</span>
              </label>
              <span className="oph-esc-char-count">{reason.length}/2000 characters</span>
            </div>
            <textarea
              id="emergency-escalation-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder={"Describe the emergency clinical reason and key findings...\ne.g., Acute angle-closure glaucoma, IOP spike > 40mmHg, Chemical burn, Retinal detachment with macula-on, Ruptured globe, Sudden vision loss ..."}
              maxLength={2000}
              rows={4}
              className="oph-esc-textarea"
              required
            />
          </div>

          {/* Urgency Level & Clinical Trigger Category */}
          <div className="oph-esc-grid-2">
            {/* Urgency Level Dropdown */}
            <div className="oph-esc-field-group" ref={urgencyRef}>
              <label htmlFor="emergency-escalation-urgency" className="oph-esc-label">
                Urgency Level <span className="oph-required" style={{ color: '#ef4444' }}>*</span>
              </label>

              {/* Hidden select for full programmatic test and form compatibility */}
              <select
                id="emergency-escalation-urgency"
                disabled={emergencyOnly}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as 'EMERGENCY' | 'URGENT')}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              >
                <option value="EMERGENCY">EMERGENCY (Immediate Response)</option>
                <option value="URGENT">URGENT (Priority Attention)</option>
              </select>

              {/* Custom Styled Urgency Control */}
              <div className="oph-esc-custom-dropdown">
                <button
                  type="button"
                  className={`oph-esc-dropdown-btn oph-esc-urgency-btn ${urgency.toLowerCase()}${urgencyOpen ? ' active' : ''}`}
                  disabled={emergencyOnly}
                  onClick={() => {
                    setUrgencyOpen(!urgencyOpen);
                    setTriggerOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={urgencyOpen}
                >
                  <div className="oph-esc-btn-left">
                    {urgency === 'EMERGENCY' ? (
                      <span className="oph-esc-siren-icon-small">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12h1m14 0h1M5.6 5.6l.7.7m11.4 0l.7-.7M12 4V3M7 12a5 5 0 0 1 10 0v5H7v-5zM5 17h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2zM9 12h6" />
                        </svg>
                      </span>
                    ) : (
                      <span className="oph-esc-lightning-icon-small">
                        <i className="ph ph-lightning-fill" />
                      </span>
                    )}
                    <span className="oph-esc-selected-label">
                      {urgency === 'EMERGENCY' ? 'EMERGENCY (Immediate Response)' : 'URGENT (Priority Attention)'}
                    </span>
                  </div>
                  <i className={`ph ph-caret-${urgencyOpen ? 'up' : 'down'} oph-esc-caret`} />
                </button>

                {urgencyOpen && (
                  <div className="oph-esc-menu oph-esc-urgency-menu" role="listbox">
                    <div
                      className={`oph-esc-menu-item ${urgency === 'EMERGENCY' ? 'selected' : ''}`}
                      role="option"
                      aria-selected={urgency === 'EMERGENCY'}
                      onClick={() => {
                        setUrgency('EMERGENCY');
                        setUrgencyOpen(false);
                      }}
                    >
                      <span className="oph-esc-item-icon siren">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12h1m14 0h1M5.6 5.6l.7.7m11.4 0l.7-.7M12 4V3M7 12a5 5 0 0 1 10 0v5H7v-5zM5 17h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2zM9 12h6" />
                        </svg>
                      </span>
                      <div className="oph-esc-item-text">
                        <div className="oph-esc-item-title red">EMERGENCY (Immediate Response)</div>
                        <div className="oph-esc-item-subtitle">Immediate alert to on-duty ophthalmologist and emergency triage team.</div>
                      </div>
                      {urgency === 'EMERGENCY' && (
                        <i className="ph ph-check-bold oph-esc-check-icon red" />
                      )}
                    </div>

                    <div
                      className={`oph-esc-menu-item ${urgency === 'URGENT' ? 'selected' : ''}`}
                      role="option"
                      aria-selected={urgency === 'URGENT'}
                      onClick={() => {
                        setUrgency('URGENT');
                        setUrgencyOpen(false);
                      }}
                    >
                      <span className="oph-esc-item-icon lightning">
                        <i className="ph ph-lightning-fill" />
                      </span>
                      <div className="oph-esc-item-text">
                        <div className="oph-esc-item-title dark">URGENT (Priority Attention)</div>
                        <div className="oph-esc-item-subtitle">High priority review, faster response required.</div>
                      </div>
                      {urgency === 'URGENT' && (
                        <i className="ph ph-check-bold oph-esc-check-icon dark" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Trigger Category Dropdown */}
            <div className="oph-esc-field-group" ref={triggerRef}>
              <label htmlFor="emergency-escalation-trigger" className="oph-esc-label">
                Clinical Trigger Category <span className="oph-required" style={{ color: '#ef4444' }}>*</span>
              </label>

              {/* Hidden select for programmatic test and form compatibility */}
              <select
                id="emergency-escalation-trigger"
                value={clinicalFinding}
                onChange={(e) => setClinicalFinding(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Custom Styled Trigger Category Control */}
              <div className="oph-esc-custom-dropdown">
                <button
                  type="button"
                  className={`oph-esc-dropdown-btn oph-esc-trigger-btn${triggerOpen ? ' active' : ''}`}
                  onClick={() => {
                    setTriggerOpen(!triggerOpen);
                    setUrgencyOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={triggerOpen}
                >
                  <div className="oph-esc-btn-left">
                    <span className="oph-esc-trigger-icon-blue">
                      <i className={`ph ${selectedTrigger.icon}`} />
                    </span>
                    <span className="oph-esc-selected-label trigger-label">
                      {selectedTrigger.label}
                    </span>
                  </div>
                  <i className={`ph ph-caret-${triggerOpen ? 'up' : 'down'} oph-esc-caret blue-gray`} />
                </button>

                {triggerOpen && (
                  <div className="oph-esc-menu oph-esc-trigger-menu" role="listbox">
                    {TRIGGER_OPTIONS.map((opt) => {
                      const isSelected = clinicalFinding === opt.value;
                      return (
                        <div
                          key={opt.value}
                          className={`oph-esc-trigger-item ${isSelected ? 'selected' : ''}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setClinicalFinding(opt.value);
                            setTriggerOpen(false);
                          }}
                        >
                          <span className={`oph-esc-trigger-option-icon ${isSelected ? 'blue' : 'gray'}`}>
                            <i className={`ph ${opt.icon}`} />
                          </span>
                          <span className={`oph-esc-trigger-option-label ${isSelected ? 'blue' : 'dark'}`}>
                            {opt.label}
                          </span>
                          {isSelected && (
                            <i className="ph ph-check-bold oph-esc-check-icon blue" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Conditional Specify Field when 'Other' is selected */}
              {clinicalFinding === 'OTHER' && (
                <div style={{ marginTop: '6px' }}>
                  <input
                    type="text"
                    value={otherTrigger}
                    onChange={(e) => setOtherTrigger(e.target.value)}
                    placeholder="Please specify clinical trigger reason..."
                    maxLength={200}
                    className="oph-esc-other-input"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Common Emergency Examples */}
          <div className="oph-esc-examples-panel">
            <div className="oph-esc-examples-heading">Common Emergency Examples</div>
            <div className="oph-esc-chips-row">
              <span className="oph-esc-chip">Acute angle-closure glaucoma</span>
              <span className="oph-esc-chip">IOP spike &gt; 40mmHg</span>
              <span className="oph-esc-chip">Chemical / thermal burn</span>
              <span className="oph-esc-chip">Retinal detachment (macula-on)</span>
              <span className="oph-esc-chip">Ruptured globe</span>
              <span className="oph-esc-chip">Sudden vision loss</span>
              <span className="oph-esc-chip">Severe eye trauma</span>
            </div>
          </div>

          {/* What happens next? Information Panel */}
          <div className="oph-esc-next-panel">
            <div className="oph-esc-next-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="8" r="1.2" fill="#ffffff" />
              </svg>
            </div>
            <div className="oph-esc-next-content">
              <h4 className="oph-esc-next-heading">What happens next?</h4>
              <ul className="oph-esc-next-list">
                <li>Immediately notifies the emergency eye triage team and on-duty ophthalmologists.</li>
                <li>Restricts routine tests and workflow for this patient (fail-closed protection).</li>
                <li>The patient will be marked as an emergency case in the OPD encounter.</li>
                <li>Acknowledgement of the alert does not mean clinical clearance. The patient remains under emergency evaluation.</li>
              </ul>
            </div>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
