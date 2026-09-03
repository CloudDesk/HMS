import type { ApiClinicalOrderPriority } from '../../api/opd';
import type { ServiceResponse } from '../../api/services';

export type LabOrderItem = {
  id: string;
  name: string;
  local_id: string;
  category?: string;
};

export type OpdLabSectionProps = {
  labPriority: ApiClinicalOrderPriority;
  setLabPriority: (val: ApiClinicalOrderPriority) => void;
  labFacility: string;
  setLabFacility: (val: string) => void;
  labFacilities: string[];
  labSampleType: string;
  setLabSampleType: (val: string) => void;
  labSampleTypeOptions: string[];
  labCategory: string;
  setLabCategory: (val: string) => void;
  labCategoryOptions: string[];
  availableLabTests: ServiceResponse[];
  labOrders: LabOrderItem[];
  setLabOrders: React.Dispatch<React.SetStateAction<LabOrderItem[]>>;
  handleToggleLabTest: (test: ServiceResponse) => void;
  labSearchQuery: string;
  setLabSearchQuery: (val: string) => void;
  labClinicalNotes: string;
  setLabClinicalNotes: (val: string) => void;
  labOrderSummary: string;
  setLabOrderSummary: (val: string) => void;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
};

export function OpdLabSection({
  labPriority,
  setLabPriority,
  labFacility,
  setLabFacility,
  labFacilities,
  labSampleType,
  setLabSampleType,
  labSampleTypeOptions,
  labCategory,
  setLabCategory,
  labCategoryOptions,
  availableLabTests,
  labOrders,
  setLabOrders,
  handleToggleLabTest,
  labSearchQuery,
  setLabSearchQuery,
  labClinicalNotes,
  setLabClinicalNotes,
  labOrderSummary,
  setLabOrderSummary,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
}: OpdLabSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Laboratory Order</h3>
            <p>Select priority, category and requested investigations</p>
          </div>
        </div>

        {canEdit && (
          <div className="doc-form-grid four" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <label className="doc-field" htmlFor="lab-priority-sel">
              <span>Priority</span>
              <select
                id="lab-priority-sel"
                onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)}
                value={labPriority}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </label>
            <label className="doc-field" htmlFor="lab-facility-sel">
              <span>Laboratory</span>
              <select
                id="lab-facility-sel"
                onChange={(e) => setLabFacility(e.target.value)}
                value={labFacility}
              >
                {labFacilities.map((facility) => (
                  <option key={facility} value={facility}>
                    {facility}
                  </option>
                ))}
              </select>
            </label>
            <label className="doc-field" htmlFor="lab-sample-type-sel">
              <span>Sample Type</span>
              <select
                id="lab-sample-type-sel"
                onChange={(e) => setLabSampleType(e.target.value)}
                value={labSampleType}
              >
                {labSampleTypeOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
            <label className="doc-field" htmlFor="lab-category-sel">
              <span>Laboratory Category</span>
              <select
                id="lab-category-sel"
                onChange={(e) => setLabCategory(e.target.value)}
                value={labCategory}
              >
                {labCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
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
            <h4>Available Tests</h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Check tests to add to requisition ({availableLabTests.length} available)
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
              onChange={(e) => setLabSearchQuery(e.target.value)}
              placeholder="Filter lab tests..."
              style={{ width: '100%', paddingLeft: '28px', height: '32px' }}
              type="text"
              value={labSearchQuery}
            />
          </div>
        </div>

        <div className="opd-tests-checkbox-grid">
          {availableLabTests.length === 0 ? (
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
              No lab tests found matching current category / filter.
            </div>
          ) : (
            availableLabTests.map((test) => {
              const isSelected = labOrders.some((o) => o.id === test.id);
              return (
                <label
                  className={`opd-test-checkbox-label ${isSelected ? 'selected' : ''}`}
                  key={test.id}
                >
                  <input
                    checked={isSelected}
                    disabled={!canEdit}
                    onChange={() => handleToggleLabTest(test)}
                    type="checkbox"
                  />
                  <div className="opd-test-label-content">
                    <span className="opd-test-name">{test.name}</span>
                    <span className="opd-test-badge">
                      {test.sample_type ? `Sample: ${test.sample_type}` : test.category || 'General Lab'}
                    </span>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="doc-form-grid two" style={{ marginTop: '1rem' }}>
          <label className="doc-field" htmlFor="lab-clinical-notes">
            <span>Clinical Notes</span>
            <textarea
              id="lab-clinical-notes"
              onChange={(e) => setLabClinicalNotes(e.target.value)}
              placeholder="Clinical indication or suspected conditions..."
              rows={2}
              value={labClinicalNotes}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="lab-order-summary">
            <span>Order Summary</span>
            <textarea
              id="lab-order-summary"
              onChange={(e) => setLabOrderSummary(e.target.value)}
              placeholder="Instructions for laboratory technician..."
              rows={2}
              value={labOrderSummary}
              disabled={!canEdit}
            />
          </label>
        </div>

        <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
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
              {labOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 5 : 4}
                    style={{ textAlign: 'center', padding: '1.2rem', color: '#64748b' }}
                  >
                    No lab tests selected yet.
                  </td>
                </tr>
              ) : (
                labOrders.map((item) => (
                  <tr key={item.local_id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.category || labCategory}</td>
                    <td>
                      <span className="doc-status draft">{labPriority}</span>
                    </td>
                    <td>
                      <span className="doc-status pending">Pending Submit</span>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="doc-action danger"
                          onClick={() =>
                            setLabOrders((prev) => prev.filter((i) => i.local_id !== item.local_id))
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
            Print Laboratory Order
          </button>
          <button
            className="doc-btn primary"
            onClick={() => handleNextStep('Imaging Orders')}
            type="button"
          >
            Next: Imaging Orders
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
