import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { usePatientsList } from '../patients/usePatients';
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
  const can = (screen: string, action: string) =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'Emergency', screen, action });
  const capabilities = {
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
  };
  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100 }, isSuperAdmin);
  const branches = isSuperAdmin ? (branchesQuery.data?.data ?? []) : (user?.branches ?? []);
  useEffect(() => {
    if (!branchId && branches[0]?.id) setBranchId(branches[0].id);
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
  const rawDepartmentOptions =
    departments.data?.data && departments.data.data.length > 0
      ? departments.data.data
      : allDepartments.data?.data ?? [];
  const seenDept = new Set<string>();
  const departmentOptions = rawDepartmentOptions.filter((d) => {
    const key = d.name.trim().toLowerCase();
    if (seenDept.has(key)) return false;
    seenDept.add(key);
    return true;
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
      patients: patientOptions,
      services: services.data?.data ?? [],
      capabilities,
      encounters: emergency.list.data?.data ?? [],
      summary: emergency.summary.data ?? {},
      listQuery: emergency.list,
      detailQuery: emergency.detail,
      selected: emergency.detail.data ?? null,
    },
    actions: {
      setBranchId,
      setDepartmentId,
      setStatus,
      setTriageLevel,
      setSearch,
      setSelectedId,
      setPatientSearch,
    },
    mutations: emergency,
  };
}
