import { useMemo } from 'react';
import { useSystemSettingsFeature } from '../hooks/settings/useSystemSettingsFeature';

import {
} from '../api/settings';
import { AuditLogPanel } from '../components/settings/AuditLogPanel';
import {
  GeneralSettingsForm,
  HospitalSettingsForm,
  LocalizationSettingsForm,
  UserPreferencesForm,
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


export function SystemSettingsPage() {
  const feature = useSystemSettingsFeature();
  const { state, data, status, rbac, actions } = feature;

  const { activeTab, navSearch, auditTotal, serverErrors: errors, logoUrl, toast, toastTone, setActiveTab, setNavSearch, setAuditTotal } = state;
  const { settings } = data;
  const { isFetching: loading, isMutating: busy, loadError } = status;
  const { canEdit } = rbac;
  const { updateGeneral, updateHospital, updateLocalization, updatePreferences, reset, uploadLogo, showMessage, refetch: load } = actions;

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.label.toLowerCase().includes(navSearch.trim().toLowerCase())),
    [navSearch],
  );

  const renderPanel = (activeTab: TabId) => {
    if (!settings) return null;
    const common = { busy, canEdit, serverErrors: errors };
    if (activeTab === 'general') return <GeneralSettingsForm {...common} value={settings.general} onSubmit={(data) => void updateGeneral(data)} onReset={() => reset('general')} />;
    if (activeTab === 'hospital') return <HospitalSettingsForm {...common} value={settings.hospital} logoUrl={logoUrl} onLogo={uploadLogo} onSubmit={(data) => void updateHospital(data)} onReset={() => reset('hospital')} />;
    if (activeTab === 'localization') return <LocalizationSettingsForm {...common} value={settings.localization} onSubmit={(data) => void updateLocalization(data)} onReset={() => reset('localization')} />;
    if (activeTab === 'preferences') return <UserPreferencesForm {...common} value={settings.userPreferences} onSubmit={(data) => void updatePreferences(data)} onReset={() => reset('userPreferences')} />;
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
          <button className="ss-kpi-card" key={`${label}-${icon}`} onClick={() => { setActiveTab(tab as TabId); }} type="button">
            <span className={`ss-kpi-icon ${tone}`}><i className={`ph-fill ${icon}`} aria-hidden="true" /></span>
            <span className="ss-kpi-info"><span className="ss-kpi-label">{label}</span><strong className="ss-kpi-value">{value}</strong><span className="ss-kpi-sub">{detail}</span></span>
          </button>
        ))}
      </section>

      <div className="ss-body">
        <aside className="card ss-nav-panel">
          <label className="ss-nav-header"><i className="ph ph-magnifying-glass" aria-hidden="true" /><input aria-label="Search settings" onChange={(event) => setNavSearch(event.target.value)} placeholder="Search settings..." type="search" value={navSearch} /></label>
          <ul className="ss-nav-list">
            {visibleTabs.map((tab) => <li key={tab.id}><button className={`ss-nav-item${activeTab === tab.id ? ' active' : ''}`} onClick={() => { setActiveTab(tab.id); }} type="button"><i className={`ph ${tab.icon}`} aria-hidden="true" /><span>{tab.label}</span></button></li>)}
          </ul>
        </aside>

        <main className="card ss-content-panel">
          {loading ? <div className="ss-state" role="status"><span className="loading-spinner" /> Loading system settings...</div> : loadError ? <div className="ss-state ss-state--error" role="alert"><i className="ph ph-warning-circle" aria-hidden="true" /><strong>Settings unavailable</strong><span>{loadError}</span><button className="btn-secondary" onClick={() => void load()} type="button">Try again</button></div> : renderPanel(activeTab)}
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
