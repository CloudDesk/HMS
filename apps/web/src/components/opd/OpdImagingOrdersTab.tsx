import type { ApiClinicalOrderPriority } from '../../api/opd';

interface OpdImagingOrdersTabProps {
  imagingServices: Array<{ id: string; name: string; code?: string }>;
  imagingOrders: Array<{ id: string; name: string; local_id: string }>;
  setImagingOrders: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; local_id: string }>>>;
  imagingPriority: ApiClinicalOrderPriority;
  setImagingPriority: (priority: ApiClinicalOrderPriority) => void;
  selectedImagingTest: string;
  setSelectedImagingTest: (val: string) => void;
  canEdit: boolean;
}

export function OpdImagingOrdersTab({
  imagingServices,
  imagingOrders,
  setImagingOrders,
  imagingPriority,
  setImagingPriority,
  selectedImagingTest,
  setSelectedImagingTest,
  canEdit,
}: OpdImagingOrdersTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Radiology / Imaging Requisition</h3>
            <p>Order imaging studies for this encounter</p>
          </div>
        </div>
        
        {canEdit && (
          <div className="doc-form-grid two">
            <label className="doc-field" htmlFor="imaging-test-name">
              <span>Test / Study Name</span>
              <select 
                id="imaging-test-name" 
                onChange={(e) => setSelectedImagingTest(e.target.value)} 
                value={selectedImagingTest}
              >
                <option value="">Select Imaging Study from Service Catalogue</option>
                {imagingServices.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name} {service.code ? `(${service.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="doc-field" htmlFor="imaging-priority">
              <span>Priority</span>
              <select 
                id="imaging-priority" 
                onChange={(e) => setImagingPriority(e.target.value as ApiClinicalOrderPriority)} 
                value={imagingPriority}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </label>
            
            <button
              className="doc-btn primary add-medication"
              onClick={() => {
                if (!selectedImagingTest.trim()) return;
                const matchedImaging = imagingServices.find(s => s.name === selectedImagingTest);
                if (!matchedImaging) return;
                setImagingOrders((prev) => [
                  ...prev,
                  { id: matchedImaging.id, name: selectedImagingTest, local_id: `img-${Date.now()}` }
                ]);
                setSelectedImagingTest('');
              }}
              type="button"
              style={{ alignSelf: 'flex-end', height: 'fit-content', marginBottom: '4px' }}
            >
              <i className="ph ph-plus" aria-hidden="true" /> Add Study
            </button>
          </div>
        )}

        <div className="doc-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="doc-table opd-prescription-table">
            <thead>
              <tr>
                <th>Test / Study Name</th>
                {canEdit && <th style={{ width: '60px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {imagingOrders.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 2 : 1} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                    No imaging studies added yet. Select a study and click "Add Study".
                  </td>
                </tr>
              ) : (
                imagingOrders.map((item) => (
                  <tr key={item.local_id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="btn-icon"
                          onClick={() => setImagingOrders(prev => prev.filter(i => i.local_id !== item.local_id))}
                          title="Remove study"
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
