import type { ApiClinicalOrderPriority } from '../../api/opd';
import type { ServiceResponse } from '../../api/services';

export type ImagingOrderItem = {
  id: string;
  name: string;
  local_id: string;
  category?: string;
};

export type OpdImagingSectionProps = {
  imagingPriority: ApiClinicalOrderPriority;
  setImagingPriority: (val: ApiClinicalOrderPriority) => void;
  imagingCategory: string;
  setImagingCategory: (val: string) => void;
  imagingCategoryOptions: string[];
  availableImagingTests: ServiceResponse[];
  imagingOrders: ImagingOrderItem[];
  setImagingOrders: React.Dispatch<React.SetStateAction<ImagingOrderItem[]>>;
  handleToggleImagingTest: (test: ServiceResponse) => void;
  imagingSearchQuery: string;
  setImagingSearchQuery: (val: string) => void;
  imagingClinicalInfo: string;
  setImagingClinicalInfo: (val: string) => void;
  imagingOrderInstructions: string;
  setImagingOrderInstructions: (val: string) => void;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
};

export function OpdImagingSection({
  imagingPriority,
  setImagingPriority,
  imagingCategory,
  setImagingCategory,
  imagingCategoryOptions,
  availableImagingTests,
  imagingOrders,
  setImagingOrders,
  handleToggleImagingTest,
  imagingSearchQuery,
  setImagingSearchQuery,
  imagingClinicalInfo,
  setImagingClinicalInfo,
  imagingOrderInstructions,
  setImagingOrderInstructions,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
}: OpdImagingSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Imaging &amp; Radiology Requisition</h3>
            <p>Order X-rays, Ultrasounds, CT, or MRI scans</p>
          </div>
        </div>

        {canEdit && (
          <div className="doc-form-grid two" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <label className="doc-field" htmlFor="imaging-priority-sel">
              <span>Priority</span>
              <select
                id="imaging-priority-sel"
                onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)}
                value={imagingPriority}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </label>
            <label className="doc-field" htmlFor="imaging-category-sel">
              <span>Imaging Category</span>
              <select
                id="imaging-category-sel"
                onChange={(e) => setImagingCategory(e.target.value)}
                value={imagingCategory}
              >
                {imagingCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Modalities' : cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div
          className="opd-form-section-head"
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h4>Available Imaging Tests</h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Check scans to add to requisition ({availableImagingTests.length} available)
            </p>
          </div>
          <div style={{ position: 'relative', width: '240px' }}>
            <i
              className="ph ph-magnifying-glass"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            />
            <input
              className="opd-tests-search-input"
              onChange={(e) => setImagingSearchQuery(e.target.value)}
              placeholder="Filter imaging scans..."
              style={{ width: '100%', paddingLeft: '28px', height: '32px' }}
              type="text"
              value={imagingSearchQuery}
            />
          </div>
        </div>

        <div className="opd-tests-checkbox-grid">
          {availableImagingTests.length === 0 ? (
            <div
              style={{
                color: '#64748b',
                fontSize: '0.82rem',
                gridColumn: '1 / -1',
                padding: '16px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}
            >
              No imaging tests found matching current modality / filter.
            </div>
          ) : (
            availableImagingTests.map((test) => {
              const isSelected = imagingOrders.some((o) => o.id === test.id);
              return (
                <label
                  className={`opd-test-checkbox-label ${isSelected ? 'selected imaging' : ''}`}
                  key={test.id}
                >
                  <input
                    checked={isSelected}
                    disabled={!canEdit}
                    onChange={() => handleToggleImagingTest(test)}
                    type="checkbox"
                  />
                  <div className="opd-test-label-content">
                    <span className="opd-test-name">{test.name}</span>
                    <span className="opd-test-badge">
                      {test.category || 'Radiology / Scan'}
                    </span>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="doc-form-grid two" style={{ marginTop: '1rem' }}>
          <label className="doc-field" htmlFor="imaging-clinical-info">
            <span>Clinical Information</span>
            <textarea
              id="imaging-clinical-info"
              onChange={(e) => setImagingClinicalInfo(e.target.value)}
              placeholder="Clinical symptoms, suspected pathology, or trauma site..."
              rows={2}
              value={imagingClinicalInfo}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="imaging-order-instructions">
            <span>Order Instructions</span>
            <textarea
              id="imaging-order-instructions"
              onChange={(e) => setImagingOrderInstructions(e.target.value)}
              placeholder="Special radiology instructions, views requested, with/without contrast..."
              rows={2}
              value={imagingOrderInstructions}
              disabled={!canEdit}
            />
          </label>
        </div>

        <div className="opd-form-section-head" style={{ marginTop: '1.25rem' }}>
          <div>
            <h4>Selected Imaging Tests</h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Orders created during this consultation
            </p>
          </div>
        </div>

        <div className="doc-table-wrap">
          <table className="doc-table opd-prescription-table">
            <thead>
              <tr>
                <th>TEST</th>
                <th>CATEGORY</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                {canEdit && <th style={{ width: '48px' }} />}
              </tr>
            </thead>
            <tbody>
              {imagingOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 5 : 4}
                    style={{ textAlign: 'center', padding: '1.2rem', color: '#64748b' }}
                  >
                    No tests selected.
                  </td>
                </tr>
              ) : (
                imagingOrders.map((item) => (
                  <tr key={item.local_id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.category || imagingCategory}</td>
                    <td>
                      <span className="doc-status draft">{imagingPriority}</span>
                    </td>
                    <td>
                      <span className="doc-status pending">Pending Submit</span>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="doc-action danger"
                          onClick={() =>
                            setImagingOrders((prev) =>
                              prev.filter((i) => i.local_id !== item.local_id)
                            )
                          }
                          title="Remove test"
                          type="button"
                        >
                          <i className="ph ph-trash" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="opd-sticky-actions">
        <span className="opd-autosave saved">
          <i aria-hidden="true" className="ph ph-check-circle" />
          Auto-save enabled
        </span>
        <div>
          {canEdit && (
            <button className="doc-btn" onClick={saveConsultationDraft} type="button">
              Save Draft
            </button>
          )}
          <button className="doc-btn" onClick={() => window.print()} type="button">
            <i aria-hidden="true" className="ph ph-printer" />
            Print Imaging Order
          </button>
          <button
            className="doc-btn primary"
            onClick={() => handleNextStep('Referral')}
            type="button"
          >
            Next: Referral
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
