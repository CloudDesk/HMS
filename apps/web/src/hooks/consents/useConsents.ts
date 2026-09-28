import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConsentContextType,
  ConsentFormDefinition,
  ConsentTemplateStatus,
  SaveConsentTemplate,
  SubmitStructuredConsentPayload,
} from '../../api/consents';
import { consentsService } from '../../services/consents.service';

const keys = {
  all: ['consent-templates'] as const,
  list: (params: object) => ['consent-templates', params] as const,
  detail: (id: string) => ['consent-templates', 'detail', id] as const,
};

export const useConsentTemplates = (
  params: { branch_id: string; context_type?: ConsentContextType; status?: ConsentTemplateStatus },
  enabled = true,
) =>
  useQuery({
    queryKey: keys.list(params),
    queryFn: () => consentsService.list(params),
    enabled: enabled && Boolean(params.branch_id),
  });

export const useConsentTemplateDetail = (id: string | null, enabled = true) =>
  useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => consentsService.getById(id!),
    enabled: enabled && Boolean(id),
  });

export const useCreateConsentTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveConsentTemplate) => consentsService.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateConsentTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveConsentTemplate }) => consentsService.update(id, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useSaveFormDefinition = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId, formDefinition }: { id: string; branchId: string; formDefinition: ConsentFormDefinition }) =>
      consentsService.saveFormDefinition(id, branchId, formDefinition),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
};

export const usePublishConsentTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) => consentsService.publish(id, branchId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCreateConsentNextVersion = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) => consentsService.createNextVersion(id, branchId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCompleteStructuredConsent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, payload }: { patientId: string; payload: SubmitStructuredConsentPayload }) =>
      consentsService.completeStructuredConsent(patientId, payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['patient-documents'] });
      client.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};
