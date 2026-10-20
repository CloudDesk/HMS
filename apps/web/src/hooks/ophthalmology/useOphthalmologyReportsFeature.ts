import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { downloadBlob } from '../../utils/download';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useActiveBranch } from '../../context/BranchContext';
import { navigate, useAppLocation } from '../../routing/navigation';
import { reportTypeSchema, reportQuerySchema } from '../../api/ophthalmology-reports';
import { ophthalmologyIdSchema as id } from '../../api/ophthalmology';
import { stationSchema } from '../../api/ophthalmology-admin';
import { useBranchesList } from '../branches/useBranches';
import { useOphthalmologyAdministrationList } from './useOphthalmologyAdministration';
import { useOphthalmologyReport, useOphthalmologyReportExport } from './useOphthalmologyReports';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function useOphthalmologyReportsFeature() {
  const { user } = useAuth(); const { activeBranchId } = useActiveBranch(); const { search } = useAppLocation(); const params = new URLSearchParams(search);
  const permitted = (module: string, screen: string) => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module, screen, action: 'View' });
  const canView = permitted('OPD', 'Ophthalmology Reports'); const canStations = canView && permitted('OPD', 'Ophthalmology Configuration');
  const typeResult = reportTypeSchema.safeParse(params.get('report_type') ?? 'STATION_QUEUE'); const type = typeResult.success ? typeResult.data : 'STATION_QUEUE';
  const branchId = params.get('branch_id') ?? activeBranchId ?? '';
  const raw: Record<string, unknown> = { branch_id: branchId, page: params.get('page') ?? 1, limit: 20 };
  for (const key of ['station_id', 'date_from', 'date_to']) if (params.has(key)) raw[key] = params.get(key);
  const isVisitVolume = type === 'CLINICAL_VOLUME' && (params.get('volume_basis') ?? 'VISITS') === 'VISITS';
  const basisInvalid = type !== 'CLINICAL_VOLUME' && params.has('volume_basis');
  if (type === 'CLINICAL_VOLUME' || params.has('volume_basis')) raw.volume_basis = params.get('volume_basis') ?? 'VISITS';
  const parsed = reportQuerySchema.safeParse(raw); const query = typeResult.success && parsed.success && !basisInvalid ? parsed.data : null;
  const exporter = useOphthalmologyReportExport();
  const canExport = canView && (Boolean(user?.roles.some((r) => r.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Reports', action: 'Export' }));
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [branchId, search, user?.id]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [exportFailure, setExportFailure] = useState<{ scope: typeof lifecycle; message: string } | null>(null);
  const reportQuery = useOphthalmologyReport(type, query, canView);
  const positive = (key: string) => { const n = Number(params.get(key) ?? 1); return Number.isSafeInteger(n) && n > 0 ? n : 1; };
  const canReadBranches = canView && permitted('Administration', 'Branches') && !user?.branches.length;
  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: positive('branch_page'), limit: 20 }, canReadBranches);
  const stationsOpen = canStations && params.get('station_lookup') === 'open' && id.safeParse(branchId).success;
  const stationsQuery = useOphthalmologyAdministrationList('stations', { branch_id: branchId, page: positive('station_page') }, stationsOpen);
  const stations = stationsOpen ? (stationsQuery.data?.data ?? []).flatMap((row) => { const parsed = stationSchema.safeParse(row); return parsed.success && parsed.data.branch_id === branchId ? [parsed.data] : []; }) : [];
  const setQuery = (updates: Record<string, string | null>) => { if (!canView) return; const next = new URLSearchParams(window.location.search); for (const [key, value] of Object.entries(updates)) { if (value === null) next.delete(key); else next.set(key, value); } navigate(`/opd/ophthalmology/reports?${next}`); };
  const exportReport = async () => {
    if (!canExport || !query || lifecycle.pending || exporter.isPending) return;
    lifecycle.pending = true; setExportFailure(null);
    try { const file = await exporter.mutateAsync({ type, query }); if (!lifecycle.active) return; downloadBlob(file.blob, file.fileName ?? `ophthalmology-${type.toLowerCase()}.csv`); toast.success('Matching report exported.'); }
    catch (error) { if (lifecycle.active) setExportFailure({ scope: lifecycle, message: getOpdErrorMessage(error) }); }
    finally { lifecycle.pending = false; }
  };
  return { isVisitVolume, canExport, exportReport, exportBusy: exporter.isPending, exportError: exportFailure?.scope === lifecycle ? exportFailure.message : null, canView, canStations, canReadBranches, type, branchId, query, reportQuery, report: canView && query ? reportQuery.data : undefined,
    invalid: basisInvalid ? 'Volume basis is available only for clinical volume.' : !typeResult.success ? 'Select a supported report.' : !parsed.success ? parsed.error.issues.map((row) => row.message).join(' ') : null,
    error: reportQuery.isError ? getOpdErrorMessage(reportQuery.error) : null,
    branches: user?.branches.length ? user.branches : canView && permitted('Administration', 'Branches') ? branchesQuery.data?.data ?? [] : [], branchesQuery,
    stations, stationsOpen, stationsQuery, page: positive('page'), branchPage: positive('branch_page'), stationPage: positive('station_page'), setQuery,
    refresh: () => { if (canView && query) void reportQuery.refetch(); },
  };
}
export type OphthalmologyReportsFeature = ReturnType<typeof useOphthalmologyReportsFeature>;
