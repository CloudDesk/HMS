import { useRef, type ChangeEvent, type FormEvent } from 'react';
import type {
  GeneralSettings,
  HospitalSettings,
  LocalizationSettings,
  UserPreferenceSettings,
} from '../../api/settings';
import { SettingsField, SettingsToggle } from './SettingsControls';

export type FieldErrors = Record<string, string>;

type FormActions = {
  busy: boolean;
  canEdit: boolean;
  errors: FieldErrors;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function FormFooter({ busy, canEdit, onReset }: Pick<FormActions, 'busy' | 'canEdit' | 'onReset'>) {
  return (
    <div className="ss-panel-footer">
      <button className="btn-secondary" disabled={!canEdit || busy} onClick={onReset} type="button">
        Reset to Default
      </button>
      <button className="btn-primary" disabled={!canEdit || busy} type="submit">
        <i className="ph ph-floppy-disk" aria-hidden="true" /> {busy ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

type GeneralFormProps = FormActions & {
  value: GeneralSettings;
  onChange: (value: GeneralSettings) => void;
};

export function GeneralSettingsForm({ value, onChange, ...actions }: GeneralFormProps) {
  const set = <K extends keyof GeneralSettings>(key: K, next: GeneralSettings[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <form className="ss-tab-panel active" onSubmit={actions.onSubmit}>
      <div className="ss-panel-header">
        <div className="ss-panel-title"><i className="ph ph-info" aria-hidden="true" /> General Settings</div>
        <p className="ss-panel-desc">Core application-wide configurations.</p>
      </div>
      <div className="ss-form-body">
        <div className="ss-section-label">Application</div>
        <div className="ss-form-grid">
          <SettingsField error={actions.errors.applicationName} label="Application Name">
            <input disabled={!actions.canEdit} onChange={(event) => set('applicationName', event.target.value)} value={value.applicationName} />
          </SettingsField>
          <SettingsField label="Version"><input readOnly value={value.version} /></SettingsField>
          <SettingsField label="Default Language">
            <select disabled={!actions.canEdit} onChange={(event) => set('defaultLanguage', event.target.value as GeneralSettings['defaultLanguage'])} value={value.defaultLanguage}>
              <option value="en">English (EN)</option><option value="sw">Swahili (SW)</option>
            </select>
          </SettingsField>
          <SettingsField label="Date Format">
            <select disabled={!actions.canEdit} onChange={(event) => set('dateFormat', event.target.value as GeneralSettings['dateFormat'])} value={value.dateFormat}>
              <option>DD MMM YYYY</option><option>YYYY-MM-DD</option><option>MM/DD/YYYY</option>
            </select>
          </SettingsField>
          <SettingsField label="Time Format">
            <select disabled={!actions.canEdit} onChange={(event) => set('timeFormat', event.target.value as GeneralSettings['timeFormat'])} value={value.timeFormat}>
              <option value="12-hour">12-hour (AM/PM)</option><option value="24-hour">24-hour</option>
            </select>
          </SettingsField>
          <SettingsField error={actions.errors.sessionTimeoutMinutes} label="Session Timeout (mins)">
            <input disabled={!actions.canEdit} max={480} min={5} onChange={(event) => set('sessionTimeoutMinutes', Number(event.target.value))} type="number" value={value.sessionTimeoutMinutes} />
          </SettingsField>
        </div>
        <div className="ss-section-label">Feature Toggles</div>
        <div className="ss-toggle-list">
          <SettingsToggle checked={value.maintenanceMode} description="Show maintenance page to all users" disabled={!actions.canEdit} label="Maintenance Mode" onChange={(checked) => set('maintenanceMode', checked)} />
          <SettingsToggle checked={value.darkMode} description="Apply dark theme to all users" disabled={!actions.canEdit} label="Dark Mode (Global)" onChange={(checked) => set('darkMode', checked)} />
          <SettingsToggle checked={value.auditLogging} description="Log all user actions" disabled={!actions.canEdit} label="Enable Audit Logging" onChange={(checked) => set('auditLogging', checked)} />
          <SettingsToggle checked={value.multiBranchMode} description="Allow multiple branch management" disabled={!actions.canEdit} label="Multi-Branch Mode" onChange={(checked) => set('multiBranchMode', checked)} />
        </div>
      </div>
      <FormFooter {...actions} />
    </form>
  );
}

type HospitalFormProps = FormActions & {
  value: HospitalSettings;
  logoUrl: string | null;
  onChange: (value: HospitalSettings) => void;
  onLogo: (file: File) => void;
};

export function HospitalSettingsForm({ value, logoUrl, onChange, onLogo, ...actions }: HospitalFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof HospitalSettings>(key: K, next: HospitalSettings[K]) => onChange({ ...value, [key]: next });
  const selectLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onLogo(file);
    event.target.value = '';
  };

  return (
    <form className="ss-tab-panel active" onSubmit={actions.onSubmit}>
      <div className="ss-panel-header">
        <div className="ss-panel-title"><i className="ph ph-hospital" aria-hidden="true" /> Hospital Information</div>
        <p className="ss-panel-desc">Configure your hospital&apos;s identity and contact details.</p>
      </div>
      <div className="ss-form-body">
        <div className="ss-section-label">Identity</div>
        <div className="ss-form-grid">
          <SettingsField error={actions.errors.hospitalName} fullWidth label="Hospital Name"><input disabled={!actions.canEdit} onChange={(e) => set('hospitalName', e.target.value)} value={value.hospitalName} /></SettingsField>
          <SettingsField error={actions.errors.registrationNumber} label="Registration Number"><input disabled={!actions.canEdit} onChange={(e) => set('registrationNumber', e.target.value)} value={value.registrationNumber} /></SettingsField>
          <SettingsField label="Hospital Type"><select disabled={!actions.canEdit} onChange={(e) => set('hospitalType', e.target.value as HospitalSettings['hospitalType'])} value={value.hospitalType}><option>General</option><option value="Teaching">Teaching Hospital</option><option>Specialist</option></select></SettingsField>
          <SettingsField error={actions.errors.phone} label="Phone"><input disabled={!actions.canEdit} onChange={(e) => set('phone', e.target.value)} value={value.phone} /></SettingsField>
          <SettingsField error={actions.errors.email} label="Email"><input disabled={!actions.canEdit} onChange={(e) => set('email', e.target.value)} type="email" value={value.email} /></SettingsField>
          <SettingsField error={actions.errors.website} label="Website"><input disabled={!actions.canEdit} onChange={(e) => set('website', e.target.value || null)} type="url" value={value.website ?? ''} /></SettingsField>
          <SettingsField error={actions.errors.bedCapacity} label="Bed Capacity"><input disabled={!actions.canEdit} min={0} max={100000} onChange={(e) => set('bedCapacity', Number(e.target.value))} type="number" value={value.bedCapacity} /></SettingsField>
          <SettingsField error={actions.errors.address} fullWidth label="Address"><textarea disabled={!actions.canEdit} onChange={(e) => set('address', e.target.value)} rows={2} value={value.address} /></SettingsField>
        </div>
        <div className="ss-section-label">Logo &amp; Branding</div>
        <div className="ss-logo-upload">
          <div className="ss-logo-preview">
            {logoUrl ? <img alt="Hospital logo" src={logoUrl} /> : <i className="ph-fill ph-hospital" aria-hidden="true" />}
          </div>
          <div>
            <input accept="image/png,image/jpeg" hidden onChange={selectLogo} ref={fileInput} type="file" />
            <button className="btn-secondary" disabled={!actions.canEdit || actions.busy} onClick={() => fileInput.current?.click()} type="button"><i className="ph ph-upload-simple" aria-hidden="true" /> Upload Logo</button>
            <p className="ss-logo-hint">PNG, JPG up to 2MB. Recommended: 200×200px</p>
          </div>
        </div>
      </div>
      <FormFooter {...actions} />
    </form>
  );
}

type LocalizationFormProps = FormActions & { value: LocalizationSettings; onChange: (value: LocalizationSettings) => void };

export function LocalizationSettingsForm({ value, onChange, ...actions }: LocalizationFormProps) {
  const set = <K extends keyof LocalizationSettings>(key: K, next: LocalizationSettings[K]) => onChange({ ...value, [key]: next });
  return (
    <form className="ss-tab-panel active" onSubmit={actions.onSubmit}>
      <div className="ss-panel-header"><div className="ss-panel-title"><i className="ph ph-globe" aria-hidden="true" /> Localization</div><p className="ss-panel-desc">Regional and language settings.</p></div>
      <div className="ss-form-body"><div className="ss-form-grid">
        <SettingsField label="Country"><select disabled={!actions.canEdit} onChange={(e) => set('country', e.target.value as LocalizationSettings['country'])} value={value.country}><option>Kenya</option><option>Uganda</option><option>Tanzania</option><option>Nigeria</option></select></SettingsField>
        <SettingsField label="Timezone"><select disabled={!actions.canEdit} onChange={(e) => set('timezone', e.target.value as LocalizationSettings['timezone'])} value={value.timezone}><option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option><option>Africa/Lagos</option><option>Africa/Cairo</option></select></SettingsField>
        <SettingsField label="Currency"><select disabled={!actions.canEdit} onChange={(e) => set('currency', e.target.value as LocalizationSettings['currency'])} value={value.currency}><option value="KES">KES — Kenyan Shilling</option><option value="UGX">UGX — Ugandan Shilling</option><option value="USD">USD — US Dollar</option></select></SettingsField>
        <SettingsField error={actions.errors.currencySymbol} label="Currency Symbol"><input disabled={!actions.canEdit} maxLength={8} onChange={(e) => set('currencySymbol', e.target.value)} value={value.currencySymbol} /></SettingsField>
        <SettingsField label="Number Format"><select disabled={!actions.canEdit} onChange={(e) => set('numberFormat', e.target.value as LocalizationSettings['numberFormat'])} value={value.numberFormat}><option>1,000.00</option><option>1.000,00</option></select></SettingsField>
        <SettingsField label="First Day of Week"><select disabled={!actions.canEdit} onChange={(e) => set('firstDayOfWeek', e.target.value as LocalizationSettings['firstDayOfWeek'])} value={value.firstDayOfWeek}><option>Monday</option><option>Sunday</option></select></SettingsField>
      </div></div>
      <FormFooter {...actions} />
    </form>
  );
}

type PreferencesFormProps = FormActions & { value: UserPreferenceSettings; onChange: (value: UserPreferenceSettings) => void };

export function UserPreferencesForm({ value, onChange, ...actions }: PreferencesFormProps) {
  const set = <K extends keyof UserPreferenceSettings>(key: K, next: UserPreferenceSettings[K]) => onChange({ ...value, [key]: next });
  return (
    <form className="ss-tab-panel active" onSubmit={actions.onSubmit}>
      <div className="ss-panel-header"><div className="ss-panel-title"><i className="ph ph-user-gear" aria-hidden="true" /> User Preferences</div><p className="ss-panel-desc">Default settings applied to new user accounts.</p></div>
      <div className="ss-form-body"><div className="ss-form-grid">
        <SettingsField label="Default Role for New Users"><select disabled={!actions.canEdit} onChange={(e) => set('defaultRole', e.target.value as UserPreferenceSettings['defaultRole'])} value={value.defaultRole}><option>Receptionist</option><option>Nurse</option><option>Doctor</option></select></SettingsField>
        <SettingsField error={actions.errors.passwordMinLength} label="Password Min Length"><input disabled={!actions.canEdit} min={6} max={32} onChange={(e) => set('passwordMinLength', Number(e.target.value))} type="number" value={value.passwordMinLength} /></SettingsField>
        <SettingsField error={actions.errors.passwordExpiryDays} label="Password Expiry (days)"><input disabled={!actions.canEdit} min={0} max={3650} onChange={(e) => set('passwordExpiryDays', Number(e.target.value))} type="number" value={value.passwordExpiryDays} /></SettingsField>
        <SettingsField error={actions.errors.maxFailedLoginAttempts} label="Max Failed Login Attempts"><input disabled={!actions.canEdit} min={1} max={20} onChange={(e) => set('maxFailedLoginAttempts', Number(e.target.value))} type="number" value={value.maxFailedLoginAttempts} /></SettingsField>
      </div><div className="ss-toggle-list">
        <SettingsToggle checked={value.requireStrongPasswords} description="Min 8 chars, uppercase, number, symbol" disabled={!actions.canEdit} label="Require Strong Passwords" onChange={(checked) => set('requireStrongPasswords', checked)} />
        <SettingsToggle checked={value.forcePasswordChangeOnFirstLogin} description="Users must change password on first access" disabled={!actions.canEdit} label="Force Password Change on First Login" onChange={(checked) => set('forcePasswordChangeOnFirstLogin', checked)} />
        <SettingsToggle checked={value.allowUserSelfRegistration} description="Allow staff to self-register accounts" disabled={!actions.canEdit} label="Allow User Self Registration" onChange={(checked) => set('allowUserSelfRegistration', checked)} />
      </div></div>
      <FormFooter {...actions} />
    </form>
  );
}
