import { useMemo } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useBillingCapabilities } from './useBillingFeature';
import { useBranchesList } from '../branches/useBranches';
import { usePatientsList } from '../patients/usePatients';
import { useOpdVisits } from '../opd/useOpd';
import { useServicesList } from '../services/useServices';
import { usePharmacyBatches } from '../pharmacy/usePharmacy';
import {
  useBillingInvoiceDetails,
  useBillingPayments,
  useCreateBillingInvoice,
  useUpdateBillingInvoice,
  useCancelBillingInvoice,
  useCollectBillingPayment,
  useBillingReceipt,
} from './useBilling';

type ServiceType = 'CONSULTATION' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PHARMACY';

const catalogueType = (type: ServiceType) => type === 'CONSULTATION'
  ? 'GENERAL'
  : type === 'LAB_TEST' ? 'LAB_TEST' : type === 'IMAGING_SERVICE' ? 'IMAGING_SERVICE' : undefined;

export function useBillingWorkspaceFeature({
  invoiceId,
  createMode,
  selectedBranch,
  selectedPatient,
  selectedSource,
}: {
  invoiceId: string;
  createMode: boolean;
  selectedBranch: string;
  selectedPatient: string;
  selectedSource: ServiceType;
}) {
  const { user } = useAuth();
  const capabilities = useBillingCapabilities();
  const { isSuperAdmin } = capabilities;

  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    createMode && isSuperAdmin
  );

  const branches = useMemo(() => {
    return isSuperAdmin
      ? (branchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, name: branch.name }))
      : (user?.branches ?? []).map((branch) => ({ id: branch.id, name: branch.name }));
  }, [isSuperAdmin, branchesQuery.data?.data, user?.branches]);

  const patientsQuery = usePatientsList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'last_name', sortOrder: 'asc' },
    createMode
  );

  const visitsQuery = useOpdVisits(
    { patient_id: selectedPatient, branch_id: selectedBranch, page: 1, limit: 100, sortBy: 'visit_date', sortOrder: 'desc' },
    createMode && Boolean(selectedPatient && selectedBranch)
  );

  const servicesQuery = useServicesList(
    { status: 'ACTIVE', service_type: catalogueType(selectedSource), page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    createMode && selectedSource !== 'PHARMACY'
  );

  const batchesQuery = usePharmacyBatches(
    { branch_id: selectedBranch, status: 'ACTIVE', page: 1, limit: 100 },
    createMode && selectedSource === 'PHARMACY' && Boolean(selectedBranch)
  );

  const invoiceQuery = useBillingInvoiceDetails(!createMode ? invoiceId : null);
  const paymentsQuery = useBillingPayments(!createMode ? invoiceId : null);

  const createMutation = useCreateBillingInvoice();
  const updateMutation = useUpdateBillingInvoice();
  const cancelMutation = useCancelBillingInvoice();
  const paymentMutation = useCollectBillingPayment();
  const receiptMutation = useBillingReceipt();

  return {
    capabilities,
    queries: {
      branches,
      branchesQuery,
      patientsQuery,
      visitsQuery,
      servicesQuery,
      batchesQuery,
      invoiceQuery,
      paymentsQuery,
    },
    mutations: {
      createMutation,
      updateMutation,
      cancelMutation,
      paymentMutation,
      receiptMutation,
    },
  };
}
