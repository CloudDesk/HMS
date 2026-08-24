import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { ConsentTemplate, SaveConsentTemplate } from '../../api/consents';
import { useBranchesList } from '../branches/useBranches';
import { useConsentTemplates, useCreateConsentTemplate, useUpdateConsentTemplate } from './useConsents';

export function useConsentTemplatesFeature() {
  const { user } = useAuth();
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => superAdmin || hasPermission(user?.permissions ?? [], { module: 'Administration', screen: 'Consent Templates', action });
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100 }, can('View'));
  const branches = branchesQuery.data?.data ?? [];
  const [branchId, setBranchId] = useState('');
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branchId, branches]);
  const templatesQuery = useConsentTemplates({ branch_id: branchId }, can('View'));
  const create = useCreateConsentTemplate();
  const update = useUpdateConsentTemplate();
  const save = async (payload: SaveConsentTemplate, editing?: ConsentTemplate | null) => {
    if (editing) await update.mutateAsync({ id: editing.id, payload }); else await create.mutateAsync(payload);
    toast.success(editing ? 'Consent template updated.' : 'Consent template created.');
  };
  return { state: { branches, branchId, templates: templatesQuery.data ?? [], loading: branchesQuery.isLoading || templatesQuery.isLoading,
    saving: create.isPending || update.isPending }, capabilities: { canCreate: can('Create'), canEdit: can('Edit') },
    actions: { setBranchId, save } };
}
