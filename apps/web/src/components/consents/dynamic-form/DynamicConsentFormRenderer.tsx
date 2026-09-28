import { useEffect, useRef, useState } from 'react';
import type {
  ConsentDigitalSignature,
  ConsentFormDefinition,
  ConsentVisibilityCondition,
  SystemFieldSource,
} from '../../../api/consents';
import '../ConsentFormBuilder.css';

interface DynamicConsentFormRendererProps {
  templateTitle?: string;
  templateCode?: string;
  templateVersion?: number;
  category?: string;
  formDefinition: ConsentFormDefinition;
  patient?: any;
  contextData?: {
    doctorName?: string;
    departmentName?: string;
    branchName?: string;
    encounterNumber?: string;
    encounterDate?: string;
    procedureName?: string;
    admissionNumber?: string;
  };
  onSubmit?: (data: {
    formResponses: Record<string, unknown>;
    signatures: ConsentDigitalSignature[];
    declarationAccepted: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
  isPreview?: boolean;
  onClose?: () => void;
}

function evaluateCondition(
  rule?: ConsentVisibilityCondition,
  responses?: Record<string, unknown>,
): boolean {
  if (!rule || !rule.fieldKey) return true;
  const currentVal = responses?.[rule.fieldKey];
  const strVal = currentVal === undefined || currentVal === null ? '' : String(currentVal);
  if (rule.operator === 'EQUALS') {
    return strVal.toLowerCase() === rule.value.toLowerCase();
  }
  if (rule.operator === 'NOT_EQUALS') {
    return strVal.toLowerCase() !== rule.value.toLowerCase();
  }
  if (rule.operator === 'CONTAINS') {
    if (Array.isArray(currentVal)) {
      return currentVal.some((item) => String(item).toLowerCase() === rule.value.toLowerCase());
    }
    return strVal.toLowerCase().includes(rule.value.toLowerCase());
  }
  return true;
}

function getSystemFieldValue(key?: SystemFieldSource, patient?: any, contextData?: any): string {
  if (!key) return '';
  if (key === 'patient_name') {
    if (!patient) return 'John Doe';
    return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');
  }
  if (key === 'patient_number') return patient?.patient_number || 'MRN-000123';
  if (key === 'date_of_birth')
    return patient?.date_of_birth
      ? new Date(patient.date_of_birth).toLocaleDateString('en-IN')
      : '1990-01-01';
  if (key === 'gender') return patient?.gender || 'Other';
  if (key === 'phone') return patient?.phone || '+254 700 000 000';
  if (key === 'address') return patient?.address || 'Nairobi, Kenya';
  if (key === 'doctor_name') return contextData?.doctorName || 'Dr. On-Duty Physician';
  if (key === 'department_name') return contextData?.departmentName || 'Outpatient Department';
  if (key === 'branch_name') return contextData?.branchName || 'Main Hospital';
  if (key === 'encounter_number') return contextData?.encounterNumber || 'ENC-2026-001';
  if (key === 'encounter_date')
    return contextData?.encounterDate || new Date().toLocaleDateString('en-IN');
  if (key === 'procedure_name') return contextData?.procedureName || 'General Treatment';
  if (key === 'admission_number') return contextData?.admissionNumber || 'ADM-2026-001';
  return '';
}

export function DynamicConsentFormRenderer({
  templateTitle = 'Consent Form',
  templateCode,
  templateVersion = 1,
  category,
  formDefinition,
  patient,
  contextData,
  onSubmit,
  isSubmitting = false,
  isPreview = false,
  onClose,
}: DynamicConsentFormRendererProps) {
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Signatures state: signerType -> { name, data, mode: 'draw' | 'type', typedText }
  const requiredSigners = formDefinition.signatures?.requiredSignatures || ['PATIENT'];
  const [signatures, setSignatures] = useState<
    Record<
      string,
      {
        signerName: string;
        signatureData: string;
        mode: 'draw' | 'type';
        typedText: string;
      }
    >
  >(() => {
    const initial: Record<string, any> = {};
    const defaultPatientName = patient
      ? [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')
      : 'John Doe';
    requiredSigners.forEach((s) => {
      initial[s] = {
        signerName: s === 'PATIENT' ? defaultPatientName : '',
        signatureData: '',
        mode: 'draw',
        typedText: s === 'PATIENT' ? defaultPatientName : '',
      };
    });
    return initial;
  });

  // Canvas refs for signature pads
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const isDrawing = useRef<Record<string, boolean>>({});

  // Auto-populate system fields into responses
  useEffect(() => {
    const autoVals: Record<string, unknown> = {};
    formDefinition.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.systemFieldKey) {
          autoVals[f.fieldKey] = getSystemFieldValue(f.systemFieldKey, patient, contextData);
        } else if (f.defaultValue !== undefined && responses[f.fieldKey] === undefined) {
          autoVals[f.fieldKey] = f.defaultValue;
        }
      });
    });
    setResponses((prev) => ({ ...autoVals, ...prev }));
  }, [formDefinition, patient, contextData]);

  // Set up drawing listeners on signature canvases
  const startDrawing = (signer: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current[signer];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current[signer] = true;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (signer: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current[signer]) return;
    const canvas = canvasRefs.current[signer];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (signer: string) => {
    if (!isDrawing.current[signer]) return;
    isDrawing.current[signer] = false;
    const canvas = canvasRefs.current[signer];
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatures((prev) => {
      const cur = prev[signer] ?? { signerName: '', signatureData: '', mode: 'draw', typedText: '' };
      return { ...prev, [signer]: { ...cur, signatureData: dataUrl } };
    });
  };

  const clearCanvas = (signer: string) => {
    const canvas = canvasRefs.current[signer];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatures((prev) => {
      const cur = prev[signer] ?? { signerName: '', signatureData: '', mode: 'draw', typedText: '' };
      return { ...prev, [signer]: { ...cur, signatureData: '' } };
    });
  };

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const validate = (): boolean => {
    const errs: string[] = [];

    // Validate required fields that are visible
    formDefinition.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (!evaluateCondition(f.visibilityRule, responses)) return;
        if (f.required) {
          const val = responses[f.fieldKey];
          if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
            errs.push(`"${f.label}" in section "${sec.title}" is required.`);
          }
        }
      });
    });

    // Validate declaration
    if (formDefinition.declaration?.required && !declarationAccepted) {
      errs.push('Consent Declaration must be acknowledged and accepted.');
    }

    // Validate signatures
    requiredSigners.forEach((s) => {
      const sig = signatures[s];
      if (!sig?.signerName?.trim()) {
        errs.push(`Full name of signer for ${s} is required.`);
      }
      if (sig?.mode === 'draw' && !sig.signatureData) {
        errs.push(`Digital drawn signature for ${s} is required.`);
      } else if (sig?.mode === 'type' && !sig.typedText?.trim()) {
        errs.push(`Typed signature for ${s} is required.`);
      }
    });

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isPreview) {
      alert('Form preview is valid! All required fields and signatures were successfully checked.');
      return;
    }

    if (onSubmit) {
      const compiledSignatures: ConsentDigitalSignature[] = requiredSigners.map((s) => {
        const sig = signatures[s] ?? { signerName: '', signatureData: '', mode: 'draw' as const, typedText: '' };
        return {
          signer_type: s as any,
          signer_name: sig.signerName.trim(),
          signature_data: sig.mode === 'draw' ? sig.signatureData : sig.typedText.trim(),
          signed_at: new Date().toISOString(),
        };
      });

      await onSubmit({
        formResponses: responses,
        signatures: compiledSignatures,
        declarationAccepted,
      });
    }
  };

  return (
    <form className="dynamic-consent-container" onSubmit={handleSubmit}>
      {/* Banner */}
      <div className="dynamic-consent-banner">
        <div>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
            {category || 'Clinical Consent'} &middot; v{templateVersion}
          </span>
          <h3 style={{ margin: '0.2rem 0', fontSize: '1.2rem', color: '#0f172a' }}>{templateTitle}</h3>
          {templateCode && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Code: {templateCode}</span>}
        </div>
        {isPreview && (
          <span
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '6px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            <i className="ph ph-eye" /> Interactive Preview Mode
          </span>
        )}
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.86rem',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
            <i className="ph ph-warning-circle" /> Please complete all required items:
          </strong>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sections & Fields */}
      {formDefinition.sections.map((section, sIdx) => (
        <section key={section.id || sIdx} className="dynamic-consent-section">
          <h4 className="dynamic-consent-section-title">
            {sIdx + 1}. {section.title}
          </h4>
          {section.description && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b' }}>{section.description}</p>
          )}

          <div className="dynamic-consent-grid">
            {section.fields.map((field) => {
              if (!evaluateCondition(field.visibilityRule, responses)) {
                return null;
              }

              return (
                <div key={field.id || field.fieldKey} className="dynamic-field-group">
                  <label htmlFor={`field-${field.fieldKey}`}>
                    {field.label}
                    {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    {field.systemFieldKey && (
                      <span className="dynamic-system-badge" title="Auto-populated from HMS">
                        Auto-populated
                      </span>
                    )}
                  </label>

                  {/* Field Input Renderers */}
                  {field.type === 'LONG_TEXT' ? (
                    <textarea
                      disabled={field.readOnly}
                      id={`field-${field.fieldKey}`}
                      onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      value={String(responses[field.fieldKey] ?? '')}
                    />
                  ) : field.type === 'DROPDOWN' ? (
                    <select
                      disabled={field.readOnly}
                      id={`field-${field.fieldKey}`}
                      onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                      value={String(responses[field.fieldKey] ?? '')}
                    >
                      <option value="">Select option</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'RADIO' ? (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.35rem 0' }}>
                      {(field.options || []).map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            checked={responses[field.fieldKey] === opt}
                            disabled={field.readOnly}
                            name={field.fieldKey}
                            onChange={() => handleFieldChange(field.fieldKey, opt)}
                            type="radio"
                            value={opt}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'YES_NO' ? (
                    <div style={{ display: 'flex', gap: '1rem', padding: '0.35rem 0' }}>
                      {['Yes', 'No'].map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            checked={responses[field.fieldKey] === opt}
                            disabled={field.readOnly}
                            name={field.fieldKey}
                            onChange={() => handleFieldChange(field.fieldKey, opt)}
                            type="radio"
                            value={opt}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'CHECKBOX' ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0.35rem 0',
                      }}
                    >
                      <input
                        checked={Boolean(responses[field.fieldKey])}
                        disabled={field.readOnly}
                        onChange={(e) => handleFieldChange(field.fieldKey, e.target.checked)}
                        type="checkbox"
                      />
                      {field.placeholder || field.label}
                    </label>
                  ) : field.type === 'INSTRUCTION' ? (
                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        borderLeft: '4px solid #0284c7',
                        fontSize: '0.84rem',
                        color: '#334155',
                      }}
                    >
                      {field.helpText || field.label}
                    </div>
                  ) : (
                    <input
                      disabled={field.readOnly}
                      id={`field-${field.fieldKey}`}
                      onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                      placeholder={field.placeholder}
                      type={
                        field.type === 'NUMBER'
                          ? 'number'
                          : field.type === 'DATE'
                          ? 'date'
                          : field.type === 'DATE_TIME'
                          ? 'datetime-local'
                          : field.type === 'EMAIL'
                          ? 'email'
                          : field.type === 'PHONE'
                          ? 'tel'
                          : 'text'
                      }
                      value={String(responses[field.fieldKey] ?? '')}
                    />
                  )}

                  {field.helpText && field.type !== 'INSTRUCTION' && (
                    <small style={{ color: '#64748b', fontSize: '0.72rem' }}>{field.helpText}</small>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Consent Declaration Section */}
      {formDefinition.declaration && (
        <section className="dynamic-declaration-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#166534', fontWeight: 700, fontSize: '0.86rem' }}>
            <i className="ph ph-shield-check" /> Consent Declaration &amp; Acknowledgment
          </div>
          <p>{formDefinition.declaration.text}</p>
          <label className="dynamic-declaration-checkbox">
            <input
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              type="checkbox"
            />
            I confirm and accept the above declaration statement {formDefinition.declaration.required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
        </section>
      )}

      {/* Signatures Section */}
      <section className="dynamic-consent-section">
        <h4 className="dynamic-consent-section-title">
          <i className="ph ph-signature" /> Required Signatures &amp; Verification
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {requiredSigners.map((signerType) => {
            const sigState = signatures[signerType] || {
              signerName: '',
              signatureData: '',
              mode: 'draw',
              typedText: '',
            };

            return (
              <div key={signerType} className="dynamic-signature-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                    {signerType} Signature <span style={{ color: '#ef4444' }}>*</span>
                  </strong>
                  <div className="dynamic-sig-tabs">
                    <button
                      className={`dynamic-sig-tab ${sigState.mode === 'draw' ? 'active' : ''}`}
                      onClick={() =>
                        setSignatures((prev) => {
                          const cur = prev[signerType] ?? { signerName: '', signatureData: '', mode: 'draw', typedText: '' };
                          return { ...prev, [signerType]: { ...cur, mode: 'draw' } };
                        })
                      }
                      type="button"
                    >
                      Draw
                    </button>
                    <button
                      className={`dynamic-sig-tab ${sigState.mode === 'type' ? 'active' : ''}`}
                      onClick={() =>
                        setSignatures((prev) => {
                          const cur = prev[signerType] ?? { signerName: '', signatureData: '', mode: 'type', typedText: '' };
                          return { ...prev, [signerType]: { ...cur, mode: 'type' } };
                        })
                      }
                      type="button"
                    >
                      Type
                    </button>
                  </div>
                </div>

                <div className="dynamic-field-group">
                  <label htmlFor={`signer-${signerType}-name`}>Signer Full Name *</label>
                  <input
                    id={`signer-${signerType}-name`}
                    onChange={(e) =>
                      setSignatures((prev) => {
                        const cur = prev[signerType] ?? { signerName: '', signatureData: '', mode: 'draw', typedText: '' };
                        return {
                          ...prev,
                          [signerType]: {
                            ...cur,
                            signerName: e.target.value,
                            typedText: cur.typedText || e.target.value,
                          },
                        };
                      })
                    }
                    placeholder="Enter legal name"
                    required
                    type="text"
                    value={sigState.signerName}
                  />
                </div>

                {sigState.mode === 'draw' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[signerType] = el;
                      }}
                      className="dynamic-sig-canvas"
                      height={140}
                      onMouseDown={(e) => startDrawing(signerType, e)}
                      onMouseLeave={() => stopDrawing(signerType)}
                      onMouseMove={(e) => draw(signerType, e)}
                      onMouseUp={() => stopDrawing(signerType)}
                      onTouchEnd={() => stopDrawing(signerType)}
                      onTouchMove={(e) => draw(signerType, e)}
                      onTouchStart={(e) => startDrawing(signerType, e)}
                      width={380}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => clearCanvas(signerType)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                        type="button"
                      >
                        <i className="ph ph-trash" /> Clear signature
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      className="dynamic-sig-typed-input"
                      onChange={(e) =>
                      setSignatures((prev) => {
                        const cur = prev[signerType] ?? { signerName: '', signatureData: '', mode: 'type', typedText: '' };
                        return { ...prev, [signerType]: { ...cur, typedText: e.target.value } };
                      })
                    }
                      placeholder="Type signature"
                      type="text"
                      value={sigState.typedText}
                    />
                  </div>
                )}

                <div className="dynamic-sig-meta-row">
                  <span>Role: {signerType}</span>
                  <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Form Submission Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 0' }}>
        {onClose && (
          <button className="doc-btn" onClick={onClose} type="button">
            Cancel
          </button>
        )}
        <button className="doc-btn primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : isPreview ? 'Validate Preview Form' : 'Submit & Sign Consent'}
        </button>
      </div>
    </form>
  );
}
