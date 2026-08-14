import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  billingApi,
  type BillingReceipt,
  type SaveBillingInvoiceItem,
} from '../api/billing';
import { branchesApi } from '../api/branches';
import { opdApi } from '../api/opd';
import { patientsApi } from '../api/patients';
import { servicesApi } from '../api/services';
import { useAuth } from '../auth/useAuth';
import { useCurrencyFormatter } from '../api/useSettings';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  billingErrorMessage,
  billingServiceLabel,
  billingStatusClass,
  billingStatusLabel,
  formatBillingDate,
  formatBillingDateTime,
} from './billing-utils';

const invoiceSchema = z.object({
  branch_id: z.string().min(1, 'Select a branch.'),
  patient_id: z.string().min(1, 'Select a patient.'),
  visit_id: z.string().min(1, 'Select an OPD visit.'),
  invoice_date: z.string().min(1, 'Invoice date is required.'),
  discount_amount: z.number().min(0, 'Discount cannot be negative.'),
  tax_amount: z.number().min(0, 'Tax cannot be negative.'),
});
const itemSchema = z.object({
  service_type: z.enum(['CONSULTATION', 'LAB_TEST', 'IMAGING_SERVICE']),
  service_id: z.string().min(1, 'Select a service.'),
  quantity: z.number().int().min(1, 'Quantity must be at least one.'),
});
const paymentSchema = z.object({
  amount: z.number().positive('Enter a payment amount.'),
  payment_method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']),
  payment_date: z.string().min(1, 'Payment date is required.'),
  reference_number: z.string().trim().max(100),
}).superRefine((data, context) => {
  if (data.payment_method !== 'CASH' && !data.reference_number) {
    context.addIssue({ code: 'custom', message: 'Reference number is required.', path: ['reference_number'] });
  }
});

type InvoiceForm = z.infer<typeof invoiceSchema>;
type ItemForm = z.infer<typeof itemSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;
type DraftItem = SaveBillingInvoiceItem & { service_name: string; unit_price: number; line_total: number };

const today = () => new Date().toISOString().slice(0, 10);
const catalogueType = (type: ItemForm['service_type']) => type === 'CONSULTATION'
  ? 'GENERAL'
  : type === 'LAB_TEST' ? 'LAB_TEST' : 'IMAGING_SERVICE';

export function BillingWorkspacePage() {
  const formatBillingMoney = useCurrencyFormatter();
  const { user } = useAuth();
  const location = useAppLocation();
  const queryClient = useQueryClient();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const invoiceId = params.get('id') ?? '';
  const createMode = params.get('mode') === 'create' || !invoiceId;
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receipt, setReceipt] = useState<BillingReceipt | null>(null);

  const hasAction = (action: string) => superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'billing' &&
    permission.screen.toLowerCase() === 'invoices' &&
    permission.action.toLowerCase() === action.toLowerCase()));

  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { branch_id: '', patient_id: '', visit_id: '', invoice_date: today(), discount_amount: 0, tax_amount: 0 },
  });
  const itemForm = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { service_type: 'CONSULTATION', service_id: '', quantity: 1 },
  });
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, payment_method: 'CASH', payment_date: today(), reference_number: '' },
  });

  const selectedBranch = invoiceForm.watch('branch_id');
  const selectedPatient = invoiceForm.watch('patient_id');
  const selectedSource = itemForm.watch('service_type');
  const selectedServiceId = itemForm.watch('service_id');
  const paymentMethod = paymentForm.watch('payment_method');

  const branchesQuery = useQuery({
    queryKey: ['branches', 'billing-workspace-options'],
    queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: createMode && superAdmin,
  });
  const branches = superAdmin
    ? (branchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, name: branch.name }))
    : (user?.branches ?? []).map((branch) => ({ id: branch.id, name: branch.name }));
  useEffect(() => {
    if (createMode && !selectedBranch && branches.length === 1) invoiceForm.setValue('branch_id', branches[0]!.id);
  }, [branches, createMode, invoiceForm, selectedBranch]);

  const patientsQuery = useQuery({
    queryKey: ['patients', 'billing-workspace-options'],
    queryFn: () => patientsApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'last_name', sortOrder: 'asc' }),
    enabled: createMode,
  });
  const visitsQuery = useQuery({
    queryKey: ['opd-visits', 'billing-workspace-options', selectedPatient, selectedBranch],
    queryFn: () => opdApi.listVisits({ patient_id: selectedPatient, branch_id: selectedBranch, page: 1, limit: 100, sortBy: 'visit_date', sortOrder: 'desc' }),
    enabled: createMode && Boolean(selectedPatient && selectedBranch),
  });
  const servicesQuery = useQuery({
    queryKey: ['services', 'billing-workspace-options', selectedSource],
    queryFn: () => servicesApi.list({ status: 'ACTIVE', service_type: catalogueType(selectedSource), page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: createMode,
  });

  const invoiceQuery = useQuery({
    queryKey: ['billing', 'invoice', invoiceId],
    queryFn: () => billingApi.getById(invoiceId),
    enabled: !createMode,
  });
  const paymentsQuery = useQuery({
    queryKey: ['billing', 'payments', invoiceId],
    queryFn: () => billingApi.payments(invoiceId),
    enabled: !createMode,
  });
  const invoice = invoiceQuery.data;

  useEffect(() => {
    if (!invoice) return;
    invoiceForm.reset({
      branch_id: invoice.branch_id,
      patient_id: invoice.patient_id,
      visit_id: invoice.visit_id,
      invoice_date: invoice.invoice_date.slice(0, 10),
      discount_amount: invoice.discount_amount,
      tax_amount: invoice.tax_amount,
    });
  }, [invoice, invoiceForm]);

  const invalidateInvoice = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['billing'] }),
      invoiceId ? queryClient.invalidateQueries({ queryKey: ['billing', 'invoice', invoiceId] }) : Promise.resolve(),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (values: InvoiceForm) => {
      const visit = visitsQuery.data?.data.find((item) => item.id === values.visit_id);
      return billingApi.create({
        ...values,
        appointment_id: visit?.appointment_id ?? null,
        items: draftItems.map(({ service_id, service_type, quantity }) => ({ service_id, service_type, quantity })),
      });
    },
    onSuccess: async (created) => {
      toast.success('Invoice draft created.');
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      navigate(`/billing/workspace?id=${created.id}`, { replace: true });
    },
    onError: (error) => toast.error(billingErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ values, finalize }: { values: InvoiceForm; finalize: boolean }) => billingApi.update(invoiceId, {
      invoice_date: values.invoice_date,
      discount_amount: values.discount_amount,
      tax_amount: values.tax_amount,
      ...(finalize ? { status: 'PENDING' as const } : {}),
    }),
    onSuccess: async (_result, variables) => {
      toast.success(variables.finalize ? 'Invoice finalized and ready for payment.' : 'Invoice updated.');
      await invalidateInvoice();
    },
    onError: (error) => toast.error(billingErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(invoiceId),
    onSuccess: async () => {
      toast.success('Invoice cancelled.');
      setCancelOpen(false);
      await invalidateInvoice();
    },
    onError: (error) => toast.error(billingErrorMessage(error)),
  });

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentForm) => billingApi.collectPayment(invoiceId, {
      amount: values.amount,
      payment_method: values.payment_method,
      payment_date: values.payment_date,
      reference_number: values.reference_number || null,
    }),
    onSuccess: async (result) => {
      toast.success(result.invoice.status === 'PAID' ? 'Invoice paid in full.' : 'Partial payment collected.');
      setPaymentOpen(false);
      paymentForm.reset({ amount: 0, payment_method: 'CASH', payment_date: today(), reference_number: '' });
      await invalidateInvoice();
      await queryClient.invalidateQueries({ queryKey: ['billing', 'payments', invoiceId] });
    },
    onError: (error) => toast.error(billingErrorMessage(error)),
  });

  const receiptMutation = useMutation({
    mutationFn: (paymentId: string) => billingApi.receipt(paymentId),
    onSuccess: setReceipt,
    onError: (error) => toast.error(billingErrorMessage(error)),
  });

  const addItem = itemForm.handleSubmit((values) => {
    const service = servicesQuery.data?.data.find((candidate) => candidate.id === values.service_id);
    if (!service) return itemForm.setError('service_id', { message: 'Select an active service.' });
    if (draftItems.some((item) => item.service_id === service.id)) return itemForm.setError('service_id', { message: 'Service is already included.' });
    setDraftItems((current) => [...current, {
      service_id: service.id,
      service_name: service.name,
      service_type: values.service_type,
      quantity: values.quantity,
      unit_price: service.standard_price,
      line_total: service.standard_price * values.quantity,
    }]);
    itemForm.reset({ service_type: values.service_type, service_id: '', quantity: 1 });
  });

  const createInvoice = invoiceForm.handleSubmit((values) => {
    if (draftItems.length === 0) return toast.error('Add at least one billable service.');
    createMutation.mutate(values);
  });
  const draftSubtotal = draftItems.reduce((sum, item) => sum + item.line_total, 0);
  const draftTotal = draftSubtotal - invoiceForm.watch('discount_amount') + invoiceForm.watch('tax_amount');
  const selectedService = servicesQuery.data?.data.find((service) => service.id === selectedServiceId);

  if (createMode) {
    return <div className="billing-page">
      <div className="billing-page-head"><div><h2>Create Invoice</h2><p>Create an OPD invoice using Service Catalogue pricing</p></div><button className="btn-secondary" onClick={() => navigate('/billing/history')} type="button"><i className="ph ph-x" /> Cancel</button></div>
      <div className="billing-workspace-grid">
        <main>
          <section className="billing-card">
            <div className="billing-card-head"><div><h3>Patient and Visit</h3><p>Charges remain linked to the selected OPD context</p></div></div>
            <div className="billing-form-grid">
              <label><span>Branch *</span><select {...invoiceForm.register('branch_id', { onChange: () => invoiceForm.setValue('visit_id', '') })}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><small>{invoiceForm.formState.errors.branch_id?.message}</small></label>
              <label><span>Patient *</span><select {...invoiceForm.register('patient_id', { onChange: () => invoiceForm.setValue('visit_id', '') })}><option value="">Select patient</option>{patientsQuery.data?.data.map((patient) => <option key={patient.id} value={patient.id}>{patient.patient_number} · {patient.first_name} {patient.last_name}</option>)}</select><small>{invoiceForm.formState.errors.patient_id?.message}</small></label>
              <label><span>OPD Visit *</span><select disabled={!selectedPatient || !selectedBranch || visitsQuery.isLoading} {...invoiceForm.register('visit_id')}><option value="">{visitsQuery.isLoading ? 'Loading visits…' : 'Select visit'}</option>{visitsQuery.data?.data.map((visit) => <option key={visit.id} value={visit.id}>{visit.visit_number} · {formatBillingDate(visit.visit_date)} · {visit.doctor_name}</option>)}</select><small>{invoiceForm.formState.errors.visit_id?.message}</small></label>
              <label><span>Invoice Date *</span><input type="date" {...invoiceForm.register('invoice_date')} /><small>{invoiceForm.formState.errors.invoice_date?.message}</small></label>
            </div>
            {selectedPatient && selectedBranch && !visitsQuery.isLoading && (visitsQuery.data?.data.length ?? 0) === 0 ? <div className="billing-inline-alert"><i className="ph ph-warning" /> No OPD visit matches this patient and branch.</div> : null}
          </section>

          <section className="billing-card">
            <div className="billing-card-head"><div><h3>Billable Services</h3><p>Names and prices are copied from active Service Catalogue records</p></div></div>
            <form className="billing-item-builder" onSubmit={addItem}>
              <label><span>Charge Source</span><select {...itemForm.register('service_type', { onChange: () => itemForm.setValue('service_id', '') })}><option value="CONSULTATION">Consultation</option><option value="LAB_TEST">Laboratory Test</option><option value="IMAGING_SERVICE">Imaging Service</option></select></label>
              <label><span>Service</span><select disabled={servicesQuery.isLoading} {...itemForm.register('service_id')}><option value="">{servicesQuery.isLoading ? 'Loading services…' : 'Select service'}</option>{servicesQuery.data?.data.map((service) => <option key={service.id} value={service.id}>{service.name} · {formatBillingMoney(service.standard_price)}</option>)}</select><small>{itemForm.formState.errors.service_id?.message}</small></label>
              <label><span>Quantity</span><input min="1" type="number" {...itemForm.register('quantity', { valueAsNumber: true })} /></label>
              <button className="btn-secondary" disabled={!selectedService} type="submit"><i className="ph ph-plus" /> Add</button>
            </form>
            {servicesQuery.isError ? <div className="billing-inline-alert error"><i className="ph ph-warning-circle" /> Service Catalogue could not be loaded.</div> : null}
            {!servicesQuery.isLoading && !servicesQuery.isError && (servicesQuery.data?.data.length ?? 0) === 0 ? <div className="billing-inline-alert"><i className="ph ph-info" /> No active {billingServiceLabel[selectedSource]} services are configured.</div> : null}
            <div className="table-responsive"><table className="data-table billing-table"><thead><tr><th>Source</th><th>Service</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th><th aria-label="Remove" /></tr></thead><tbody>
              {draftItems.length === 0 ? <tr><td className="um-state-cell" colSpan={6}>No billable services added.</td></tr> : null}
              {draftItems.map((item) => <tr key={item.service_id}><td>{billingServiceLabel[item.service_type]}</td><td><strong>{item.service_name}</strong></td><td>{item.quantity}</td><td>{formatBillingMoney(item.unit_price)}</td><td>{formatBillingMoney(item.line_total)}</td><td><button aria-label={`Remove ${item.service_name}`} className="icon-btn danger" onClick={() => setDraftItems((current) => current.filter((candidate) => candidate.service_id !== item.service_id))} type="button"><i className="ph ph-trash" /></button></td></tr>)}
            </tbody></table></div>
          </section>
        </main>
        <aside className="billing-summary-card">
          <h3>Invoice Summary</h3><label><span>Discount Amount</span><input min="0" step="0.01" type="number" {...invoiceForm.register('discount_amount', { valueAsNumber: true })} /></label><label><span>Tax Amount</span><input min="0" step="0.01" type="number" {...invoiceForm.register('tax_amount', { valueAsNumber: true })} /></label>
          <div className="billing-total-row"><span>Subtotal</span><strong>{formatBillingMoney(draftSubtotal)}</strong></div><div className="billing-total-row"><span>Discount</span><strong>− {formatBillingMoney(invoiceForm.watch('discount_amount'))}</strong></div><div className="billing-total-row"><span>Tax</span><strong>{formatBillingMoney(invoiceForm.watch('tax_amount'))}</strong></div><div className="billing-total-row grand"><span>Total</span><strong>{formatBillingMoney(Math.max(0, draftTotal))}</strong></div>
          <button className="btn-primary billing-full-button" disabled={!hasAction('Create') || createMutation.isPending} onClick={createInvoice} type="button">{createMutation.isPending ? 'Creating…' : 'Create Invoice Draft'}</button>
        </aside>
      </div>
    </div>;
  }

  if (invoiceQuery.isLoading) return <div className="billing-state"><span className="loading-spinner" /> Loading invoice…</div>;
  if (invoiceQuery.isError || !invoice) return <div className="billing-state error"><i className="ph ph-warning-circle" /><strong>Invoice could not be loaded.</strong><button onClick={() => void invoiceQuery.refetch()} type="button">Retry</button></div>;

  const editable = (invoice.status === 'DRAFT' || invoice.status === 'PENDING') && invoice.paid_amount === 0;
  const cancellable = editable;
  const payable = (invoice.status === 'PENDING' || invoice.status === 'PARTIALLY_PAID') && invoice.balance_amount > 0;
  return <div className="billing-page">
    <div className="billing-page-head"><div><div className="billing-title-line"><h2>{invoice.invoice_number}</h2><span className={`billing-status ${billingStatusClass(invoice.status)}`}>{billingStatusLabel[invoice.status]}</span></div><p>{invoice.patient_name ?? 'Patient'} · {invoice.patient_number ?? invoice.patient_id} · {invoice.visit_number ?? invoice.visit_id}</p></div><div className="billing-head-actions"><button className="btn-secondary" onClick={() => navigate('/billing/history')} type="button"><i className="ph ph-arrow-left" /> History</button>{cancellable && hasAction('Cancel') ? <button className="btn-danger" onClick={() => setCancelOpen(true)} type="button"><i className="ph ph-x-circle" /> Cancel Invoice</button> : null}{payable && hasAction('CollectPayment') ? <button className="btn-primary" onClick={() => { paymentForm.reset({ amount: invoice.balance_amount, payment_method: 'CASH', payment_date: today(), reference_number: '' }); setPaymentOpen(true); }} type="button"><i className="ph ph-currency-circle-dollar" /> Collect Payment</button> : null}</div></div>

    <section className="billing-detail-strip"><div><span>Patient</span><strong>{invoice.patient_name ?? 'Patient'}</strong><small>{invoice.patient_number ?? invoice.patient_id}</small></div><div><span>Visit</span><strong>{invoice.visit_number ?? invoice.visit_id}</strong><small>{invoice.appointment_number ?? 'Walk-in / no appointment'}</small></div><div><span>Branch</span><strong>{invoice.branch_name ?? invoice.branch_id}</strong><small>{formatBillingDate(invoice.invoice_date)}</small></div><div><span>Balance</span><strong className={invoice.balance_amount ? 'billing-balance-due' : 'billing-balance-clear'}>{formatBillingMoney(invoice.balance_amount)}</strong><small>{formatBillingMoney(invoice.paid_amount)} collected</small></div></section>

    <div className="billing-workspace-grid">
      <main>
        <section className="billing-card"><div className="billing-card-head"><div><h3>Invoice Items</h3><p>Price snapshots remain unchanged after invoice creation</p></div></div><div className="table-responsive"><table className="data-table billing-table"><thead><tr><th>Source</th><th>Service</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td>{billingServiceLabel[item.service_type]}</td><td><strong>{item.service_name}</strong></td><td>{item.quantity}</td><td>{formatBillingMoney(item.unit_price)}</td><td>{formatBillingMoney(item.line_total)}</td></tr>)}</tbody></table></div></section>
        <section className="billing-card"><div className="billing-card-head"><div><h3>Payments</h3><p>Collected payments and receipt access</p></div></div>{paymentsQuery.isError ? <div className="billing-inline-alert error">Payments could not be loaded.</div> : <div className="table-responsive"><table className="data-table billing-table"><thead><tr><th>Payment</th><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>{paymentsQuery.isLoading ? <tr><td className="um-state-cell" colSpan={6}>Loading payments…</td></tr> : null}{!paymentsQuery.isLoading && (paymentsQuery.data?.length ?? 0) === 0 ? <tr><td className="um-state-cell" colSpan={6}>No payments collected.</td></tr> : null}{paymentsQuery.data?.map((payment) => <tr key={payment.id}><td><strong>{payment.payment_number}</strong></td><td>{formatBillingDateTime(payment.payment_date)}</td><td>{payment.payment_method.replaceAll('_', ' ')}</td><td>{payment.reference_number ?? 'Cash'}</td><td>{formatBillingMoney(payment.amount)}</td><td>{hasAction('ViewReceipt') ? <button className="btn-secondary" disabled={receiptMutation.isPending} onClick={() => receiptMutation.mutate(payment.id)} type="button"><i className="ph ph-receipt" /> View</button> : '—'}</td></tr>)}</tbody></table></div>}</section>
      </main>
      <aside className="billing-summary-card">
        <h3>Financial Summary</h3>
        {editable ? <form onSubmit={invoiceForm.handleSubmit((values) => updateMutation.mutate({ values, finalize: false }))}><label><span>Invoice Date</span><input type="date" {...invoiceForm.register('invoice_date')} /></label><label><span>Discount Amount</span><input min="0" step="0.01" type="number" {...invoiceForm.register('discount_amount', { valueAsNumber: true })} /></label><label><span>Tax Amount</span><input min="0" step="0.01" type="number" {...invoiceForm.register('tax_amount', { valueAsNumber: true })} /></label></form> : null}
        <div className="billing-total-row"><span>Subtotal</span><strong>{formatBillingMoney(invoice.subtotal)}</strong></div><div className="billing-total-row"><span>Discount</span><strong>− {formatBillingMoney(invoice.discount_amount)}</strong></div><div className="billing-total-row"><span>Tax</span><strong>{formatBillingMoney(invoice.tax_amount)}</strong></div><div className="billing-total-row grand"><span>Total</span><strong>{formatBillingMoney(invoice.total_amount)}</strong></div><div className="billing-total-row"><span>Paid</span><strong className="billing-balance-clear">{formatBillingMoney(invoice.paid_amount)}</strong></div><div className="billing-total-row due"><span>Balance</span><strong>{formatBillingMoney(invoice.balance_amount)}</strong></div>
        {editable && hasAction('Edit') ? <><button className="btn-secondary billing-full-button" disabled={updateMutation.isPending} onClick={invoiceForm.handleSubmit((values) => updateMutation.mutate({ values, finalize: false }))} type="button">Save Changes</button>{invoice.status === 'DRAFT' ? <button className="btn-primary billing-full-button" disabled={updateMutation.isPending} onClick={invoiceForm.handleSubmit((values) => updateMutation.mutate({ values, finalize: true }))} type="button">Finalize Invoice</button> : null}</> : null}
      </aside>
    </div>

    <Modal footer={<><button className="btn-secondary" onClick={() => setPaymentOpen(false)} type="button">Cancel</button><button className="btn-primary" disabled={paymentMutation.isPending} onClick={paymentForm.handleSubmit((values) => paymentMutation.mutate(values))} type="button">{paymentMutation.isPending ? 'Collecting…' : 'Collect Payment'}</button></>} icon="ph-currency-circle-dollar" onClose={() => setPaymentOpen(false)} open={paymentOpen} title="Collect Payment">
      <div className="billing-payment-summary"><span>Invoice balance</span><strong>{formatBillingMoney(invoice.balance_amount)}</strong></div><form className="billing-modal-form" onSubmit={paymentForm.handleSubmit((values) => paymentMutation.mutate(values))}><label><span>Amount *</span><input max={invoice.balance_amount} min="0.01" step="0.01" type="number" {...paymentForm.register('amount', { valueAsNumber: true })} /><small>{paymentForm.formState.errors.amount?.message}</small></label><label><span>Payment Method *</span><select {...paymentForm.register('payment_method')}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option></select></label><label><span>Payment Date *</span><input type="date" {...paymentForm.register('payment_date')} /></label><label><span>Reference Number {paymentMethod === 'CASH' ? '(optional)' : '*'}</span><input {...paymentForm.register('reference_number')} /><small>{paymentForm.formState.errors.reference_number?.message}</small></label></form>
    </Modal>

    <Modal footer={<><button className="btn-secondary" onClick={() => setCancelOpen(false)} type="button">Keep Invoice</button><button className="btn-danger" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()} type="button">Cancel Invoice</button></>} icon="ph-warning" onClose={() => setCancelOpen(false)} open={cancelOpen} title="Cancel Invoice">
      <p>This cancels the unpaid invoice and prevents future payments. This action is audit logged.</p>
    </Modal>

    <Modal footer={<><button className="btn-secondary" onClick={() => setReceipt(null)} type="button">Close</button><button className="btn-primary" onClick={() => window.print()} type="button"><i className="ph ph-printer" /> Print Receipt</button></>} icon="ph-receipt" onClose={() => setReceipt(null)} open={Boolean(receipt)} size="large" title="Payment Receipt">
      {receipt ? <ReceiptPaper receipt={receipt} /> : null}
    </Modal>
  </div>;
}

function ReceiptPaper({ receipt }: { receipt: BillingReceipt }) {
  const formatBillingMoney = useCurrencyFormatter();
  return <article className="billing-receipt-paper">
    <header><i className="ph-fill ph-hospital" /><h3>HMS Medical Centre</h3><p>Official Payment Receipt</p></header>
    <div className="billing-receipt-grid"><div><span>Receipt Number</span><strong>{receipt.receipt_number}</strong></div><div><span>Payment Number</span><strong>{receipt.payment.payment_number}</strong></div><div><span>Invoice Number</span><strong>{receipt.invoice.invoice_number}</strong></div><div><span>Payment Date</span><strong>{formatBillingDateTime(receipt.payment.payment_date)}</strong></div><div><span>Patient</span><strong>{receipt.invoice.patient_name ?? receipt.invoice.patient_id}</strong></div><div><span>Patient Number</span><strong>{receipt.invoice.patient_number ?? '—'}</strong></div><div><span>Payment Method</span><strong>{receipt.payment.payment_method.replaceAll('_', ' ')}</strong></div><div><span>Reference</span><strong>{receipt.payment.reference_number ?? 'Cash'}</strong></div></div>
    <div className="billing-receipt-amount"><span>Amount Received</span><strong>{formatBillingMoney(receipt.payment.amount)}</strong></div>
    <footer>Generated {formatBillingDateTime(receipt.generated_at)} · Electronically generated receipt</footer>
  </article>;
}
