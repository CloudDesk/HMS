import { Types, type ClientSession } from 'mongoose';
import { NotificationModel, type NotificationDocumentFields } from './notification.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { CreateNotificationDTO, Notification, NotificationListQuery } from './notification.types.js';
import { PatientAccessGrantModel } from '../patient-portal/patient-access-grant.model.js';
import { LaboratoryResultModel } from '../laboratory/laboratory-result.model.js';
import { ImagingReportModel } from '../imaging/imaging-report.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { DentalTreatmentQuotationModel } from '../opd/dental-quotation.model.js';

type NotificationLean = NotificationDocumentFields & { _id: Types.ObjectId };

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
  private async recipientFilter(userId: string, patientId?: string): Promise<Record<string, unknown>> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('roleIds branchIds')
      .lean<{ roleIds: Types.ObjectId[]; branchIds: Types.ObjectId[] }>();

    const userCond: Record<string, unknown> = { recipientUserId: new Types.ObjectId(userId) };
    if (patientId && Types.ObjectId.isValid(patientId)) {
      userCond.patientId = new Types.ObjectId(patientId);
    }
    if (!user) return userCond;

    const roles = await RoleModel.find({ _id: { $in: user.roleIds }, status: 'active', deletedAt: null })
      .select('code')
      .lean<Array<{ code: string }>>();

    const roleCodes = roles.map((role) => role.code);
    if (!roleCodes.length) return userCond;

    const roleBranchCond: Record<string, unknown> = {
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
      $or: [userCond, roleBranchCond],
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
    const grants = await PatientAccessGrantModel.find({
      userId: new Types.ObjectId(userId),
      status: 'VERIFIED',
    }).select('patientId').lean();

    const user = await UserModel.findById(userId).select('patientId').lean();

    const patientIdSet = new Set<string>();
    for (const g of grants) {
      if (g.patientId) patientIdSet.add(g.patientId.toString());
    }
    if (user?.patientId) {
      patientIdSet.add(user.patientId.toString());
    }

    if (!patientIdSet.size) return;
    const patientIds = Array.from(patientIdSet).map((id) => new Types.ObjectId(id));

    // 1. Check verified lab results
    const labResults = await LaboratoryResultModel.find({
      patientId: { $in: patientIds },
      deletedAt: null,
      verifiedAt: { $ne: null },
    }).select('_id patientId verifiedAt createdAt').limit(20).lean();

    for (const lab of labResults) {
      const exists = await NotificationModel.exists({
        recipientUserId: new Types.ObjectId(userId),
        relatedEntityId: lab._id,
        type: 'LAB_RESULT',
      });
      if (!exists) {
        await NotificationModel.create([{
          recipientRole: 'PATIENT',
          recipientUserId: new Types.ObjectId(userId),
          patientId: lab.patientId,
          type: 'LAB_RESULT',
          title: 'Laboratory Result Available',
          message: 'Your laboratory report has been verified and is ready for your review.',
          relatedEntityId: lab._id,
          createdAt: lab.verifiedAt ?? lab.createdAt ?? new Date(),
          isRead: false,
        }]);
      }
    }

    // 2. Check verified imaging reports
    const imagingReports = await ImagingReportModel.find({
      patientId: { $in: patientIds },
      deletedAt: null,
      verifiedAt: { $ne: null },
    }).select('_id patientId verifiedAt createdAt').limit(20).lean();

    for (const img of imagingReports) {
      const exists = await NotificationModel.exists({
        recipientUserId: new Types.ObjectId(userId),
        relatedEntityId: img._id,
        type: 'IMAGING_REPORT',
      });
      if (!exists) {
        await NotificationModel.create([{
          recipientRole: 'PATIENT',
          recipientUserId: new Types.ObjectId(userId),
          patientId: img.patientId,
          type: 'IMAGING_REPORT',
          title: 'Imaging Scan Available',
          message: 'Your imaging scan report has been verified and is ready for viewing.',
          relatedEntityId: img._id,
          createdAt: img.verifiedAt ?? img.createdAt ?? new Date(),
          isRead: false,
        }]);
      }
    }

    // 3. Check pending invoices
    const invoices = await BillingInvoiceModel.find({
      patientId: { $in: patientIds },
      deletedAt: null,
      balanceAmount: { $gt: 0 },
      status: { $in: ['PENDING', 'PARTIALLY_PAID'] },
    }).select('_id patientId invoiceNumber balanceAmount createdAt').limit(20).lean();

    for (const inv of invoices) {
      const exists = await NotificationModel.exists({
        recipientUserId: new Types.ObjectId(userId),
        relatedEntityId: inv._id,
        type: 'INVOICE_PENDING',
      });
      if (!exists) {
        await NotificationModel.create([{
          recipientRole: 'PATIENT',
          recipientUserId: new Types.ObjectId(userId),
          patientId: inv.patientId,
          type: 'INVOICE_PENDING',
          title: 'Pending Invoice',
          message: `Invoice ${inv.invoiceNumber} has an outstanding balance of ${inv.balanceAmount}.`,
          relatedEntityId: inv._id,
          createdAt: inv.createdAt ?? new Date(),
          isRead: false,
        }]);
      }
    }

    // 4. Check consents requiring signature
    const pendingConsents = await PatientDocumentModel.find({
      patientId: { $in: patientIds },
      deletedAt: null,
      documentType: 'CONSENT',
      consentKind: { $ne: 'PATIENT_SIGNATURE' },
      consentStatus: { $ne: 'SIGNED' },
      status: 'ACTIVE',
    }).select('_id patientId title createdAt').limit(20).lean();

    for (const doc of pendingConsents) {
      const exists = await NotificationModel.exists({
        recipientUserId: new Types.ObjectId(userId),
        relatedEntityId: doc._id,
        type: 'CONSENT_REQUIRED',
      });
      if (!exists) {
        await NotificationModel.create([{
          recipientRole: 'PATIENT',
          recipientUserId: new Types.ObjectId(userId),
          patientId: doc.patientId,
          type: 'CONSENT_REQUIRED',
          title: 'Consent Signature Required',
          message: `${doc.title} requires your review and signature.`,
          relatedEntityId: doc._id,
          createdAt: doc.createdAt ?? new Date(),
          isRead: false,
        }]);
      }
    }

    // 5. Check dental treatment quotations pending decision (status: 'SENT')
    const quotations = await DentalTreatmentQuotationModel.find({
      patientId: { $in: patientIds },
      deletedAt: null,
      status: 'SENT',
    }).select('_id patientId quotationNumber total currency sentAt createdAt').limit(20).lean();

    for (const q of quotations) {
      const exists = await NotificationModel.exists({
        recipientUserId: new Types.ObjectId(userId),
        relatedEntityId: q._id,
        type: 'QUOTATION_AVAILABLE',
      });
      if (!exists) {
        await NotificationModel.create([{
          recipientRole: 'PATIENT',
          recipientUserId: new Types.ObjectId(userId),
          patientId: q.patientId,
          type: 'QUOTATION_AVAILABLE',
          title: 'Dental Quotation Available',
          message: `Dental Treatment Quotation ${q.quotationNumber} is ready for your review and decision.`,
          relatedEntityId: q._id,
          createdAt: q.sentAt ?? q.createdAt ?? new Date(),
          isRead: false,
        }]);
      }
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
