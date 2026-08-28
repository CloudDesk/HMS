import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import {
  OpdClinicalOrderModel,
  type ClinicalOrderItemFields,
  type OpdClinicalOrderFields,
} from './opd-clinical-order.model.js';
import type {
  ClinicalOrderType,
  ClinicalOrderSourceType,
  ClinicalOrderListQuery,
  ClinicalOrderRequestMetadata,
  OpdClinicalOrder,
  SaveClinicalOrderItemDTO,
  SaveOpdClinicalOrderDTO,
} from './opd-clinical-order.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import type { OpdVisit, OpdVisitType } from './opd-visit.types.js';
import type { ClinicalSourceContext } from './clinical-context.types.js';

type OpdClinicalOrderLean = OpdClinicalOrderFields & { _id: Types.ObjectId };

type SaveClinicalOrderRecord = SaveOpdClinicalOrderDTO & {
  consultation: OpdConsultation;
  orderType: ClinicalOrderType;
  status: OpdClinicalOrder['status'];
  submittedAt?: Date | null;
  visit: OpdVisit;
};

const objectId = (value: string) => new Types.ObjectId(value);

const sourceTypeForVisit = (visitType: OpdVisitType): ClinicalOrderSourceType => {
  if (visitType === 'EMERGENCY') return 'EMERGENCY_ENCOUNTER';
  if (visitType === 'PROCEDURE') return 'PROCEDURE_BOOKING';
  return 'OPD_VISIT';
};

const nullableString = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const toItem = (item: ClinicalOrderItemFields) => ({
  id: item._id.toString(),
  service_id: item.serviceId.toString(),
  service_name: item.serviceName,
  investigation_name: item.investigationName,
  category: item.category,
});

export const toClinicalOrder = (record: OpdClinicalOrderLean): OpdClinicalOrder => ({
  id: record._id.toString(),
  originating_order_id: record._id.toString(),
  source_type: record.sourceType === 'EMERGENCY_ENCOUNTER' ? 'EMERGENCY' : (visitType ? sourceTypeForVisit(visitType) : 'OPD'),
  encounter_id: record.visitId?.toString() ?? record.sourceId?.toString() ?? null,
  admission_id: null,
  procedure_id: null,
  source_id: record.sourceId?.toString() ?? record.visitId?.toString() ?? record._id.toString(),
  visit_id: record.visitId?.toString() ?? record.sourceId?.toString() ?? null,
  consultation_id: record.consultationId?.toString() ?? null,
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  doctor_id: record.doctorId.toString(),
  doctor_name: record.doctorName,
  branch_id: record.branchId.toString(),
  order_type: record.orderType,
  status: record.status,
  priority: record.priority,
  destination: record.destination ?? null,
  specimen_type: record.specimenType ?? null,
  items: record.items.map(toItem),
  clinical_notes: record.clinicalNotes ?? null,
  instructions: record.instructions ?? null,
  submitted_at: record.submittedAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toItemFields = (item: SaveClinicalOrderItemDTO) => ({
  serviceId: objectId(item.service_id),
  serviceName: item.investigation_name.trim(),
  investigationName: item.investigation_name.trim(),
  category: item.category.trim(),
});

export class OpdClinicalOrderRepository {
  async getByVisitAndType(visitId: string, orderType: ClinicalOrderType): Promise<OpdClinicalOrder | null> {
    const record = await OpdClinicalOrderModel.findOne({
      visitId: objectId(visitId),
      orderType,
      deletedAt: null,
    }).lean<OpdClinicalOrderLean>();

    return record ? toClinicalOrder(record) : null;
  }

  async getBySourceAndType(
    sourceType: ClinicalSourceContext['source_type'],
    sourceId: string,
    orderType: ClinicalOrderType,
    session?: ClientSession,
  ) {
    const query = OpdClinicalOrderModel.findOne({
      sourceType,
      sourceId: objectId(sourceId),
      orderType,
      deletedAt: null,
    }).lean<OpdClinicalOrderLean>();
    if (session) query.session(session);
    const record = await query;
    return record ? toClinicalOrder(record) : null;
  }

  async saveForVisit(data: SaveClinicalOrderRecord, userId: string): Promise<OpdClinicalOrder> {
    const record = await OpdClinicalOrderModel.findOneAndUpdate(
      { visitId: objectId(data.visit.id), orderType: data.orderType, deletedAt: null },
      {
        $set: {
          sourceType: sourceTypeForVisit(data.visit.visit_type),
          encounterId: objectId(data.visit.id),
          admissionId: null,
          procedureId: null,
          consultationId: objectId(data.consultation.id),
          branchId: objectId(data.visit.branch_id),
          status: data.status,
          priority: data.priority,
          destination: nullableString(data.destination),
          specimenType: data.orderType === 'LABORATORY' ? nullableString(data.specimen_type) : null,
          items: data.items.map(toItemFields),
          clinicalNotes: nullableString(data.clinical_notes),
          instructions: nullableString(data.instructions),
          submittedAt: data.submittedAt ?? null,
          updatedBy: objectId(userId),
        },
        $setOnInsert: {
          sourceType: 'OPD_VISIT',
          sourceId: objectId(data.visit.id),
          visitId: objectId(data.visit.id),
          patientId: objectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          doctorId: objectId(data.visit.doctor_id),
          doctorName: data.visit.doctor_name,
          orderType: data.orderType,
          createdBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after', upsert: true },
    ).lean<OpdClinicalOrderLean>();

    if (!record) {
      throw new AppError('Clinical order could not be saved', 500, 'CLINICAL_ORDER_SAVE_FAILED');
    }

    return toClinicalOrder(record);
  }

  async submitForEmergency(data: {
    encounterId: string; patientId: string; patientNumber: string; patientName: string; doctorId: string; doctorName: string;
    branchId: string; orderType: ClinicalOrderType; priority: import('./opd-clinical-order.types.js').ClinicalOrderPriority;
    destination?: string | null; specimenType?: string | null; items: SaveClinicalOrderItemDTO[]; clinicalNotes?: string | null; instructions?: string | null;
  }, userId: string, session: ClientSession) {
    return this.submitForContext({
      source_type: 'EMERGENCY_ENCOUNTER', source_id: data.encounterId, encounter_id: data.encounterId,
      admission_id: null, procedure_id: null, patient_id: data.patientId, patient_number: data.patientNumber,
      patient_name: data.patientName, doctor_id: data.doctorId, doctor_name: data.doctorName, branch_id: data.branchId,
    }, data.orderType, {
      priority: data.priority, destination: data.destination, specimen_type: data.specimenType, items: data.items,
      clinical_notes: data.clinicalNotes, instructions: data.instructions,
    }, userId, session);
  }

  async submitForContext(
    context: ClinicalSourceContext,
    orderType: ClinicalOrderType,
    data: SaveOpdClinicalOrderDTO,
    userId: string,
    session: ClientSession,
  ) {
    const record = await OpdClinicalOrderModel.findOneAndUpdate(
      { sourceType: context.source_type, sourceId: objectId(context.source_id), orderType, deletedAt: null },
      { $set: {
        status: 'SUBMITTED', priority: data.priority, destination: nullableString(data.destination),
        specimenType: orderType === 'LABORATORY' ? nullableString(data.specimen_type) : null,
        items: data.items.map(toItemFields), clinicalNotes: nullableString(data.clinical_notes),
        instructions: nullableString(data.instructions), submittedAt: new Date(), updatedBy: objectId(userId),
        encounterId: context.encounter_id ? objectId(context.encounter_id) : null,
        admissionId: context.admission_id ? objectId(context.admission_id) : null,
        procedureId: context.procedure_id ? objectId(context.procedure_id) : null,
      }, $setOnInsert: {
        sourceType: context.source_type, sourceId: objectId(context.source_id),
        visitId: context.source_type === 'OPD_VISIT' ? objectId(context.source_id) : null, consultationId: null,
        patientId: objectId(context.patient_id), patientNumber: context.patient_number, patientName: context.patient_name,
        doctorId: objectId(context.doctor_id), doctorName: context.doctor_name, branchId: objectId(context.branch_id),
        orderType, createdBy: objectId(userId),
      } },
      { new: true, upsert: true, runValidators: true, session },
    ).lean<OpdClinicalOrderLean>();
    if (!record) throw new AppError('Context clinical order could not be submitted', 500, 'CLINICAL_ORDER_SAVE_FAILED');
    return toClinicalOrder(record);
  }

  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');
    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null,
    }));
    if (requestedBranchId) {
      const branchExists = Boolean(await BranchModel.exists({ _id: requestedBranchId, status: 'ACTIVE', deletedAt: null }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      return [requestedBranchId];
    }
    if (isSuperAdmin) return undefined;
    const activeBranches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] }, status: 'ACTIVE', deletedAt: null,
    }).select('_id').lean();
    return activeBranches.map((branch) => String(branch._id));
  }

  async listOperational(orderType: ClinicalOrderType, query: ClinicalOrderListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      orderType,
      status: query.status ?? { $ne: 'DRAFT' },
      deletedAt: null,
    };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    if (query.priority) filter.priority = query.priority;
    if (query.patient_id) filter.patientId = objectId(query.patient_id);
    if (query.doctor_id) filter.doctorId = objectId(query.doctor_id);
    if (query.date_from || query.date_to) {
      const submittedAt: { $gte?: Date; $lte?: Date } = {};
      if (query.date_from) submittedAt.$gte = new Date(`${query.date_from}T00:00:00.000Z`);
      if (query.date_to) submittedAt.$lte = new Date(`${query.date_to}T23:59:59.999Z`);
      filter.submittedAt = submittedAt;
    }
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expression = new RegExp(escaped, 'i');
      filter.$or = [
        { patientName: expression }, { patientNumber: expression }, { doctorName: expression },
        { destination: expression }, { 'items.serviceName': expression },
      ];
    }
    const [records, total] = await Promise.all([
      OpdClinicalOrderModel.find(filter).sort({ submittedAt: 1, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean<OpdClinicalOrderLean[]>(),
      OpdClinicalOrderModel.countDocuments(filter),
    ]);
    return {
      data: records.map((record) => toClinicalOrder(record)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOperationalById(id: string, orderType: ClinicalOrderType, branchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id), orderType, status: { $ne: 'DRAFT' }, deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(objectId) };
    const find = OpdClinicalOrderModel.findOne(filter).lean<OpdClinicalOrderLean>();
    if (session) find.session(session);
    const record = await find;
    if (!record) return null;
    return toClinicalOrder(record);
  }

  async updateOperationalStatus(
    id: string,
    orderType: ClinicalOrderType,
    expectedStatus: OpdClinicalOrder['status'],
    status: OpdClinicalOrder['status'],
    userId: string,
    session?: ClientSession,
  ) {
    const record = await OpdClinicalOrderModel.findOneAndUpdate(
      { _id: objectId(id), orderType, status: expectedStatus, deletedAt: null },
      { $set: { status, updatedBy: objectId(userId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<OpdClinicalOrderLean>();
    if (!record) return null;
    return toClinicalOrder(record);
  }

  async summaryOperational(orderType: ClinicalOrderType, branchIds?: string[]) {
    const match: Record<string, unknown> = { orderType, status: { $ne: 'DRAFT' }, deletedAt: null };
    if (branchIds) match.branchId = { $in: branchIds.map(objectId) };
    const rows = await OpdClinicalOrderModel.aggregate<{ _id: string; count: number }>([
      { $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: ClinicalOrderRequestMetadata,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    const entries = await AuditLogModel.create([{
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    }], { session });
    return entries[0];
  }
}
