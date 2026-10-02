import mongoose, { Document, Schema } from 'mongoose';
import type { AdministrationDashboardSnapshot } from './administration-dashboard.types.js';

interface IAdministrationDashboardSnapshot extends Document, AdministrationDashboardSnapshot {
  key: 'administration';
}

const metricSchema = new Schema(
  {
    label: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const activitySchema = new Schema(
  {
    id: { type: String, required: true },
    actorName: { type: String, required: true },
    eventType: { type: String, required: true },
    module: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const snapshotSchema = new Schema<IAdministrationDashboardSnapshot>(
  {
    key: { type: String, enum: ['administration'], required: true, unique: true },
    generatedAt: { type: Date, required: true, index: true },
    kpis: {
      totalUsers: { type: Number, required: true },
      activeUsers: { type: Number, required: true },
      totalRoles: { type: Number, required: true },
      totalDepartments: { type: Number, required: true },
      totalServices: { type: Number, required: true },
      totalBranches: { type: Number, required: true },
    },
    usersByStatus: { type: [metricSchema], default: [] },
    usersByRole: { type: [metricSchema], default: [] },
    servicesByDepartment: { type: [metricSchema], default: [] },
    recentActivity: { type: [activitySchema], default: [] },
  },
  { timestamps: true },
);

export const AdministrationDashboardSnapshotModel = mongoose.model<IAdministrationDashboardSnapshot>(
  'AdministrationDashboardSnapshot',
  snapshotSchema,
);
