import { useCallback, useEffect, useMemo, useState } from 'react';
import { opdApi, type OpdPrescriptionResponse, type ApiOpdPrescriptionStatus } from '../api/opd';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';

export function PrescriptionQueuePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [prescriptions, setPrescriptions] = useState<OpdPrescriptionResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApiOpdPrescriptionStatus | ''>(
    (initialParams.get('status') as ApiOpdPrescriptionStatus | null) ?? ''
  );
  const [searchTerm, setSearchTerm] = useState(initialParams.get('search') ?? '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState('');
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<OpdPrescriptionResponse | null>(null);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3500);
  };

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await opdApi.listPrescriptions({
        search: searchTerm.trim() || undefined,
        status: statusFilter || undefined,
        limit: 100,
        sortBy: 'submitted_at',
        sortOrder: 'desc',
      });
      setPrescriptions(response.data);
    } catch (error: any) {
      setPrescriptions([]);
      setLoadError(error.message || 'Failed to load prescription queue');
      showToast(error.message || 'Failed to load prescription queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (statusFilter) params.set('status', statusFilter);
    const query = params.toString();
    const nextUrl = `/pharmacy/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openDispenseModal = (prescription: OpdPrescriptionResponse) => {
    setSelectedPrescription(prescription);
    setDispenseModalOpen(true);
  };

  const markAsDispensed = async () => {
    if (!selectedPrescription) return;
    setUpdating(selectedPrescription.id);
    try {
      await opdApi.updatePrescriptionStatus(selectedPrescription.id, 'DISPENSED');
      showToast(`Prescription for ${selectedPrescription.patient_name} marked as dispensed.`, 'success');
      setDispenseModalOpen(false);
      setSelectedPrescription(null);
      await loadQueue();
    } catch (error: any) {
      showToast(error.message || 'Failed to dispense prescription', 'error');
    } finally {
      setUpdating('');
    }
  };

  const pendingCount = prescriptions.filter(p => p.status === 'SUBMITTED').length;
  const dispensedCount = prescriptions.filter(p => p.status === 'DISPENSED').length;

  return (
    <>
      <div className="um-grid">
        <div className="um-kpi-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-pill" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Pending Dispensing</span>
              <span className="kpi-value">{loading ? '—' : pendingCount}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-check-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Dispensed Today</span>
              <span className="kpi-value">{loading ? '—' : dispensedCount}</span>
            </div>
          </div>
        </div>

        <section className="um-table-section card">
          <div className="um-toolbar">
            <div className="um-toolbar-row1">
              <div className="um-search">
                <i className="ph ph-magnifying-glass" aria-hidden="true" />
                <input
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search patient name, MRN, or doctor"
                  type="search"
                  value={searchTerm}
                />
              </div>
              <select 
                className="um-filter" 
                onChange={(event) => setStatusFilter(event.target.value as ApiOpdPrescriptionStatus | '')} 
                value={statusFilter}
              >
                <option value="">All Statuses (Excl. Drafts)</option>
                <option value="SUBMITTED">Submitted (Pending)</option>
                <option value="DISPENSED">Dispensed</option>
              </select>
              <button className="btn-secondary admin-table-action" disabled={loading} onClick={loadQueue} type="button">
                <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
              </button>
            </div>
          </div>

          {loadError ? <div className="form-error-banner" style={{ margin: '1rem' }}>{loadError}</div> : null}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Items</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={6}>
                      <span className="loading-spinner" /> Loading prescription queue...
                    </td>
                  </tr>
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={6}>
                      <i className="ph ph-inbox" aria-hidden="true" /> No prescriptions found in the queue.
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((rx) => (
                    <tr key={rx.id}>
                      <td>
                        <div className="user-cell-info">
                          <strong>{rx.patient_name}</strong>
                          <span className="muted-cell">{rx.patient_number}</span>
                        </div>
                      </td>
                      <td>{rx.doctor_name}</td>
                      <td><strong>{rx.items.length} meds</strong></td>
                      <td>{rx.submitted_at ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(rx.submitted_at)) : '—'}</td>
                      <td>
                        <span className={`diagnostic-status status-${rx.status.toLowerCase().replaceAll('_', '-')}`}>
                          {rx.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="action-icons">
                          {rx.status === 'SUBMITTED' ? (
                            <button
                              className="btn-primary compact"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                              onClick={() => openDispenseModal(rx)}
                              title="View and Dispense"
                              type="button"
                            >
                              <i className="ph ph-pill" aria-hidden="true" /> Dispense
                            </button>
                          ) : (
                            <button
                              className="btn-secondary compact"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                              onClick={() => openDispenseModal(rx)}
                              title="View Details"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" /> View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="um-pagination">
            <div className="um-showing">
              {prescriptions.length === 0 ? 'No prescriptions' : `Showing ${prescriptions.length} prescriptions`}
            </div>
          </div>
        </section>
      </div>

      <Modal
        onClose={() => setDispenseModalOpen(false)}
        open={dispenseModalOpen}
        title={selectedPrescription ? `Prescription for ${selectedPrescription.patient_name}` : 'Prescription Details'}
        size="large"
        footer={
          selectedPrescription?.status === 'SUBMITTED' ? (
            <>
              <button className="secondary-action" onClick={() => setDispenseModalOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary-action" disabled={!!updating} onClick={markAsDispensed} type="button">
                {updating ? 'Dispensing...' : 'Mark as Dispensed'}
              </button>
            </>
          ) : (
            <button className="secondary-action" onClick={() => setDispenseModalOpen(false)} type="button">
              Close
            </button>
          )
        }
      >
        {selectedPrescription && (
          <div className="rx-preview">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Doctor</p>
                <strong style={{ fontSize: '1.1rem' }}>{selectedPrescription.doctor_name}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Submitted At</p>
                <strong>{selectedPrescription.submitted_at ? new Date(selectedPrescription.submitted_at).toLocaleString() : '-'}</strong>
              </div>
            </div>
            
            <table className="doc-table opd-prescription-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage & Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {selectedPrescription.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.medicine_name}</strong>
                      {item.strength && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.strength}</div>}
                    </td>
                    <td>
                      {item.dosage} - {item.route}
                      <br />
                      <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>{item.frequency}</span>
                    </td>
                    <td>{item.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedPrescription.doctor_instructions && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>Doctor Instructions</h4>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>{selectedPrescription.doctor_instructions}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
