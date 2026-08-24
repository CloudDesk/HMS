import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConsentContextType, ConsentTemplateStatus, SaveConsentTemplate } from '../../api/consents';
import { consentsService } from '../../services/consents.service';
const keys = { all: ['consent-templates'] as const, list: (params: object) => ['consent-templates', params] as const };
export const useConsentTemplates = (params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus }, enabled = true) =>
  useQuery({ queryKey: keys.list(params), queryFn: () => consentsService.list(params), enabled: enabled && Boolean(params.branch_id) });
export const useCreateConsentTemplate = () => { const client = useQueryClient(); return useMutation({ mutationFn: (payload: SaveConsentTemplate) => consentsService.create(payload), onSuccess: () => client.invalidateQueries({ queryKey: keys.all }) }); };
export const useUpdateConsentTemplate = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: SaveConsentTemplate }) => consentsService.update(id, payload), onSuccess: () => client.invalidateQueries({ queryKey: keys.all }) }); };
