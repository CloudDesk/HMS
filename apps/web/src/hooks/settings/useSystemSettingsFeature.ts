import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { ApiError } from '../../api/api-error';
import {
  useSystemSettings,
  useUpdateGeneralSettings,
  useUpdateHospitalSettings,
  useUpdateLocalizationSettings,
  useUpdateUserPreferences,
  useResetSettings,
  useUploadHospitalLogo,
  useDeleteHospitalLogo,
} from './useSettings';
import {
  settingsApi,
  type GeneralSettings,
  type HospitalSettings,
  type LocalizationSettings,
  type UserPreferenceSettings
} from '../../api/settings';
import { useEffect } from 'react';

type TabId =
  | 'general'
  | 'hospital'
  | 'localization'
  | 'preferences'
  | 'billing'
  | 'inventory'
  | 'notifications'
  | 'security'
  | 'integrations'
  | 'backup'
  | 'audit';

type FieldErrors = Record<string, string>;

const detailsToErrors = (error: ApiError): FieldErrors => {
  if (!Array.isArray(error.details)) return {};
  const errors: FieldErrors = {};
  for (const detail of error.details as Array<{ instancePath?: string; message?: string; params?: { missingProperty?: string } }>) {
    const field = detail.params?.missingProperty ?? detail.instancePath?.split('/').filter(Boolean).at(-1);
    if (field) errors[field] = detail.message ? `${field} ${detail.message}` : 'This value is not valid.';
  }
  return errors;
};

export function useSystemSettingsFeature() {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = useCallback((action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Settings', action,
  }), [isSuperAdmin, user?.permissions]);

  const canView = can('View');
  const canEdit = can('Edit');

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [navSearch, setNavSearch] = useState('');
  const [auditTotal, setAuditTotal] = useState(0);

  const settingsQuery = useSystemSettings(canView);
  
  const updateGeneralSettings = useUpdateGeneralSettings();
  const updateHospitalSettings = useUpdateHospitalSettings();
  const updateLocalizationSettings = useUpdateLocalizationSettings();
  const updateUserPreferences = useUpdateUserPreferences();
  const resetSettings = useResetSettings();
  const uploadLogoMutation = useUploadHospitalLogo();
  const deleteLogoMutation = useDeleteHospitalLogo();

  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoObjectUrl = useRef<string | null>(null);

  const showMessage = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast(message);
    setToastTone(tone);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  const replaceLogoUrl = useCallback((nextUrl: string | null) => {
    if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
    logoObjectUrl.current = nextUrl;
    setLogoUrl(nextUrl);
  }, []);

  const serverLogoBlobName = settingsQuery.data?.hospital?.logoBlobName;

  useEffect(() => {
    if (!serverLogoBlobName) return;
    let active = true;
    let createdUrl: string | null = null;
    settingsApi
      .getLogo()
      .then((blob) => {
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          replaceLogoUrl(createdUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [serverLogoBlobName, replaceLogoUrl]);

  const handleMutationError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      setServerErrors(detailsToErrors(error));
      if (error.status === 403) {
        showMessage('You do not have permission to edit System Settings.', 'error');
        return;
      }
      showMessage(error.message, 'error');
    } else {
      showMessage((error as Error).message || 'An unexpected error occurred.', 'error');
    }
  }, [showMessage]);

  const updateGeneral = async (payload: GeneralSettings) => {
    if (!canEdit) return;
    setServerErrors({});
    try {
      const { version, ...data } = payload;
      void version;
      await updateGeneralSettings.mutateAsync(data);
    } catch (error) {
      handleMutationError(error);
    }
  };

  const updateHospital = async (payload: HospitalSettings) => {
    if (!canEdit) return;
    setServerErrors({});
    try {
      const { logoBlobName, logoContentType, ...data } = payload;
      void logoBlobName;
      void logoContentType;
      await updateHospitalSettings.mutateAsync(data);
    } catch (error) {
      handleMutationError(error);
    }
  };

  const updateLocalization = async (payload: LocalizationSettings) => {
    if (!canEdit) return;
    setServerErrors({});
    try {
      await updateLocalizationSettings.mutateAsync(payload);
    } catch (error) {
      handleMutationError(error);
    }
  };

  const updatePreferences = async (payload: UserPreferenceSettings) => {
    if (!canEdit) return;
    setServerErrors({});
    try {
      await updateUserPreferences.mutateAsync(payload);
    } catch (error) {
      handleMutationError(error);
    }
  };

  const reset = (section: 'general' | 'hospital' | 'localization' | 'userPreferences') => {
    if (!canEdit) return;
    setServerErrors({});
    resetSettings.mutate(section, {
      onSuccess: () => {
        if (section === 'hospital') {
          replaceLogoUrl(null);
        }
      },
      onError: handleMutationError,
    });
  };

  const uploadLogo = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) return showMessage('Hospital logo must be a PNG or JPG image.', 'error');
    if (file.size > 2 * 1024 * 1024) return showMessage('Hospital logo must not exceed 2 MB.', 'error');
    if (!canEdit) return;
    
    try {
      await uploadLogoMutation.mutateAsync(file);
      replaceLogoUrl(URL.createObjectURL(file));
      showMessage('Hospital logo uploaded.');
    } catch (error) {
      showMessage((error as Error).message || 'Failed to upload logo', 'error');
    }
  };

  const removeLogo = async () => {
    if (!canEdit) return;

    try {
      await deleteLogoMutation.mutateAsync();
      replaceLogoUrl(null);
      showMessage('Hospital logo removed.');
    } catch (error) {
      showMessage((error as Error).message || 'Failed to remove logo', 'error');
    }
  };

  const isFetching = settingsQuery.isFetching;
  const isMutating = updateGeneralSettings.isPending || updateHospitalSettings.isPending || updateLocalizationSettings.isPending || updateUserPreferences.isPending || resetSettings.isPending || uploadLogoMutation.isPending || deleteLogoMutation.isPending;
  const loadError = settingsQuery.error ? (settingsQuery.error as Error).message || 'Unable to load settings.' : '';

  return {
    state: {
      activeTab,
      navSearch,
      auditTotal,
      serverErrors,
      logoUrl,
      toast,
      toastTone,
      setActiveTab: (tab: TabId) => {
        setActiveTab(tab);
        setServerErrors({});
      },
      setNavSearch,
      setAuditTotal,
    },
    data: {
      settings: settingsQuery.data,
    },
    status: {
      isFetching,
      isMutating,
      loadError,
    },
    rbac: {
      canView,
      canEdit,
    },
    actions: {
      updateGeneral,
      updateHospital,
      updateLocalization,
      updatePreferences,
      reset,
      uploadLogo,
      removeLogo,
      showMessage,
      refetch: settingsQuery.refetch,
    }
  };
}
