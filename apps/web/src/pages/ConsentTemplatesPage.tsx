import { useMemo, useState, type FormEvent } from 'react';
import type { ConsentContextType, ConsentTemplate, ConsentTemplateStatus } from '../api/consents';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { useConsentTemplatesFeature } from '../hooks/consents/useConsentTemplatesFeature';
import { ConsentFormBuilderModal } from '../components/consents/form-builder/ConsentFormBuilderModal';
import { toast } from 'sonner';

type TemplateForm = {
  code: string;
  name: string;
  category: string;
  context_type: ConsentContextType;
  mandatory: boolean;
  status: ConsentTemplateStatus;
};

const empty: TemplateForm = {
  code: '',
  name: '',
  category: '',
  context_type: 'PATIENT',
  mandatory: false,
  status: 'DRAFT',
};

const commonCategories = [
  'General Treatment Consent',
  'Patient Consent',
  'Procedure Consent',
  'Surgery Consent',
  'Admission Consent',
  'Discharge Consent',
  'Anesthesia Consent',
  'Blood Transfusion Consent',
  'Diagnostic Consent',
  'Medication Consent',
];

function formatErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const msg = (err as any)?.message;
  if (typeof msg === 'string') {
    const trimmed = msg.trim();
    if (trimmed.startsWith('[') && trimmed.includes('"message"')) {
      try {
        const issues = JSON.parse(trimmed);
        if (Array.isArray(issues) && issues.length > 0) {
          return issues.map((i: any) => `${i.path?.join('.') ? `[${i.path.join('.')}] ` : ''}${i.message || 'Validation error'}`).join(', ');
        }
      } catch {
        // ignore
      }
    }
    return msg;
  }
  return fallback;
}

export function ConsentTemplatesPage() {
  const {
    state: { branches, branchId, templates, loading, saving },
    capabilities,
    actions,
  } = useConsentTemplatesFeature();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(empty);
  const [modalBranchId, setModalBranchId] = useState<string>('');

  // Form Builder state
  const [builderTemplate, setBuilderTemplate] = useState<ConsentTemplate | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(templates.length / pageSize));
  const paginatedTemplates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return templates.slice(start, start + pageSize);
  }, [templates, page, pageSize]);

  const startCreate = () => {
    setEditing(null);
    setForm(empty);
    setModalBranchId(branchId || branches[0]?.id || '');
    setOpen(true);
  };

  const startEdit = (item: ConsentTemplate) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      category: item.category,
      context_type: item.context_type,
      mandatory: item.mandatory,
      status: item.status,
    });
    setModalBranchId(item.branch_id || branchId || branches[0]?.id || '');
    setOpen(true);
  };

  const openFormBuilder = (item: ConsentTemplate) => {
    setBuilderTemplate(item);
  };

  const handleNextToBuilder = async (event: FormEvent) => {
    event.preventDefault();
    const effectiveBranchId = modalBranchId || branchId;
    if (!effectiveBranchId || !/^[a-f\d]{24}$/i.test(effectiveBranchId)) {
      toast.error('Please select a valid hospital branch.');
      return;
    }
    try {
      const saved = await actions.save(
        {
          branch_id: effectiveBranchId,
          ...form,
          code: form.code.trim().toUpperCase(),
          status: form.status || 'DRAFT',
        },
        editing,
      );
      setOpen(false);
      if (saved) {
        setBuilderTemplate(saved);
      }
    } catch (err: unknown) {
      toast.error(formatErrorMessage(err, 'Failed to save template information.'));
    }
  };

  const handleCreateNewVersion = async (templateId: string, targetBranchId?: string) => {
    try {
      const next = await actions.createNextVersion(templateId, targetBranchId);
      if (next) {
        setBuilderTemplate(next);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create new version.');
    }
  };

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Consent Templates</h2>
            <p>Configure categories, mandatory triggers and versioned consent forms</p>
          </div>
          <div className="appointment-page-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                aria-label="Select Branch"
                className="um-filter"
                style={{ minWidth: '180px', fontWeight: 500 }}
                onChange={(e) => {
                  actions.setBranchId(e.target.value);
                  setPage(1);
                }}
                value={branchId}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="doc-btn primary"
              disabled={!branchId || !capabilities.canCreate}
              onClick={startCreate}
              type="button"
            >
              <i className="ph ph-plus" /> Add Template
            </button>
          </div>
        </section>

        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>NAME</th>
                  <th>CATEGORY</th>
                  <th>CONTEXT</th>
                  <th>MANDATORY</th>
                  <th>VERSION</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem 1rem' }}>
                      <MedicalLoader text="Loading consent templates..." subtext="Accessing branch consent forms" />
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      No consent templates configured.
                    </td>
                  </tr>
                ) : (
                  paginatedTemplates.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="emp-id">{item.code}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td>
                        <span className="role-badge role-blue">{item.context_type}</span>
                      </td>
                      <td>
                        {item.mandatory ? (
                          <span className="status-badge status-locked">Yes</span>
                        ) : (
                          <span className="status-badge status-active">No</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#0284c7' }}>v{item.version}</span>
                      </td>
                      <td>
                        <span
                          className={`doc-status ${
                            item.status === 'ACTIVE'
                              ? 'active'
                              : item.status === 'DRAFT'
                              ? 'pending'
                              : 'inactive'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Configure Form Builder */}
                          <button
                            className="doc-btn compact"
                            onClick={() => openFormBuilder(item)}
                            style={{
                              fontSize: '0.74rem',
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Open Form Builder to configure sections and fields"
                            type="button"
                          >
                            <i className="ph ph-sliders-horizontal" /> Configure Form
                          </button>

                          {/* Edit Metadata */}
                          {capabilities.canEdit && item.status !== 'ACTIVE' ? (
                            <button
                              className="doc-icon-action"
                              onClick={() => startEdit(item)}
                              title="Edit Template Information"
                              type="button"
                            >
                              <i className="ph ph-pencil" />
                            </button>
                          ) : null}

                          {/* Create New Version from Published Template */}
                          {capabilities.canCreate && item.status === 'ACTIVE' ? (
                            <button
                              className="doc-icon-action"
                              onClick={() => handleCreateNewVersion(item.id)}
                              title={`Create new version (v${item.version + 1}) to edit`}
                              type="button"
                            >
                              <i className="ph ph-git-branch" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {templates.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.82rem',
                color: '#64748b',
                background: '#ffffff',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
              }}
            >
              <div>
                Showing <strong>{Math.min((page - 1) * pageSize + 1, templates.length)}</strong> to{' '}
                <strong>{Math.min(page * pageSize, templates.length)}</strong> of{' '}
                <strong>{templates.length}</strong> consent templates
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  <i className="ph ph-caret-left" /> Previous
                </button>
                <span style={{ padding: '0 8px', fontWeight: 600, color: '#1e293b' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Next <i className="ph ph-caret-right" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Step 1: Template Information Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Consent Template Information' : 'Add Consent Template — Step 1: Information'}
        icon="ph-file-text"
        size="large"
      >
        <form className="modal-form consent-template-form" onSubmit={handleNextToBuilder}>
          <div className="doc-form-grid">
            <div className="doc-field">
              <label>
                Branch <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                disabled={Boolean(editing)}
                value={modalBranchId || branchId}
                onChange={(e) => {
                  setModalBranchId(e.target.value);
                  actions.setBranchId(e.target.value);
                }}
                required
              >
                {branches.length === 0 ? (
                  <option value="">No branches available</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Assigned branch scope
              </small>
            </div>

            <div className="doc-field">
              <label>
                Code <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                disabled={Boolean(editing)}
                placeholder="e.g. CONSENT-OPD-001"
                required
                style={{ textTransform: 'uppercase' }}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Unique code. Cannot be changed once published.
              </small>
            </div>

            <div className="doc-field">
              <label>
                Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                placeholder="e.g. General OPD Treatment Consent"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Clinical template title
              </small>
            </div>

            <div className="doc-field">
              <label>
                Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                list="consent-categories-list"
                placeholder="e.g. Treatment Consent"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="consent-categories-list">
                {commonCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Specialty or care classification
              </small>
            </div>

            <div className="doc-field">
              <label>
                Context <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={form.context_type}
                onChange={(e) => setForm({ ...form, context_type: e.target.value as ConsentContextType })}
              >
                <option value="PATIENT">Patient / EMR</option>
                <option value="PROCEDURE">Procedure</option>
                <option value="ADMISSION">Admission</option>
              </select>
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Clinical workflow trigger point
              </small>
            </div>

            <div className="doc-field">
              <label>Initial Status</label>
              <select
                disabled={!editing}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ConsentTemplateStatus })}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                Publication lifecycle state
              </small>
            </div>

            <div className="doc-field full" style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: form.mandatory ? '#eff6ff' : '#f8fafc',
                  border: `1.5px solid ${form.mandatory ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                  boxShadow: form.mandatory ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  {/* Custom Toggle Switch */}
                  <div
                    aria-hidden="true"
                    style={{
                      width: '42px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: form.mandatory ? '#2563eb' : '#cbd5e1',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: form.mandatory ? '21px' : '3px',
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 650,
                          color: form.mandatory ? '#1d4ed8' : '#1e293b',
                          fontSize: '0.88rem',
                          lineHeight: 1.2,
                        }}
                      >
                        Mandatory before confirmation
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: form.mandatory ? '#dbeafe' : '#f1f5f9',
                          color: form.mandatory ? '#1e40af' : '#64748b',
                          border: form.mandatory ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        }}
                      >
                        {form.mandatory ? 'Strict Enforcement' : 'Optional'}
                      </span>
                    </div>
                    <small
                      style={{
                        color: '#64748b',
                        fontSize: '0.78rem',
                        lineHeight: 1.4,
                        display: 'block',
                      }}
                    >
                      If enabled, clinical procedures or admission confirmation will be blocked until signed.
                    </small>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={form.mandatory}
                  onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: 'none',
                    width: 0,
                    height: 0,
                  }}
                />
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
            <button className="doc-btn" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={saving} type="submit">
              {saving ? 'Saving...' : editing ? 'Save & Open Builder' : 'Next: Build Consent Form →'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Step 2: Consent Form Builder Modal */}
      {builderTemplate && (
        <ConsentFormBuilderModal
          branchId={builderTemplate.branch_id || branchId}
          onClose={() => {
            setBuilderTemplate(null);
            actions.refetch();
          }}
          onCreateNewVersion={
            capabilities.canCreate
              ? async () => {
                  await handleCreateNewVersion(builderTemplate.id, builderTemplate.branch_id || branchId);
                }
              : undefined
          }
          onPublish={async () => {
            const bId = builderTemplate.branch_id || branchId;
            await actions.publish(builderTemplate.id, bId);
            setBuilderTemplate((prev) => (prev ? { ...prev, status: 'ACTIVE' } : null));
            actions.refetch();
          }}
          onSaveFormDefinition={async (definition) => {
            const bId = builderTemplate.branch_id || branchId;
            await actions.saveFormDefinition(builderTemplate.id, definition, bId);
            setBuilderTemplate((prev) => (prev ? { ...prev, form_definition: definition } : null));
            actions.refetch();
          }}
          open={Boolean(builderTemplate)}
          saving={saving}
          template={builderTemplate}
        />
      )}
    </>
  );
}
