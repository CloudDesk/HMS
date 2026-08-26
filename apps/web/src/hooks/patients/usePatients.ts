import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  patientsApi,
  type PatientDocumentListParams,
  type PatientListParams,
  type PatientTimelineListParams,
  type SavePatientPayload,
  type UploadPatientDocumentPayload,
} from '../../api/patients';
import { patientDocumentsService } from '../../services/patient-documents.service';
import { patientRegistrationService } from '../../services/patient-registration.service';

export const getPatientErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 404) return 'The requested patient record could not be found.';
    if (error.status === 409) return error.message || 'A conflict occurred.';
    if (error.status >= 500) return 'The patient service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'An unexpected error occurred while processing the patient record.';
};

export const patientsKeys = {
  all: ['patients'] as const,
  lists: () => [...patientsKeys.all, 'list'] as const,
  list: (params: PatientListParams) => [...patientsKeys.lists(), params] as const,
  details: () => [...patientsKeys.all, 'detail'] as const,
  detail: (id: string) => [...patientsKeys.details(), id] as const,
  histories: () => [...patientsKeys.all, 'history'] as const,
  history: (id: string) => [...patientsKeys.histories(), id] as const,
  timelines: () => [...patientsKeys.all, 'timeline'] as const,
  timeline: (id: string, params: PatientTimelineListParams) => [...patientsKeys.timelines(), id, params] as const,
  documentsAll: () => [...patientsKeys.all, 'documents'] as const,
  documents: (id: string, params: PatientDocumentListParams) => [...patientsKeys.documentsAll(), id, params] as const,
};

export function usePatientsList(params: PatientListParams, enabled = true) {
  return useQuery({
    queryKey: patientsKeys.list(params),
    queryFn: () => patientsApi.list(params),
    enabled,
  });
}

export function usePatientDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? patientsKeys.detail(id) : patientsKeys.details(),
    queryFn: () => patientsApi.getById(id!),
    enabled: enabled && Boolean(id),
  });
}

export function usePatientHistory(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? patientsKeys.history(id) : patientsKeys.histories(),
    queryFn: () => patientsApi.history(id!),
    enabled: enabled && Boolean(id),
  });
}

export function usePatientTimeline(id: string | null, params: PatientTimelineListParams, enabled = true) {
  return useQuery({
    queryKey: id ? patientsKeys.timeline(id, params) : patientsKeys.timelines(),
    queryFn: () => patientsApi.timeline(id!, params),
    enabled: enabled && Boolean(id),
  });
}

export function usePatientDocuments(id: string | null, params: PatientDocumentListParams = {}, enabled = true) {
  return useQuery({
    queryKey: id ? patientsKeys.documents(id, params) : patientsKeys.documentsAll(),
    queryFn: () => patientDocumentsService.list(id!, params),
    enabled: enabled && Boolean(id),
  });
}

type CreatePatientOptions = {
  notify?: boolean;
};

export function useCreatePatient(options: CreatePatientOptions = {}) {
  const queryClient = useQueryClient();
  const notify = options.notify ?? true;

  return useMutation({
    mutationFn: (payload: SavePatientPayload) => patientRegistrationService.create(payload),
    onSuccess: async () => {
      if (notify) toast.success('Patient created successfully.');
      await queryClient.invalidateQueries({ queryKey: patientsKeys.lists() });
    },
    onError: (error) => {
      if (notify) toast.error(getPatientErrorMessage(error));
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SavePatientPayload> }) =>
      patientsApi.update(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Patient profile updated.');
      await queryClient.invalidateQueries({ queryKey: patientsKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.history(id) });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.lists() });
    },
    onError: (error) => toast.error(getPatientErrorMessage(error)),
  });
}

export function useUploadPatientDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UploadPatientDocumentPayload }) =>
      patientDocumentsService.upload(id, payload),
    onSuccess: async (_, { id }) => {
      await queryClient.invalidateQueries({ queryKey: patientsKeys.documentsAll() });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.history(id) });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.timeline(id, {}) });
    },
    onError: (error) => toast.error(getPatientErrorMessage(error)),
  });
}

export function useReplacePatientDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, documentId, payload }: { id: string; documentId: string; payload: UploadPatientDocumentPayload }) =>
      patientDocumentsService.replace(id, documentId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: patientsKeys.documentsAll() });
    },
    onError: (error) => toast.error(getPatientErrorMessage(error)),
  });
}

export function useDeletePatientDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) =>
      patientDocumentsService.delete(id, documentId),
    onSuccess: async (_r, { id }) => {
      await queryClient.invalidateQueries({ queryKey: patientsKeys.documentsAll() });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.history(id) });
    },
    onError: (error) => toast.error(getPatientErrorMessage(error)),
  });
}

export function useVerifyPatientConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) => patientsApi.verifyConsent(id, documentId),
    onSuccess: async (_, { id }) => {
      await queryClient.invalidateQueries({ queryKey: patientsKeys.documentsAll() });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.history(id) });
      await queryClient.invalidateQueries({ queryKey: patientsKeys.timeline(id, {}) });
    },
    onError: (error) => toast.error(getPatientErrorMessage(error)),
  });
}

export function useDownloadPatientDocument() {
  return useMutation({
    mutationFn: ({ patientId, docId }: { patientId: string; docId: string }) =>
      patientDocumentsService.download(patientId, docId),
  });
}
