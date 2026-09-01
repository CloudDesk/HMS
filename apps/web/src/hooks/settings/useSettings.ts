import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  settingsApi,
  type AuditAction,
  type GeneralSettings,
  type HospitalSettings,
  type LocalizationSettings,
  type UserPreferenceSettings,
} from '../../api/settings';
import { useEffect, useState } from 'react';

export const settingsKeys = {
  all: ['settings'] as const,
  details: () => [...settingsKeys.all, 'detail'] as const,
  firstDayOfWeek: () => [...settingsKeys.all, 'runtime', 'firstDayOfWeek'] as const,
  hospital: () => [...settingsKeys.all, 'runtime', 'hospital'] as const,
  auditLogs: () => [...settingsKeys.all, 'auditLogs'] as const,
  auditLogList: (params: { search?: string; action?: AuditAction; page?: number; limit?: number }) => [...settingsKeys.auditLogs(), params] as const,
};

export function useSystemSettings(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.details(),
    queryFn: () => settingsApi.get(),
    enabled,
  });
}

export function useHospitalSettings() {
  const query = useQuery({
    queryKey: settingsKeys.hospital(),
    queryFn: () => settingsApi.getRuntimeHospital(),
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoBlobName = query.data?.logoBlobName;

  useEffect(() => {
    if (!logoBlobName) {
      setLogoUrl(null);
      return;
    }
    let active = true;
    settingsApi
      .getLogo()
      .then((blob) => {
        if (active) {
          setLogoUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        if (active) setLogoUrl(null);
      });
    return () => {
      active = false;
    };
  }, [logoBlobName]);

  return {
    hospitalName: query.data?.hospitalName ?? 'HMS Enterprise',
    phone: query.data?.phone ?? '',
    email: query.data?.email ?? '',
    address: query.data?.address ?? '',
    logoUrl,
    hospitalSettings: query.data ?? null,
    ...query,
  };
}

export function useFirstDayOfWeek() {
  const query = useQuery({
    queryKey: settingsKeys.firstDayOfWeek(),
    queryFn: () => settingsApi.getFirstDayOfWeek(),
  });

  return {
    firstDayOfWeek: query.data?.firstDayOfWeek ?? 'Sunday',
    ...query,
  };
}

export function useUpdateGeneralSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<GeneralSettings, 'version'>) => settingsApi.updateGeneral(payload),
    onSuccess: async () => {
      toast.success('General settings updated successfully');


      await queryClient.invalidateQueries({ queryKey: settingsKeys.details() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update general settings');
    }
  });
}

export function useUpdateHospitalSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<HospitalSettings, 'logoBlobName' | 'logoContentType'>) => settingsApi.updateHospital(payload),
    onSuccess: async () => {
      toast.success('Hospital settings updated successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.details() }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.hospital() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update hospital settings');
    }
  });
}

export function useUpdateLocalizationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LocalizationSettings) => settingsApi.updateLocalization(payload),
    onSuccess: async () => {
      toast.success('Localization settings updated successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.details() }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.firstDayOfWeek() }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update localization settings');
    }
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserPreferenceSettings) => settingsApi.updateUserPreferences(payload),
    onSuccess: async () => {
      toast.success('User preferences updated successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.details() }),
        queryClient.invalidateQueries({ queryKey: ['auth', 'passwordPolicy'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update user preferences');
    }
  });
}

export function useResetSettings<T>() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (section: 'general' | 'hospital' | 'localization' | 'userPreferences') => settingsApi.reset<T>(section),
    onSuccess: async () => {
      toast.success('Settings reset to defaults successfully');
      await queryClient.invalidateQueries({ queryKey: settingsKeys.details() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reset settings');
    }
  });
}

export function useSettingsAuditLogs(params: { search?: string; action?: AuditAction; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: settingsKeys.auditLogList(params),
    queryFn: () => settingsApi.listAuditLogs(params),
    enabled,
  });
}
export function useUploadHospitalLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useDeleteHospitalLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.deleteLogo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
