import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { RoleModel } from '../roles/role.model.js';
import { ServiceModel } from '../services/service.model.js';
import { UserModel } from '../users/user.model.js';
import { AdministrationDashboardSnapshotModel } from './administration-dashboard.model.js';
import type {
  AdministrationDashboardSnapshot,
  DashboardMetric,
} from './administration-dashboard.types.js';

type AggregateMetric = { _id: string; value: number };
type AggregateNamedMetric = { label: string; value: number };
type AuditRecord = { _id: unknown; actorUserId?: string; eventType: string; createdAt: Date };
type ActorRecord = { _id: unknown; fullName: string };

const moduleFromEvent = (eventType: string) => {
  const modules: Record<string, string> = {
    auth: 'Authentication',
    branch: 'Branches',
    department: 'Departments',
    permission: 'Permissions',
    role: 'Roles',
    service: 'Services',
    settings: 'Settings',
    user: 'Users',
  };
  return modules[eventType.split('.')[0]?.toLowerCase() ?? ''] ?? 'System';
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  locked: 'Locked',
};

export class AdministrationDashboardRepository {
  async getSnapshot(): Promise<AdministrationDashboardSnapshot | null> {
    const snapshot = await AdministrationDashboardSnapshotModel.findOne({ key: 'administration' })
      .select('-_id generatedAt kpis usersByStatus usersByRole servicesByDepartment recentActivity')
      .lean();
    return snapshot as AdministrationDashboardSnapshot | null;
  }

  async refreshSnapshot(): Promise<AdministrationDashboardSnapshot> {
    const activeFilter = { deletedAt: null };
    const [
      totalUsers,
      activeUsers,
      totalRoles,
      totalDepartments,
      totalServices,
      totalBranches,
      statusRows,
      roleRows,
      departmentRows,
      auditRows,
    ] = await Promise.all([
      UserModel.countDocuments(activeFilter),
      UserModel.countDocuments({ ...activeFilter, status: 'active' }),
      RoleModel.countDocuments(activeFilter),
      DepartmentModel.countDocuments(activeFilter),
      ServiceModel.countDocuments(activeFilter),
      BranchModel.countDocuments(activeFilter),
      UserModel.aggregate<AggregateMetric>([
        { $match: activeFilter },
        { $group: { _id: '$status', value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      UserModel.aggregate<AggregateNamedMetric>([
        { $match: activeFilter },
        { $unwind: '$roleIds' },
        { $lookup: { from: 'roles', localField: 'roleIds', foreignField: '_id', as: 'role' } },
        { $unwind: '$role' },
        { $match: { 'role.deletedAt': null } },
        { $group: { _id: '$role._id', label: { $first: '$role.name' }, value: { $sum: 1 } } },
        { $project: { _id: 0, label: 1, value: 1 } },
        { $sort: { value: -1, label: 1 } },
      ]),
      ServiceModel.aggregate<AggregateNamedMetric>([
        { $match: activeFilter },
        { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
        { $unwind: '$department' },
        { $match: { 'department.deletedAt': null } },
        { $group: { _id: '$department._id', label: { $first: '$department.name' }, value: { $sum: 1 } } },
        { $project: { _id: 0, label: 1, value: 1 } },
        { $sort: { value: -1, label: 1 } },
      ]),
      AuditLogModel.find({})
        .select('_id actorUserId eventType createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const audits = auditRows as unknown as AuditRecord[];
    const actorIds = [...new Set(audits.map((item) => item.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? ((await UserModel.find({ _id: { $in: actorIds } }).select('_id fullName').lean()) as unknown as ActorRecord[])
      : [];
    const actorNames = new Map(actors.map((actor) => [String(actor._id), actor.fullName]));
    const usersByStatus: DashboardMetric[] = ['active', 'inactive', 'locked'].map((status) => ({
      label: statusLabels[status] ?? status,
      value: statusRows.find((row) => row._id === status)?.value ?? 0,
    }));

    const snapshot: AdministrationDashboardSnapshot = {
      generatedAt: new Date(),
      kpis: { totalUsers, activeUsers, totalRoles, totalDepartments, totalServices, totalBranches },
      usersByStatus,
      usersByRole: roleRows,
      servicesByDepartment: departmentRows,
      recentActivity: audits.map((item) => ({
        id: String(item._id),
        actorName: item.actorUserId ? actorNames.get(item.actorUserId) ?? 'System' : 'System',
        eventType: item.eventType,
        module: moduleFromEvent(item.eventType),
        createdAt: item.createdAt,
      })),
    };

    const saved = await AdministrationDashboardSnapshotModel.findOneAndUpdate(
      { key: 'administration' },
      { $set: snapshot, $setOnInsert: { key: 'administration' } },
      { upsert: true, returnDocument: 'after', lean: true },
    );
    return saved as unknown as AdministrationDashboardSnapshot;
  }
}
