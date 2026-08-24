import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { BedModel } from '../admissions-configuration/admissions-configuration.model.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { ConsentTemplateModel } from '../consents/consent.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type {
  BedOccupancyRow,
  ConsentPendingRow,
  DepartmentPendingRow,
  EmergencyRegisterRow,
  PaymentStatusRow,
  PhaseTwoReportBundle,
  PhaseTwoReportQuery,
  ProcedureScheduleRow,
  ReportPage,
} from './phase-two-report.types.js';

const oid = (value: string) => new Types.ObjectId(value);
const meta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit) || 1,
});
const dateFilter = (query: PhaseTwoReportQuery, field: string) =>
  query.date_from || query.date_to
    ? {
        [field]: {
          ...(query.date_from ? { $gte: new Date(`${query.date_from}T00:00:00.000Z`) } : {}),
          ...(query.date_to ? { $lte: new Date(`${query.date_to}T23:59:59.999Z`) } : {}),
        },
      }
    : {};
const pageResult = <T>(data: T[], total: number, page: number, limit: number): ReportPage<T> => ({
  data,
  meta: meta(total, page, limit),
});

export class PhaseTwoReportRepository {
  async authorizeBranch(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null })
        .select('branchIds roleIds')
        .lean(),
      BranchModel.exists({ _id: oid(branchId), status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch)
      throw new AppError('Branch not found or unavailable', 404, 'BRANCH_NOT_FOUND');
    const superAdmin = await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    });
    if (!superAdmin && !(user.branchIds ?? []).some((id) => id.toString() === branchId))
      throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
  }

  async bedOccupancy(query: PhaseTwoReportQuery): Promise<ReportPage<BedOccupancyRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const match: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.ward_id) match.wardId = oid(query.ward_id);
    if (query.status) match.status = query.status;
    const base: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } },
      {
        $set: {
          wardName: { $ifNull: [{ $arrayElemAt: ['$ward.name', 0] }, ''] },
          wardType: { $ifNull: [{ $arrayElemAt: ['$ward.wardType', 0] }, ''] },
        },
      },
    ];
    const [rows, total] = await Promise.all([
      BedModel.aggregate([
        ...base,
        { $sort: { wardName: 1, roomNumber: 1, bedNumber: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            ward_id: { $toString: '$wardId' },
            ward_name: '$wardName',
            ward_type: '$wardType',
            room_number: { $ifNull: ['$roomNumber', null] },
            bed_number: '$bedNumber',
            bed_type: { $ifNull: ['$bedType', '$bedCategory'] },
            charge_category: { $ifNull: ['$chargeCategory', '$bedCategory'] },
            status: 1,
          },
        },
      ]),
      BedModel.countDocuments(match),
    ]);
    return pageResult(rows as BedOccupancyRow[], total, page, limit);
  }

  async emergencyRegister(query: PhaseTwoReportQuery): Promise<ReportPage<EmergencyRegisterRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const match: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      visitType: 'EMERGENCY',
      deletedAt: null,
      ...dateFilter(query, 'visitDate'),
    };
    if (query.department_id) match.departmentId = oid(query.department_id);
    if (query.doctor_id) match.doctorId = oid(query.doctor_id);
    if (query.status) match.status = query.status;
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      {
        $lookup: {
          from: 'opdclinicalorders',
          let: { visitId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$visitId', '$$visitId'] } } },
            { $group: { _id: '$orderType', count: { $sum: 1 } } },
          ],
          as: 'orders',
        },
      },
      {
        $lookup: {
          from: 'opdprescriptions',
          localField: '_id',
          foreignField: 'visitId',
          as: 'prescriptions',
        },
      },
      { $sort: { visitDate: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          visit_number: '$visitNumber',
          patient_number: '$patientNumber',
          patient_name: '$patientName',
          doctor_name: '$doctorName',
          department_name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, ''] },
          visit_date: '$visitDate',
          priority: 1,
          status: 1,
          laboratory_orders: {
            $ifNull: [
              {
                $getField: {
                  field: 'count',
                  input: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$orders',
                          as: 'item',
                          cond: { $eq: ['$$item._id', 'LABORATORY'] },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
              0,
            ],
          },
          imaging_orders: {
            $ifNull: [
              {
                $getField: {
                  field: 'count',
                  input: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$orders',
                          as: 'item',
                          cond: { $eq: ['$$item._id', 'IMAGING'] },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
              0,
            ],
          },
          pharmacy_requests: { $size: '$prescriptions' },
          conversion_outcome: { $literal: null },
        },
      },
    ];
    const [rows, total] = await Promise.all([
      OpdVisitModel.aggregate(pipeline),
      OpdVisitModel.countDocuments(match),
    ]);
    return pageResult(rows as EmergencyRegisterRow[], total, page, limit);
  }

  async procedureSchedule(query: PhaseTwoReportQuery): Promise<ReportPage<ProcedureScheduleRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const match: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      visitType: 'PROCEDURE',
      deletedAt: null,
      ...dateFilter(query, 'appointmentDate'),
    };
    if (query.department_id) match.departmentId = oid(query.department_id);
    if (query.doctor_id) match.doctorId = oid(query.doctor_id);
    if (query.status) match.status = query.status;
    const [rows, total] = await Promise.all([
      AppointmentModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $sort: { appointmentDate: 1, startTime: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            booking_number: '$appointmentNumber',
            patient_number: '$patientNumber',
            patient_name: '$patientName',
            doctor_id: { $toString: '$doctorId' },
            doctor_name: '$doctorName',
            department_id: { $toString: '$departmentId' },
            department_name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, ''] },
            scheduled_date: '$appointmentDate',
            start_time: '$startTime',
            status: 1,
          },
        },
      ]),
      AppointmentModel.countDocuments(match),
    ]);
    return pageResult(rows as ProcedureScheduleRow[], total, page, limit);
  }

  async paymentStatus(
    query: PhaseTwoReportQuery,
    allowed: boolean,
  ): Promise<ReportPage<PaymentStatusRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    if (!allowed) return pageResult([], 0, page, limit);
    const match: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      deletedAt: null,
      ...dateFilter(query, 'invoiceDate'),
    };
    if (query.status) match.status = query.status;
    if (query.source_type) match.sourceType = query.source_type;
    const stages: PipelineStage[] = [
      { $match: match },
      {
        $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' },
      },
      {
        $lookup: {
          from: 'billing_invoice_items',
          localField: '_id',
          foreignField: 'invoiceId',
          as: 'items',
        },
      },
      {
        $lookup: {
          from: 'services',
          localField: 'items.serviceId',
          foreignField: '_id',
          as: 'services',
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'services.departmentId',
          foreignField: '_id',
          as: 'departments',
        },
      },
      { $sort: { invoiceDate: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          invoice_number: '$invoiceNumber',
          patient_number: { $ifNull: [{ $arrayElemAt: ['$patient.patientNumber', 0] }, null] },
          patient_name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: [{ $arrayElemAt: ['$patient.firstName', 0] }, ''] },
                  ' ',
                  { $ifNull: [{ $arrayElemAt: ['$patient.lastName', 0] }, ''] },
                ],
              },
            },
          },
          source_type: '$sourceType',
          encounter_id: { $toString: { $ifNull: ['$encounterId', '$visitId'] } },
          service_names: '$items.serviceName',
          department_names: '$departments.name',
          invoice_date: '$invoiceDate',
          status: 1,
          total_amount: '$totalAmount',
          paid_amount: '$paidAmount',
          balance_amount: '$balanceAmount',
        },
      },
    ];
    const [rows, total] = await Promise.all([
      BillingInvoiceModel.aggregate(stages),
      BillingInvoiceModel.countDocuments(match),
    ]);
    return pageResult(rows as PaymentStatusRow[], total, page, limit);
  }

  async consentPending(query: PhaseTwoReportQuery): Promise<ReportPage<ConsentPendingRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const branch = oid(query.branch_id);
    const admission = [
      {
        $match: {
          branchId: branch,
          status: { $in: ['DRAFT', 'ADMITTED'] },
          ...dateFilter(query, 'admissionDate'),
        },
      },
      {
        $lookup: {
          from: 'consenttemplates',
          let: { branchId: '$branchId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$branchId', '$$branchId'] },
                    { $eq: ['$contextType', 'ADMISSION'] },
                    { $eq: ['$mandatory', true] },
                    { $eq: ['$status', 'ACTIVE'] },
                  ],
                },
              },
            },
          ],
          as: 'template',
        },
      },
      { $unwind: '$template' },
      {
        $lookup: {
          from: 'patientdocuments',
          let: { contextId: '$_id', templateId: '$template._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$admissionId', '$$contextId'] },
                    { $eq: ['$consentTemplateId', '$$templateId'] },
                    { $eq: ['$status', 'ACTIVE'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'document',
        },
      },
      { $set: { consent: { $arrayElemAt: ['$document', 0] } } },
      { $match: { 'consent.consentStatus': { $ne: 'VERIFIED' } } },
      {
        $project: {
          _id: 0,
          id: { $concat: [{ $toString: '$_id' }, ':', { $toString: '$template._id' }] },
          context_type: { $literal: 'ADMISSION' },
          context_id: { $toString: '$_id' },
          patient_number: '$patientNumber',
          patient_name: '$patientName',
          template_name: '$template.name',
          category: '$template.category',
          consent_status: { $ifNull: ['$consent.consentStatus', 'PENDING'] },
          required_at: '$admissionDate',
        },
      },
    ];
    const procedure = [
      {
        $match: {
          branchId: branch,
          visitType: 'PROCEDURE',
          status: { $nin: ['CANCELLED', 'COMPLETED'] },
          ...dateFilter(query, 'appointmentDate'),
        },
      },
      {
        $lookup: {
          from: 'consenttemplates',
          let: { branchId: '$branchId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$branchId', '$$branchId'] },
                    { $eq: ['$contextType', 'PROCEDURE'] },
                    { $eq: ['$mandatory', true] },
                    { $eq: ['$status', 'ACTIVE'] },
                  ],
                },
              },
            },
          ],
          as: 'template',
        },
      },
      { $unwind: '$template' },
      {
        $lookup: {
          from: 'patientdocuments',
          let: { contextId: '$_id', templateId: '$template._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$procedureId', '$$contextId'] },
                    { $eq: ['$consentTemplateId', '$$templateId'] },
                    { $eq: ['$status', 'ACTIVE'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'document',
        },
      },
      { $set: { consent: { $arrayElemAt: ['$document', 0] } } },
      { $match: { 'consent.consentStatus': { $ne: 'VERIFIED' } } },
      {
        $project: {
          _id: 0,
          id: { $concat: [{ $toString: '$_id' }, ':', { $toString: '$template._id' }] },
          context_type: { $literal: 'PROCEDURE' },
          context_id: { $toString: '$_id' },
          patient_number: '$patientNumber',
          patient_name: '$patientName',
          template_name: '$template.name',
          category: '$template.category',
          consent_status: { $ifNull: ['$consent.consentStatus', 'PENDING'] },
          required_at: '$appointmentDate',
        },
      },
    ];
    const combined = [
      ...admission,
      { $unionWith: { coll: 'appointments', pipeline: procedure } },
      { $sort: { required_at: -1 } },
    ];
    const [rows, countRows] = await Promise.all([
      ConsentTemplateModel.db
        .collection('inpatientadmissions')
        .aggregate([...combined, { $skip: (page - 1) * limit }, { $limit: limit }])
        .toArray(),
      ConsentTemplateModel.db
        .collection('inpatientadmissions')
        .aggregate([...combined, { $count: 'total' }])
        .toArray(),
    ]);
    return pageResult(rows as ConsentPendingRow[], Number(countRows[0]?.total ?? 0), page, limit);
  }

  async departmentPending(query: PhaseTwoReportQuery): Promise<ReportPage<DepartmentPendingRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const sources = query.source_type
      ? [query.source_type]
      : ['EMERGENCY', 'IP_ADMISSION', 'PROCEDURE', 'SURGERY'];
    const orderMatch: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      sourceType: { $in: sources },
      status: {
        $in: [
          'SUBMITTED',
          'RECEIVED',
          'SAMPLE_COLLECTED',
          'IN_PROGRESS',
          'RESULT_ENTERED',
          'REPORT_ENTERED',
        ],
      },
      deletedAt: null,
      ...dateFilter(query, 'submittedAt'),
    };
    if (query.status) orderMatch.status = query.status;
    const prescriptionPipeline: PipelineStage[] = [
      { $match: { status: 'SUBMITTED', deletedAt: null, ...dateFilter(query, 'submittedAt') } },
      { $lookup: { from: 'opdvisits', localField: 'visitId', foreignField: '_id', as: 'visit' } },
      { $set: { visit: { $arrayElemAt: ['$visit', 0] } } },
      { $match: { 'visit.branchId': oid(query.branch_id), 'visit.visitType': { $in: sources } } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          department: { $literal: 'PHARMACY' },
          source_type: '$visit.visitType',
          patient_number: '$patientNumber',
          patient_name: '$patientName',
          request_date: '$submittedAt',
          status: 1,
          encounter_id: { $toString: '$visitId' },
          admission_id: { $literal: null },
          procedure_id: {
            $cond: [{ $eq: ['$visit.visitType', 'PROCEDURE'] }, { $toString: '$visitId' }, null],
          },
        },
      },
    ];
    const orderPipeline: PipelineStage[] = [
      { $match: orderMatch },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          department: '$orderType',
          source_type: '$sourceType',
          patient_number: '$patientNumber',
          patient_name: '$patientName',
          request_date: { $ifNull: ['$submittedAt', '$createdAt'] },
          status: 1,
          encounter_id: {
            $convert: { input: '$encounterId', to: 'string', onNull: null, onError: null },
          },
          admission_id: {
            $convert: { input: '$admissionId', to: 'string', onNull: null, onError: null },
          },
          procedure_id: {
            $convert: { input: '$procedureId', to: 'string', onNull: null, onError: null },
          },
        },
      },
    ];
    const [orders, prescriptions, orderTotal, prescriptionCount] = await Promise.all([
      OpdClinicalOrderModel.aggregate([
        ...orderPipeline,
        { $sort: { request_date: -1 } },
        { $limit: page * limit },
      ]),
      OpdPrescriptionModel.aggregate([
        ...prescriptionPipeline,
        { $sort: { request_date: -1 } },
        { $limit: page * limit },
      ]),
      OpdClinicalOrderModel.countDocuments(orderMatch),
      OpdPrescriptionModel.aggregate([...prescriptionPipeline, { $count: 'total' }]),
    ]);
    const combined = [...orders, ...prescriptions]
      .sort(
        (a, b) =>
          new Date(b.request_date as Date).getTime() - new Date(a.request_date as Date).getTime(),
      )
      .slice((page - 1) * limit, page * limit) as DepartmentPendingRow[];
    return pageResult(combined, orderTotal + Number(prescriptionCount[0]?.total ?? 0), page, limit);
  }

  async bundle(
    query: PhaseTwoReportQuery,
    financialAccess: boolean,
  ): Promise<PhaseTwoReportBundle> {
    const [beds, emergencies, procedures, payments, consents, pending, bedStatuses, paymentSummary, orderStatuses, pharmacyPending] = await Promise.all([
      this.bedOccupancy(query),
      this.emergencyRegister(query),
      this.procedureSchedule(query),
      this.paymentStatus(query, financialAccess),
      this.consentPending(query),
      this.departmentPending(query),
      BedModel.aggregate<{ _id: string; count: number }>([{ $match: { branchId: oid(query.branch_id), ...(query.ward_id ? { wardId: oid(query.ward_id) } : {}) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      financialAccess ? BillingInvoiceModel.aggregate<{ balance: number }>([{ $match: { branchId: oid(query.branch_id), deletedAt: null, status: { $in: ['DRAFT', 'PENDING', 'PARTIALLY_PAID'] }, ...dateFilter(query, 'invoiceDate') } }, { $group: { _id: null, balance: { $sum: '$balanceAmount' } } }]) : Promise.resolve([]),
      OpdClinicalOrderModel.aggregate<{ _id: string; count: number }>([{ $match: { branchId: oid(query.branch_id), sourceType: { $in: ['EMERGENCY', 'IP_ADMISSION', 'PROCEDURE', 'SURGERY'] }, status: { $in: ['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'REPORT_ENTERED'] }, deletedAt: null, ...dateFilter(query, 'submittedAt') } }, { $group: { _id: '$orderType', count: { $sum: 1 } } }]),
      OpdPrescriptionModel.aggregate<{ total: number }>([{ $match: { status: 'SUBMITTED', deletedAt: null, ...dateFilter(query, 'submittedAt') } }, { $lookup: { from: 'opdvisits', localField: 'visitId', foreignField: '_id', as: 'visit' } }, { $set: { visit: { $arrayElemAt: ['$visit', 0] } } }, { $match: { 'visit.branchId': oid(query.branch_id), 'visit.visitType': { $in: ['EMERGENCY', 'PROCEDURE'] } } }, { $count: 'total' }]),
    ]);
    const bedCount = (status: string) => bedStatuses.find((row) => row._id === status)?.count ?? 0;
    const orderCount = (type: string) => orderStatuses.find((row) => row._id === type)?.count ?? 0;
    return {
      generated_at: new Date(),
      financial_access: financialAccess,
      dashboard: {
        emergency_volume: emergencies.meta.total,
        procedures_scheduled: procedures.meta.total,
        beds_total: beds.meta.total,
        beds_available: bedCount('AVAILABLE'),
        beds_occupied: bedCount('OCCUPIED'),
        beds_unavailable: beds.meta.total - bedCount('AVAILABLE') - bedCount('OCCUPIED'),
        pending_payment_amount: financialAccess ? paymentSummary[0]?.balance ?? 0 : null,
        pending_pharmacy: pharmacyPending[0]?.total ?? 0,
        pending_laboratory: orderCount('LABORATORY'),
        pending_imaging: orderCount('IMAGING'),
      },
      bed_occupancy: beds,
      emergency_register: emergencies,
      procedure_schedule: procedures,
      payment_status: payments,
      consent_pending: consents,
      department_pending: pending,
    };
  }
}
