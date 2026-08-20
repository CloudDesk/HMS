import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { type MedicineResponse } from '../api/medicines';
import { getMedicineErrorMessage } from '../hooks/medicines/useMedicines';
import { useMedicineMasterFeature } from '../hooks/pharmacy/useMedicineMasterFeature';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { downloadBlob } from '../utils/download';
import { navigate } from '../routing/navigation';

const medicineFormSchema = z.object({
  code: z.string().trim().min(1, 'Medicine code is required.').max(50),
  name: z.string().trim().min(1, 'Medicine name is required.').max(200),
  generic_name: z.string().trim().max(200),
  strength: z.string().trim().max(100),
  dosage_form: z.string().trim().max(100),
  unit: z.string().trim().max(50),
  description: z.string().trim().max(1000),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

type MedicineFormValues = z.infer<typeof medicineFormSchema>;
type ModalMode = 'create' | 'edit' | 'view';

const emptyForm: MedicineFormValues = {
  code: '',
  name: '',
  generic_name: '',
  strength: '',
  dosage_form: '',
  unit: '',
  description: '',
  status: 'ACTIVE',
};

const optional = (value: string) => value.trim() || null;
const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));



export function MedicineMasterPage() {
  const {
    permissions: { canCreate, canEdit, canDelete, canExport },
    state: { search, status, dosageForm, page, limit, sortBy, queryAction },
    actions: { updateQuery, handleExport },
    queries: { listQuery, summaryQuery },
    mutations: { saveMutation, statusMutation, deleteMutation },
    flags: { exporting },
  } = useMedicineMasterFeature();

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeMedicine, setActiveMedicine] = useState<MedicineResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicineResponse | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MedicineFormValues>({
    defaultValues: emptyForm,
    resolver: zodResolver(medicineFormSchema),
  });

  const closeModal = () => {
    setModalMode(null);
    setActiveMedicine(null);
    reset(emptyForm);
  };

  const openModal = (mode: ModalMode, medicine: MedicineResponse | null = null) => {
    setModalMode(mode);
    setActiveMedicine(medicine);
    reset(medicine ? {
      code: medicine.code,
      name: medicine.name,
      generic_name: medicine.generic_name ?? '',
      strength: medicine.strength ?? '',
      dosage_form: medicine.dosage_form ?? '',
      unit: medicine.unit ?? '',
      description: medicine.description ?? '',
      status: medicine.status,
    } : emptyForm);
  };

  useEffect(() => {
    if (queryAction === 'create' && !modalMode) {
      openModal('create');
      updateQuery({ action: null });
    }
  }, [queryAction, modalMode, updateQuery]);

  const handleSave = (values: MedicineFormValues) => {
    const payload = {
      code: values.code,
      name: values.name,
      generic_name: optional(values.generic_name),
      strength: optional(values.strength),
      dosage_form: optional(values.dosage_form),
      unit: optional(values.unit),
      description: optional(values.description),
      status: values.status,
    };
    saveMutation.mutate(
      { id: modalMode === 'edit' && activeMedicine ? activeMedicine.id : undefined, payload },
      { onSuccess: closeModal }
    );
  };

  const records = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const summary = summaryQuery.data ?? { total: 0, active: 0, inactive: 0, dosageForms: 0, addedThisMonth: 0 };
  const forbidden = listQuery.error instanceof ApiError && listQuery.error.status === 403;
  const modalTitle = modalMode === 'create'
    ? 'Add Medicine'
    : modalMode === 'edit' && activeMedicine
      ? `Edit ${activeMedicine.name}`
      : activeMedicine?.name ?? 'Medicine Details';

  return (
    <>
      <div className="um-grid">
        <div className="um-kpi-row" aria-label="Medicine KPIs">
          {[
            ['ph-pill', 'blue', 'Total Medicines', summary.total],
            ['ph-check-circle', 'green', 'Active', summary.active],
            ['ph-minus-circle', 'orange', 'Inactive', summary.inactive],
            ['ph-shapes', 'purple', 'Dosage Forms', summary.dosageForms],
            ['ph-calendar-plus', 'blue', 'Added This Month', summary.addedThisMonth],
          ].map(([icon, tone, label, value]) => (
            <div className="kpi-card" key={String(label)}>
              <div className={`kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></div>
              <div className="kpi-info"><span className="kpi-label">{label}</span><span className="kpi-value">{summaryQuery.isLoading ? 'â€”' : value}</span></div>
            </div>
          ))}
        </div>

        <div className="um-table-section card">
          <div className="um-toolbar">
            <div className="um-toolbar-row1">
              <div className="um-search"><i className="ph ph-magnifying-glass" aria-hidden="true" /><input onChange={(event) => updateQuery({ search: event.target.value, page: 1 })} placeholder="Search code, medicine, or generic name..." type="search" value={search} /></div>
              <button className="um-add-btn" disabled={forbidden || !canCreate} onClick={() => openModal('create')} type="button"><i className="ph ph-plus" aria-hidden="true" /> Add Medicine</button>
              <button className="btn-secondary admin-table-action" disabled={exporting || forbidden || !canExport} onClick={() => handleExport(downloadBlob)} type="button"><i className="ph ph-download-simple" aria-hidden="true" /> Export CSV</button>
              <button className="btn-secondary admin-table-action" disabled={listQuery.isFetching} onClick={() => void listQuery.refetch()} type="button"><i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh</button>
            </div>
            <div className="um-toolbar-row2">
              <span className="filter-label">Filter by:</span>
              <input className="um-filter" onChange={(event) => updateQuery({ dosage_form: event.target.value, page: 1 })} placeholder="Dosage form" value={dosageForm} />
              <select className="um-filter" onChange={(event) => updateQuery({ status: event.target.value, page: 1 })} value={status}><option value="">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
              <select className="um-filter" onChange={(event) => updateQuery({ sortBy: event.target.value, page: 1 })} value={sortBy}><option value="created_at">Newest</option><option value="name">Name</option><option value="code">Code</option><option value="generic_name">Generic Name</option></select>
              <button className="um-clear-btn" onClick={() => navigate('/administration/medicines', { replace: true })} type="button"><i className="ph ph-x" aria-hidden="true" /> Clear Filters</button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Medicine</th><th>Strength</th><th>Dosage Form</th><th>Unit</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {listQuery.isLoading ? <tr><td className="um-state-cell" colSpan={8}><span className="loading-spinner" /> Loading medicines...</td></tr> : null}
                {listQuery.isError ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-warning" aria-hidden="true" /> {getMedicineErrorMessage(listQuery.error)}</td></tr> : null}
                {!listQuery.isLoading && !listQuery.isError && records.length === 0 ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-pill" aria-hidden="true" /> No medicines found matching your filters.</td></tr> : null}
                {records.map((medicine) => (
                  <tr key={medicine.id}>
                    <td><span className="emp-id">{medicine.code}</span></td>
                    <td><div className="user-cell-info"><span className="user-cell-name">{medicine.name}</span>{medicine.generic_name ? <span className="muted-cell">{medicine.generic_name}</span> : null}</div></td>
                    <td>{medicine.strength ?? 'â€”'}</td><td>{medicine.dosage_form ?? 'â€”'}</td><td>{medicine.unit ?? 'â€”'}</td>
                    <td><span className={`status-badge ${medicine.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>{medicine.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                    <td className="muted-cell">{formatDate(medicine.created_at)}</td>
                    <td><div className="action-icons">
                      <button className="action-icon-btn" onClick={() => openModal('view', medicine)} title="View" type="button"><i className="ph ph-eye" /></button>
                      <button className="action-icon-btn" disabled={forbidden || !canEdit} onClick={() => openModal('edit', medicine)} title="Edit" type="button"><i className="ph ph-pencil" /></button>
                      <button className="action-icon-btn" disabled={forbidden || !canEdit || statusMutation.isPending} onClick={() => statusMutation.mutate(medicine)} title={medicine.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} type="button"><i className={`ph ${medicine.status === 'ACTIVE' ? 'ph-pause-circle' : 'ph-play-circle'}`} /></button>
                      <button className="action-icon-btn danger" disabled={forbidden || !canDelete} onClick={() => setDeleteTarget(medicine)} title="Delete" type="button"><i className="ph ph-trash" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="um-pagination"><div className="um-showing">{meta.total === 0 ? 'No medicines' : `Showing ${(meta.page - 1) * meta.limit + 1}â€“${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}</div><div className="um-page-size"><span>Rows:</span><select onChange={(event) => updateQuery({ limit: event.target.value, page: 1 })} value={limit}><option value="5">5</option><option value="10">10</option><option value="25">25</option></select></div><div className="um-page-controls"><button className="pg-btn" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })} type="button"><i className="ph ph-caret-left" /></button><span className="pg-btn active">{page}</span><button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => updateQuery({ page: page + 1 })} type="button"><i className="ph ph-caret-right" /></button></div></div>
        </div>
      </div>

      <Modal footer={modalMode === 'view' ? <button className="btn-secondary" onClick={closeModal} type="button">Close</button> : <><button className="btn-secondary" disabled={saveMutation.isPending} onClick={closeModal} type="button">Cancel</button><button className="btn-primary" disabled={saveMutation.isPending} form="medicine-master-form" type="submit">{saveMutation.isPending ? 'Saving...' : 'Save Medicine'}</button></>} icon="ph-pill" onClose={closeModal} open={Boolean(modalMode)} title={modalTitle}>
        {(modalMode === 'create' || modalMode === 'edit') ? (
          <form id="medicine-master-form" onSubmit={(event) => void handleSubmit(handleSave)(event)}>
            <div className="form-section-title">Medicine Information</div><div className="form-grid-2">
              <label className="form-field"><span>Medicine Code <span className="required">*</span></span><input {...register('code')} disabled={saveMutation.isPending} />{errors.code ? <small className="field-error">{errors.code.message}</small> : null}</label>
              <label className="form-field"><span>Medicine Name <span className="required">*</span></span><input {...register('name')} disabled={saveMutation.isPending} />{errors.name ? <small className="field-error">{errors.name.message}</small> : null}</label>
              <label className="form-field"><span>Generic Name</span><input {...register('generic_name')} disabled={saveMutation.isPending} /></label>
              <label className="form-field"><span>Strength</span><input {...register('strength')} disabled={saveMutation.isPending} placeholder="e.g. 500 mg" /></label>
              <label className="form-field"><span>Dosage Form</span><input {...register('dosage_form')} disabled={saveMutation.isPending} placeholder="e.g. Tablet" /></label>
              <label className="form-field"><span>Unit</span><input {...register('unit')} disabled={saveMutation.isPending} placeholder="e.g. Tablet" /></label>
              <label className="form-field"><span>Status</span><select {...register('status')} disabled={saveMutation.isPending}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Description</span><textarea {...register('description')} disabled={saveMutation.isPending} rows={3} /></label>
            </div>
          </form>
        ) : null}
        {modalMode === 'view' && activeMedicine ? <div className="form-grid-2"><label className="form-field"><span>Code</span><input readOnly value={activeMedicine.code} /></label><label className="form-field"><span>Name</span><input readOnly value={activeMedicine.name} /></label><label className="form-field"><span>Generic Name</span><input readOnly value={activeMedicine.generic_name ?? ''} /></label><label className="form-field"><span>Strength</span><input readOnly value={activeMedicine.strength ?? ''} /></label><label className="form-field"><span>Dosage Form</span><input readOnly value={activeMedicine.dosage_form ?? ''} /></label><label className="form-field"><span>Unit</span><input readOnly value={activeMedicine.unit ?? ''} /></label><label className="form-field"><span>Status</span><input readOnly value={activeMedicine.status === 'ACTIVE' ? 'Active' : 'Inactive'} /></label><label className="form-field"><span>Created</span><input readOnly value={formatDate(activeMedicine.created_at)} /></label><label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Description</span><textarea readOnly rows={3} value={activeMedicine.description ?? ''} /></label></div> : null}
      </Modal>

      <ConfirmDialog confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete Medicine'} message={deleteTarget ? `Delete ${deleteTarget.name}? Historical audit records will be retained.` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) }); }} open={Boolean(deleteTarget)} title="Delete Medicine" />
    </>
  );
}
