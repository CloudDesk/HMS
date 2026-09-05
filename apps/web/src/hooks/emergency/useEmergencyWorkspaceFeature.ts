import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  ConsultationPayload,
  DispositionPayload,
  EmergencyOrderPayload,
  EmergencyReferralPayload,
  EmergencyTriageLevel,
  TriagePayload,
} from '../../api/emergency';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { useMedicinesList } from '../medicines/useMedicines';
import { usePatientsList } from '../patients/usePatients';
import { usePharmacyInventoryList } from '../pharmacy/usePharmacy';
import { useServicesList } from '../services/useServices';
import { useEmergency } from './useEmergency';

export type EmergencyView = 'dashboard' | 'queue' | 'workspace';
const viewOf = (path: string): EmergencyView =>
  path.endsWith('/queue') ? 'queue' : path.endsWith('/workspace') ? 'workspace' : 'dashboard';

export function useEmergencyWorkspaceFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const query = new URLSearchParams(location.search);
  const view = viewOf(location.pathname);
  const [branchId, setBranchId] = useState(query.get('branch_id') ?? '');
  const [departmentId, setDepartmentId] = useState(query.get('department_id') ?? '');
  const [status, setStatus] = useState(query.get('status') ?? '');
  const [triageLevel, setTriageLevel] = useState(query.get('triage_level') ?? '');
  const [search, setSearch] = useState(query.get('search') ?? '');
  const [selectedId, setSelectedIdState] = useState(query.get('encounter_id'));
  const [patientSearch, setPatientSearch] = useState('');

  const isSuperAdmin = user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const can = (screen: string, action: string, module = 'Emergency') =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen, action });

  const capabilities = {
    viewEncounters: can('Encounters', 'View'),
    editEncounters: can('Encounters', 'Edit'),
    register: can('Encounters', 'Register'),
    linkPatient: can('Patient Linking', 'Link'),
    viewTriage: can('Triage', 'View'),
    assessTriage: can('Triage', 'Assess'),
    overridePriority: can('Triage', 'OverridePriority'),
    viewConsultation: can('Consultation', 'View'),
    editConsultation: can('Consultation', 'Edit'),
    viewOrders: can('Orders', 'View'),
    createOrders: can('Orders', 'Create'),
    viewDisposition: can('Disposition', 'View'),
    markNoShow: can('Disposition', 'MarkNoShow'),
    markLeft: can('Disposition', 'MarkLeft'),
    cancel: can('Disposition', 'Cancel'),
    discharge: can('Disposition', 'Discharge'),
    transfer: can('Disposition', 'Transfer'),
    admit: can('Disposition', 'ConvertToIP'),
    viewDocuments: can('Patient Documents', 'View', 'Patients'),
    createDocuments: can('Patient Documents', 'Create', 'Patients'),
    viewReferral: can('OPD Referral', 'View', 'OPD'),
  };

  // Derive dashboard profile from capabilities (mirrors EmergencyWorkspacePage logic).
  // Purely capability-driven — no hardcoded role names.
  const isDoctor =
    capabilities.editConsultation ||
    capabilities.createOrders ||
    capabilities.discharge ||
    capabilities.admit;
  const isNurse = capabilities.assessTriage && !isDoctor;
  const isReceptionist =
    (capabilities.register || capabilities.linkPatient) && !isNurse && !isDoctor;

  const dashboardProfile: 'doctor' | 'nurse' | 'receptionist' | 'viewer' = isDoctor
    ? 'doctor'
    : isNurse
      ? 'nurse'
      : isReceptionist
        ? 'receptionist'
        : 'viewer';

  // Current authenticated user ID — used by doctor queue filter without hardcoding names.
  const currentUserId = user?.id ?? null;

  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100 }, isSuperAdmin);
  const branches = isSuperAdmin ? (branchesQuery.data?.data ?? []) : (user?.branches ?? []);

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      const main = branches.find((b) => b.code?.toUpperCase() === 'MB01' || b.name?.toLowerCase().includes('main'));
      setBranchId(main ? main.id : (branches[0]?.id ?? ''));
    }
  }, [branchId, branches]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', branchId);
    if (departmentId) params.set('department_id', departmentId);
    if (status) params.set('status', status);
    if (triageLevel) params.set('triage_level', triageLevel);
    if (search) params.set('search', search);
    if (selectedId) params.set('encounter_id', selectedId);
    navigate(`${location.pathname}?${params}`, { replace: true });
  }, [branchId, departmentId, location.pathname, search, selectedId, status, triageLevel]);

  const emergency = useEmergency(
    {
      branch_id: branchId,
      department_id: departmentId || undefined,
      status: status || undefined,
      triage_level: triageLevel || undefined,
      search: search || undefined,
      page: 1,
      limit: 100,
    },
    selectedId,
    Boolean(branchId),
  );

  const departments = useDepartmentsList(
    { branch_id: branchId || undefined, status: 'ACTIVE', page: 1, limit: 100 },
    Boolean(branchId),
  );
  const allDepartments = useDepartmentsList({ status: 'ACTIVE', page: 1, limit: 100 }, true);

  const nonClinicalDeptNames = new Set([
    'nursing',
    'reception',
    'pharmacy',
    'billing',
    'imaging',
    'laboratory',
    'billing / finance',
    'billing/finance',
    'administration',
    'finance',
    'it / technical',
    'it',
    'security',
    'human resources',
    'hr',
    'housekeeping',
    'maintenance',
    'medical records',
    'store',
    'inventory',
  ]);

  const rawDepartmentOptions =
    departments.data?.data && departments.data.data.length > 0
      ? departments.data.data
      : allDepartments.data?.data ?? [];
  const seenDept = new Set<string>();
  const departmentOptions = rawDepartmentOptions
    .filter((d: { name: string; isClinical?: boolean }) => {
      const key = d.name.trim().toLowerCase();
      if (d.isClinical === false || nonClinicalDeptNames.has(key)) return false;
      if (seenDept.has(key)) return false;
      seenDept.add(key);
      return true;
    })
    .sort((a: { name: string }, b: { name: string }) => {
      const aIsEm = /emergency|casualty|trauma/i.test(a.name);
      const bIsEm = /emergency|casualty|trauma/i.test(b.name);
      if (aIsEm && !bIsEm) return -1;
      if (!aIsEm && bIsEm) return 1;
      return a.name.localeCompare(b.name);
    });

  const doctors = useDoctorsList(
    {
      branch_id: branchId || undefined,
      department_id: departmentId || undefined,
      status: 'ACTIVE',
      page: 1,
      limit: 100,
    },
    Boolean(branchId),
  );
  const allDoctors = useDoctorsList({ status: 'ACTIVE', page: 1, limit: 100 }, true);
  const doctorOptions =
    doctors.data?.data && doctors.data.data.length > 0
      ? doctors.data.data
      : allDoctors.data?.data ?? [];

  const currentDoctor = useMemo(() => {
    return doctorOptions.find((d) => d.user_id === user?.id) || null;
  }, [doctorOptions, user?.id]);

  const currentDoctorId = currentDoctor?.id ?? null;

  const patients = usePatientsList(
    { search: patientSearch, status: 'ACTIVE', page: 1, limit: 20 },
    patientSearch.trim().length >= 2,
  );
  const allPatients = usePatientsList({ status: 'ACTIVE', page: 1, limit: 100 }, true);
  const patientOptions =
    patientSearch.trim().length >= 2
      ? patients.data?.data ?? []
      : allPatients.data?.data ?? [];

  const services = useServicesList({ status: 'ACTIVE', page: 1, limit: 100 });
  const medicines = useMedicinesList(
    { status: 'ACTIVE', limit: 100 },
    view === 'workspace',
  );
  const inventory = usePharmacyInventoryList(
    { branch_id: branchId, limit: 100 },
    view === 'workspace' && Boolean(branchId),
  );

  const availableMedicines = useMemo(() => {
    const medicineList = medicines.data?.data ?? [];
    const inventoryList = inventory.data?.data ?? [];
    const inventoryByMedicine: Record<
      string,
      { available: number; strength?: string | null; form?: string | null }
    > = {};
    inventoryList.forEach((item) => {
      inventoryByMedicine[item.medicine_id] = {
        available: item.available_quantity,
        strength: item.medicine?.strength,
        form: item.medicine?.dosage_form,
      };
    });

    const combined: Array<{
      id: string;
      name: string;
      generic_name?: string | null;
      strength?: string | null;
      dosage_form?: string | null;
      available_quantity?: number;
    }> = [];
    const seen = new Set<string>();

    medicineList.forEach((medicine) => {
      const key = medicine.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      combined.push({
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.generic_name,
        strength: medicine.strength || inventoryByMedicine[medicine.id]?.strength,
        dosage_form: medicine.dosage_form || inventoryByMedicine[medicine.id]?.form,
        available_quantity: inventoryByMedicine[medicine.id]?.available,
      });
    });

    inventoryList.forEach((item) => {
      if (!item.medicine?.name) return;
      const key = item.medicine.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      combined.push({
        id: item.medicine_id,
        name: item.medicine.name,
        generic_name: item.medicine.generic_name,
        strength: item.medicine.strength,
        dosage_form: item.medicine.dosage_form,
        available_quantity: item.available_quantity,
      });
    });

    return combined;
  }, [inventory.data, medicines.data]);

  const serviceOptions = useMemo(() => services.data?.data ?? [], [services.data]);
  const labServices = useMemo(() => {
    const filtered = serviceOptions.filter((service) =>
      service.service_type === 'LAB_TEST' ||
      service.category?.toLowerCase().includes('lab') ||
      service.category?.toLowerCase().includes('pathology') ||
      service.category?.toLowerCase().includes('blood') ||
      service.name.toLowerCase().includes('test') ||
      service.name.toLowerCase().includes('panel') ||
      service.name.toLowerCase().includes('cbc') ||
      service.name.toLowerCase().includes('profile') ||
      service.name.toLowerCase().includes('culture') ||
      service.name.toLowerCase().includes('count'));
    return filtered.length > 0 ? filtered : serviceOptions;
  }, [serviceOptions]);
  const imagingServices = useMemo(() => {
    const filtered = serviceOptions.filter((service) =>
      service.service_type === 'IMAGING_SERVICE' ||
      service.category?.toLowerCase().includes('imaging') ||
      service.category?.toLowerCase().includes('radiology') ||
      service.category?.toLowerCase().includes('x-ray') ||
      service.category?.toLowerCase().includes('scan') ||
      service.name.toLowerCase().includes('x-ray') ||
      service.name.toLowerCase().includes('ct') ||
      service.name.toLowerCase().includes('ultrasound') ||
      service.name.toLowerCase().includes('mri') ||
      service.name.toLowerCase().includes('ecg') ||
      service.name.toLowerCase().includes('echo'));
    return filtered.length > 0 ? filtered : serviceOptions;
  }, [serviceOptions]);

  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    if (id && view !== 'workspace')
      navigate(`/emergency/workspace?branch_id=${branchId}&encounter_id=${id}`);
  };

  return {
    state: {
      view,
      branchId,
      departmentId,
      status,
      triageLevel,
      search,
      selectedId,
      patientSearch,
      branches,
      departments: departmentOptions,
      doctors: doctorOptions,
      currentDoctor,
      currentDoctorId,
      currentUserId,
      dashboardProfile,
      patients: patientOptions,
      services: serviceOptions,
      availableMedicines,
      labServices,
      imagingServices,
      capabilities,
      encounters: emergency.list.data?.data ?? [],
      summary: emergency.summary.data ?? {},
      listQuery: emergency.list,
      detailQuery: emergency.detail,
      selected: emergency.detail.data ?? emergency.list.data?.data[0] ?? null,
      loading: emergency.list.isLoading || emergency.detail.isLoading,
      error: emergency.detail.error ?? emergency.list.error,
      pending: {
        triage: emergency.triage.isPending,
        consultation: emergency.consultation.isPending,
        order: emergency.order.isPending,
        referral: emergency.referral.isPending,
        disposition: emergency.disposition.isPending,
        linkPatient: emergency.linkPatient.isPending,
        overridePriority: emergency.overridePriority.isPending,
      },
    },
    actions: {
      setBranchId,
      setDepartmentId,
      setStatus,
      setTriageLevel,
      setSearch,
      setSelectedId,
      setPatientSearch,
      saveTriage: (id: string, body: TriagePayload) =>
        emergency.triage.mutateAsync({ id, body }),
      saveConsultation: (id: string, body: ConsultationPayload) =>
        emergency.consultation.mutateAsync({ id, body }),
      submitOrder: (id: string, body: EmergencyOrderPayload) =>
        emergency.order.mutateAsync({ id, body }),
      submitReferral: (id: string, body: EmergencyReferralPayload) =>
        emergency.referral.mutateAsync({ id, body }),
      completeDisposition: async (id: string, body: DispositionPayload) => {
        const encounter = await emergency.disposition.mutateAsync({ id, body });
        toast.success(`Patient disposition confirmed as ${body.decision}.`);
        navigate(`/emergency/queue?branch_id=${branchId}`);
        return encounter;
      },
      linkPatient: (id: string, patientId: string, reason?: string) =>
        emergency.linkPatient.mutateAsync({ id, patientId, reason }),
      overridePriority: (id: string, level: EmergencyTriageLevel, reason: string) =>
        emergency.overridePriority.mutateAsync({ id, level, reason }),
      openQueue: () => navigate(`/emergency/queue?branch_id=${branchId}`),
    },
    mutations: emergency,
  };
}
