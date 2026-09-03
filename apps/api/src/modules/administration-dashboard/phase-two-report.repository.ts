import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AdmissionPolicyModel, BedModel } from '../admissions-configuration/admissions-configuration.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { EmergencyEncounterModel } from '../emergency/emergency.model.js';
import { AdmissionRequestModel, InpatientAdmissionModel } from '../inpatient-admissions/inpatient-admission.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { ProcedureBookingModel } from '../surgery/surgery.model.js';
import { UserModel } from '../users/user.model.js';
import type {
  AdvancePaymentRow, BedOccupancyRow, ConsentPendingRow, DepartmentPendingRow,
  EmergencyRegisterRow, IpConversionRow, PaymentStatusRow, PhaseTwoReportBundle,
  PhaseTwoReportQuery, ProcedureScheduleRow, ReportPage,
} from './phase-two-report.types.js';

const oid = (value: string) => new Types.ObjectId(value);
const meta = (total: number, page: number, limit: number) => ({ total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
const dateFilter = (query: PhaseTwoReportQuery, field: string) => query.date_from || query.date_to ? {
  [field]: {
    ...(query.date_from ? { $gte: new Date(`${query.date_from}T00:00:00.000Z`) } : {}),
    ...(query.date_to ? { $lte: new Date(`${query.date_to}T23:59:59.999Z`) } : {}),
  },
} : {};
const pageResult = <T>(data: T[], total: number, page: number, limit: number): ReportPage<T> => ({ data, meta: meta(total, page, limit) });
const operationalSource = (value?: string) => value === 'EMERGENCY' ? 'EMERGENCY_ENCOUNTER' : value === 'OPD' ? 'OPD_VISIT' : value;

export class PhaseTwoReportRepository {
  async authorizeBranch(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('branchIds roleIds').lean(),
      BranchModel.exists({ _id: oid(branchId), status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch) throw new AppError('Branch not found or unavailable', 404, 'BRANCH_NOT_FOUND');
    const superAdmin = await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null });
    if (!superAdmin && !(user.branchIds ?? []).some((id) => id.toString() === branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }

  async bedOccupancy(query: PhaseTwoReportQuery): Promise<ReportPage<BedOccupancyRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    const match: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.ward_id) match.wardId = oid(query.ward_id);
    if (query.status) match.status = query.status;
    const base: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } },
      { $set: { wardName: { $ifNull: [{ $arrayElemAt: ['$ward.name', 0] }, ''] }, wardType: { $ifNull: [{ $arrayElemAt: ['$ward.wardType', 0] }, ''] } } },
    ];
    const [rows, total] = await Promise.all([
      BedModel.aggregate([...base, { $sort: { wardName: 1, roomNumber: 1, bedNumber: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: {
        _id: 0, id: { $toString: '$_id' }, ward_id: { $toString: '$wardId' }, ward_name: '$wardName', ward_type: '$wardType',
        room_number: { $ifNull: ['$roomNumber', null] }, bed_number: '$bedNumber', bed_type: { $ifNull: ['$bedType', '$bedCategory'] },
        charge_category: { $ifNull: ['$chargeCategory', '$bedCategory'] }, status: 1,
      } }]),
      BedModel.countDocuments(match),
    ]);
    return pageResult(rows as BedOccupancyRow[], total, page, limit);
  }

  async emergencyRegister(query: PhaseTwoReportQuery): Promise<ReportPage<EmergencyRegisterRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    const match: Record<string, unknown> = { branchId: oid(query.branch_id), ...dateFilter(query, 'arrivalAt') };
    if (query.department_id) match.departmentId = oid(query.department_id);
    if (query.doctor_id) match.assignedDoctorId = oid(query.doctor_id);
    if (query.status) match.status = query.status;
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
      { $sort: { arrivalAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: {
        _id: 0, id: { $toString: '$_id' }, visit_number: '$encounterNumber', patient_number: { $ifNull: ['$patientNumber', null] },
        patient_name: '$patientName', doctor_name: { $ifNull: ['$assignedDoctorName', null] },
        department_name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, ''] }, visit_date: '$arrivalAt',
        priority: { $ifNull: ['$triage.effectiveLevel', 'UNTRIAGED'] }, status: 1,
        laboratory_orders: { $size: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.orderType', 'LABORATORY'] } } } },
        imaging_orders: { $size: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.orderType', 'IMAGING'] } } } },
        pharmacy_requests: { $size: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.orderType', 'PHARMACY'] } } } },
        conversion_outcome: { $cond: [{ $eq: ['$status', 'CONVERTED_TO_IP'] }, 'CONVERTED_TO_IP', { $ifNull: ['$disposition.decision', null] }] },
      } },
    ];
    const [rows, total] = await Promise.all([EmergencyEncounterModel.aggregate(pipeline), EmergencyEncounterModel.countDocuments(match)]);
    return pageResult(rows as EmergencyRegisterRow[], total, page, limit);
  }

  async procedureSchedule(query: PhaseTwoReportQuery): Promise<ReportPage<ProcedureScheduleRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    const match: Record<string, unknown> = { branchId: oid(query.branch_id), ...dateFilter(query, 'scheduledStart') };
    if (query.department_id) match.departmentId = oid(query.department_id);
    if (query.doctor_id) match.doctorId = oid(query.doctor_id);
    if (query.status) match.status = query.status;
    const [rows, total] = await Promise.all([
      ProcedureBookingModel.aggregate([{ $match: match }, { $sort: { scheduledStart: 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: {
        _id: 0, id: { $toString: '$_id' }, booking_number: '$bookingNumber', patient_number: '$patientNumber', patient_name: '$patientName',
        doctor_id: { $toString: '$doctorId' }, doctor_name: '$doctorName', department_id: { $toString: '$departmentId' },
        department_name: '$departmentName', scheduled_date: '$scheduledStart', start_time: { $dateToString: { date: '$scheduledStart', format: '%H:%M' } }, status: 1,
      } }]),
      ProcedureBookingModel.countDocuments(match),
    ]);
    return pageResult(rows as ProcedureScheduleRow[], total, page, limit);
  }

  async ipConversions(query: PhaseTwoReportQuery): Promise<ReportPage<IpConversionRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    const match: Record<string, unknown> = {
      branchId: oid(query.branch_id), sourceType: { $in: ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'PROCEDURE_BOOKING'] }, ...dateFilter(query, 'admissionDate'),
    };
    if (query.department_id) match.departmentId = oid(query.department_id);
    if (query.doctor_id) match.admittingDoctorId = oid(query.doctor_id);
    if (query.status) match.status = query.status;
    if (query.source_type && ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'PROCEDURE_BOOKING'].includes(query.source_type)) match.sourceType = query.source_type;
    const [rows, total] = await Promise.all([
      InpatientAdmissionModel.aggregate([{ $match: match }, { $lookup: { from: 'admissionrequests', localField: 'requestId', foreignField: '_id', as: 'request' } },
        { $sort: { admissionDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: {
          _id: 0, id: { $toString: '$_id' }, admission_number: '$admissionNumber', patient_number: '$patientNumber', patient_name: '$patientName',
          source_type: '$sourceType', source_id: { $toString: '$sourceId' }, source_reference: { $ifNull: [{ $arrayElemAt: ['$request.sourceReference', 0] }, null] },
          admission_date: '$admissionDate', status: 1,
        } }]),
      InpatientAdmissionModel.countDocuments(match),
    ]);
    return pageResult(rows as IpConversionRow[], total, page, limit);
  }

  async advancePayments(query: PhaseTwoReportQuery, allowed: boolean): Promise<ReportPage<AdvancePaymentRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    if (!allowed) return pageResult([], 0, page, limit);
    const match: Record<string, unknown> = {
      branchId: oid(query.branch_id), contextType: { $in: ['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'] }, contextId: { $type: 'objectId' },
      deletedAt: null, ...dateFilter(query, 'invoiceDate'),
    };
    if (query.status) match.status = query.status;
    const stages: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' } },
      { $lookup: { from: 'admissionrequests', localField: 'contextId', foreignField: '_id', as: 'admissionRequest' } },
      { $lookup: { from: 'procedurebookings', localField: 'contextId', foreignField: '_id', as: 'procedureBooking' } },
      { $sort: { invoiceDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: {
        _id: 0, id: { $toString: '$_id' }, invoice_number: '$invoiceNumber',
        patient_number: { $ifNull: [{ $arrayElemAt: ['$patient.patientNumber', 0] }, null] },
        patient_name: { $trim: { input: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$patient.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$patient.lastName', 0] }, ''] }] } } },
        context_type: '$contextType', context_id: { $toString: '$contextId' }, invoice_date: '$invoiceDate', status: 1,
        total_amount: '$totalAmount', paid_amount: '$paidAmount', balance_amount: '$balanceAmount',
        consumption_status: { $switch: { branches: [
          { case: { $eq: ['$status', 'CANCELLED'] }, then: 'CANCELLED' },
          { case: { $eq: [{ $arrayElemAt: ['$admissionRequest.status', 0] }, 'CONFIRMED'] }, then: 'CONSUMED' },
          { case: { $in: [{ $arrayElemAt: ['$procedureBooking.status', 0] }, ['BOOKED', 'COMPLETED']] }, then: 'CONSUMED' },
          { case: { $gte: ['$paidAmount', '$totalAmount'] }, then: 'RECEIVED' },
          { case: { $gt: ['$paidAmount', 0] }, then: 'PARTIALLY_RECEIVED' },
        ], default: 'PENDING' } },
      } },
    ];
    const [rows, total] = await Promise.all([BillingInvoiceModel.aggregate(stages), BillingInvoiceModel.countDocuments(match)]);
    return pageResult(rows as AdvancePaymentRow[], total, page, limit);
  }

  async paymentStatus(query: PhaseTwoReportQuery, allowed: boolean): Promise<ReportPage<PaymentStatusRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25;
    if (!allowed) return pageResult([], 0, page, limit);
    const match: Record<string, unknown> = { branchId: oid(query.branch_id), deletedAt: null, ...dateFilter(query, 'invoiceDate') };
    if (query.status) match.status = query.status;
    if (query.source_type && ['OPD', 'EMERGENCY', 'PROCEDURE'].includes(query.source_type)) match.sourceType = query.source_type;
    const stages: PipelineStage[] = [
      { $match: match }, { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' } },
      { $lookup: { from: 'billing_invoice_items', localField: '_id', foreignField: 'invoiceId', as: 'items' } },
      { $lookup: { from: 'services', localField: 'items.serviceId', foreignField: '_id', as: 'services' } },
      { $lookup: { from: 'departments', localField: 'services.departmentId', foreignField: '_id', as: 'departments' } },
      { $sort: { invoiceDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: {
        _id: 0, id: { $toString: '$_id' }, invoice_number: '$invoiceNumber',
        patient_number: { $ifNull: [{ $arrayElemAt: ['$patient.patientNumber', 0] }, null] },
        patient_name: { $trim: { input: { $concat: [{ $ifNull: [{ $arrayElemAt: ['$patient.firstName', 0] }, ''] }, ' ', { $ifNull: [{ $arrayElemAt: ['$patient.lastName', 0] }, ''] }] } } },
        source_type: '$sourceType', encounter_id: { $toString: { $ifNull: ['$encounterId', '$visitId'] } },
        service_names: '$items.serviceName', department_names: '$departments.name', invoice_date: '$invoiceDate', status: 1,
        total_amount: '$totalAmount', paid_amount: '$paidAmount', balance_amount: '$balanceAmount',
      } },
    ];
    const [rows, total] = await Promise.all([BillingInvoiceModel.aggregate(stages), BillingInvoiceModel.countDocuments(match)]);
    return pageResult(rows as PaymentStatusRow[], total, page, limit);
  }

  async consentPending(query: PhaseTwoReportQuery): Promise<ReportPage<ConsentPendingRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25, branchId = oid(query.branch_id), now = new Date();
    const policy = await AdmissionPolicyModel.findOne({ branchId, status: 'ACTIVE' }).select('admissionConsentRequired').lean();
    const validConsentLookup = (contextType: 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING'): PipelineStage => ({ $lookup: {
      from: PatientDocumentModel.collection.name, let: { contextId: '$_id', patientId: '$patientId' }, pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ['$contextType', contextType] }, { $eq: ['$contextId', '$$contextId'] }, { $eq: ['$patientId', '$$patientId'] },
          { $eq: ['$documentType', 'CONSENT'] }, { $eq: ['$consentStatus', 'SIGNED'] }, { $eq: ['$status', 'ACTIVE'] },
          { $lte: ['$signedAt', now] }, { $or: [{ $eq: ['$validUntil', null] }, { $gte: ['$validUntil', now] }] },
        ] } } }, { $limit: 1 },
      ], as: 'validConsent',
    } });
    const admissionPipeline: PipelineStage[] = policy?.admissionConsentRequired ? [
      { $match: { branchId, status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] }, ...dateFilter(query, 'createdAt') } },
      validConsentLookup('INPATIENT_ADMISSION'), { $match: { validConsent: { $size: 0 } } }, { $project: {
        _id: 0, id: { $concat: [{ $toString: '$_id' }, ':ADMISSION'] }, context_type: { $literal: 'ADMISSION' }, context_id: { $toString: '$_id' },
        patient_number: '$patientNumber', patient_name: '$patientName', template_name: { $literal: 'Admission consent' },
        category: { $literal: 'Admission' }, consent_status: { $literal: 'PENDING' }, required_at: '$createdAt',
      } },
    ] : [];
    const procedurePipeline: PipelineStage[] = [
      { $match: { branchId, status: 'PENDING_CONFIRMATION', ...dateFilter(query, 'scheduledStart') } },
      { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } }, { $match: { 'service.requiresConsent': true } },
      validConsentLookup('PROCEDURE_BOOKING'), { $match: { validConsent: { $size: 0 } } }, { $project: {
        _id: 0, id: { $concat: [{ $toString: '$_id' }, ':PROCEDURE'] }, context_type: { $literal: 'PROCEDURE' }, context_id: { $toString: '$_id' },
        patient_number: '$patientNumber', patient_name: '$patientName', template_name: { $literal: 'Procedure consent' },
        category: { $literal: 'Procedure' }, consent_status: { $literal: 'PENDING' }, required_at: '$scheduledStart',
      } },
    ];
    const unionPipeline: PipelineStage[] = [
      ...admissionPipeline,
      {
        $unionWith: {
          coll: 'procedurebookings',
          pipeline: procedurePipeline as any,
        },
      } as unknown as PipelineStage,
    ];

    const [rows, totalCount] = await Promise.all([
      admissionPipeline.length
        ? AdmissionRequestModel.aggregate([
            ...unionPipeline,
            { $sort: { required_at: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ])
        : ProcedureBookingModel.aggregate([
            ...procedurePipeline,
            { $sort: { required_at: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ]),
      admissionPipeline.length
        ? AdmissionRequestModel.aggregate([...unionPipeline, { $count: 'total' }])
        : ProcedureBookingModel.aggregate([...procedurePipeline, { $count: 'total' }]),
    ]);

    const total = Number(totalCount[0]?.total ?? 0);
    return pageResult(rows as ConsentPendingRow[], total, page, limit);
  }

  async departmentPending(query: PhaseTwoReportQuery): Promise<ReportPage<DepartmentPendingRow>> {
    const page = query.page ?? 1, limit = query.limit ?? 25, requestedSource = operationalSource(query.source_type);
    const supportedSources = ['EMERGENCY_ENCOUNTER'];
    const sources = requestedSource && supportedSources.includes(requestedSource) ? [requestedSource] : supportedSources;
    const pendingStatuses = ['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'REPORT_ENTERED'];
    const orderMatch: Record<string, unknown> = { branchId: oid(query.branch_id), sourceType: { $in: sources }, status: query.status ?? { $in: pendingStatuses }, deletedAt: null, ...dateFilter(query, 'submittedAt') };
    const prescriptionMatch: Record<string, unknown> = { branchId: oid(query.branch_id), sourceType: { $in: sources }, status: query.status ?? 'SUBMITTED', deletedAt: null, ...dateFilter(query, 'submittedAt') };
    const orderPipeline: PipelineStage[] = [{ $match: orderMatch }, { $project: {
      _id: 0, id: { $toString: '$_id' }, department: '$orderType', source_type: '$sourceType', patient_number: '$patientNumber', patient_name: '$patientName',
      request_date: { $ifNull: ['$submittedAt', '$createdAt'] }, status: 1, encounter_id: { $toString: '$sourceId' }, admission_id: { $literal: null }, procedure_id: { $literal: null },
    } }];
    const prescriptionPipeline: PipelineStage[] = [{ $match: prescriptionMatch }, { $project: {
      _id: 0, id: { $toString: '$_id' }, department: { $literal: 'PHARMACY' }, source_type: '$sourceType', patient_number: '$patientNumber', patient_name: '$patientName',
      request_date: '$submittedAt', status: 1, encounter_id: { $toString: '$sourceId' }, admission_id: { $literal: null }, procedure_id: { $literal: null },
    } }];

    const unionPipeline: PipelineStage[] = [
      ...orderPipeline,
      {
        $unionWith: {
          coll: 'opdprescriptions',
          pipeline: prescriptionPipeline as any,
        },
      } as unknown as PipelineStage,
    ];

    const [rows, totalCount] = await Promise.all([
      OpdClinicalOrderModel.aggregate([
        ...unionPipeline,
        { $sort: { request_date: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      OpdClinicalOrderModel.aggregate([...unionPipeline, { $count: 'total' }]),
    ]);

    const total = Number(totalCount[0]?.total ?? 0);
    return pageResult(rows as DepartmentPendingRow[], total, page, limit);
  }

  async bundle(query: PhaseTwoReportQuery, financialAccess: boolean): Promise<PhaseTwoReportBundle> {
    const pendingOrderMatch = {
      branchId: oid(query.branch_id), sourceType: 'EMERGENCY_ENCOUNTER' as const, status: { $in: ['SUBMITTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] as const },
      deletedAt: null, ...dateFilter(query, 'submittedAt'),
    };
    const pendingPrescriptionMatch = {
      branchId: oid(query.branch_id), sourceType: 'EMERGENCY_ENCOUNTER' as const, status: 'SUBMITTED' as const, deletedAt: null,
      ...dateFilter(query, 'submittedAt'),
    };
    const [beds, emergencies, procedures, conversions, advances, payments, consents, pending, bedStatuses, paymentSummary, advanceSummary, pendingPharmacy, pendingLaboratory, pendingImaging] = await Promise.all([
      this.bedOccupancy(query), this.emergencyRegister(query), this.procedureSchedule(query), this.ipConversions(query),
      this.advancePayments(query, financialAccess), this.paymentStatus(query, financialAccess), this.consentPending(query), this.departmentPending(query),
      BedModel.aggregate<{ _id: string; count: number }>([{ $match: { branchId: oid(query.branch_id), ...(query.ward_id ? { wardId: oid(query.ward_id) } : {}) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      financialAccess ? BillingInvoiceModel.aggregate<{ balance: number }>([{ $match: { branchId: oid(query.branch_id), deletedAt: null, status: { $in: ['DRAFT', 'PENDING', 'PARTIALLY_PAID'] }, ...dateFilter(query, 'invoiceDate') } }, { $group: { _id: null, balance: { $sum: '$balanceAmount' } } }]) : Promise.resolve([]),
      financialAccess ? BillingInvoiceModel.aggregate<{ received: number }>([{ $match: { branchId: oid(query.branch_id), contextType: { $in: ['ADMISSION_REQUEST', 'PROCEDURE_BOOKING'] }, deletedAt: null, status: { $ne: 'CANCELLED' }, ...dateFilter(query, 'invoiceDate') } }, { $group: { _id: null, received: { $sum: '$paidAmount' } } }]) : Promise.resolve([]),
      OpdPrescriptionModel.countDocuments(pendingPrescriptionMatch),
      OpdClinicalOrderModel.countDocuments({ ...pendingOrderMatch, orderType: 'LABORATORY' }),
      OpdClinicalOrderModel.countDocuments({ ...pendingOrderMatch, orderType: 'IMAGING' }),
    ]);
    const bedCount = (status: string) => bedStatuses.find((row) => row._id === status)?.count ?? 0;
    return {
      generated_at: new Date(), financial_access: financialAccess,
      dashboard: {
        emergency_volume: emergencies.meta.total, procedures_scheduled: procedures.meta.total, ip_conversions: conversions.meta.total,
        beds_total: beds.meta.total, beds_available: bedCount('AVAILABLE'), beds_occupied: bedCount('OCCUPIED'),
        beds_unavailable: beds.meta.total - bedCount('AVAILABLE') - bedCount('OCCUPIED'),
        pending_payment_amount: financialAccess ? paymentSummary[0]?.balance ?? 0 : null,
        advance_received_amount: financialAccess ? advanceSummary[0]?.received ?? 0 : null,
        pending_pharmacy: pendingPharmacy, pending_laboratory: pendingLaboratory, pending_imaging: pendingImaging,
      },
      bed_occupancy: beds, emergency_register: emergencies, procedure_schedule: procedures, ip_conversions: conversions,
      advance_payments: advances, payment_status: payments, consent_pending: consents, department_pending: pending,
    };
  }
}
