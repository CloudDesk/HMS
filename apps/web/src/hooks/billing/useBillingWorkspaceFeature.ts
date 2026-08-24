import { useMemo } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useBillingCapabilities } from './useBillingFeature';
import { useBranchesList } from '../branches/useBranches';
import { usePatientsList } from '../patients/usePatients';
import { useOpdVisits } from '../opd/useOpd';
import { useServicesList } from '../services/useServices';
import {
  useBillingInvoiceDetails,
  useBillingPayments,
  useCreateBillingInvoice,
  useUpdateBillingInvoice,
  useCancelBillingInvoice,
  useCollectBillingPayment,
  useBillingReceipt,
} from './useBilling';
import { useBillingAutoPopulate, type DraftItem } from './useBillingAutoPopulate';

type ServiceType = 'CONSULTATION' | 'LAB_TEST' | 'IMAGING_SERVICE';

const catalogueType = (type: ServiceType) => type === 'CONSULTATION'
  ? 'GENERAL'
  : type === 'LAB_TEST' ? 'LAB_TEST' : 'IMAGING_SERVICE';

export function useBillingWorkspaceFeature({
  invoiceId,
  createMode,
  selectedBranch,
  selectedPatient,
  selectedVisit,
  selectedSource,
  onPopulate,
}: {
  invoiceId: string;
  createMode: boolean;
  selectedBranch: string;
  selectedPatient: string;
  selectedVisit: string;
  selectedSource: ServiceType;
  onPopulate: (items: DraftItem[]) => void;
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
    createMode
  );

  const invoiceQuery = useBillingInvoiceDetails(!createMode ? invoiceId : null);
  const paymentsQuery = useBillingPayments(!createMode ? invoiceId : null);

  const createMutation = useCreateBillingInvoice();
  const updateMutation = useUpdateBillingInvoice();
  const cancelMutation = useCancelBillingInvoice();
  const paymentMutation = useCollectBillingPayment();
  const receiptMutation = useBillingReceipt();

  useBillingAutoPopulate({
    visitId: selectedVisit,
    createMode,
    onPopulate,
  });

  return {
    capabilities,
    queries: {
      branches,
      branchesQuery,
      patientsQuery,
      visitsQuery,
      servicesQuery,
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
