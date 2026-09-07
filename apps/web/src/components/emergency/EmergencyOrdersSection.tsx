import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyWorkspaceProps } from './types';
import { formatTime, message } from './utils';

const optionalNumber = z.number().optional();
const numericInput = { setValueAs: (value: string) => (value === '' ? undefined : Number(value)) };

const orderSchema = z
  .object({
    order_type: z.enum(['PHARMACY', 'LABORATORY', 'IMAGING']),
    priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
    service_id: z.string(),
    name: z.string().trim().min(1, 'Medicine / order name is required'),
    category: z.string(),
    dosage: z.string(),
    route: z.string(),
    frequency: z.string(),
    duration: z.string(),
    quantity: optionalNumber,
    destination: z.string(),
    specimen_type: z.string(),
    clinical_notes: z.string(),
    instructions: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.order_type !== 'PHARMACY' && !value.service_id)
      ctx.addIssue({ code: 'custom', path: ['service_id'], message: 'Select a catalogue service' });
  });

type OrderForm = z.infer<typeof orderSchema>;

export type EmergencyOrdersSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  mutations: EmergencyWorkspaceProps['mutations'];
  orderType: 'PHARMACY' | 'LABORATORY' | 'IMAGING';
};

export function EmergencyOrdersSection({ state, mutations, orderType }: EmergencyOrdersSectionProps) {
  const selected = state.selected || state.encounters[0] || null;

  const order = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      order_type: orderType,
      priority: 'STAT',
      service_id: '',
      name: '',
      category: orderType === 'PHARMACY' ? 'Emergency' : orderType === 'LABORATORY' ? 'Laboratory' : 'Imaging',
      dosage: '',
      route: '',
      frequency: '',
      duration: '',
      destination: '',
      specimen_type: '',
      clinical_notes: '',
      instructions: '',
    },
  });

  const submitOrder = order.handleSubmit(
    async (value) => {
      if (!selected) return;
      try {
        await mutations.order.mutateAsync({
          id: selected.id,
          branchId: selected.branch_id || state.branchId,
          body: {
            order_type: value.order_type,
            priority: value.priority,
            items: [
              {
                service_id: value.service_id || undefined,
                medicine_name: value.order_type === 'PHARMACY' ? value.name : undefined,
                name: value.name,
                category: value.category || 'Emergency',
                dosage: value.dosage || undefined,
                route: value.route || undefined,
                frequency: value.frequency || undefined,
                duration: value.duration || undefined,
                quantity: value.quantity ?? null,
              },
            ],
            destination: value.destination || null,
            specimen_type: value.specimen_type || null,
            clinical_notes: value.clinical_notes || null,
            instructions: value.instructions || null,
          },
        });
        toast.success(`${value.order_type === 'PHARMACY' ? 'Medication' : value.order_type.toLowerCase()} order submitted.`);
        order.reset({
          ...order.getValues(),
          service_id: '',
          name: '',
          dosage: '',
          route: '',
          frequency: '',
          duration: '',
          clinical_notes: '',
          instructions: '',
        });
      } catch (error) {
        toast.error(message(error));
      }
    },
    (errors) => {
      const firstError = Object.values(errors)[0];
      if (firstError?.message) {
        toast.error(String(firstError.message));
      }
    },
  );

  if (!selected) return null;

  const canCreateOrders = state.capabilities.createOrders;
  const existingOrders = (selected.orders || []).filter((o) => o.order_type === orderType);

  if (!canCreateOrders) {
    return (
      <div className="emergency-form-section">
        <div className="emergency-section-context-header">
          <div className="emergency-context-badge">
            <i className="ph ph-lock-key" /> {orderType === 'PHARMACY' ? 'Medication Prescriptions' : orderType === 'LABORATORY' ? 'Laboratory Orders' : 'Imaging Orders'} (Read-Only)
          </div>
          <p className="emergency-context-desc">
            Physician-ordered {orderType.toLowerCase()} requests. Nursing staff can review active orders below.
          </p>
        </div>

        {existingOrders.length > 0 ? (
          <div className="emergency-readonly-grid" style={{ gridTemplateColumns: '1fr' }}>
            {existingOrders.map((ord, idx) => (
              <div className="emergency-readonly-card" key={idx}>
                <h4><i className="ph ph-check-circle" /> {orderType} Order #{idx + 1}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div className="emergency-readonly-field">
                    <label>Status</label>
                    <span>{ord.status}</span>
                  </div>
                  <div className="emergency-readonly-field">
                    <label>Ordered At</label>
                    <span>{formatTime(ord.created_at)}</span>
                  </div>
                  <div className="emergency-readonly-field">
                    <label>Order Reference ID</label>
                    <span>{ord.downstream_id || ord.source_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center', fontSize: '0.88rem' }}>
            <i className="ph ph-clipboard" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }} />
            No {orderType.toLowerCase()} orders placed yet by attending physician.
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submitOrder}>
      <div className="emergency-section-active-header">
        <div className="emergency-active-badge">
          <i className="ph ph-prescription" /> Primary Physician Duty – {orderType === 'PHARMACY' ? 'Prescribe Medications' : orderType === 'LABORATORY' ? 'STAT Lab Orders' : 'STAT Imaging Orders'}
        </div>
        <p className="emergency-active-desc">
          {orderType === 'PHARMACY'
            ? 'Prescribe stat and emergency medications.'
            : orderType === 'LABORATORY'
            ? 'Order emergency bloods, cardiac markers, and STAT diagnostic tests.'
            : 'Order emergency X-Ray, CT, FAST Ultrasound, and MRI.'}
        </p>
      </div>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>
              {orderType === 'PHARMACY'
                ? 'Prescribe Emergency Medications'
                : orderType === 'LABORATORY'
                ? 'STAT Laboratory Orders'
                : 'STAT Imaging Orders'}
            </h3>
            <p>
              {orderType === 'PHARMACY'
                ? 'Prescribe stat and continuous medications'
                : orderType === 'LABORATORY'
                ? 'Order emergency bloods, cardiac markers, and point-of-care tests'
                : 'Order emergency X-Ray, CT, Ultrasound FAST, and MRI'}
            </p>
          </div>
        </div>

        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Priority</label>
            <select {...order.register('priority')}>
              <option value="STAT">STAT (Immediate)</option>
              <option value="URGENT">Urgent</option>
              {orderType !== 'IMAGING' && <option value="ROUTINE">Routine</option>}
            </select>
          </div>

          {orderType === 'PHARMACY' && (
            <>
              <div className="doc-field">
                <label>Medicine Name</label>
                <input
                  list="emergency-med-list"
                  {...order.register('name')}
                  placeholder="e.g. Paracetamol 1g IV"
                />
                <datalist id="emergency-med-list">
                  {state.availableMedicines?.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.generic_name ? `${m.name} (${m.generic_name})` : m.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="doc-field">
                <label>Dosage</label>
                <input {...order.register('dosage')} placeholder="e.g. 1000 mg" />
              </div>
              <div className="doc-field">
                <label>Route</label>
                <input {...order.register('route')} placeholder="e.g. IV Infusion" />
              </div>
              <div className="doc-field">
                <label>Frequency</label>
                <input {...order.register('frequency')} placeholder="e.g. STAT / Once" />
              </div>
              <div className="doc-field">
                <label>Quantity</label>
                <input type="number" {...order.register('quantity', numericInput)} placeholder="1" />
              </div>
            </>
          )}

          {orderType === 'LABORATORY' && (
            <>
              <div className="doc-field">
                <label>Lab Test Service</label>
                <select
                  {...order.register('service_id')}
                  onChange={(e) => {
                    const s = state.services.find((svc) => svc.id === e.target.value);
                    order.setValue('service_id', e.target.value);
                    order.setValue('name', s?.name || '');
                    order.setValue('category', s?.category || 'Laboratory');
                  }}
                >
                  <option value="">Select Lab Test</option>
                  {state.services
                    .filter((s) => s.service_type === 'LAB_TEST')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="doc-field">
                <label>Specimen Type</label>
                <select {...order.register('specimen_type')}>
                  <option>Blood</option>
                  <option>Urine</option>
                  <option>Arterial Blood Gas</option>
                  <option>CSF</option>
                </select>
              </div>
            </>
          )}

          {orderType === 'IMAGING' && (
            <>
              <div className="doc-field">
                <label>Imaging Service</label>
                <select
                  {...order.register('service_id')}
                  onChange={(e) => {
                    const s = state.services.find((svc) => svc.id === e.target.value);
                    order.setValue('service_id', e.target.value);
                    order.setValue('name', s?.name || '');
                    order.setValue('category', s?.category || 'Imaging');
                  }}
                >
                  <option value="">Select Imaging Study</option>
                  {state.services
                    .filter((s) => s.service_type === 'IMAGING_SERVICE')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="doc-field">
                <label>Clinical Notes / Region</label>
                <input {...order.register('clinical_notes')} placeholder="e.g. Chest trauma, rule out pneumothorax" />
              </div>
            </>
          )}
        </div>
      </section>

      {existingOrders.length > 0 && (
        <section className="emergency-form-section">
          <div className="emergency-form-head">
            <div>
              <h3>Placed {orderType} Orders</h3>
              <p>Active and completed orders for this encounter</p>
            </div>
          </div>
          <div className="emergency-readonly-grid" style={{ gridTemplateColumns: '1fr' }}>
            {existingOrders.map((ord, idx) => (
              <div className="emergency-readonly-card" key={idx}>
                <h4><i className="ph ph-check-circle" /> {orderType} Order #{idx + 1}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div className="emergency-readonly-field">
                    <label>Status</label>
                    <span>{ord.status}</span>
                  </div>
                  <div className="emergency-readonly-field">
                    <label>Ordered At</label>
                    <span>{formatTime(ord.created_at)}</span>
                  </div>
                  <div className="emergency-readonly-field">
                    <label>Order Reference ID</label>
                    <span>{ord.downstream_id || ord.source_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" disabled={mutations.order.isPending} type="submit">
            {mutations.order.isPending
              ? 'Submitting...'
              : orderType === 'PHARMACY'
              ? 'Submit Medication Order'
              : orderType === 'LABORATORY'
              ? 'Submit Lab Order'
              : 'Submit Imaging Order'}
          </button>
        </div>
      </div>
    </form>
  );
}
