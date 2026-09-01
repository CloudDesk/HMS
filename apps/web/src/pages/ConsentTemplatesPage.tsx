import { useMemo, useState, type FormEvent } from 'react';
import type { ConsentContextType, ConsentTemplate, ConsentTemplateStatus } from '../api/consents';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { useConsentTemplatesFeature } from '../hooks/consents/useConsentTemplatesFeature';

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
  status: 'ACTIVE',
};

export function ConsentTemplatesPage() {
  const {
    state: { branches, branchId, templates, loading, saving },
    capabilities,
    actions,
  } = useConsentTemplatesFeature();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(empty);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(templates.length / pageSize));
  const paginatedTemplates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return templates.slice(start, start + pageSize);
  }, [templates, page, pageSize]);

  const start = (item?: ConsentTemplate) => {
    setEditing(item ?? null);
    setForm(
      item
        ? {
            code: item.code,
            name: item.name,
            category: item.category,
            context_type: item.context_type,
            mandatory: item.mandatory,
            status: item.status,
          }
        : empty,
    );
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await actions.save({ branch_id: branchId, ...form }, editing);
    setOpen(false);
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
              onClick={() => start()}
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
                      <td>v{item.version}</td>
                      <td>
                        <span className={`doc-status ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {capabilities.canEdit ? (
                          <button
                            className="doc-icon-action"
                            onClick={() => start(item)}
                            title="Edit"
                            type="button"
                          >
                            <i className="ph ph-pencil" />
                          </button>
                        ) : null}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Consent Template' : 'Add Consent Template'}>
        <form className="modal-form" onSubmit={(e) => void submit(e)}>
          <div className="doc-form-grid">
            <div className="doc-field">
              <label>Code</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="doc-field">
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="doc-field">
              <label>Category</label>
              <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="doc-field">
              <label>Context</label>
              <select
                value={form.context_type}
                onChange={(e) => setForm({ ...form, context_type: e.target.value as ConsentContextType })}
              >
                <option value="PATIENT">Patient / EMR</option>
                <option value="PROCEDURE">Procedure</option>
                <option value="ADMISSION">Admission</option>
              </select>
            </div>
            <div className="doc-field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <label className="form-checkbox">
              <input
                checked={form.mandatory}
                onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                type="checkbox"
              />{' '}
              Mandatory before confirmation
            </label>
          </div>
          <div className="modal-actions">
            <button className="doc-btn" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
