import { useState } from 'react';
import { toast } from 'sonner';
import type {
  ConsentDeclarationConfig,
  ConsentFieldType,
  ConsentFormDefinition,
  ConsentFormField,
  ConsentFormSection,
  ConsentSignaturesConfig,
  ConsentTemplate,
  SystemFieldSource,
} from '../../../api/consents';
import { DynamicConsentFormRenderer } from '../dynamic-form/DynamicConsentFormRenderer';
import '../ConsentFormBuilder.css';

interface ConsentFormBuilderModalProps {
  open: boolean;
  onClose: () => void;
  template: ConsentTemplate;
  branchId: string;
  onSaveFormDefinition: (definition: ConsentFormDefinition) => Promise<void>;
  onPublish: () => Promise<void>;
  onCreateNewVersion?: () => Promise<void>;
  saving?: boolean;
}

const defaultDeclaration: ConsentDeclarationConfig = {
  text: 'I confirm that the information provided to me regarding the proposed treatment, its expected benefits, risks, alternatives and possible outcomes has been explained to me. I have had the opportunity to ask questions and understand the information provided.',
  required: true,
};

const defaultSignatures: ConsentSignaturesConfig = {
  requiredSignatures: ['PATIENT', 'DOCTOR'],
};

export function ConsentFormBuilderModal({
  open,
  onClose,
  template,
  onSaveFormDefinition,
  onPublish,
  onCreateNewVersion,
  saving = false,
}: ConsentFormBuilderModalProps) {
  const [sections, setSections] = useState<ConsentFormSection[]>(() => {
    if (template.form_definition?.sections && template.form_definition.sections.length > 0) {
      return template.form_definition.sections;
    }
    // Default starting template with standard sections
    return [
      {
        id: 'sec-1',
        title: 'Patient Identification',
        description: 'Auto-populated patient demographics from HMS records.',
        displayOrder: 0,
        required: true,
        fields: [
          {
            id: 'fld-1',
            fieldKey: 'patient_name',
            label: 'Patient Name',
            type: 'PATIENT_INFO',
            systemFieldKey: 'patient_name',
            required: true,
            readOnly: true,
            displayOrder: 0,
          },
          {
            id: 'fld-2',
            fieldKey: 'patient_number',
            label: 'Medical Record Number (MRN)',
            type: 'PATIENT_INFO',
            systemFieldKey: 'patient_number',
            required: true,
            readOnly: true,
            displayOrder: 1,
          },
          {
            id: 'fld-3',
            fieldKey: 'date_of_birth',
            label: 'Date of Birth',
            type: 'PATIENT_INFO',
            systemFieldKey: 'date_of_birth',
            required: true,
            readOnly: true,
            displayOrder: 2,
          },
        ],
      },
      {
        id: 'sec-2',
        title: 'Clinical Consent & Treatment Acknowledgment',
        description: 'Treatment information and patient agreement questions.',
        displayOrder: 1,
        required: true,
        fields: [
          {
            id: 'fld-4',
            fieldKey: 'understands_treatment',
            label: 'Do you understand the proposed treatment, benefits and associated risks?',
            type: 'YES_NO',
            required: true,
            displayOrder: 0,
          },
          {
            id: 'fld-5',
            fieldKey: 'refusal_reason',
            label: 'Please specify any concerns or reason for refusal:',
            type: 'LONG_TEXT',
            required: true,
            visibilityRule: {
              fieldKey: 'understands_treatment',
              operator: 'EQUALS',
              value: 'No',
            },
            displayOrder: 1,
          },
        ],
      },
    ];
  });

  const [declaration, setDeclaration] = useState<ConsentDeclarationConfig>(
    template.form_definition?.declaration || defaultDeclaration,
  );

  const [signatures, setSignatures] = useState<ConsentSignaturesConfig>(
    template.form_definition?.signatures || defaultSignatures,
  );

  const [showPreview, setShowPreview] = useState(false);
  const [editingFieldState, setEditingFieldState] = useState<{
    sectionId: string;
    field: ConsentFormField;
  } | null>(null);
  const [addingFieldSectionId, setAddingFieldSectionId] = useState<string | null>(null);

  if (!open) return null;

  const isPublished = template.status === 'ACTIVE';

  // Section actions
  const addSection = () => {
    if (isPublished) return;
    const newId = `sec-${Date.now()}`;
    setSections((prev) => [
      ...prev,
      {
        id: newId,
        title: `Section ${prev.length + 1}`,
        description: '',
        displayOrder: prev.length,
        required: true,
        fields: [],
      },
    ]);
  };

  const updateSectionTitle = (id: string, title: string) => {
    if (isPublished) return;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const updateSectionDesc = (id: string, description: string) => {
    if (isPublished) return;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, description } : s)));
  };

  const deleteSection = (id: string) => {
    if (isPublished) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const moveSection = (id: string, dir: 'up' | 'down') => {
    if (isPublished) return;
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const itemA = next[idx];
      const itemB = next[targetIdx];
      if (itemA && itemB) {
        next[idx] = itemB;
        next[targetIdx] = itemA;
      }
      return next.map((s, i) => ({ ...s, displayOrder: i }));
    });
  };

  // Field actions
  const addField = (sectionId: string, type: ConsentFieldType, systemFieldKey?: SystemFieldSource) => {
    if (isPublished) return;
    const fieldId = `fld-${Date.now()}`;
    const defaultLabel = systemFieldKey
      ? systemFieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : type === 'LONG_TEXT'
      ? 'Detailed Notes / Question'
      : type === 'YES_NO'
      ? 'Do you agree to the proposed procedure?'
      : `New ${type.toLowerCase().replace(/_/g, ' ')} field`;

    const rawKey = (systemFieldKey || defaultLabel)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const newField: ConsentFormField = {
      id: fieldId,
      fieldKey: rawKey || `field_${Date.now()}`,
      label: defaultLabel,
      type,
      systemFieldKey,
      readOnly: Boolean(systemFieldKey),
      required: true,
      options: ['DROPDOWN', 'RADIO', 'CHECKBOX_GROUP'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
      displayOrder: 0,
    };

    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            fields: [...s.fields, { ...newField, displayOrder: s.fields.length }],
          };
        }
        return s;
      }),
    );
    setAddingFieldSectionId(null);
    setEditingFieldState({ sectionId, field: newField });
  };

  const saveEditedField = (sectionId: string, updatedField: ConsentFormField) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            fields: s.fields.map((f) => (f.id === updatedField.id ? updatedField : f)),
          };
        }
        return s;
      }),
    );
    setEditingFieldState(null);
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    if (isPublished) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          return { ...s, fields: s.fields.filter((f) => f.id !== fieldId) };
        }
        return s;
      }),
    );
  };

  const moveField = (sectionId: string, fieldId: string, dir: 'up' | 'down') => {
    if (isPublished) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.fields.findIndex((f) => f.id === fieldId);
        if (idx === -1) return s;
        const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= s.fields.length) return s;
        const nextFields = [...s.fields];
        const itemA = nextFields[idx];
        const itemB = nextFields[targetIdx];
        if (itemA && itemB) {
          nextFields[idx] = itemB;
          nextFields[targetIdx] = itemA;
        }
        return { ...s, fields: nextFields.map((f, i) => ({ ...f, displayOrder: i })) };
      }),
    );
  };

  // Compile definition
  const getCurrentDefinition = (): ConsentFormDefinition => ({
    sections,
    declaration,
    signatures,
  });

  const handleSaveDraft = async () => {
    const def = getCurrentDefinition();
    try {
      await onSaveFormDefinition(def);
      toast.success('Consent form draft saved successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save form definition.');
    }
  };

  const handlePublish = async () => {
    if (sections.length === 0) {
      toast.error('Add at least one section before publishing.');
      return;
    }
    const def = getCurrentDefinition();
    try {
      await onSaveFormDefinition(def);
      await onPublish();
      toast.success(`Template ${template.code} published! It is now active for clinical use.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish consent template.');
    }
  };

  // All fields across sections for conditional visibility selector
  const allOtherFields = sections
    .flatMap((s) => s.fields)
    .filter((f) => f.id !== editingFieldState?.field.id);

  return (
    <div className="consent-builder-overlay">
      <div className="consent-builder-dialog">
        {/* Header */}
        <div className="consent-builder-header">
          <div className="consent-builder-header-left">
            <div className="consent-builder-icon">
              <i className="ph ph-file-text" />
            </div>
            <div>
              <h2>{template.name}</h2>
              <div className="consent-builder-meta">
                <span>Code: <strong>{template.code}</strong></span>
                <span>&middot;</span>
                <span>Version: <strong>v{template.version}</strong></span>
                <span>&middot;</span>
                <span>Category: <strong>{template.category}</strong></span>
                <span>&middot;</span>
                <span className={`consent-builder-badge consent-builder-badge--${template.status.toLowerCase()}`}>
                  {template.status}
                </span>
                {template.mandatory && (
                  <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                    Mandatory
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="consent-builder-header-actions">
            <button
              className="doc-btn"
              onClick={() => setShowPreview(true)}
              title="Preview form exactly as patients/staff see it"
              type="button"
            >
              <i className="ph ph-eye" /> Preview Form
            </button>

            {!isPublished ? (
              <>
                <button
                  className="doc-btn"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  type="button"
                >
                  <i className="ph ph-floppy-disk" /> {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  className="doc-btn primary"
                  disabled={saving}
                  onClick={handlePublish}
                  type="button"
                >
                  <i className="ph ph-check-circle" /> Publish Template
                </button>
              </>
            ) : (
              onCreateNewVersion && (
                <button
                  className="doc-btn primary"
                  onClick={onCreateNewVersion}
                  title="Create a new draft version to edit this published template"
                  type="button"
                >
                  <i className="ph ph-git-branch" /> Create New Version (v{template.version + 1})
                </button>
              )
            )}

            <button
              aria-label="Close form builder"
              className="doc-icon-action"
              onClick={onClose}
              style={{ fontSize: '1.25rem' }}
              type="button"
            >
              <i className="ph ph-x" />
            </button>
          </div>
        </div>

        {/* Builder Body */}
        <div className="consent-builder-body">
          {isPublished && (
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <i className="ph ph-lock-key" style={{ fontSize: '1.2rem' }} />
              <div>
                <strong>Published Template Version (Immutable)</strong>
                <p style={{ margin: 0, fontSize: '0.78rem' }}>
                  This template version is published and actively used by clinical workflows. To modify its questions or layout, click <strong>Create New Version</strong> above.
                </p>
              </div>
            </div>
          )}

          {/* Sections List */}
          {sections.map((section, sIdx) => (
            <div key={section.id} className="consent-section-card">
              <div className="consent-section-card-header">
                <div className="consent-section-title-inputs">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0284c7' }}>
                      Section {sIdx + 1}:
                    </span>
                    <input
                      className="consent-section-title-input"
                      disabled={isPublished}
                      onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                      placeholder="Enter section name"
                      value={section.title}
                    />
                  </div>
                  <input
                    className="consent-section-desc-input"
                    disabled={isPublished}
                    onChange={(e) => updateSectionDesc(section.id, e.target.value)}
                    placeholder="Add instructions or description for this section (optional)"
                    value={section.description || ''}
                  />
                </div>

                {!isPublished && (
                  <div className="consent-section-card-actions">
                    <button
                      className="doc-icon-action"
                      disabled={sIdx === 0}
                      onClick={() => moveSection(section.id, 'up')}
                      title="Move section up"
                      type="button"
                    >
                      <i className="ph ph-arrow-up" />
                    </button>
                    <button
                      className="doc-icon-action"
                      disabled={sIdx === sections.length - 1}
                      onClick={() => moveSection(section.id, 'down')}
                      title="Move section down"
                      type="button"
                    >
                      <i className="ph ph-arrow-down" />
                    </button>
                    <button
                      className="doc-icon-action"
                      onClick={() => deleteSection(section.id)}
                      title="Delete section"
                      type="button"
                    >
                      <i className="ph ph-trash" />
                    </button>
                  </div>
                )}
              </div>

              {/* Fields List */}
              <div className="consent-fields-container">
                {section.fields.map((field, fIdx) => (
                  <div key={field.id} className="consent-field-row">
                    <div className="consent-field-info">
                      <i className="ph ph-dots-six-vertical consent-field-drag-icon" />
                      <div className="consent-field-label-group">
                        <span className="consent-field-label">
                          {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </span>
                        <span className="consent-field-key">key: {field.fieldKey}</span>
                      </div>
                    </div>

                    <div className="consent-field-tags">
                      <span className="consent-field-type-tag">{field.type}</span>
                      {field.systemFieldKey && (
                        <span className="consent-field-sys-tag" title="Auto-populated HMS Field">
                          <i className="ph ph-database" /> {field.systemFieldKey}
                        </span>
                      )}
                      {field.visibilityRule && (
                        <span className="consent-field-cond-tag" title="Conditional logic applied">
                          <i className="ph ph-git-branch" /> Conditional
                        </span>
                      )}
                      {field.readOnly && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Read-Only</span>
                      )}
                    </div>

                    <div className="consent-field-actions">
                      <button
                        className="doc-icon-action"
                        onClick={() => setEditingFieldState({ sectionId: section.id, field })}
                        title="Configure field settings"
                        type="button"
                      >
                        <i className="ph ph-gear-six" />
                      </button>
                      {!isPublished && (
                        <>
                          <button
                            className="doc-icon-action"
                            disabled={fIdx === 0}
                            onClick={() => moveField(section.id, field.id, 'up')}
                            title="Move field up"
                            type="button"
                          >
                            <i className="ph ph-caret-up" />
                          </button>
                          <button
                            className="doc-icon-action"
                            disabled={fIdx === section.fields.length - 1}
                            onClick={() => moveField(section.id, field.id, 'down')}
                            title="Move field down"
                            type="button"
                          >
                            <i className="ph ph-caret-down" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => deleteField(section.id, field.id)}
                            title="Delete field"
                            type="button"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isPublished && (
                <div>
                  <button
                    className="consent-add-field-btn"
                    onClick={() => setAddingFieldSectionId(section.id)}
                    type="button"
                  >
                    <i className="ph ph-plus-circle" /> Add Field to Section
                  </button>
                </div>
              )}
            </div>
          ))}

          {!isPublished && (
            <button className="consent-add-section-btn" onClick={addSection} type="button">
              <i className="ph ph-plus" /> Add New Form Section
            </button>
          )}

          {/* Consent Declaration Configuration Block */}
          <div className="consent-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 700 }}>
              <i className="ph ph-shield-check" style={{ fontSize: '1.25rem' }} />
              <span>Consent Declaration Block</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Legal affirmation text displayed before the patient/guardian signs.
            </p>
            <textarea
              disabled={isPublished}
              onChange={(e) => setDeclaration((prev) => ({ ...prev, text: e.target.value }))}
              rows={3}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
              }}
              value={declaration.text}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer' }}>
              <input
                checked={declaration.required}
                disabled={isPublished}
                onChange={(e) => setDeclaration((prev) => ({ ...prev, required: e.target.checked }))}
                type="checkbox"
              />
              Require signer to check acknowledgment checkbox before signing
            </label>
          </div>

          {/* Required Signatures Configuration Block */}
          <div className="consent-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700 }}>
              <i className="ph ph-signature" style={{ fontSize: '1.25rem', color: '#0284c7' }} />
              <span>Signature Configuration</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Select which digital signatures are mandatory for completing this consent form.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.25rem 0' }}>
              {[
                { key: 'PATIENT', label: 'Patient / Consent Giver' },
                { key: 'GUARDIAN', label: 'Parent / Guardian' },
                { key: 'DOCTOR', label: 'Doctor / Healthcare Provider' },
                { key: 'WITNESS', label: 'Witness' },
              ].map(({ key, label }) => {
                const checked = signatures.requiredSignatures.includes(key as any);
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer' }}>
                    <input
                      checked={checked}
                      disabled={isPublished}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...signatures.requiredSignatures, key as any]
                          : signatures.requiredSignatures.filter((s) => s !== key);
                        setSignatures({ requiredSignatures: next });
                      }}
                      type="checkbox"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Field Palette Modal */}
      {addingFieldSectionId && (
        <div className="consent-inspector-modal" onClick={() => setAddingFieldSectionId(null)}>
          <div className="consent-inspector-panel" onClick={(e) => e.stopPropagation()}>
            <div className="consent-inspector-header">
              <h3>Select Field Type</h3>
              <button
                className="doc-icon-action"
                onClick={() => setAddingFieldSectionId(null)}
                type="button"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="consent-inspector-body">
              <div>
                <strong style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Standard Form Fields
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { type: 'TEXT', label: 'Short Text', icon: 'ph-text-t' },
                    { type: 'LONG_TEXT', label: 'Long Text', icon: 'ph-textbox' },
                    { type: 'NUMBER', label: 'Number', icon: 'ph-hash' },
                    { type: 'DATE', label: 'Date', icon: 'ph-calendar' },
                    { type: 'DATE_TIME', label: 'Date & Time', icon: 'ph-clock' },
                    { type: 'YES_NO', label: 'Yes / No Choice', icon: 'ph-check-circle' },
                    { type: 'RADIO', label: 'Radio Group', icon: 'ph-radio-button' },
                    { type: 'DROPDOWN', label: 'Dropdown Select', icon: 'ph-caret-down' },
                    { type: 'CHECKBOX', label: 'Single Checkbox', icon: 'ph-check-square' },
                    { type: 'EMAIL', label: 'Email', icon: 'ph-envelope' },
                    { type: 'PHONE', label: 'Phone', icon: 'ph-phone' },
                    { type: 'INSTRUCTION', label: 'Instruction Text', icon: 'ph-info' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      className="doc-btn"
                      onClick={() => addField(addingFieldSectionId, item.type as ConsentFieldType)}
                      style={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        padding: '0.65rem 0.8rem',
                        fontSize: '0.82rem',
                      }}
                      type="button"
                    >
                      <i className={`ph ${item.icon}`} style={{ fontSize: '1.1rem', color: '#0284c7' }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', color: '#0284c7', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Auto-Populated HMS System Fields
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { key: 'patient_name', label: 'Patient Name' },
                    { key: 'patient_number', label: 'MRN Number' },
                    { key: 'date_of_birth', label: 'Date of Birth' },
                    { key: 'gender', label: 'Gender' },
                    { key: 'phone', label: 'Phone Number' },
                    { key: 'address', label: 'Address' },
                    { key: 'doctor_name', label: 'Doctor Name' },
                    { key: 'department_name', label: 'Department' },
                    { key: 'branch_name', label: 'Hospital Branch' },
                    { key: 'procedure_name', label: 'Procedure Name' },
                    { key: 'encounter_number', label: 'Encounter Number' },
                    { key: 'admission_number', label: 'Admission Number' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      className="doc-btn"
                      onClick={() =>
                        addField(addingFieldSectionId, 'PATIENT_INFO', item.key as SystemFieldSource)
                      }
                      style={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        padding: '0.65rem 0.8rem',
                        fontSize: '0.82rem',
                        background: '#f0f9ff',
                        borderColor: '#bae6fd',
                      }}
                      type="button"
                    >
                      <i className="ph ph-database" style={{ fontSize: '1rem', color: '#0284c7' }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Field Configuration Drawer (Inspector) */}
      {editingFieldState && (
        <div className="consent-inspector-modal" onClick={() => setEditingFieldState(null)}>
          <div className="consent-inspector-panel" onClick={(e) => e.stopPropagation()}>
            <div className="consent-inspector-header">
              <h3>Field Configuration</h3>
              <button
                className="doc-icon-action"
                onClick={() => setEditingFieldState(null)}
                type="button"
              >
                <i className="ph ph-x" />
              </button>
            </div>

            <div className="consent-inspector-body">
              <div className="dynamic-field-group">
                <label>Field Label *</label>
                <input
                  disabled={isPublished}
                  onChange={(e) =>
                    setEditingFieldState((prev) =>
                      prev ? { ...prev, field: { ...prev.field, label: e.target.value } } : null,
                    )
                  }
                  type="text"
                  value={editingFieldState.field.label}
                />
              </div>

              <div className="dynamic-field-group">
                <label>Field Key (Identifier) *</label>
                <input
                  disabled={isPublished}
                  onChange={(e) =>
                    setEditingFieldState((prev) =>
                      prev
                        ? {
                            ...prev,
                            field: {
                              ...prev.field,
                              fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
                            },
                          }
                        : null,
                    )
                  }
                  type="text"
                  value={editingFieldState.field.fieldKey}
                />
              </div>

              <div className="dynamic-field-group">
                <label>Field Type</label>
                <select
                  disabled={isPublished || Boolean(editingFieldState.field.systemFieldKey)}
                  onChange={(e) =>
                    setEditingFieldState((prev) =>
                      prev
                        ? {
                            ...prev,
                            field: {
                              ...prev.field,
                              type: e.target.value as ConsentFieldType,
                            },
                          }
                        : null,
                    )
                  }
                  value={editingFieldState.field.type}
                >
                  <option value="TEXT">Short Text</option>
                  <option value="LONG_TEXT">Long Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="DATE_TIME">Date & Time</option>
                  <option value="DROPDOWN">Dropdown</option>
                  <option value="RADIO">Radio</option>
                  <option value="CHECKBOX">Checkbox</option>
                  <option value="YES_NO">Yes / No</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="INSTRUCTION">Instruction Text</option>
                  <option value="PATIENT_INFO">System Field</option>
                </select>
              </div>

              {/* Options list for Radio / Dropdown */}
              {['DROPDOWN', 'RADIO', 'CHECKBOX_GROUP'].includes(editingFieldState.field.type) && (
                <div className="dynamic-field-group">
                  <label>Selectable Options</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(editingFieldState.field.options || []).map((opt, oIdx) => (
                      <div key={oIdx} style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          disabled={isPublished}
                          onChange={(e) => {
                            const next = [...(editingFieldState.field.options || [])];
                            next[oIdx] = e.target.value;
                            setEditingFieldState((prev) =>
                              prev ? { ...prev, field: { ...prev.field, options: next } } : null,
                            );
                          }}
                          type="text"
                          value={opt}
                        />
                        {!isPublished && (
                          <button
                            className="doc-icon-action"
                            onClick={() => {
                              const next = (editingFieldState.field.options || []).filter(
                                (_, i) => i !== oIdx,
                              );
                              setEditingFieldState((prev) =>
                                prev ? { ...prev, field: { ...prev.field, options: next } } : null,
                              );
                            }}
                            type="button"
                          >
                            <i className="ph ph-trash" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!isPublished && (
                      <button
                        className="doc-btn"
                        onClick={() => {
                          const next = [
                            ...(editingFieldState.field.options || []),
                            `Option ${(editingFieldState.field.options || []).length + 1}`,
                          ];
                          setEditingFieldState((prev) =>
                            prev ? { ...prev, field: { ...prev.field, options: next } } : null,
                          );
                        }}
                        style={{ alignSelf: 'flex-start', fontSize: '0.78rem', marginTop: '0.2rem' }}
                        type="button"
                      >
                        <i className="ph ph-plus" /> Add Option
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="dynamic-field-group">
                <label>Placeholder</label>
                <input
                  disabled={isPublished}
                  onChange={(e) =>
                    setEditingFieldState((prev) =>
                      prev ? { ...prev, field: { ...prev.field, placeholder: e.target.value } } : null,
                    )
                  }
                  placeholder="e.g. Enter details..."
                  type="text"
                  value={editingFieldState.field.placeholder || ''}
                />
              </div>

              <div className="dynamic-field-group">
                <label>Help Text</label>
                <input
                  disabled={isPublished}
                  onChange={(e) =>
                    setEditingFieldState((prev) =>
                      prev ? { ...prev, field: { ...prev.field, helpText: e.target.value } } : null,
                    )
                  }
                  placeholder="Additional context shown below field"
                  type="text"
                  value={editingFieldState.field.helpText || ''}
                />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', margin: '0.5rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', cursor: 'pointer' }}>
                  <input
                    checked={editingFieldState.field.required}
                    disabled={isPublished}
                    onChange={(e) =>
                      setEditingFieldState((prev) =>
                        prev ? { ...prev, field: { ...prev.field, required: e.target.checked } } : null,
                      )
                    }
                    type="checkbox"
                  />
                  Required Field
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', cursor: 'pointer' }}>
                  <input
                    checked={Boolean(editingFieldState.field.readOnly)}
                    disabled={isPublished}
                    onChange={(e) =>
                      setEditingFieldState((prev) =>
                        prev ? { ...prev, field: { ...prev.field, readOnly: e.target.checked } } : null,
                      )
                    }
                    type="checkbox"
                  />
                  Read Only
                </label>
              </div>

              {/* Conditional Visibility Rules */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>Conditional Visibility</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    checked={Boolean(editingFieldState.field.visibilityRule)}
                    disabled={isPublished}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const firstKey = allOtherFields[0]?.fieldKey || 'understands_treatment';
                        setEditingFieldState((prev) =>
                          prev
                            ? {
                                ...prev,
                                field: {
                                  ...prev.field,
                                  visibilityRule: { fieldKey: firstKey, operator: 'EQUALS', value: 'No' },
                                },
                              }
                            : null,
                        );
                      } else {
                        setEditingFieldState((prev) =>
                          prev ? { ...prev, field: { ...prev.field, visibilityRule: undefined } } : null,
                        );
                      }
                    }}
                    type="checkbox"
                  />
                  Show this field conditionally based on another question
                </label>

                {editingFieldState.field.visibilityRule && (
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="dynamic-field-group">
                      <label>When Field</label>
                      <select
                        disabled={isPublished}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingFieldState((prev) =>
                            prev && prev.field.visibilityRule
                              ? {
                                  ...prev,
                                  field: {
                                    ...prev.field,
                                    visibilityRule: { ...prev.field.visibilityRule, fieldKey: val },
                                  },
                                }
                              : null,
                          );
                        }}
                        value={editingFieldState.field.visibilityRule.fieldKey}
                      >
                        {allOtherFields.map((f) => (
                          <option key={f.fieldKey} value={f.fieldKey}>
                            {f.label} ({f.fieldKey})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="dynamic-field-group">
                      <label>Condition</label>
                      <select
                        disabled={isPublished}
                        onChange={(e) => {
                          const op = e.target.value as any;
                          setEditingFieldState((prev) =>
                            prev && prev.field.visibilityRule
                              ? {
                                  ...prev,
                                  field: {
                                    ...prev.field,
                                    visibilityRule: { ...prev.field.visibilityRule, operator: op },
                                  },
                                }
                              : null,
                          );
                        }}
                        value={editingFieldState.field.visibilityRule.operator}
                      >
                        <option value="EQUALS">Equals</option>
                        <option value="NOT_EQUALS">Does not equal</option>
                        <option value="CONTAINS">Contains</option>
                      </select>
                    </div>

                    <div className="dynamic-field-group">
                      <label>Value</label>
                      <input
                        disabled={isPublished}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingFieldState((prev) =>
                            prev && prev.field.visibilityRule
                              ? {
                                  ...prev,
                                  field: {
                                    ...prev.field,
                                    visibilityRule: { ...prev.field.visibilityRule, value: val },
                                  },
                                }
                              : null,
                          );
                        }}
                        placeholder="e.g. No or Yes"
                        type="text"
                        value={editingFieldState.field.visibilityRule.value}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="consent-inspector-footer">
              <button
                className="doc-btn"
                onClick={() => setEditingFieldState(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="doc-btn primary"
                onClick={() => saveEditedField(editingFieldState.sectionId, editingFieldState.field)}
                type="button"
              >
                Save Field Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {showPreview && (
        <div className="consent-builder-overlay" style={{ zIndex: 1200 }} onClick={() => setShowPreview(false)}>
          <div
            className="consent-builder-dialog"
            style={{ maxWidth: '900px', height: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="consent-builder-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <i className="ph ph-eye" style={{ fontSize: '1.3rem', color: '#0284c7' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Live Interactive Form Preview
                </h3>
              </div>
              <button
                className="doc-icon-action"
                onClick={() => setShowPreview(false)}
                type="button"
              >
                <i className="ph ph-x" />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#fff' }}>
              <DynamicConsentFormRenderer
                category={template.category}
                contextData={{
                  doctorName: 'Dr. Sarah On-Duty',
                  departmentName: 'Dental & Oral Surgery',
                  branchName: 'Main Campus',
                  procedureName: 'Root Canal & Crown Restoration',
                  encounterNumber: 'ENC-2026-0042',
                  admissionNumber: 'ADM-2026-0010',
                }}
                formDefinition={getCurrentDefinition()}
                isPreview={true}
                onClose={() => setShowPreview(false)}
                patient={{
                  first_name: 'John',
                  middle_name: 'David',
                  last_name: 'Doe',
                  patient_number: 'MRN-000123',
                  date_of_birth: '1988-04-12',
                  gender: 'Male',
                  phone: '+254 712 345 678',
                  address: '123 Hospital Road, Nairobi',
                }}
                templateCode={template.code}
                templateTitle={template.name}
                templateVersion={template.version}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
