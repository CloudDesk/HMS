import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { useServicesList } from '../services/useServices';
import { useSurgeryDownstream } from './useSurgeryDownstream';
export function useSurgeryDownstreamFeature(bookingId: string | null, branchId: string, enabled: boolean) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canViewPrescription = isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Prescription', action: 'View' });
  const canCreatePrescription = isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Prescription', action: 'Edit' });
  const domain = useSurgeryDownstream(bookingId, branchId, enabled, canViewPrescription);
  const laboratoryServices = useServicesList({ status: 'ACTIVE', service_type: 'LAB_TEST', limit: 100 }, enabled);
  const imagingServices = useServicesList({ status: 'ACTIVE', service_type: 'IMAGING_SERVICE', limit: 100 }, enabled);
  return { ...domain, canCreatePrescription, laboratoryServices: laboratoryServices.data?.data ?? [], imagingServices: imagingServices.data?.data ?? [] };
}
