import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { ServiceModel } from '../services/service.model.js';
import { UserModel } from '../users/user.model.js';
import { AdministrationDashboardSnapshotModel } from './administration-dashboard.model.js';
import type {
  AdministrationDashboardSnapshot,
  DashboardMetric,
  ExecutiveDashboardOverview,
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
  async authorizeBranch(userId: string, branchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: new Types.ObjectId(userId), status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');

    const isSuperAdmin = Boolean(
      await RoleModel.exists({
        _id: { $in: user.roleIds ?? [] },
        code: 'SUPER_ADMIN',
        status: 'active',
        deletedAt: null,
      }),
    );

    if (branchId) {
      if (!Types.ObjectId.isValid(branchId)) {
        throw new AppError('Invalid branch ID format', 400, 'INVALID_BRANCH_ID');
      }
      const branchExists = Boolean(await BranchModel.exists({ _id: new Types.ObjectId(branchId), status: 'ACTIVE', deletedAt: null }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => id.toString() === branchId);
      if (!isSuperAdmin && !assigned) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      return [branchId];
    }

    if (isSuperAdmin) return undefined;
    const activeBranches = await BranchModel.find({ _id: { $in: user.branchIds ?? [] }, status: 'ACTIVE', deletedAt: null })
      .select('_id')
      .lean();
    return activeBranches.map((b) => b._id.toString());
  }

  async getExecutiveOverview(
    userId: string,
    requestedBranchId?: string,
    financialAccess = true,
    range: 'week' | 'month' | 'year' = 'week',
    scheduleDate?: string,
  ): Promise<ExecutiveDashboardOverview> {
    const branchScope = await this.authorizeBranch(userId, requestedBranchId);
    const branchOids = branchScope ? branchScope.map((id) => new Types.ObjectId(id)) : undefined;

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const scheduleStart = scheduleDate ? new Date(`${scheduleDate}T00:00:00.000Z`) : startOfDay;
    const scheduleEnd = new Date(scheduleStart);
    scheduleEnd.setUTCHours(23, 59, 59, 999);
    const startOfTrend = range === 'year'
      ? new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
      : range === 'month'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));

    const patientFilter: Record<string, unknown> = { deletedAt: null };
    if (branchOids) patientFilter.registrationBranchId = { $in: branchOids };

    const doctorFilter: Record<string, unknown> = { status: 'ACTIVE', deletedAt: null };
    if (branchOids) doctorFilter.branchId = { $in: branchOids };

    const appointmentTodayFilter: Record<string, unknown> = {
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'CANCELLED' },
      deletedAt: null,
    };
    if (branchOids) appointmentTodayFilter.branchId = { $in: branchOids };

    const visitTodayFilter: Record<string, unknown> = {
      visitDate: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    };
    if (branchOids) visitTodayFilter.branchId = { $in: branchOids };

    const invoiceTodayFilter: Record<string, unknown> = {
      invoiceDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'CANCELLED' },
      deletedAt: null,
    };
    if (branchOids) invoiceTodayFilter.branchId = { $in: branchOids };

    const invoiceAllFilter: Record<string, unknown> = {
      status: { $ne: 'CANCELLED' },
      deletedAt: null,
    };
    if (branchOids) invoiceAllFilter.branchId = { $in: branchOids };

    const visitTrendFilter: Record<string, unknown> = {
      visitDate: { $gte: startOfTrend, $lte: endOfDay },
      deletedAt: null,
    };
    if (branchOids) visitTrendFilter.branchId = { $in: branchOids };

    const invoiceTrendFilter: Record<string, unknown> = {
      invoiceDate: { $gte: startOfTrend, $lte: endOfDay },
      status: { $ne: 'CANCELLED' },
      deletedAt: null,
    };
    if (branchOids) invoiceTrendFilter.branchId = { $in: branchOids };

    const waitingFilter: Record<string, unknown> = {
      status: { $in: ['CHECKED_IN', 'WAITING_FOR_VITALS', 'READY_FOR_CONSULTATION'] },
      visitDate: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    };
    if (branchOids) waitingFilter.branchId = { $in: branchOids };

    const inConsultationFilter: Record<string, unknown> = {
      status: 'IN_CONSULTATION',
      visitDate: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    };
    if (branchOids) inConsultationFilter.branchId = { $in: branchOids };

    const completedTodayFilter: Record<string, unknown> = {
      status: 'COMPLETED',
      visitDate: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    };
    if (branchOids) completedTodayFilter.branchId = { $in: branchOids };

    const recentVisitsFilter: Record<string, unknown> = { deletedAt: null };
    if (branchOids) recentVisitsFilter.branchId = { $in: branchOids };

    const scheduleVisitsFilter: Record<string, unknown> = {
      visitDate: { $gte: scheduleStart, $lte: scheduleEnd },
      status: { $nin: ['CANCELLED', 'NO_SHOW'] },
      deletedAt: null,
    };
    if (branchOids) scheduleVisitsFilter.branchId = { $in: branchOids };

    const scheduleAppointmentsFilter: Record<string, unknown> = {
      $or: [
        { utcDateTime: { $gte: scheduleStart, $lte: scheduleEnd } },
        { utcDateTime: { $exists: false }, appointmentDate: { $gte: scheduleStart, $lte: scheduleEnd } },
      ],
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      deletedAt: null,
    };
    if (branchOids) scheduleAppointmentsFilter.branchId = { $in: branchOids };

    const dateFormat = range === 'year' ? '%Y-%m' : '%Y-%m-%d';

    const [
      registeredPatients,
      activeDoctors,
      todayAppointments,
      todayOpdVisits,
      todayInvoiceAggregate,
      financialSummaryAggregate,
      encounterTrendAggregate,
      revenueTrendAggregate,
      recentVisitsRows,
      patientsWaiting,
      patientsInConsultation,
      completedConsultationsToday,
      scheduleVisitRows,
      scheduleAppointmentRows,
    ] = await Promise.all([
      PatientModel.countDocuments(patientFilter),
      DoctorModel.countDocuments(doctorFilter),
      AppointmentModel.countDocuments(appointmentTodayFilter),
      OpdVisitModel.countDocuments(visitTodayFilter),
      financialAccess
        ? BillingInvoiceModel.aggregate<{ total: number }>([
            { $match: invoiceTodayFilter },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ])
        : Promise.resolve([]),
      financialAccess
        ? BillingInvoiceModel.aggregate<{ totalBilled: number; totalCollected: number }>([
            { $match: invoiceAllFilter },
            { $group: { _id: null, totalBilled: { $sum: '$totalAmount' }, totalCollected: { $sum: '$paidAmount' } } },
          ])
        : Promise.resolve([]),
      OpdVisitModel.aggregate<{ _id: string; count: number }>([
        { $match: visitTrendFilter },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$visitDate' } }, count: { $sum: 1 } } },
      ]),
      financialAccess
        ? BillingInvoiceModel.aggregate<{ _id: string; total: number }>([
            { $match: invoiceTrendFilter },
            { $group: { _id: { $dateToString: { format: dateFormat, date: '$invoiceDate' } }, total: { $sum: '$totalAmount' } } },
          ])
        : Promise.resolve([]),
      OpdVisitModel.find(recentVisitsFilter)
        .sort({ checkInTime: -1, _id: -1 })
        .limit(20)
        .lean(),
      OpdVisitModel.countDocuments(waitingFilter),
      OpdVisitModel.countDocuments(inConsultationFilter),
      OpdVisitModel.countDocuments(completedTodayFilter),
      OpdVisitModel.find(scheduleVisitsFilter)
        .select('_id appointmentId patientName doctorName checkInTime status')
        .sort({ checkInTime: 1, _id: 1 })
        .limit(100)
        .lean(),
      AppointmentModel.find(scheduleAppointmentsFilter)
        .select('_id patientName doctorName utcDateTime appointmentDate status')
        .sort({ utcDateTime: 1, appointmentDate: 1, _id: 1 })
        .limit(100)
        .lean(),
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const encountersByDate = new Map(encounterTrendAggregate.map((row) => [row._id, row.count]));
    const revenueByDate = new Map(revenueTrendAggregate.map((row) => [row._id, row.total]));

    const trend = [];
    if (range === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const dateStr = d.toISOString().slice(0, 7);
        const dayName = monthNames[d.getUTCMonth()] ?? '';
        trend.push({
          date: dateStr,
          day: dayName,
          revenue: Math.round((revenueByDate.get(dateStr) ?? 0) * 100) / 100,
          encounters: encountersByDate.get(dateStr) ?? 0,
        });
      }
    } else if (range === 'month') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        const dateStr = d.toISOString().slice(0, 10);
        const dayName = `${monthNames[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
        trend.push({
          date: dateStr,
          day: dayName,
          revenue: Math.round((revenueByDate.get(dateStr) ?? 0) * 100) / 100,
          encounters: encountersByDate.get(dateStr) ?? 0,
        });
      }
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        const dateStr = d.toISOString().slice(0, 10);
        const dayName = `${dayNames[d.getUTCDay()]} ${d.getUTCDate()}`;
        trend.push({
          date: dateStr,
          day: dayName,
          revenue: Math.round((revenueByDate.get(dateStr) ?? 0) * 100) / 100,
          encounters: encountersByDate.get(dateStr) ?? 0,
        });
      }
    }

    const todayBilledRevenue = financialAccess ? (todayInvoiceAggregate[0]?.total ?? 0) : null;
    const totalBilledAmount = financialAccess ? (financialSummaryAggregate[0]?.totalBilled ?? 0) : null;
    const collectedFunds = financialAccess ? (financialSummaryAggregate[0]?.totalCollected ?? 0) : null;
    const pendingOutstanding =
      financialAccess && totalBilledAmount !== null && collectedFunds !== null
        ? Math.max(0, Math.round((totalBilledAmount - collectedFunds) * 100) / 100)
        : null;
    const convertedAppointmentIds = new Set(
      scheduleVisitRows
        .map((visit) => visit.appointmentId?.toString())
        .filter((id): id is string => Boolean(id)),
    );
    const scheduleItems: ExecutiveDashboardOverview['scheduleItems'] = [
      ...scheduleVisitRows.map((visit) => ({
        id: String(visit._id),
        source: 'VISIT' as const,
        patient_name: visit.patientName,
        doctor_name: visit.doctorName,
        scheduled_at: visit.checkInTime.toISOString(),
        status: visit.status,
        appointment_id: visit.appointmentId?.toString() ?? null,
        visit_id: String(visit._id),
      })),
      ...scheduleAppointmentRows
        .filter((appointment) => !convertedAppointmentIds.has(String(appointment._id)))
        .map((appointment) => ({
          id: String(appointment._id),
          source: 'APPOINTMENT' as const,
          patient_name: appointment.patientName,
          doctor_name: appointment.doctorName,
          scheduled_at: (appointment.utcDateTime ?? appointment.appointmentDate ?? scheduleStart).toISOString(),
          status: appointment.status,
          appointment_id: String(appointment._id),
          visit_id: null,
        })),
    ].sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at));

    return {
      generatedAt: now.toISOString(),
      branchId: requestedBranchId ?? null,
      kpis: {
        registeredPatients,
        activeDoctors,
        todayAppointments,
        todayOpdVisits,
        todayBilledRevenue,
      },
      financialSummary: financialAccess
        ? {
            totalBilledAmount,
            collectedFunds,
            pendingOutstanding,
          }
        : null,
      trend,
      recentVisits: recentVisitsRows.map((v) => ({
        id: String(v._id),
        visit_number: v.visitNumber,
        patient_name: v.patientName,
        doctor_name: v.doctorName,
        check_in_time: v.checkInTime.toISOString(),
        status: v.status,
      })),
      scheduleItems,
      operationalMetrics: {
        patientsWaiting,
        patientsInConsultation,
        completedConsultationsToday,
      },
    };
  }

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
