import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { ophthalmologyJourneySchema } from '../../api/ophthalmology-journey';
import { useOphthalmologySummary } from './useOphthalmologyCompletion';
import type { CareWorkspace } from './useOphthalmologyCareFeature';

export function useOphthalmologyTreatmentLinksFeature(workspace: CareWorkspace, open: boolean) {
  const { user } = useAuth();
  const canView = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'))
    || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View' });
  const enabled = open && canView && workspace.canView && Boolean(workspace.visit && workspace.context)
    && !workspace.scopeError && !workspace.visitQuery.isError && !workspace.contextQuery.isError;
  const query = useOphthalmologySummary(workspace.visitId, enabled);
  const parsed = ophthalmologyJourneySchema.safeParse(query.data?.summary);
  const context = parsed.success ? parsed.data.context : undefined;
  const scopeMatches = context?.id === workspace.context?.id && context?.visit_id === workspace.visitId
    && context?.patient_id === workspace.visit?.patient_id && context?.branch_id === workspace.visit?.branch_id
    && context?.department_id === workspace.visit?.department_id;
  const invalid = enabled && query.data !== undefined && (!parsed.success || !scopeMatches);
  const data = enabled && !invalid && !query.isError && parsed.success ? parsed.data : undefined;
  return { query, data, invalid, enabled, ready: Boolean(data) && !query.isFetching,
    refresh: () => enabled ? query.refetch() : Promise.resolve(undefined) };
}
