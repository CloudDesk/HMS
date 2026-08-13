import { Types } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { UserModel } from '../users/user.model.js';
import {
  defaultGeneralSettings,
  defaultHospitalSettings,
  defaultLocalizationSettings,
  defaultSystemSettings,
  defaultUserPreferenceSettings,
} from './settings.defaults.js';
import { SystemSettingsModel } from './settings.model.js';
import type {
  AuditAction,
  AuditLogItem,
  AuditLogQuery,
  GeneralSettings,
  HospitalSettings,
  LocalizationSettings,
  RequestMetadata,
  SettingsSection,
  SystemSettings,
  UserPreferenceSettings,
} from './settings.types.js';

type SettingsRecord = {
  general: GeneralSettings;
  hospital: HospitalSettings;
  localization: LocalizationSettings;
  userPreferences: UserPreferenceSettings;
  updatedAt: Date;
  updatedBy?: unknown;
};

type AuditRecord = {
  _id: unknown;
  eventType: string;
  actorUserId?: string;
  createdAt: Date;
};

type UserSummaryRecord = {
  _id: unknown;
  fullName: string;
  profilePhotoUrl?: string;
};

type AuditFilter = {
  eventType?: RegExp;
  $or?: Array<{ eventType: RegExp } | { actorUserId: { $in: string[] } }>;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toSettings = (record: SettingsRecord): SystemSettings => ({
  general: record.general,
  hospital: record.hospital,
  localization: record.localization,
  userPreferences: record.userPreferences,
  updatedAt: record.updatedAt,
  updatedBy: record.updatedBy ? String(record.updatedBy) : null,
});

const actionPatterns: Record<AuditAction, RegExp> = {
  login: /login/i,
  create: /creat/i,
  edit: /(edit|update|change|reset|assign|remove|activate|deactivate|lock|unlock|denied|refresh|logout)/i,
  delete: /delet/i,
  export: /export/i,
};

const classifyAction = (eventType: string): AuditAction => {
  for (const action of ['login', 'create', 'delete', 'export'] as const) {
    if (actionPatterns[action].test(eventType)) {
      return action;
    }
  }

  return 'edit';
};

const moduleFromEvent = (eventType: string) => {
  const prefix = eventType.split('.')[0]?.toLowerCase();
  const modules: Record<string, string> = {
    auth: 'Auth',
    branch: 'Branches',
    department: 'Departments',
    permission: 'Permissions',
    role: 'Roles',
    service: 'Services',
    settings: 'Settings',
    user: 'Users',
  };

  return modules[prefix ?? ''] ?? 'System';
};

const describeEvent = (eventType: string) =>
  eventType
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' ')
    .replace(/^./, (character) => character.toUpperCase());

export class SettingsRepository {
  async get(): Promise<SystemSettings> {
    const settings = await SystemSettingsModel.findOneAndUpdate(
      { key: 'system' },
      { $setOnInsert: { key: 'system', ...defaultSystemSettings } },
      { upsert: true, returnDocument: 'after', lean: true },
    );

    return toSettings(settings as unknown as SettingsRecord);
  }

  async updateSection<T extends SettingsSection>(
    section: T,
    value: SystemSettings[T],
    actorUserId: string,
  ): Promise<SystemSettings> {
    await this.get();
    const settings = await SystemSettingsModel.findOneAndUpdate(
      { key: 'system' },
      {
        $set: {
          [section]: value,
          updatedBy: actorUserId,
        },
      },
      { returnDocument: 'after', lean: true, runValidators: true },
    );

    return toSettings(settings as unknown as SettingsRecord);
  }

  async resetSection(section: SettingsSection, actorUserId: string): Promise<SystemSettings> {
    const defaults = {
      general: defaultGeneralSettings,
      hospital: defaultHospitalSettings,
      localization: defaultLocalizationSettings,
      userPreferences: defaultUserPreferenceSettings,
    };

    return this.updateSection(section, defaults[section], actorUserId);
  }

  async listAuditLogs(query: Required<Pick<AuditLogQuery, 'page' | 'limit'>> & AuditLogQuery) {
    const filter: AuditFilter = {};

    if (query.action) {
      filter.eventType = actionPatterns[query.action];
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      const matchingUsers = await UserModel.find({
        $or: [{ fullName: searchRegex }, { username: searchRegex }, { email: searchRegex }],
      })
        .select('_id')
        .limit(100)
        .lean();
      filter.$or = [
        { eventType: searchRegex },
        { actorUserId: { $in: matchingUsers.map((user) => String(user._id)) } },
      ];
    }

    const offset = (query.page - 1) * query.limit;
    const [records, total] = await Promise.all([
      AuditLogModel.find(filter)
        .select('_id eventType actorUserId createdAt')
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(query.limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    const auditRecords = records as unknown as AuditRecord[];
    const validActorIds = auditRecords.reduce<string[]>((ids, record) => {
      if (record.actorUserId && Types.ObjectId.isValid(record.actorUserId)) {
        ids.push(record.actorUserId);
      }
      return ids;
    }, []);
    const actorObjectIds = [...new Set(validActorIds)].map((id) => new Types.ObjectId(id));
    const users = actorObjectIds.length
      ? ((await UserModel.find({ _id: { $in: actorObjectIds } })
          .select('_id fullName profilePhotoUrl')
          .lean()) as unknown as UserSummaryRecord[])
      : [];
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    const items: AuditLogItem[] = auditRecords.map((record) => {
      const actor = record.actorUserId ? usersById.get(record.actorUserId) : undefined;

      return {
        id: String(record._id),
        actor: {
          id: record.actorUserId ?? null,
          name: actor?.fullName ?? 'System',
          profilePhotoUrl: actor?.profilePhotoUrl ?? null,
        },
        eventType: record.eventType,
        action: classifyAction(record.eventType),
        description: describeEvent(record.eventType),
        module: moduleFromEvent(record.eventType),
        createdAt: record.createdAt,
      };
    });

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: RequestMetadata,
    details?: Record<string, unknown>,
  ) {
    await AuditLogModel.create({
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    });
  }
}
