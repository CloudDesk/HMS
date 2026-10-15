import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { ConsentFormDefinition, ConsentTemplate, SaveConsentTemplate } from '../../api/consents';
import { useBranchesList } from '../branches/useBranches';
import {
  useConsentTemplates,
  useCreateConsentNextVersion,
  useCreateConsentTemplate,
  usePublishConsentTemplate,
  useSaveFormDefinition,
  useUpdateConsentTemplate,
} from './useConsents';

export function useConsentTemplatesFeature() {
  const { user } = useAuth();
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) =>
    superAdmin || hasPermission(user?.permissions ?? [], { module: 'Administration', screen: 'Consent Templates', action });

  const canViewBranches =
    superAdmin || hasPermission(user?.permissions ?? [], { module: 'Administration', screen: 'Branches', action: 'View' });
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100 }, canViewBranches);

  // Fallback to user session branches if global branch listing is restricted or loading
  const userBranches = (user?.branches ?? []).map((b) => ({ id: b.id, name: b.name, code: b.code }));
  const apiBranches = branchesQuery.data?.data ?? [];
  const branches = apiBranches.length > 0 ? apiBranches : userBranches;

  const [branchId, setBranchId] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('activeBranchId') : '';
    if (stored && /^[a-f\d]{24}$/i.test(stored)) return stored;
    return user?.branches?.[0]?.id ?? '';
  });

  useEffect(() => {
    if (!branchId || !/^[a-f\d]{24}$/i.test(branchId)) {
      const stored = localStorage.getItem('activeBranchId');
      if (stored && /^[a-f\d]{24}$/i.test(stored) && (branches.length === 0 || branches.some((b) => b.id === stored))) {
        setBranchId(stored);
      } else if (branches[0]?.id) {
        setBranchId(branches[0].id);
      }
    }
  }, [branchId, branches]);

  const templatesQuery = useConsentTemplates({ branch_id: branchId }, can('View'));
  const create = useCreateConsentTemplate();
  const update = useUpdateConsentTemplate();
  const saveFormDef = useSaveFormDefinition();
  const publishTemplate = usePublishConsentTemplate();
  const createNextVer = useCreateConsentNextVersion();

  const save = async (payload: SaveConsentTemplate, editing?: ConsentTemplate | null) => {
    if (editing) {
      const updated = await update.mutateAsync({ id: editing.id, payload });
      toast.success('Consent template updated.');
      return updated;
    } else {
      const created = await create.mutateAsync(payload);
      toast.success('Consent template created as Draft.');
      return created;
    }
  };

  const saveFormDefinition = async (id: string, formDefinition: ConsentFormDefinition, targetBranchId?: string) => {
    await saveFormDef.mutateAsync({ id, branchId: targetBranchId || branchId, formDefinition });
  };

  const publish = async (id: string, targetBranchId?: string) => {
    await publishTemplate.mutateAsync({ id, branchId: targetBranchId || branchId });
  };

  const createNextVersion = async (id: string, targetBranchId?: string) => {
    const next = await createNextVer.mutateAsync({ id, branchId: targetBranchId || branchId });
    toast.success(`New draft version created (v${next.version}).`);
    return next;
  };

  return {
    state: {
      branches,
      branchId,
      templates: templatesQuery.data ?? [],
      loading: branchesQuery.isLoading || templatesQuery.isLoading,
      saving:
        create.isPending ||
        update.isPending ||
        saveFormDef.isPending ||
        publishTemplate.isPending ||
        createNextVer.isPending,
    },
    capabilities: {
      canCreate: can('Create'),
      canEdit: can('Edit'),
    },
    actions: {
      setBranchId,
      save,
      saveFormDefinition,
      publish,
      createNextVersion,
      refetch: () => templatesQuery.refetch(),
    },
  };
}
