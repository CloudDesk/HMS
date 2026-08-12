import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import { SettingsLogoStorage } from './settings.logo-storage.js';
import { SettingsRepository } from './settings.repository.js';
import type {
  AuditLogQuery,
  GeneralSettings,
  HospitalSettings,
  LocalizationSettings,
  RequestMetadata,
  SettingsSection,
  UserPreferenceSettings,
} from './settings.types.js';

export type GeneralSettingsInput = Omit<GeneralSettings, 'version'>;
export type HospitalSettingsInput = Omit<HospitalSettings, 'logoBlobName' | 'logoContentType'>;

const trim = (value: string) => value.trim();
const optionalTrim = (value: string | null) => {
  const normalized = value?.trim() ?? '';
  return normalized.length ? normalized : null;
};

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly logoStorage: SettingsLogoStorage,
  ) {}

  get() {
    return this.repository.get();
  }

  async updateGeneral(
    input: GeneralSettingsInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const current = await this.repository.get();
    const value: GeneralSettings = {
      ...input,
      applicationName: trim(input.applicationName),
      version: current.general.version,
    };

    const settings = await this.repository.updateSection('general', value, actorUserId);
    await this.repository.audit('settings.general.updated', actorUserId, metadata);
    return settings.general;
  }

  async updateHospital(
    input: HospitalSettingsInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const current = await this.repository.get();
    const value: HospitalSettings = {
      ...input,
      hospitalName: trim(input.hospitalName),
      registrationNumber: trim(input.registrationNumber),
      phone: trim(input.phone),
      email: trim(input.email).toLowerCase(),
      website: optionalTrim(input.website),
      address: trim(input.address),
      logoBlobName: current.hospital.logoBlobName,
      logoContentType: current.hospital.logoContentType,
    };

    const settings = await this.repository.updateSection('hospital', value, actorUserId);
    await this.repository.audit('settings.hospital.updated', actorUserId, metadata);
    return settings.hospital;
  }

  async updateLocalization(
    input: LocalizationSettings,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const value = { ...input, currencySymbol: trim(input.currencySymbol) };
    const settings = await this.repository.updateSection('localization', value, actorUserId);
    await this.repository.audit('settings.localization.updated', actorUserId, metadata);
    return settings.localization;
  }

  async updateUserPreferences(
    input: UserPreferenceSettings,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const settings = await this.repository.updateSection('userPreferences', input, actorUserId);
    await this.repository.audit('settings.user_preferences.updated', actorUserId, metadata);
    return settings.userPreferences;
  }

  async reset(section: SettingsSection, actorUserId: string, metadata: RequestMetadata) {
    const current = section === 'hospital' ? await this.repository.get() : null;
    const settings = await this.repository.resetSection(section, actorUserId);
    await this.repository.audit(`settings.${section}.reset`, actorUserId, metadata);

    const oldLogo = current?.hospital.logoBlobName;
    if (oldLogo) {
      await this.logoStorage.delete(oldLogo).catch(() => undefined);
    }

    return settings[section];
  }

  listAuditLogs(query: AuditLogQuery) {
    return this.repository.listAuditLogs({
      search: query.search?.trim() || undefined,
      action: query.action,
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 20))),
    });
  }

  async exportAuditLogs(query: AuditLogQuery, actorUserId: string, metadata: RequestMetadata) {
    await this.repository.audit('settings.audit.exported', actorUserId, metadata, { filters: query });
    const repository = this.repository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.listAuditLogs({ ...query, page, limit: 100 });
        for (const item of result.items) {
          yield [item.actor.name, item.description, item.module, item.action, item.createdAt];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(['User', 'Action', 'Module', 'Type', 'Date Time'], rows());
  }

  async uploadHospitalLogo(
    buffer: Buffer,
    contentType: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    if (!buffer.length) {
      throw new AppError('Hospital logo file is empty', 400, 'EMPTY_LOGO_FILE');
    }

    if (buffer.length > 2 * 1024 * 1024) {
      throw new AppError('Hospital logo must not exceed 2 MB', 400, 'LOGO_TOO_LARGE');
    }

    const current = await this.repository.get();
    const blobName = await this.logoStorage.upload(buffer, contentType);

    try {
      const hospital = {
        ...current.hospital,
        logoBlobName: blobName,
        logoContentType: contentType,
      };
      const settings = await this.repository.updateSection('hospital', hospital, actorUserId);
      await this.repository.audit('settings.hospital.logo_updated', actorUserId, metadata);

      if (current.hospital.logoBlobName) {
        await this.logoStorage.delete(current.hospital.logoBlobName).catch(() => undefined);
      }

      return settings.hospital;
    } catch (error) {
      await this.logoStorage.delete(blobName).catch(() => undefined);
      throw error;
    }
  }

  async downloadHospitalLogo() {
    const settings = await this.repository.get();
    if (!settings.hospital.logoBlobName || !settings.hospital.logoContentType) {
      throw new AppError('Hospital logo has not been uploaded', 404, 'LOGO_NOT_FOUND');
    }

    return {
      contentType: settings.hospital.logoContentType,
      stream: await this.logoStorage.download(settings.hospital.logoBlobName),
    };
  }
}
