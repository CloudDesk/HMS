import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { useAdmissionsConfiguration } from '../hooks/useAdmissionsConfiguration';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { BedStatus, WardStatus } from '../api/admissions-configuration';
import { branchesApi } from '../api/branches';

const wardSchema = z.object({ name: z.string().trim().min(1, 'Ward name is required').max(100), ward_type: z.string().trim().min(1, 'Ward type is required').max(100), floor: z.string().trim().min(1, 'Floor is required').max(50), description: z.string().trim().max(500) });
const bedSchema = z.object({ ward_id: z.string().min(1, 'Ward is required'), bed_number: z.string().trim().min(1, 'Bed number is required').max(50), bed_category: z.string().trim().min(1, 'Bed category is required').max(100), room_number: z.string().trim().max(50) });
type ActionTarget = { kind: 'ward' | 'bed'; id: string; label: string; status: string } | null;

const statusTone = (status: string) => status === 'AVAILABLE' || status === 'ACTIVE' ? 'green' as const : status === 'OCCUPIED' ? 'red' as const : status === 'RESERVED' ? 'orange' as const : status === 'UNDER_MAINTENANCE' || status === 'INACTIVE' ? 'gray' as const : 'purple' as const;

// Helper to mock patient name based on bed id
const mockPatientName = (id: string) => {
  const names = ['Brian Mutua', 'Lucy Wanjiku', 'Robert Achieng', 'John Kamau', 'Peter Odhiambo'];
  const index = parseInt(id.slice(-1), 16);
  return names[isNaN(index) ? 0 : index % names.length] || 'Unknown Patient';
};

export function BedManagementPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const assignedBranches = user?.branches ?? [];
  const allBranchesQuery = useQuery({ queryKey: ['admissions', 'configuration-branches'], queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }), enabled: isSuperAdmin });
  const branches = isSuperAdmin ? (allBranchesQuery.data?.data ?? []) : assignedBranches;
  const [branchId, setBranchId] = useState('');
  useEffect(() => { if (!branchId && branches[0]?.id) setBranchId(branches[0].id); }, [branchId, branches]);
  
  const [search, setSearch] = useState('');
  const [bedStatus, setBedStatus] = useState<BedStatus | ''>('');
  const [tab, setTab] = useState<'overview' | 'allocation'>('overview');
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  
  const [selectedBed, setSelectedBed] = useState<any>(null);

  const config = useAdmissionsConfiguration(branchId, search, bedStatus || undefined);
  const wardForm = useForm<z.infer<typeof wardSchema>>({ resolver: zodResolver(wardSchema), defaultValues: { name: '', ward_type: '', floor: '', description: '' } });
  const bedForm = useForm<z.infer<typeof bedSchema>>({ resolver: zodResolver(bedSchema), defaultValues: { ward_id: '', bed_number: '', bed_category: '', room_number: '' } });

  const createWard = async (values: z.infer<typeof wardSchema>) => { try { await config.createWard.mutateAsync({ branch_id: branchId, ...values, description: values.description || null }); wardForm.reset(); toast.success('Ward created successfully.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to create ward.'); } };
  const createBed = async (values: z.infer<typeof bedSchema>) => { try { await config.createBed.mutateAsync({ branch_id: branchId, ...values, room_number: values.room_number || null }); bedForm.reset({ ward_id: values.ward_id, bed_number: '', bed_category: '', room_number: '' }); toast.success('Bed created successfully.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to create bed.'); } };
  const confirmStatus = async () => { if (!actionTarget) return; try { if (actionTarget.kind === 'ward') { const next: WardStatus = actionTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; await config.wardStatus.mutateAsync({ id: actionTarget.id, body: { branch_id: branchId, status: next } }); toast.success(`${actionTarget.label} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`); } else { const next: BedStatus = actionTarget.status === 'AVAILABLE' ? 'INACTIVE' : 'AVAILABLE'; await config.bedStatus.mutateAsync({ id: actionTarget.id, body: { branch_id: branchId, status: next } }); toast.success(`${actionTarget.label} ${next === 'AVAILABLE' ? 'activated' : 'deactivated'}.`); } setActionTarget(null); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to change status.'); } };

  const summary = config.summaryQuery.data ?? { total: 0, available: 0, occupied: 0, reserved: 0, blocked: 0, under_maintenance: 0, inactive: 0 };
  const wards = config.wardsQuery.data?.data ?? [];
  const beds = config.bedsQuery.data?.data ?? [];
  const busy = config.wardsQuery.isLoading || config.bedsQuery.isLoading || config.summaryQuery.isLoading;

  return <div className="page-shell">
    <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h1>Bed Management</h1>
        <p>Ward capacity, room allocation and bed assignment</p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button className="btn-secondary compact">🖨 Print Bed List</button>
        <button className="btn-primary compact">+ Select Patient</button>
      </div>
    </div>
    
    {!branchId && isSuperAdmin && allBranchesQuery.isLoading && <div className="admin-dashboard-state"><strong>Loading authorized branches</strong><span>Fetching active branches available to the administrator.</span></div>}
    {!branchId && isSuperAdmin && allBranchesQuery.isError && <div className="admin-dashboard-state admin-dashboard-state--error"><strong>Unable to load branches</strong><span>Refresh the page or verify Administration branch permissions.</span></div>}
    {!branchId && isSuperAdmin && allBranchesQuery.isSuccess && branches.length === 0 && <div className="admin-dashboard-state admin-dashboard-state--error"><strong>No active branches</strong><span>Create or activate a branch before managing wards and beds.</span></div>}
    {!branchId && !isSuperAdmin && <div className="admin-dashboard-state admin-dashboard-state--error"><strong>No authorized branch</strong><span>Assign this user to a branch before managing wards and beds.</span></div>}
    
    {branchId && <>
      <section className="kpi-grid enhanced">
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>🛏</div>
            <span className="kpi-title">Total Beds</span>
          </div>
          <strong className="kpi-value">{summary.total}</strong>
          <span className="kpi-subtext">Registered capacity</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>✓</div>
            <span className="kpi-title">Available Beds</span>
          </div>
          <strong className="kpi-value">{summary.available}</strong>
          <span className="kpi-subtext">Ready now</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>👤</div>
            <span className="kpi-title">Occupied Beds</span>
          </div>
          <strong className="kpi-value">{summary.occupied}</strong>
          <span className="kpi-subtext">Active patients</span>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-header">
            <div className="kpi-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>🔖</div>
            <span className="kpi-title">Reserved Beds</span>
          </div>
          <strong className="kpi-value">{summary.reserved}</strong>
          <span className="kpi-subtext">Awaiting arrival</span>
        </div>
      </section>

      <div className="tabs-container">
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Ward Overview</button>
        <button className={`tab-btn ${tab === 'allocation' ? 'active' : ''}`} onClick={() => setTab('allocation')}>Bed Allocation</button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="filters-toolbar" style={{ marginBottom: 0 }}>
            <label><span>Ward</span><select><option>All</option></select></label>
            <label><span>Room</span><select><option>All</option></select></label>
            <label><span>Room Type</span><select><option>All</option></select></label>
            <label><span>Bed Type</span><select><option>All</option></select></label>
            <label><span>Floor</span><select><option>All</option></select></label>
            <label><span>Bed Status</span>
              <select value={bedStatus} onChange={(event) => setBedStatus(event.target.value as BedStatus | '')}>
                <option value="">All statuses</option>
                {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as BedStatus[]).map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label style={{ flex: '2 1 200px' }}><span>Search Bed</span>
              <input placeholder="Ward, room or bed" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>

          <div className="split-layout">
            <div className="split-layout__main">
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Ward Overview</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Live visual bed state</span>
              </div>
              
              {busy ? (
                <p className="empty-state">Loading bed states...</p>
              ) : beds.length === 0 ? (
                <p className="empty-state">No beds configured for this branch.</p>
              ) : (
                <div className="bed-grid">
                  {beds.map((bed) => {
                    const isOccupied = bed.status === 'OCCUPIED';
                    const isSelected = selectedBed?.id === bed.id;
                    return (
                      <div 
                        key={bed.id} 
                        className={`bed-card status-${bed.status}`}
                        onClick={() => setSelectedBed(bed)}
                        style={{ border: isSelected ? '2px solid var(--primary-color)' : '' }}
                      >
                        <div className="bed-number">{bed.bed_number}</div>
                        <div className="ward-name">{bed.ward_name} · {bed.bed_category}</div>
                        
                        <div className="bed-patient" style={{ color: isOccupied ? 'var(--text-color)' : 'var(--text-muted)' }}>
                          {isOccupied ? mockPatientName(bed.id) : bed.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="split-layout__side" style={{ minWidth: '300px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Allocation Summary</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Confirm patient and selected bed</span>

              {selectedBed ? (
                <>
                  <div className="profile-header" style={{ justifyContent: 'center', flexDirection: 'column', textAlign: 'center', margin: '1rem 0' }}>
                    <div className="profile-circle" style={{ width: '64px', height: '64px', fontSize: '1.5rem', marginBottom: '0.5rem', marginRight: 0 }}>
                      {selectedBed.status === 'OCCUPIED' ? mockPatientName(selectedBed.id || '0').split(' ').map((n: string) => n.charAt(0)).join('') : '?'}
                    </div>
                    <div className="name-group">
                      <h3 style={{ fontSize: '1.2rem' }}>{selectedBed.status === 'OCCUPIED' ? mockPatientName(selectedBed.id || '0') : 'No Patient Assigned'}</h3>
                      <span>{selectedBed.status === 'OCCUPIED' ? 'MRN-80003' : '-'}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Selected Bed: {selectedBed.ward_name} - {selectedBed.bed_number}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                     <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedBed(null)}>Cancel</button>
                     <button className="btn-primary" style={{ flex: 2 }} disabled={selectedBed.status !== 'AVAILABLE'}>Allocate Bed</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Select an available bed to begin allocation.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'allocation' && (
        <section className="content-card">
          <div className="segmented-control" style={{ marginBottom: '1.5rem' }}>
            <button className="active" type="button">Wards Setup</button>
            <button type="button">Beds Setup</button>
          </div>
          
          <form className="inline-form" onSubmit={wardForm.handleSubmit(createWard)}>
            <input placeholder="Ward name" {...wardForm.register('name')} />
            <input placeholder="Ward type" {...wardForm.register('ward_type')} />
            <input placeholder="Floor" {...wardForm.register('floor')} />
            <input placeholder="Description" {...wardForm.register('description')} />
            <button className="btn-primary" type="submit" disabled={config.createWard.isPending}>Add ward</button>
          </form>
          <p className="form-error">{wardForm.formState.errors.name?.message}</p>
          
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Ward</th><th>Type</th><th>Floor</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {wards.map((ward) => (
                  <tr key={ward.id}>
                    <td><strong>{ward.name}</strong><small>{ward.description || 'No description'}</small></td>
                    <td>{ward.ward_type}</td>
                    <td>{ward.floor}</td>
                    <td><StatusBadge tone={statusTone(ward.status)}>{ward.status}</StatusBadge></td>
                    <td><button className="btn-secondary compact" type="button" onClick={() => setActionTarget({ kind: 'ward', id: ward.id, label: ward.name, status: ward.status })}>{ward.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>}

    <ConfirmDialog open={Boolean(actionTarget)} title="Change configuration status" message={actionTarget ? `Change the status of ${actionTarget.label}? This affects whether it can be used for future admission assignments.` : ''} confirmLabel="Change status" onCancel={() => setActionTarget(null)} onConfirm={() => void confirmStatus()} />
  </div>;
}
