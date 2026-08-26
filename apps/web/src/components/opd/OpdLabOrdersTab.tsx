import type { ApiClinicalOrderPriority } from '../../api/opd';

interface OpdLabOrdersTabProps {
  labTestServices: Array<{ id: string; name: string; code?: string }>;
  labOrders: Array<{ id: string; name: string; local_id: string }>;
  setLabOrders: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; local_id: string }>>>;
  labPriority: ApiClinicalOrderPriority;
  setLabPriority: (priority: ApiClinicalOrderPriority) => void;
  selectedLabTest: string;
  setSelectedLabTest: (val: string) => void;
  canEdit: boolean;
}

export function OpdLabOrdersTab({
  labTestServices,
  labOrders,
  setLabOrders,
  labPriority,
  setLabPriority,
  selectedLabTest,
  setSelectedLabTest,
  canEdit,
}: OpdLabOrdersTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Laboratory Requisition</h3>
            <p>Order laboratory tests for this encounter</p>
          </div>
        </div>
        
        {canEdit && (
          <div className="doc-form-grid two">
            <label className="doc-field" htmlFor="lab-test-name">
              <span>Test / Investigation Name</span>
              <select 
                id="lab-test-name" 
                onChange={(e) => setSelectedLabTest(e.target.value)} 
                value={selectedLabTest}
              >
                <option value="">Select Lab Test from Service Catalogue</option>
                {labTestServices.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name} {service.code ? `(${service.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="doc-field" htmlFor="lab-priority">
              <span>Priority</span>
              <select 
                id="lab-priority" 
                onChange={(e) => setLabPriority(e.target.value as ApiClinicalOrderPriority)} 
                value={labPriority}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </label>
            
            <button
              className="doc-btn primary add-medication"
              onClick={() => {
                if (!selectedLabTest.trim()) return;
                const matchedLab = labTestServices.find(s => s.name === selectedLabTest);
                if (!matchedLab) return;
                setLabOrders((prev) => [
                  ...prev,
                  { id: matchedLab.id, name: selectedLabTest, local_id: `lab-${Date.now()}` }
                ]);
                setSelectedLabTest('');
              }}
              type="button"
              style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
            >
              <i className="ph ph-plus" aria-hidden="true" /> Add Test
            </button>
          </div>
        )}

        <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="doc-table opd-prescription-table">
            <thead>
              <tr>
                <th>Test / Investigation Name</th>
                {canEdit && <th style={{ width: '60px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {labOrders.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 2 : 1} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                    No lab tests added yet. Select a test and click "Add Test".
                  </td>
                </tr>
              ) : (
                labOrders.map((item) => (
                  <tr key={item.local_id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="btn-icon"
                          onClick={() => setLabOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                          title="Remove test"
                          type="button"
                        >
                          <i className="ph ph-trash" aria-hidden="true" style={{ color: '#ef4444' }} />
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
    </article>
  );
}
