import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyWorkspaceProps } from './types';
import { message } from './utils';

const optionalNumber = z.number().optional();
const numericInput = { setValueAs: (value: string) => (value === '' ? undefined : Number(value)) };

const orderSchema = z
  .object({
    order_type: z.enum(['PHARMACY', 'LABORATORY', 'IMAGING']),
    priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
    service_id: z.string(),
    name: z.string().min(1),
    category: z.string().min(1),
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

  const submitOrder = order.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.order.mutateAsync({
        id: selected.id,
        body: {
          order_type: value.order_type,
          priority: value.priority,
          items: [
            {
              service_id: value.service_id || undefined,
              medicine_name: value.order_type === 'PHARMACY' ? value.name : undefined,
              name: value.name,
              category: value.category,
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
      toast.success(`${value.order_type.toLowerCase()} request submitted.`);
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
  });

  if (!selected) return null;

  return (
    <form onSubmit={submitOrder}>
      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>
              {orderType === 'PHARMACY'
                ? 'Pharmacy Orders'
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
                <input {...order.register('name')} placeholder="e.g. Paracetamol 1g IV" />
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
