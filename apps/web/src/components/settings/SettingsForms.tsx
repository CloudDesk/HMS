import { useRef, useEffect, type ChangeEvent } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { regionalConfig, currencySymbolMap } from '../../utils/localization-utils';
import {
  type GeneralSettings,
  type HospitalSettings,
  type LocalizationSettings,
  type UserPreferenceSettings,
  localizationSchema,
} from '../../api/settings';
import { localizationSchema } from '../../api/settings';
import { SettingsField, SettingsToggle } from './SettingsControls';

export type FieldErrors = Record<string, string>;

const generalSchema = z.object({
  applicationName: z.string().min(1, 'Application Name is required.'),
  version: z.string(),
  defaultLanguage: z.enum(['en', 'sw']),
  dateFormat: z.enum(['DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']),
  timeFormat: z.enum(['12-hour', '24-hour']),
  sessionTimeoutMinutes: z.number().int().min(5, 'Enter a value from 5 to 480.').max(480, 'Enter a value from 5 to 480.'),
  maintenanceMode: z.boolean(),
  darkMode: z.boolean(),
  auditLogging: z.boolean(),
  multiBranchMode: z.boolean(),
});

const hospitalSchema = z.object({
  hospitalName: z.string().min(1, 'Hospital Name is required.'),
  registrationNumber: z.string().min(1, 'Registration Number is required.'),
  hospitalType: z.enum(['General', 'Teaching', 'Specialist']),
  phone: z.string().regex(/^\+?[0-9\s().-]{7,20}$/, 'Enter a valid phone number.'),
  email: z.string().email('Enter a valid email address.'),
  website: z.string().url('Enter a valid website URL.').or(z.literal('')).nullable(),
  bedCapacity: z.number().int().min(0, 'Enter a bed capacity from 0 to 100000.').max(100000, 'Enter a bed capacity from 0 to 100000.'),
  address: z.string().min(1, 'Address is required.'),
  logoBlobName: z.string().nullable(),
  logoContentType: z.string().nullable(),
});

const userPreferencesSchema = z.object({
  defaultRole: z.enum(['Nurse', 'Receptionist', 'Doctor']),
  passwordMinLength: z.number().int().min(6, 'Enter a value from 6 to 32.').max(32, 'Enter a value from 6 to 32.'),
  passwordExpiryDays: z.number().int().min(0, 'Enter a value from 0 to 3650.').max(3650, 'Enter a value from 0 to 3650.'),
  maxFailedLoginAttempts: z.number().int().min(1, 'Enter a value from 1 to 20.').max(20, 'Enter a value from 1 to 20.'),
  requireStrongPasswords: z.boolean(),
  forcePasswordChangeOnFirstLogin: z.boolean(),
  allowUserSelfRegistration: z.boolean(),
});


type FormActions = {
  busy: boolean;
  canEdit: boolean;
  onReset: () => void;
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
  onSubmit: (data: GeneralSettings) => void;
  serverErrors?: FieldErrors;
};

export function GeneralSettingsForm({ value, onSubmit, serverErrors, ...actions }: GeneralFormProps) {
  const form = useForm<GeneralSettings>({
    resolver: zodResolver(generalSchema),
    defaultValues: value,
  });

  useEffect(() => {
    form.reset(value);
  }, [value, form]);

  useEffect(() => {
    if (serverErrors) {
      Object.entries(serverErrors).forEach(([field, message]) => {
        form.setError(field as Parameters<typeof form.setError>[0], { type: 'server', message });
      });
    }
  }, [serverErrors, form]);

  return (
    <form className="ss-tab-panel active" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="ss-panel-header">
        <div className="ss-panel-title"><i className="ph ph-info" aria-hidden="true" /> General Settings</div>
        <p className="ss-panel-desc">Core application-wide configurations.</p>
      </div>
      <div className="ss-form-body">
        <div className="ss-section-label">Application</div>
        <div className="ss-form-grid">
          <SettingsField error={form.formState.errors.applicationName?.message} label="Application Name">
            <input disabled={!actions.canEdit} {...form.register('applicationName')} />
          </SettingsField>
          <SettingsField label="Version"><input readOnly {...form.register('version')} /></SettingsField>
          <SettingsField label="Default Language">
            <select disabled={!actions.canEdit} {...form.register('defaultLanguage')}>
              <option value="en">English (EN)</option><option value="sw">Swahili (SW)</option>
            </select>
          </SettingsField>
          <SettingsField label="Date Format">
            <select disabled={!actions.canEdit} {...form.register('dateFormat')}>
              <option>DD MMM YYYY</option><option>YYYY-MM-DD</option><option>MM/DD/YYYY</option>
            </select>
          </SettingsField>
          <SettingsField label="Time Format">
            <select disabled={!actions.canEdit} {...form.register('timeFormat')}>
              <option value="12-hour">12-hour (AM/PM)</option><option value="24-hour">24-hour</option>
            </select>
          </SettingsField>
          <SettingsField error={form.formState.errors.sessionTimeoutMinutes?.message} label="Session Timeout (mins)">
            <input disabled={!actions.canEdit} max={480} min={5} type="number" {...form.register('sessionTimeoutMinutes', { valueAsNumber: true })} />
          </SettingsField>
        </div>
        <div className="ss-section-label">Feature Toggles</div>
        <div className="ss-toggle-list">
          <Controller name="maintenanceMode" control={form.control} render={({ field }) => (
            <SettingsToggle checked={field.value} description="Show maintenance page to all users" disabled={!actions.canEdit} label="Maintenance Mode" onChange={field.onChange} />
          )} />
          <Controller name="darkMode" control={form.control} render={({ field }) => (
            <SettingsToggle checked={field.value} description="Apply dark theme to all users" disabled={!actions.canEdit} label="Dark Mode (Global)" onChange={field.onChange} />
          )} />
          <Controller name="auditLogging" control={form.control} render={({ field }) => (
            <SettingsToggle checked={field.value} description="Log all user actions" disabled={!actions.canEdit} label="Enable Audit Logging" onChange={field.onChange} />
          )} />
          <Controller name="multiBranchMode" control={form.control} render={({ field }) => (
            <SettingsToggle checked={field.value} description="Allow multiple branch management" disabled={!actions.canEdit} label="Multi-Branch Mode" onChange={field.onChange} />
          )} />
        </div>
      </div>
      <FormFooter {...actions} />
    </form>
  );
}

type HospitalFormProps = FormActions & {
  value: HospitalSettings;
  logoUrl: string | null;
  onSubmit: (data: HospitalSettings) => void;
  onLogo: (file: File) => void;
  serverErrors?: FieldErrors;
};

export function HospitalSettingsForm({ value, logoUrl, onSubmit, onLogo, serverErrors, ...actions }: HospitalFormProps) {
  const form = useForm<HospitalSettings>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: value,
  });

  useEffect(() => {
    form.reset(value);
  }, [value, form]);

  useEffect(() => {
    if (serverErrors) {
      Object.entries(serverErrors).forEach(([field, message]) => {
        form.setError(field as Parameters<typeof form.setError>[0], { type: 'server', message });
      });
    }
  }, [serverErrors, form]);

  const fileInput = useRef<HTMLInputElement>(null);
  const selectLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onLogo(file);
    event.target.value = '';
  };

  return (
    <form className="ss-tab-panel active" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="ss-panel-header">
        <div className="ss-panel-title"><i className="ph ph-hospital" aria-hidden="true" /> Hospital Information</div>
        <p className="ss-panel-desc">Configure your hospital&apos;s identity and contact details.</p>
      </div>
      <div className="ss-form-body">
        <div className="ss-section-label">Identity</div>
        <div className="ss-form-grid">
          <SettingsField error={form.formState.errors.hospitalName?.message} fullWidth label="Hospital Name"><input disabled={!actions.canEdit} {...form.register('hospitalName')} /></SettingsField>
          <SettingsField error={form.formState.errors.registrationNumber?.message} label="Registration Number"><input disabled={!actions.canEdit} {...form.register('registrationNumber')} /></SettingsField>
          <SettingsField label="Hospital Type"><select disabled={!actions.canEdit} {...form.register('hospitalType')}><option>General</option><option value="Teaching">Teaching Hospital</option><option>Specialist</option></select></SettingsField>
          <SettingsField error={form.formState.errors.phone?.message} label="Phone"><input disabled={!actions.canEdit} {...form.register('phone')} /></SettingsField>
          <SettingsField error={form.formState.errors.email?.message} label="Email"><input disabled={!actions.canEdit} type="email" {...form.register('email')} /></SettingsField>
          <SettingsField error={form.formState.errors.website?.message} label="Website"><input disabled={!actions.canEdit} type="url" {...form.register('website')} /></SettingsField>
          <SettingsField error={form.formState.errors.bedCapacity?.message} label="Bed Capacity"><input disabled={!actions.canEdit} min={0} max={100000} type="number" {...form.register('bedCapacity', { valueAsNumber: true })} /></SettingsField>
          <SettingsField error={form.formState.errors.address?.message} fullWidth label="Address"><textarea disabled={!actions.canEdit} rows={2} {...form.register('address')} /></SettingsField>
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

type LocalizationFormProps = FormActions & { value: LocalizationSettings; onSubmit: (data: LocalizationSettings) => void; serverErrors?: FieldErrors; };

export function LocalizationSettingsForm({ value, onSubmit, serverErrors, ...actions }: LocalizationFormProps) {
  const form = useForm<LocalizationSettings>({
    resolver: zodResolver(localizationSchema),
    defaultValues: value,
  });

  useEffect(() => {
    form.reset(value);
  }, [value, form]);

  useEffect(() => {
    if (serverErrors) {
      Object.entries(serverErrors).forEach(([field, message]) => {
        form.setError(field as Parameters<typeof form.setError>[0], { type: 'server', message });
      });
    }
  }, [serverErrors, form]);

  const countryValue = form.watch('country');
  const currencyValue = form.watch('currency');

  useEffect(() => {
    if (countryValue) {
      const config = regionalConfig[countryValue];
      if (config) {
        if (!config.timezones.includes(form.getValues('timezone'))) {
          form.setValue('timezone', config.defaultTimezone, { shouldValidate: true, shouldDirty: true });
        }
      }
    }
  }, [countryValue, form]);

  useEffect(() => {
    if (currencyValue) {
      const derivedSymbol = currencySymbolMap[currencyValue] || currencyValue;
      if (form.getValues('currencySymbol') !== derivedSymbol) {
        form.setValue('currencySymbol', derivedSymbol, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [currencyValue, form]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value as keyof typeof regionalConfig;
    const config = regionalConfig[newCountry];
    if (config) {
      form.setValue('country', newCountry, { shouldValidate: true, shouldDirty: true });
      form.setValue('timezone', config.defaultTimezone, { shouldValidate: true, shouldDirty: true });
      form.setValue('currency', config.defaultCurrency, { shouldValidate: true, shouldDirty: true });
      form.setValue('currencySymbol', config.symbol, { shouldValidate: true, shouldDirty: true });
    }
  };

  const currentCountryConfig = regionalConfig[countryValue] || regionalConfig['Kenya'];

  return (
    <form className="ss-tab-panel active" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="ss-panel-header"><div className="ss-panel-title"><i className="ph ph-globe" aria-hidden="true" /> Localization</div><p className="ss-panel-desc">Regional and language settings.</p></div>
      <div className="ss-form-body"><div className="ss-form-grid">
        <SettingsField label="Country">
          <select disabled={!actions.canEdit} {...form.register('country')} onChange={handleCountryChange}>
            {(Object.keys(regionalConfig) as Array<keyof typeof regionalConfig>).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SettingsField>
        <SettingsField label="Timezone">
          <select disabled={!actions.canEdit} {...form.register('timezone')}>
            {currentCountryConfig.timezones.map((tz: string) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </SettingsField>
        <SettingsField label="Currency">
          <select disabled={!actions.canEdit} {...form.register('currency')}>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="UGX">UGX — Ugandan Shilling</option>
            <option value="TZS">TZS — Tanzanian Shilling</option>
            <option value="NGN">NGN — Nigerian Naira</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </SettingsField>
        <SettingsField error={form.formState.errors.currencySymbol?.message} label="Currency Symbol (Derived)">
          <input disabled={true} readOnly={true} maxLength={8} {...form.register('currencySymbol')} />
        </SettingsField>
        <SettingsField label="Number Format">
          <select disabled={!actions.canEdit} {...form.register('numberFormat')}>
            <option>1,000.00</option>
            <option>1.000,00</option>
          </select>
        </SettingsField>
        <SettingsField label="First Day of Week">
          <select disabled={!actions.canEdit} {...form.register('firstDayOfWeek')}>
            <option>Monday</option>
            <option>Sunday</option>
          </select>
        </SettingsField>
      </div></div>
      <FormFooter {...actions} />
    </form>
  );
}

type PreferencesFormProps = FormActions & { value: UserPreferenceSettings; onSubmit: (data: UserPreferenceSettings) => void; serverErrors?: FieldErrors; };

export function UserPreferencesForm({ value, onSubmit, serverErrors, ...actions }: PreferencesFormProps) {
  const form = useForm<UserPreferenceSettings>({
    resolver: zodResolver(userPreferencesSchema),
    defaultValues: value,
  });

  useEffect(() => {
    form.reset(value);
  }, [value, form]);

  useEffect(() => {
    if (serverErrors) {
      Object.entries(serverErrors).forEach(([field, message]) => {
        form.setError(field as Parameters<typeof form.setError>[0], { type: 'server', message });
      });
    }
  }, [serverErrors, form]);

  return (
    <form className="ss-tab-panel active" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="ss-panel-header"><div className="ss-panel-title"><i className="ph ph-user-gear" aria-hidden="true" /> User Preferences</div><p className="ss-panel-desc">Default settings applied to new user accounts.</p></div>
      <div className="ss-form-body"><div className="ss-form-grid">
        <SettingsField label="Default Role for New Users"><select disabled={!actions.canEdit} {...form.register('defaultRole')}><option>Receptionist</option><option>Nurse</option><option>Doctor</option></select></SettingsField>
        <SettingsField error={form.formState.errors.passwordMinLength?.message} label="Password Min Length"><input disabled={!actions.canEdit} min={6} max={32} type="number" {...form.register('passwordMinLength', { valueAsNumber: true })} /></SettingsField>
        <SettingsField error={form.formState.errors.passwordExpiryDays?.message} label="Password Expiry (days)"><input disabled={!actions.canEdit} min={0} max={3650} type="number" {...form.register('passwordExpiryDays', { valueAsNumber: true })} /></SettingsField>
        <SettingsField error={form.formState.errors.maxFailedLoginAttempts?.message} label="Max Failed Login Attempts"><input disabled={!actions.canEdit} min={1} max={20} type="number" {...form.register('maxFailedLoginAttempts', { valueAsNumber: true })} /></SettingsField>
      </div><div className="ss-toggle-list">
        <Controller name="requireStrongPasswords" control={form.control} render={({ field }) => (
          <SettingsToggle checked={field.value} description="Min 8 chars, uppercase, number, symbol" disabled={!actions.canEdit} label="Require Strong Passwords" onChange={field.onChange} />
        )} />
        <Controller name="forcePasswordChangeOnFirstLogin" control={form.control} render={({ field }) => (
          <SettingsToggle checked={field.value} description="Users must change password on first access" disabled={!actions.canEdit} label="Force Password Change on First Login" onChange={field.onChange} />
        )} />
        <Controller name="allowUserSelfRegistration" control={form.control} render={({ field }) => (
          <SettingsToggle checked={field.value} description="Allow staff to self-register accounts" disabled={!actions.canEdit} label="Allow User Self Registration" onChange={field.onChange} />
        )} />
      </div></div>
      <FormFooter {...actions} />
    </form>
  );
}
