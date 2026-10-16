import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { AdminListParams, AdminResource, AdminSave, versionActionSchema } from '../../api/ophthalmology-admin';
import type { z } from 'zod';

export function useOphthalmologyAdministrationList(resource: AdminResource, params: AdminListParams, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'admin', resource, params], queryFn: ({ signal }) => service.admin.list(resource, params, signal), enabled, retry: false });
}
export function useOphthalmologyAdministrationMutations(branchId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'admin'], predicate: (query) => query.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'branch_id' in part && part.branch_id === branchId)) });
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'configuration', branchId] });
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'workflow', branchId] });
  };
  return {
    save: useMutation({ mutationFn: (command: AdminSave) => service.admin.save(command), onSuccess: refresh }),
    action: useMutation({ mutationFn: (input: { resource: AdminResource; id: string; action: 'activate' | 'deactivate'; body: z.infer<typeof versionActionSchema> }) => service.admin.action(input.resource, input.id, input.action, input.body), onSuccess: refresh }),
  };
}
