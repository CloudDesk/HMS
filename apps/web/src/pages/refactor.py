import re

with open('BillingWorkspacePage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

imports_old = '''import { zodResolver } from '@hookform/resolvers/zod';
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
import { pharmacyInventoryApi } from '../api/pharmacy-inventory';
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
} from './billing-utils';'''

imports_new = '''import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { BillingReceipt } from '../api/billing';
import { useAuth } from '../auth/useAuth';
import { useCurrencyFormatter } from '../api/useSettings';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  billingServiceLabel,
  billingStatusClass,
  billingStatusLabel,
  formatBillingDate,
  formatBillingDateTime,
} from './billing-utils';
import { useBranchesList } from '../hooks/branches/useBranches';
import { usePatientsList } from '../hooks/patients/usePatients';
import { useOpdVisits } from '../hooks/opd/useOpd';
import { useServicesList } from '../hooks/services/useServices';
import { usePharmacyBatches } from '../hooks/pharmacy/usePharmacy';
import {
  useBillingInvoiceDetails,
  useBillingPayments,
  useCreateBillingInvoice,
  useUpdateBillingInvoice,
  useCancelBillingInvoice,
  useCollectBillingPayment,
  useBillingReceipt,
} from '../hooks/billing/useBilling';
import { useBillingAutoPopulate, type DraftItem } from '../hooks/billing/useBillingAutoPopulate';'''

code = code.replace(imports_old, imports_new)
code = code.replace('type DraftItem = SaveBillingInvoiceItem & { service_name: string; unit_price: number; line_total: number };\n', '')

code = code.replace('const queryClient = useQueryClient();\n', '')

code = code.replace('''  const branchesQuery = useQuery({
    queryKey: ['branches', 'billing-workspace-options'],
    queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: createMode && superAdmin,
  });''', \"\"\"  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }, createMode && superAdmin);\"\"\")

code = code.replace('''  const patientsQuery = useQuery({
    queryKey: ['patients', 'billing-workspace-options'],
    queryFn: () => patientsApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'last_name', sortOrder: 'asc' }),
    enabled: createMode,
  });''', \"\"\"  const patientsQuery = usePatientsList({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'last_name', sortOrder: 'asc' }, createMode);\"\"\")

code = code.replace('''  const visitsQuery = useQuery({
    queryKey: ['opd-visits', 'billing-workspace-options', selectedPatient, selectedBranch],
    queryFn: () => opdApi.listVisits({ patient_id: selectedPatient, branch_id: selectedBranch, page: 1, limit: 100, sortBy: 'visit_date', sortOrder: 'desc' }),
    enabled: createMode && Boolean(selectedPatient && selectedBranch),
  });''', \"\"\"  const visitsQuery = useOpdVisits({ patient_id: selectedPatient, branch_id: selectedBranch, page: 1, limit: 100, sortBy: 'visit_date', sortOrder: 'desc' }, createMode && Boolean(selectedPatient && selectedBranch));\"\"\")

code = code.replace('''  const servicesQuery = useQuery({
    queryKey: ['services', 'billing-workspace-options', selectedSource],
    queryFn: () => servicesApi.list({ status: 'ACTIVE', service_type: catalogueType(selectedSource), page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: createMode && selectedSource !== 'PHARMACY',
  });''', \"\"\"  const servicesQuery = useServicesList({ status: 'ACTIVE', service_type: catalogueType(selectedSource), page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }, createMode && selectedSource !== 'PHARMACY');\"\"\")

code = code.replace('''  const batchesQuery = useQuery({
    queryKey: ['pharmacy-batches', 'billing-workspace-options', selectedBranch],
    queryFn: () => pharmacyInventoryApi.allBatches({ branch_id: selectedBranch, status: 'ACTIVE', page: 1, limit: 100 }),
    enabled: createMode && selectedSource === 'PHARMACY' && Boolean(selectedBranch),
  });''', \"\"\"  const batchesQuery = usePharmacyBatches({ branch_id: selectedBranch, status: 'ACTIVE', page: 1, limit: 100 }, createMode && selectedSource === 'PHARMACY' && Boolean(selectedBranch));\"\"\")

old_effect = '''  useEffect(() => {
    if (!createMode || !selectedVisit) return;
    
    let ignore = false;
    
    const fetchOpdServices = async () => {
      try {
        const [consultation, labOrder, imagingOrder, prescription, servicesResponse, batchesResponse] = await Promise.all([
          opdApi.getConsultation(selectedVisit).catch(() => null),
          opdApi.getClinicalOrder(selectedVisit, 'LABORATORY').catch(() => null),
          opdApi.getClinicalOrder(selectedVisit, 'IMAGING').catch(() => null),
          opdApi.getPrescription(selectedVisit).catch(() => null),
          servicesApi.list({ status: 'ACTIVE', limit: 100 }).catch(() => ({ data: [] })),
          pharmacyInventoryApi.allBatches({ branch_id: selectedBranch, status: 'ACTIVE', limit: 100 }).catch(() => ({ data: [] })),
        ]);
        
        if (ignore) return;
        
        const services = servicesResponse.data;
        const batches = batchesResponse.data;
        const newDraftItems: DraftItem[] = [];
        
        // Auto-add Consultation if completed
        if (consultation && consultation.status === 'COMPLETED') {
           const consultService = services.find(s => s.service_type === 'GENERAL' && s.name.toLowerCase().includes('consultation'));
           if (consultService) {
             newDraftItems.push({
                service_id: consultService.id,
                service_type: 'CONSULTATION',
                quantity: 1,
                service_name: consultService.name,
                unit_price: consultService.standard_price,
                line_total: consultService.standard_price,
             });
           }
        }
        
        // Auto-add Lab Tests
        if (labOrder && labOrder.status !== 'DRAFT') {
           for (const item of labOrder.items) {
             const service = services.find(s => s.id === item.service_id);
             if (service) {
               newDraftItems.push({
                 service_id: service.id,
                 service_type: 'LAB_TEST',
                 quantity: 1,
                 service_name: service.name,
                 unit_price: service.standard_price,
                 line_total: service.standard_price,
               });
             }
           }
        }
        
        // Auto-add Imaging
        if (imagingOrder && imagingOrder.status !== 'DRAFT') {
           for (const item of imagingOrder.items) {
             const service = services.find(s => s.id === item.service_id);
             if (service) {
               newDraftItems.push({
                 service_id: service.id,
                 service_type: 'IMAGING_SERVICE',
                 quantity: 1,
                 service_name: service.name,
                 unit_price: service.standard_price,
                 line_total: service.standard_price,
               });
             }
           }
        }
        
        // Auto-add Pharmacy
        if (prescription && prescription.status !== 'DRAFT') {
           for (const item of prescription.items) {
             const batch = batches.find(b => b.medicine?.name === item.medicine_name);
             if (batch) {
               newDraftItems.push({
                 service_id: batch.id,
                 service_type: 'PHARMACY',
                 quantity: item.quantity || 1,
                 service_name: `${batch.medicine?.name} (Batch: ${batch.batch_number})`,
                 unit_price: batch.unit_price,
                 line_total: batch.unit_price * (item.quantity || 1),
               });
             }
           }
        }
        
        setDraftItems(newDraftItems);
        
      } catch (error) {
        console.error('Failed to auto-populate services', error);
      }
    };
    
    void fetchOpdServices();
    
    return () => {
      ignore = true;
    };
  }, [createMode, selectedVisit, selectedBranch]);'''
new_effect = '''  useBillingAutoPopulate({
    visitId: selectedVisit,
    branchId: selectedBranch,
    createMode,
    onPopulate: setDraftItems,
  });'''
code = code.replace(old_effect, new_effect)

code = code.replace('''  const invoiceQuery = useQuery({
    queryKey: ['billing', 'invoice', invoiceId],
    queryFn: () => billingApi.getById(invoiceId),
    enabled: !createMode,
  });''', \"\"\"  const invoiceQuery = useBillingInvoiceDetails(!createMode ? invoiceId : null);\"\"\")

code = code.replace('''  const paymentsQuery = useQuery({
    queryKey: ['billing', 'payments', invoiceId],
    queryFn: () => billingApi.payments(invoiceId),
    enabled: !createMode,
  });''', \"\"\"  const paymentsQuery = useBillingPayments(!createMode ? invoiceId : null);\"\"\")

old_invalidate = '''  const invalidateInvoice = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['billing'] }),
      invoiceId ? queryClient.invalidateQueries({ queryKey: ['billing', 'invoice', invoiceId] }) : Promise.resolve(),
    ]);
  };'''
code = code.replace(old_invalidate, '')

old_create_mutation = '''  const createMutation = useMutation({
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
  });'''
new_create_mutation = \"  const createMutation = useCreateBillingInvoice();\"
code = code.replace(old_create_mutation, new_create_mutation)

old_update_mutation = '''  const updateMutation = useMutation({
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
  });'''
new_update_mutation = \"  const updateMutation = useUpdateBillingInvoice();\"
code = code.replace(old_update_mutation, new_update_mutation)

old_cancel_mutation = '''  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(invoiceId),
    onSuccess: async () => {
      toast.success('Invoice cancelled.');
      setCancelOpen(false);
      await invalidateInvoice();
    },
    onError: (error) => toast.error(billingErrorMessage(error)),
  });'''
new_cancel_mutation = \"  const cancelMutation = useCancelBillingInvoice();\"
code = code.replace(old_cancel_mutation, new_cancel_mutation)

old_payment_mutation = '''  const paymentMutation = useMutation({
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
  });'''
new_payment_mutation = \"  const paymentMutation = useCollectBillingPayment();\"
code = code.replace(old_payment_mutation, new_payment_mutation)

old_receipt_mutation = '''  const receiptMutation = useMutation({
    mutationFn: (paymentId: string) => billingApi.receipt(paymentId),
    onSuccess: setReceipt,
    onError: (error) => toast.error(billingErrorMessage(error)),
  });'''
new_receipt_mutation = \"  const receiptMutation = useBillingReceipt();\"
code = code.replace(old_receipt_mutation, new_receipt_mutation)

old_create_handler = '''  const createInvoice = invoiceForm.handleSubmit((values) => {
    if (draftItems.length === 0) return toast.error('Add at least one billable service.');
    createMutation.mutate(values);
  });'''
new_create_handler = '''  const createInvoice = invoiceForm.handleSubmit((values) => {
    if (draftItems.length === 0) return toast.error('Add at least one billable service.');
    const visit = visitsQuery.data?.data.find((item) => item.id === values.visit_id);
    createMutation.mutate({
      ...values,
      appointment_id: visit?.appointment_id ?? null,
      items: draftItems.map(({ service_id, service_type, quantity }) => ({ service_id, service_type, quantity })),
    }, {
      onSuccess: (created) => navigate(`/billing/workspace?id=${created.id}`, { replace: true })
    });
  });'''
code = code.replace(old_create_handler, new_create_handler)

code = code.replace(
  \"updateMutation.mutate({ values, finalize: false })\",
  \"updateMutation.mutate({ id: invoiceId, payload: { invoice_date: values.invoice_date, discount_amount: values.discount_amount, tax_amount: values.tax_amount }, finalize: false })\"
)

code = code.replace(
  \"updateMutation.mutate({ values, finalize: true })\",
  \"updateMutation.mutate({ id: invoiceId, payload: { invoice_date: values.invoice_date, discount_amount: values.discount_amount, tax_amount: values.tax_amount }, finalize: true })\"
)

code = code.replace(
  \"cancelMutation.mutate()\",
  \"cancelMutation.mutate(invoiceId, { onSuccess: () => setCancelOpen(false) })\"
)

code = code.replace(
  \"paymentMutation.mutate(values)\",
  \"paymentMutation.mutate({ id: invoiceId, payload: { amount: values.amount, payment_method: values.payment_method, payment_date: values.payment_date, reference_number: values.reference_number || undefined } }, { onSuccess: () => { setPaymentOpen(false); paymentForm.reset({ amount: 0, payment_method: 'CASH', payment_date: today(), reference_number: '' }); } })\"
)

code = code.replace(
  \"receiptMutation.mutate(payment.id)\",
  \"receiptMutation.mutate(payment.id, { onSuccess: setReceipt })\"
)

# Remove the empty line that used to contain invalidateInvoice if needed, but not strictly necessary.

with open('BillingWorkspacePage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
