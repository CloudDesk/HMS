import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  settingsApi,
  type GeneralSettings,
  type HospitalSettings,
  type LocalizationSettings,
  type SystemSettings,
  type UserPreferenceSettings,
} from '../api/settings';
import { AuditLogPanel } from '../components/settings/AuditLogPanel';
import {
  GeneralSettingsForm,
  HospitalSettingsForm,
  LocalizationSettingsForm,
  UserPreferencesForm,
  type FieldErrors,
} from '../components/settings/SettingsForms';
import { Toast } from '../components/ui/Toast';

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

const tabs: Array<{ id: TabId; label: string; icon: string; future?: boolean }> = [
  { id: 'general', label: 'General Settings', icon: 'ph-gear' },
  { id: 'hospital', label: 'Hospital Information', icon: 'ph-hospital' },
  { id: 'localization', label: 'Localization', icon: 'ph-globe' },
  { id: 'preferences', label: 'User Preferences', icon: 'ph-user-gear' },
  { id: 'billing', label: 'Billing Settings', icon: 'ph-money', future: true },
  { id: 'inventory', label: 'Inventory Settings', icon: 'ph-package', future: true },
  { id: 'notifications', label: 'Notification Settings', icon: 'ph-bell', future: true },
  { id: 'security', label: 'Security Settings', icon: 'ph-shield-check', future: true },
  { id: 'integrations', label: 'System Integrations', icon: 'ph-plugs-connected', future: true },
  { id: 'backup', label: 'Backup & Restore', icon: 'ph-database', future: true },
  { id: 'audit', label: 'Audit Logs', icon: 'ph-clipboard-text' },
];

const futureDescriptions: Partial<Record<TabId, string>> = {
  billing: 'Billing, tax, invoicing, and payment gateway configuration is planned for a future phase.',
  inventory: 'Stock threshold and reorder configuration is planned for a future phase.',
  notifications: 'Email, SMS, and notification service configuration is planned for a future phase.',
  security: 'SSO, API key, and runtime security configuration is planned for a future phase.',
  integrations: 'External clinical, payment, messaging, and storage integrations are planned for a future phase.',
  backup: 'Backup jobs, storage, and restore operations are planned for a future phase.',
};

const required = (value: string, message: string) => (value.trim() ? '' : message);
const inRange = (value: number, min: number, max: number, message: string) =>
  Number.isInteger(value) && value >= min && value <= max ? '' : message;

const detailsToErrors = (error: ApiError): FieldErrors => {
  if (!Array.isArray(error.details)) return {};
  const errors: FieldErrors = {};
  for (const detail of error.details as Array<{ instancePath?: string; message?: string; params?: { missingProperty?: string } }>) {
    const field = detail.params?.missingProperty ?? detail.instancePath?.split('/').filter(Boolean).at(-1);
    if (field) errors[field] = detail.message ? `${field} ${detail.message}` : 'This value is not valid.';
  }
  return errors;
};

export function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [navSearch, setNavSearch] = useState('');
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [canEdit, setCanEdit] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoObjectUrl = useRef<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await settingsApi.get();
      setSettings(result);
      if (result.hospital.logoBlobName) {
        try {
          const blob = await settingsApi.getLogo();
          replaceLogoUrl(URL.createObjectURL(blob));
        } catch {
          setLogoUrl(null);
        }
      }
    } catch (error) {
      setLoadError(
        error instanceof ApiError && error.status === 403
          ? 'You do not have permission to view System Settings.'
          : error instanceof Error
            ? error.message
            : 'System Settings could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [replaceLogoUrl]);

  useEffect(() => {
    void load();
    return () => {
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
    };
  }, [load]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.label.toLowerCase().includes(navSearch.trim().toLowerCase())),
    [navSearch],
  );

  const handleMutationError = (error: unknown) => {
    if (error instanceof ApiError) {
      setErrors(detailsToErrors(error));
      if (error.status === 403) {
        setCanEdit(false);
        showMessage('You do not have permission to edit System Settings.', 'error');
        return;
      }
      showMessage(error.message, 'error');
      return;
    }
    showMessage(error instanceof Error ? error.message : 'The settings change could not be saved.', 'error');
  };

  const mutate = async (operation: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await operation();
    } catch (error) {
      handleMutationError(error);
    } finally {
      setBusy(false);
    }
  };

  const updateGeneral = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const nextErrors = {
      applicationName: required(settings.general.applicationName, 'Application Name is required.'),
      sessionTimeoutMinutes: inRange(settings.general.sessionTimeoutMinutes, 5, 480, 'Enter a value from 5 to 480.'),
    };
    if (Object.values(nextErrors).some(Boolean)) return setErrors(nextErrors);
    void mutate(async () => {
      const { version: _version, ...payload } = settings.general;
      void _version;
      const general = await settingsApi.updateGeneral(payload);
      setSettings({ ...settings, general });
      showMessage('General settings saved.');
    });
  };

  const updateHospital = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const { hospital } = settings;
    const nextErrors: FieldErrors = {
      hospitalName: required(hospital.hospitalName, 'Hospital Name is required.'),
      registrationNumber: required(hospital.registrationNumber, 'Registration Number is required.'),
      phone: /^\+?[0-9\s().-]{7,20}$/.test(hospital.phone) ? '' : 'Enter a valid phone number.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hospital.email) ? '' : 'Enter a valid email address.',
      website: !hospital.website || URL.canParse(hospital.website) ? '' : 'Enter a valid website URL.',
      bedCapacity: inRange(hospital.bedCapacity, 0, 100000, 'Enter a bed capacity from 0 to 100000.'),
      address: required(hospital.address, 'Address is required.'),
    };
    if (Object.values(nextErrors).some(Boolean)) return setErrors(nextErrors);
    void mutate(async () => {
      const { logoBlobName: _logo, logoContentType: _contentType, ...payload } = hospital;
      void _logo;
      void _contentType;
      const updated = await settingsApi.updateHospital(payload);
      setSettings({ ...settings, hospital: updated });
      showMessage('Hospital information saved.');
    });
  };

  const updateLocalization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const nextErrors = { currencySymbol: required(settings.localization.currencySymbol, 'Currency Symbol is required.') };
    if (Object.values(nextErrors).some(Boolean)) return setErrors(nextErrors);
    void mutate(async () => {
      const localization = await settingsApi.updateLocalization(settings.localization);
      setSettings({ ...settings, localization });
      showMessage('Localization settings saved.');
    });
  };

  const updatePreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const value = settings.userPreferences;
    const nextErrors = {
      passwordMinLength: inRange(value.passwordMinLength, 6, 32, 'Enter a value from 6 to 32.'),
      passwordExpiryDays: inRange(value.passwordExpiryDays, 0, 3650, 'Enter a value from 0 to 3650.'),
      maxFailedLoginAttempts: inRange(value.maxFailedLoginAttempts, 1, 20, 'Enter a value from 1 to 20.'),
    };
    if (Object.values(nextErrors).some(Boolean)) return setErrors(nextErrors);
    void mutate(async () => {
      const userPreferences = await settingsApi.updateUserPreferences(value);
      setSettings({ ...settings, userPreferences });
      showMessage('User preferences saved.');
    });
  };

  const reset = <T,>(section: 'general' | 'hospital' | 'localization' | 'userPreferences', key: keyof SystemSettings) => {
    if (!settings) return;
    void mutate(async () => {
      const value = await settingsApi.reset<T>(section);
      setSettings({ ...settings, [key]: value });
      if (section === 'hospital') {
        replaceLogoUrl(null);
      }
      showMessage('Settings reset to default.');
    });
  };

  const uploadLogo = (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) return showMessage('Hospital logo must be a PNG or JPG image.', 'error');
    if (file.size > 2 * 1024 * 1024) return showMessage('Hospital logo must not exceed 2 MB.', 'error');
    if (!settings) return;
    void mutate(async () => {
      const hospital = await settingsApi.uploadLogo(file);
      setSettings({ ...settings, hospital });
      replaceLogoUrl(URL.createObjectURL(file));
      showMessage('Hospital logo uploaded.');
    });
  };

  const renderPanel = () => {
    if (!settings) return null;
    const common = { busy, canEdit, errors };
    if (activeTab === 'general') return <GeneralSettingsForm {...common} value={settings.general} onChange={(general) => setSettings({ ...settings, general })} onSubmit={updateGeneral} onReset={() => reset<GeneralSettings>('general', 'general')} />;
    if (activeTab === 'hospital') return <HospitalSettingsForm {...common} value={settings.hospital} logoUrl={logoUrl} onChange={(hospital) => setSettings({ ...settings, hospital })} onLogo={uploadLogo} onSubmit={updateHospital} onReset={() => reset<HospitalSettings>('hospital', 'hospital')} />;
    if (activeTab === 'localization') return <LocalizationSettingsForm {...common} value={settings.localization} onChange={(localization) => setSettings({ ...settings, localization })} onSubmit={updateLocalization} onReset={() => reset<LocalizationSettings>('localization', 'localization')} />;
    if (activeTab === 'preferences') return <UserPreferencesForm {...common} value={settings.userPreferences} onChange={(userPreferences) => setSettings({ ...settings, userPreferences })} onSubmit={updatePreferences} onReset={() => reset<UserPreferenceSettings>('userPreferences', 'userPreferences')} />;
    if (activeTab === 'audit') return <AuditLogPanel onMessage={showMessage} onTotalChange={setAuditTotal} />;

    const tab = tabs.find((item) => item.id === activeTab)!;
    return (
      <section className="ss-tab-panel active">
        <div className="ss-panel-header"><div className="ss-panel-title"><i className={`ph ${tab.icon}`} aria-hidden="true" /> {tab.label}</div><p className="ss-panel-desc">{futureDescriptions[activeTab]}</p></div>
        <div className="ss-future-state"><i className={`ph ${tab.icon}`} aria-hidden="true" /><strong>Future functionality</strong><span>This section is intentionally not active in Phase 1.</span></div>
      </section>
    );
  };

  return (
    <div className="ss-page">
      <section className="ss-kpi-row" aria-label="System settings summary">
        {[
          ['general', 'ph-sliders', 'blue', 'System Configurations', '24', 'Active settings'],
          ['integrations', 'ph-plugs-connected', 'green', 'Integrations', '—', 'Future functionality'],
          ['notifications', 'ph-envelope-simple', 'purple', 'Email Templates', '—', 'Future functionality'],
          ['notifications', 'ph-bell-ringing', 'teal', 'Notification Rules', '—', 'Future functionality'],
          ['audit', 'ph-clipboard-text', 'orange', 'Audit Logs', String(auditTotal), 'Recorded activity'],
        ].map(([tab, icon, tone, label, value, detail]) => (
          <button className="ss-kpi-card" key={`${label}-${icon}`} onClick={() => { setActiveTab(tab as TabId); setErrors({}); }} type="button">
            <span className={`ss-kpi-icon ${tone}`}><i className={`ph-fill ${icon}`} aria-hidden="true" /></span>
            <span className="ss-kpi-info"><span className="ss-kpi-label">{label}</span><strong className="ss-kpi-value">{value}</strong><span className="ss-kpi-sub">{detail}</span></span>
          </button>
        ))}
      </section>

      <div className="ss-body">
        <aside className="card ss-nav-panel">
          <label className="ss-nav-header"><i className="ph ph-magnifying-glass" aria-hidden="true" /><input aria-label="Search settings" onChange={(event) => setNavSearch(event.target.value)} placeholder="Search settings..." type="search" value={navSearch} /></label>
          <ul className="ss-nav-list">
            {visibleTabs.map((tab) => <li key={tab.id}><button className={`ss-nav-item${activeTab === tab.id ? ' active' : ''}`} onClick={() => { setActiveTab(tab.id); setErrors({}); }} type="button"><i className={`ph ${tab.icon}`} aria-hidden="true" /><span>{tab.label}</span></button></li>)}
          </ul>
        </aside>

        <main className="card ss-content-panel">
          {loading ? <div className="ss-state" role="status"><span className="loading-spinner" /> Loading system settings...</div> : loadError ? <div className="ss-state ss-state--error" role="alert"><i className="ph ph-warning-circle" aria-hidden="true" /><strong>Settings unavailable</strong><span>{loadError}</span><button className="btn-secondary" onClick={() => void load()} type="button">Try again</button></div> : renderPanel()}
        </main>

        <aside className="ss-right-panel">
          <section className="card ss-side-card"><div className="ss-card-header"><h3><i className="ph ph-heartbeat" aria-hidden="true" /> System Health</h3><span className="ss-future-badge">Future</span></div><p>Monitoring and service health dashboards are planned for a future phase.</p></section>
          <section className="card ss-side-card"><div className="ss-card-header"><h3>Storage Usage</h3><span className="ss-future-badge">Future</span></div><p>Storage analytics are not enabled in Phase 1.</p></section>
          <section className="card ss-side-card"><div className="ss-card-header"><h3>Database Status</h3><span className="ss-future-badge">Future</span></div><p>Database monitoring is not enabled in Phase 1.</p></section>
          <section className="card ss-qa-card"><div className="ss-card-header"><h3>Quick Actions</h3></div><div className="ss-qa-list"><button className="ss-qa-btn" onClick={() => setActiveTab('audit')} type="button"><i className="ph ph-clipboard-text" aria-hidden="true" /><span><strong>View Audit Logs</strong><small>Browse system activity</small></span></button></div></section>
        </aside>
      </div>
      <Toast message={toast} tone={toastTone} visible={Boolean(toast)} />
    </div>
  );
}
