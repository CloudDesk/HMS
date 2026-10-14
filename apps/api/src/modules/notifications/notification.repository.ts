import { Types, type ClientSession } from 'mongoose';
import { NotificationModel, type NotificationDocumentFields } from './notification.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { CreateNotificationDTO, Notification, NotificationListQuery, NotificationType } from './notification.types.js';
import { PatientAccessGrantModel } from '../patient-portal/patient-access-grant.model.js';
import { LaboratoryResultModel } from '../laboratory/laboratory-result.model.js';
import { ImagingReportModel } from '../imaging/imaging-report.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { DentalTreatmentQuotationModel } from '../opd/dental-quotation.model.js';

type NotificationLean = NotificationDocumentFields & { _id: Types.ObjectId };

const duplicateOnly = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code !== 11000) return false;
  if ('writeConcernError' in error && error.writeConcernError) return false;
  if ('writeConcernErrors' in error && Array.isArray(error.writeConcernErrors) && error.writeConcernErrors.length) return false;
  if ('writeErrors' in error && Array.isArray(error.writeErrors) && error.writeErrors.length) {
    return error.writeErrors.every((item: unknown) => Boolean(item && typeof item === 'object' && 'code' in item && item.code === 11000));
  }
  return 'code' in error && error.code === 11000;
};

const toNotification = (doc: NotificationLean): Notification => ({
  id: doc._id.toString(),
  recipient_role: doc.recipientRole ?? null,
  recipient_user_id: doc.recipientUserId?.toString() ?? null,
  recipient_branch_id: doc.recipientBranchId?.toString() ?? null,
  patient_id: doc.patientId?.toString() ?? null,
  title: doc.title,
  message: doc.message,
  type: doc.type,
  related_entity_id: doc.relatedEntityId?.toString() ?? null,
  is_read: doc.isRead,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class NotificationRepository {
  async canReceivePatientNotification(userId: string, patientId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('patientId').lean();
    if (!user) return false;
    if (user.patientId?.toString() === patientId) return true;
    return Boolean(await PatientAccessGrantModel.exists({ userId: new Types.ObjectId(userId), patientId: new Types.ObjectId(patientId), status: 'VERIFIED', revokedAt: null }));
  }

  private async recipientFilter(userId: string, patientId?: string): Promise<Record<string, unknown>> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('roleIds branchIds patientId')
      .lean<{ roleIds: Types.ObjectId[]; branchIds: Types.ObjectId[]; patientId?: Types.ObjectId }>();

    const userCond: Record<string, unknown> = { recipientUserId: new Types.ObjectId(userId) };
    if (patientId && Types.ObjectId.isValid(patientId)) {
      userCond.patientId = new Types.ObjectId(patientId);
    }
    if (!user) return { _id: { $in: [] } };

    const roles = await RoleModel.find({ _id: { $in: user.roleIds }, status: 'active', deletedAt: null })
      .select('code')
      .lean<Array<{ code: string }>>();

    const roleCodes = roles.map((role) => role.code);
    const grants = await PatientAccessGrantModel.find({ userId: new Types.ObjectId(userId), status: 'VERIFIED', revokedAt: null }).select('patientId').lean();
    const patientIds = grants.map((grant) => grant.patientId);
    if (user.patientId) patientIds.push(user.patientId);
    const patientGuard = {
      $or: [
        ...(roleCodes.some((code) => ['PATIENT', 'GUARDIAN'].includes(code)) ? [] : [{ recipientRole: { $nin: ['PATIENT', 'GUARDIAN'] } }]),
        { patientId: null },
        { patientId: { $in: patientIds } },
      ],
    };
    if (!roleCodes.length) return { $and: [userCond, patientGuard] };

    const roleBranchCond: Record<string, unknown> = {
      recipientUserId: null,
      recipientRole: { $in: roleCodes },
      $or: [
        { recipientBranchId: null },
        { recipientBranchId: { $in: user.branchIds } },
      ],
    };
    if (patientId && Types.ObjectId.isValid(patientId)) {
      roleBranchCond.patientId = new Types.ObjectId(patientId);
    }

    return {
      $and: [{ $or: [userCond, roleBranchCond] }, patientGuard],
    };
  }

  async resolveActorBranchScope(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');

    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }));
    if (isSuperAdmin) return undefined;

    const branches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] },
      status: 'ACTIVE',
      deletedAt: null,
    }).select('_id').lean();
    return branches.map((branch) => branch._id.toString());
  }

  async activeBranchExists(branchId: string) {
    return Boolean(await BranchModel.exists({
      _id: branchId,
      status: 'ACTIVE',
      deletedAt: null,
    }));
  }

  async activeRecipientRoleExists(roleCode: string) {
    return Boolean(await RoleModel.exists({
      code: roleCode,
      status: 'active',
      deletedAt: null,
    }));
  }

  async getActiveRecipientUserBranchIds(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds')
      .lean();
    return user ? (user.branchIds ?? []).map((branchId) => branchId.toString()) : null;
  }

  async create(
    data: CreateNotificationDTO,
    session?: ClientSession,
    actorUserId?: string,
  ): Promise<Notification> {
    const records = await NotificationModel.create([{
      recipientRole: data.recipient_role ?? null,
      recipientUserId: data.recipient_user_id ? new Types.ObjectId(data.recipient_user_id) : null,
      recipientBranchId: data.recipient_branch_id ? new Types.ObjectId(data.recipient_branch_id) : null,
      patientId: data.patient_id ? new Types.ObjectId(data.patient_id) : null,
      title: data.title,
      message: data.message,
      type: data.type,
      relatedEntityId: data.related_entity_id ? new Types.ObjectId(data.related_entity_id) : null,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : null,
    }], session ? { session } : undefined);
    const created = records[0];
    if (!created) throw new AppError('Notification could not be created', 500, 'NOTIFICATION_CREATE_FAILED');
    return toNotification(created.toObject<NotificationLean>());
  }

  async syncPatientNotifications(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    const userObjectId = new Types.ObjectId(userId);

    const [grants, user] = await Promise.all([
      PatientAccessGrantModel.find({
        userId: userObjectId,
        status: 'VERIFIED',
        revokedAt: null,
      }).select('patientId').lean(),
      UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('patientId').lean(),
    ]);

    if (!user) return;

    const patientIdSet = new Set<string>();
    for (const g of grants) {
      if (g.patientId) patientIdSet.add(g.patientId.toString());
    }
    if (user?.patientId) {
      patientIdSet.add(user.patientId.toString());
    }

    if (!patientIdSet.size) return;
    const patientIds = Array.from(patientIdSet).map((id) => new Types.ObjectId(id));

    // Parallel fetch candidate records across all 5 source domains (bounded by limit 20 per domain)
    const [labResults, imagingReports, invoices, pendingConsents, quotations] = await Promise.all([
      LaboratoryResultModel.find({
        patientId: { $in: patientIds },
        deletedAt: null,
        verifiedAt: { $ne: null },
      }).select('_id patientId verifiedAt createdAt').limit(20).lean(),

      ImagingReportModel.find({
        patientId: { $in: patientIds },
        deletedAt: null,
        verifiedAt: { $ne: null },
      }).select('_id patientId verifiedAt createdAt').limit(20).lean(),

      BillingInvoiceModel.find({
        patientId: { $in: patientIds },
        deletedAt: null,
        balanceAmount: { $gt: 0 },
        status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
      }).select('_id patientId invoiceNumber balanceAmount createdAt').limit(20).lean(),

      PatientDocumentModel.find({
        patientId: { $in: patientIds },
        deletedAt: null,
        documentType: 'CONSENT',
        consentKind: { $ne: 'PATIENT_SIGNATURE' },
        consentStatus: { $ne: 'SIGNED' },
        status: 'ACTIVE',
      }).select('_id patientId title createdAt').limit(20).lean(),

      DentalTreatmentQuotationModel.find({
        patientId: { $in: patientIds },
        deletedAt: null,
        status: 'SENT',
      }).select('_id patientId quotationNumber total currency sentAt createdAt').limit(20).lean(),
    ]);

    type CandidateNotification = {
      type: NotificationType;
      relatedEntityId: Types.ObjectId;
      patientId: Types.ObjectId;
      title: string;
      message: string;
      createdAt: Date;
    };

    const candidates: CandidateNotification[] = [];

    for (const lab of labResults) {
      candidates.push({
        type: 'LAB_RESULT',
        relatedEntityId: lab._id,
        patientId: lab.patientId,
        title: 'Laboratory Result Available',
        message: 'Your laboratory report has been verified and is ready for your review.',
        createdAt: lab.verifiedAt ?? lab.createdAt ?? new Date(),
      });
    }

    for (const img of imagingReports) {
      candidates.push({
        type: 'IMAGING_REPORT',
        relatedEntityId: img._id,
        patientId: img.patientId,
        title: 'Imaging Scan Available',
        message: 'Your imaging scan report has been verified and is ready for viewing.',
        createdAt: img.verifiedAt ?? img.createdAt ?? new Date(),
      });
    }

    for (const inv of invoices) {
      candidates.push({
        type: 'INVOICE_PENDING',
        relatedEntityId: inv._id,
        patientId: inv.patientId,
        title: 'Pending Invoice',
        message: `Invoice ${inv.invoiceNumber} has an outstanding balance of ${inv.balanceAmount}.`,
        createdAt: inv.createdAt ?? new Date(),
      });
    }

    for (const doc of pendingConsents) {
      candidates.push({
        type: 'CONSENT_REQUIRED',
        relatedEntityId: doc._id,
        patientId: doc.patientId,
        title: 'Consent Signature Required',
        message: `${doc.title} requires your review and signature.`,
        createdAt: doc.createdAt ?? new Date(),
      });
    }

    for (const q of quotations) {
      candidates.push({
        type: 'QUOTATION_AVAILABLE',
        relatedEntityId: q._id,
        patientId: q.patientId,
        title: 'Dental Quotation Available',
        message: `Dental Treatment Quotation ${q.quotationNumber} is ready for your review and decision.`,
        createdAt: q.sentAt ?? q.createdAt ?? new Date(),
      });
    }

    if (!candidates.length) return;

    // Single batched existence query using $in instead of per-item queries
    const candidateEntityIds = candidates.map((c) => c.relatedEntityId);
    const existing = await NotificationModel.find({
      recipientUserId: userObjectId,
      relatedEntityId: { $in: candidateEntityIds },
    })
      .select('type relatedEntityId')
      .lean();

    const existingKeySet = new Set(
      existing.map((n) => `${n.type}:${n.relatedEntityId?.toString()}`),
    );

    const seenNewKeys = new Set<string>();
    const toInsert = candidates
      .filter((c) => {
        const key = `${c.type}:${c.relatedEntityId.toString()}`;
        if (existingKeySet.has(key) || seenNewKeys.has(key)) return false;
        seenNewKeys.add(key);
        return true;
      })
      .map((c) => ({
        recipientRole: 'PATIENT',
        recipientUserId: userObjectId,
        patientId: c.patientId,
        type: c.type,
        title: c.title,
        message: c.message,
        relatedEntityId: c.relatedEntityId,
        createdAt: c.createdAt,
        isRead: false,
      }));

    if (toInsert.length > 0) {
      try {
        await NotificationModel.insertMany(toInsert, { ordered: false });
      } catch (error) {
        // Under concurrent execution, duplicate key errors (code 11000) are safely swallowed
        if (!duplicateOnly(error)) {
          throw error;
        }
      }
    }
  }

  async createPatientNotifications(
    data: {
      patientId: string;
      type: NotificationType;
      title: string;
      message: string;
      relatedEntityId: string;
    },
    session?: ClientSession,
  ): Promise<Notification[]> {
    if (!Types.ObjectId.isValid(data.patientId) || !Types.ObjectId.isValid(data.relatedEntityId)) {
      return [];
    }

    const patientObjId = new Types.ObjectId(data.patientId);
    const relatedEntityObjId = new Types.ObjectId(data.relatedEntityId);

    const [grants, users] = await Promise.all([
      PatientAccessGrantModel.find({
        patientId: patientObjId,
        status: 'VERIFIED',
        revokedAt: null,
      })
        .select('userId')
        .session(session ?? null)
        .lean(),
      UserModel.find({
        patientId: patientObjId,
        status: 'active',
        deletedAt: null,
      })
        .select('_id')
        .session(session ?? null)
        .lean(),
    ]);

    const targetUserIds = new Set<string>();
    for (const g of grants) {
      if (g.userId) targetUserIds.add(g.userId.toString());
    }
    for (const u of users) {
      if (u._id) targetUserIds.add(u._id.toString());
    }

    if (targetUserIds.size === 0) return [];

    const activeUsers = await UserModel.find({ _id: { $in: Array.from(targetUserIds).map((id) => new Types.ObjectId(id)) }, status: 'active', deletedAt: null }).select('_id').session(session ?? null).lean();
    const recipientUserObjIds = activeUsers.map((user) => user._id);

    const existing = await NotificationModel.find({
      recipientUserId: { $in: recipientUserObjIds },
      relatedEntityId: relatedEntityObjId,
      type: data.type,
    })
      .select('recipientUserId')
      .session(session ?? null)
      .lean();

    const existingUserIds = new Set(existing.map((n) => n.recipientUserId?.toString()));

    const toInsert = recipientUserObjIds
      .filter((id) => !existingUserIds.has(id.toString()))
      .map((userObjId) => ({
        _id: new Types.ObjectId(),
        recipientRole: 'PATIENT',
        recipientUserId: userObjId,
        patientId: patientObjId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedEntityId: relatedEntityObjId,
        createdAt: new Date(),
        isRead: false,
      }));

    if (toInsert.length === 0) return [];

    try {
      const inserted = await NotificationModel.insertMany(toInsert, {
        ordered: false,
        session: session ?? undefined,
      });
      return inserted.map((n) => toNotification(n.toObject<NotificationLean>()));
    } catch (error) {
      if (!duplicateOnly(error)) {
        throw error;
      }
      // Recover only rows inserted by this attempt, never a competing attempt's rows.
      if (session) throw error; // A duplicate can abort a transaction; do not query it afterward.
      const inserted = await NotificationModel.find({ _id: { $in: toInsert.map((item) => item._id) } }).lean<NotificationLean[]>();
      return inserted.map(toNotification);
    }
  }

  async listForUser(userId: string, query: Pick<NotificationListQuery, 'is_read' | 'page' | 'limit' | 'patient_id'>) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      ...(query.is_read !== undefined ? { isRead: query.is_read } : {}),
      ...await this.recipientFilter(userId, query.patient_id),
    };
    const [data, count] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<NotificationLean[]>(),
      NotificationModel.countDocuments(filter),
    ]);
    return { data: data.map(toNotification), meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 } };
  }

  async list(query: NotificationListQuery, branchIds?: string[]): Promise<{
    data: Notification[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (branchIds) {
      filter.recipientBranchId = { $in: branchIds.map((branchId) => new Types.ObjectId(branchId)) };
    }

    if (query.recipient_role) {
      filter.recipientRole = query.recipient_role;
    }
    if (query.recipient_user_id) {
      filter.recipientUserId = new Types.ObjectId(query.recipient_user_id);
    }
    if (query.recipient_branch_id) {
      filter.recipientBranchId = new Types.ObjectId(query.recipient_branch_id);
    }
    if (query.patient_id) {
      filter.patientId = new Types.ObjectId(query.patient_id);
    }
    if (query.is_read !== undefined) {
      filter.isRead = query.is_read;
    }

    // If both are provided, we should probably do an OR condition so a user sees role-based AND user-based notifications
    if (query.recipient_role && query.recipient_user_id) {
      delete filter.recipientRole;
      delete filter.recipientUserId;
      filter.$or = [
        { recipientRole: query.recipient_role },
        { recipientUserId: new Types.ObjectId(query.recipient_user_id) },
      ];
    }

    const [data, count] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean<NotificationLean[]>(),
      NotificationModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toNotification),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findById(id).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }

  async markAsRead(id: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { returnDocument: 'after', lean: true }
    ).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }

  async markAsReadForUser(id: string, userId: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findOneAndUpdate(
      { _id: id, ...await this.recipientFilter(userId) },
      { $set: { isRead: true } },
      { returnDocument: 'after', lean: true },
    ).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }
}
