import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { defaultGeneralSettings, defaultHospitalSettings, getInitialSystemSettings } from './settings.defaults.js';
import { SystemSettingsModel } from './settings.model.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';
import { SettingsLogoStorage } from './settings.logo-storage.js';

describe('C3 explicit settings initialization', () => {
  let mongo: MongoMemoryServer;
  const originalConfiguration = { ...env.initialSettings };
  const repository = new SettingsRepository();
  const storage = new SettingsLogoStorage();
  const service = new SettingsService(repository, storage);
  const actor = String(new Types.ObjectId());
  const configuration = {
    hospitalName: 'Configured Hospital', phone: '+12345678901', email: 'ADMIN@EXAMPLE.TEST',
    address: 'Configured address', country: 'India', timezone: 'Asia/Kolkata', currency: 'INR', currencySymbol: '₹',
  };
  const clearConfiguration = () => {
    for (const key of Object.keys(env.initialSettings) as Array<keyof typeof env.initialSettings>) {
      env.initialSettings[key] = undefined;
    }
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await SystemSettingsModel.init();
  });
  beforeEach(async () => {
    await SystemSettingsModel.deleteMany({});
    clearConfiguration();
  });
  afterEach(() => {
    Object.assign(env.initialSettings, originalConfiguration);
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('does not insert a hospital or localization when deployment configuration is missing', async () => {
    await expect(repository.get()).rejects.toMatchObject({ statusCode: 503, code: 'SETTINGS_SETUP_REQUIRED' });
    expect(await SystemSettingsModel.countDocuments()).toBe(0);
    expect(await service.getRuntimeHospitalSettings()).toEqual(defaultHospitalSettings);
    expect(defaultHospitalSettings).toMatchObject({ hospitalName: 'Hospital not configured', phone: '', email: '', address: '' });
  });

  it.each(['country', 'timezone', 'currency', 'hospitalName', 'phone', 'email', 'address', 'currencySymbol'] as const)(
    'rejects incomplete or invalid bootstrap %s without persisting partial settings', async (key) => {
      Object.assign(env.initialSettings, configuration, { [key]: '' });
      await expect(repository.get()).rejects.toMatchObject({ code: 'SETTINGS_SETUP_REQUIRED' });
      expect(await SystemSettingsModel.countDocuments()).toBe(0);
    },
  );

  it.each([
    ['India', 'Asia/Kolkata', 'INR', '₹'],
    ['Nigeria', 'Africa/Lagos', 'NGN', '₦'],
    ['Kenya', 'Africa/Nairobi', 'KES', 'KES'],
  ])('initializes only the explicitly selected %s deployment', async (country, timezone, currency, currencySymbol) => {
    Object.assign(env.initialSettings, configuration, { country, timezone, currency, currencySymbol });
    const settings = await repository.get();
    expect(settings.hospital).toMatchObject({ hospitalName: configuration.hospitalName, email: 'admin@example.test' });
    expect(settings.localization).toMatchObject({ country, timezone, currency, currencySymbol });
    expect(await SystemSettingsModel.countDocuments()).toBe(1);
    expect(() => new Intl.NumberFormat('en', { style: 'currency', currency }).format(1234.56)).not.toThrow();
    expect(() => new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date())).not.toThrow();
  });

  it('preserves existing settings and timestamps when bootstrap configuration is removed or changed', async () => {
    Object.assign(env.initialSettings, configuration);
    await SystemSettingsModel.create({ key: 'system', ...getInitialSystemSettings() });
    const before = await SystemSettingsModel.findOne({ key: 'system' }).lean();
    clearConfiguration();
    expect((await repository.get()).hospital.hospitalName).toBe(configuration.hospitalName);
    Object.assign(env.initialSettings, configuration, { hospitalName: 'Must not overwrite', country: 'Kenya', currency: 'KES' });
    await repository.get();
    expect(await SystemSettingsModel.findOne({ key: 'system' }).lean()).toEqual(before);
  });

  it.each(['hospital', 'localization'] as const)('rejects %s reset without changing saved settings or deleting the logo', async (section) => {
    Object.assign(env.initialSettings, configuration);
    await repository.get();
    await SystemSettingsModel.updateOne({ key: 'system' }, { $set: { 'hospital.logoBlobName': 'existing.png' } });
    const before = await SystemSettingsModel.findOne({ key: 'system' }).lean();
    const deleteLogo = vi.spyOn(storage, 'delete').mockResolvedValue(undefined);
    await expect(service.reset(section, actor, {})).rejects.toMatchObject({ code: 'SETTINGS_EXPLICIT_CONFIGURATION_REQUIRED' });
    expect(await SystemSettingsModel.findOne({ key: 'system' }).lean()).toEqual(before);
    expect(deleteLogo).not.toHaveBeenCalled();
  });

  it('keeps explicit settings updates and non-market resets working without bootstrap configuration', async () => {
    Object.assign(env.initialSettings, configuration);
    const initial = await repository.get();
    clearConfiguration();
    const localization = { ...initial.localization, country: 'Nigeria' as const, timezone: 'Africa/Lagos' as const,
      currency: 'NGN' as const, currencySymbol: '₦', firstDayOfWeek: 'Sunday' as const };
    expect(await service.updateLocalization(localization, actor, {})).toEqual(localization);
    await service.updateHospital({ hospitalName: 'Updated Hospital', phone: '+12345678902',
      email: 'updated@example.test', address: 'Updated address' }, actor, {});
    await service.reset('general', actor, {});
    await service.reset('userPreferences', actor, {});
    const saved = await repository.get();
    expect(saved.general).toEqual(defaultGeneralSettings);
    expect(saved.hospital.hospitalName).toBe('Updated Hospital');
    expect(saved.localization).toEqual(localization);
  });
});
