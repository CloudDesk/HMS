import { useMemo, useState } from 'react';
import { useBedAvailabilityFeature } from '../hooks/reception/useBedAvailabilityFeature';

export function BedAvailabilityPage() {
  const { state, actions } = useBedAvailabilityFeature();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(state.beds.length / pageSize));
  const paginatedBeds = useMemo(() => {
    const start = (page - 1) * pageSize;
    return state.beds.slice(start, start + pageSize);
  }, [state.beds, page, pageSize]);

  return (
    <div className="appointment-page">
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Bed Availability</h2>
          <p>Read-only availability from Bed Management</p>
        </div>
        <div className="appointment-page-actions">
          <select
            aria-label="Branch"
            onChange={(e) => {
              actions.setBranchId(e.target.value);
              setPage(1);
            }}
            value={state.branchId}
          >
            {state.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="consent-kpi-grid">
        <article className="doc-card consent-kpi-card">
          <div>
            <span>Available</span>
            <strong>{state.summary?.available ?? 0}</strong>
          </div>
        </article>
        <article className="doc-card consent-kpi-card">
          <div>
            <span>Occupied</span>
            <strong>{state.summary?.occupied ?? 0}</strong>
          </div>
        </article>
        <article className="doc-card consent-kpi-card">
          <div>
            <span>Reserved</span>
            <strong>{state.summary?.reserved ?? 0}</strong>
          </div>
        </article>
        <article className="doc-card consent-kpi-card">
          <div>
            <span>Unavailable</span>
            <strong>{(state.summary?.blocked ?? 0) + (state.summary?.under_maintenance ?? 0)}</strong>
          </div>
        </article>
      </section>

      <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>BED</th>
                <th>WARD</th>
                <th>ROOM</th>
                <th>CATEGORY</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={5}>Loading available beds...</td>
                </tr>
              ) : state.beds.length === 0 ? (
                <tr>
                  <td colSpan={5}>No beds are currently available.</td>
                </tr>
              ) : (
                paginatedBeds.map((bed) => (
                  <tr key={bed.id}>
                    <td>
                      <strong>{bed.bed_number}</strong>
                    </td>
                    <td>{bed.ward_name}</td>
                    <td>{bed.room_number ?? '-'}</td>
                    <td>{bed.bed_category}</td>
                    <td>
                      <span className="doc-status active">{bed.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {state.beds.length > 0 && (
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
              Showing <strong>{Math.min((page - 1) * pageSize + 1, state.beds.length)}</strong> to{' '}
              <strong>{Math.min(page * pageSize, state.beds.length)}</strong> of{' '}
              <strong>{state.beds.length}</strong> beds
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
  );
}

