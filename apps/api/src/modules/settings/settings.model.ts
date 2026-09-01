import mongoose, { Document, Schema, Types } from 'mongoose';
import type {
  GeneralSettings,
  HospitalSettings,
  LocalizationSettings,
  UserPreferenceSettings,
} from './settings.types.js';

export interface ISystemSettings extends Document {
  key: 'system';
  general: GeneralSettings;
  hospital: HospitalSettings;
  localization: LocalizationSettings;
  userPreferences: UserPreferenceSettings;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const generalSchema = new Schema<GeneralSettings>(
  {
    applicationName: { type: String, required: true, trim: true },
    version: { type: String, required: true },
    defaultLanguage: { type: String, enum: ['en', 'sw'], required: true },
    dateFormat: { type: String, enum: ['DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'], required: true },
    timeFormat: { type: String, enum: ['12-hour', '24-hour'], required: true },
    sessionTimeoutMinutes: { type: Number, min: 5, max: 480, required: true },
    maintenanceMode: { type: Boolean, required: true },
    darkMode: { type: Boolean, required: true },
    auditLogging: { type: Boolean, required: true },
    multiBranchMode: { type: Boolean, required: true },
  },
  { _id: false },
);

const hospitalSchema = new Schema<HospitalSettings>(
  {
    hospitalName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    logoBlobName: { type: String, default: null },
    logoContentType: { type: String, default: null },
  },
  { _id: false },
);

const localizationSchema = new Schema<LocalizationSettings>(
  {
    country: { type: String, enum: ['Kenya', 'Uganda', 'Tanzania', 'Nigeria'], required: true },
    timezone: { type: String, enum: ['Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo'], required: true },
    currency: { type: String, enum: ['KES', 'UGX', 'USD'], required: true },
    currencySymbol: { type: String, required: true, trim: true },
    numberFormat: { type: String, enum: ['1,000.00', '1.000,00'], required: true },
    firstDayOfWeek: { type: String, enum: ['Monday', 'Sunday'], required: true },
  },
  { _id: false },
);

const userPreferencesSchema = new Schema<UserPreferenceSettings>(
  {
    passwordMinLength: { type: Number, min: 6, max: 32, required: true },
    passwordExpiryDays: { type: Number, min: 0, max: 3650, required: true },
    maxFailedLoginAttempts: { type: Number, min: 1, max: 20, required: true },
    requireStrongPasswords: { type: Boolean, required: true },
    forcePasswordChangeOnFirstLogin: { type: Boolean, required: true },
    allowUserSelfRegistration: { type: Boolean, required: true },
  },
  { _id: false },
);

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, enum: ['system'], default: 'system', unique: true, required: true },
    general: { type: generalSchema, required: true },
    hospital: { type: hospitalSchema, required: true },
    localization: { type: localizationSchema, required: true },
    userPreferences: { type: userPreferencesSchema, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const SystemSettingsModel = mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);
