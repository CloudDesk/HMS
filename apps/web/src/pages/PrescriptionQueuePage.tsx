import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePharmacyDispensing, usePharmacyDispensingDetail } from '../hooks/usePharmacyDispensing';
import { StatusBadge } from '../components/ui/StatusBadge';

const tone = (status: string) => status === 'CONFIRMED' ? 'green' as const : status === 'CANCELLED' ? 'red' as const : status === 'REVERSED' ? 'purple' as const : 'orange' as const;

export function PrescriptionQueuePage() {
  const { user } = useAuth();
  const branchId = user?.branches[0]?.id ?? '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const queue = usePharmacyDispensing(branchId, search, status);
  const detail = usePharmacyDispensingDetail(selectedId);
  const selected = detail.data;

  useEffect(() => { if (selected) setQuantities(Object.fromEntries(selected.items.map((item) => [item.id, item.confirmed_quantity]))); }, [selected]);

  const run = async (action: 'confirm' | 'cancel' | 'reverse') => {
    if (!selected) return;
    try {
      if (action === 'confirm') await queue.confirm.mutateAsync({ id: selected.prescription_id, version: selected.version });
      if (action === 'cancel') await queue.cancel.mutateAsync({ id: selected.prescription_id, version: selected.version, reason: reason.trim() || 'Cancelled by pharmacy' });
      if (action === 'reverse') await queue.reverse.mutateAsync({ id: selected.prescription_id, version: selected.version, reason: reason.trim() || 'Reversed by pharmacy' });
      toast.success(`Dispensing ${action}d successfully.`); setSelectedId(''); setReason('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Pharmacy action failed.'); }
  };

  const saveQuantities = async () => {
    if (!selected) return;
    try {
      await queue.save.mutateAsync({ id: selected.prescription_id, payload: { version: selected.version, items: selected.items.map((item) => ({ prescription_item_id: item.prescription_item_id, medicine_id: item.medicine_id, batch_id: item.batch_id, confirmed_quantity: quantities[item.id] ?? item.confirmed_quantity, pharmacist_instructions: item.pharmacist_instructions })) } });
      toast.success('Dispensing quantities saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save dispensing quantities.'); }
  };

  return <div className="page-shell">
    <div className="page-heading"><div><h1>Prescription Dispensing</h1><p>Review submitted prescriptions, verify stock, and generate bills.</p></div></div>
    <section className="content-card">
      <div className="filter-toolbar"><input aria-label="Search prescriptions" placeholder="Search patient or number" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option><option value="REVERSED">Reversed</option></select></div>
      {!branchId && <p className="error-state">No authorized branch is assigned to this user.</p>}
      {queue.listQuery.isLoading && <p className="empty-state">Loading dispensing queue...</p>}
      {queue.listQuery.isError && <p className="error-state">Unable to load the dispensing queue. Refresh and try again.</p>}
      {!queue.listQuery.isLoading && !queue.listQuery.isError && (queue.listQuery.data?.data.length ?? 0) === 0 && <p className="empty-state">No prescriptions match this queue.</p>}
      {(queue.listQuery.data?.data ?? []).length > 0 && <table className="data-table"><thead><tr><th>Patient</th><th>MRN</th><th>Doctor</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{queue.listQuery.data?.data.map((item) => <tr key={item.prescription_id}><td><strong>{item.patient_name}</strong></td><td>{item.patient_number}</td><td>{item.doctor_name}</td><td><StatusBadge tone={tone(item.status)}>{item.status}</StatusBadge></td><td>{new Date(item.updated_at).toLocaleString()}</td><td><button className="btn-secondary compact" type="button" onClick={() => setSelectedId(item.prescription_id)}>Review</button></td></tr>)}</tbody></table>}
    </section>
    {selectedId && <section className="content-card" aria-label="Dispensing review"><div className="page-heading"><div><h2>{selected?.patient_name ?? 'Loading...'}</h2><p>{selected?.patient_number} - Dr. {selected?.doctor_name}</p></div><button className="btn-secondary" type="button" onClick={() => setSelectedId('')}>Close</button></div>{detail.isLoading && <p className="empty-state">Loading prescription details...</p>}{detail.isError && <p className="error-state">Unable to load dispensing details.</p>}{selected && <><div className="table-scroll"><table className="data-table"><thead><tr><th>Medicine</th><th>Batch</th><th>Available</th><th>Quantity</th><th>Line total</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.id}><td>{item.medicine_name}</td><td>{item.batch_number || 'No valid stock batch'}</td><td>{item.available_quantity}</td><td><input aria-label={`Quantity for ${item.medicine_name}`} type="number" min="1" max={item.available_quantity || undefined} disabled={selected.status !== 'DRAFT'} value={quantities[item.id] ?? item.confirmed_quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></td><td>{(item.unit_price * (quantities[item.id] ?? item.confirmed_quantity)).toFixed(2)}</td></tr>)}</tbody></table></div><textarea aria-label="Pharmacy reason" placeholder="Cancellation or reversal reason" value={reason} onChange={(event) => setReason(event.target.value)} />{selected.status === 'DRAFT' && <div className="button-row"><button className="btn-secondary" type="button" onClick={() => void run('cancel')}>Cancel prescription</button><button className="btn-secondary" type="button" disabled={queue.save.isPending} onClick={() => void saveQuantities()}>Save quantities</button><button className="btn-primary" type="button" disabled={selected.items.length === 0 || queue.confirm.isPending} onClick={() => void run('confirm')}>Confirm dispensing and bill</button></div>}{selected.status === 'CONFIRMED' && <button className="btn-danger" type="button" onClick={() => void run('reverse')}>Reverse dispensing</button>}</>}</section>}
  </div>;
}
