import mongoose, { Schema, Types } from 'mongoose';
import type { ClinicalContextSourceType } from './clinical-context.types.js';
import type {
  ClinicalOrderPriority,
  ClinicalOrderStatus,
  ClinicalOrderType,
} from './opd-clinical-order.types.js';

export type ClinicalOrderItemFields = {
  _id: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceName: string;
  investigationName: string;
  category: string;
};

export type OpdClinicalOrderFields = {
  sourceType: ClinicalContextSourceType;
  sourceId: Types.ObjectId;
  encounterId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;
  visitId?: Types.ObjectId | null;
  consultationId?: Types.ObjectId | null;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  branchId: Types.ObjectId;
  orderType: ClinicalOrderType;
  status: ClinicalOrderStatus;
  priority: ClinicalOrderPriority;
  destination?: string | null;
  specimenType?: string | null;
  items: ClinicalOrderItemFields[];
  clinicalNotes?: string | null;
  instructions?: string | null;
  submittedAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const clinicalOrderItemSchema = new Schema<ClinicalOrderItemFields>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true, trim: true },
    investigationName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const opdClinicalOrderSchema = new Schema<OpdClinicalOrderFields>(
  {
    sourceType: {
      type: String,
      enum: ['OPD_VISIT', 'EMERGENCY_ENCOUNTER', 'INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'],
      default: 'OPD_VISIT',
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    encounterId: { type: Schema.Types.ObjectId, default: null },
    admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
    procedureId: { type: Schema.Types.ObjectId, ref: 'ProcedureBooking', default: null },
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit' },
    consultationId: { type: Schema.Types.ObjectId, ref: 'OpdConsultation', default: null },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    doctorName: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    orderType: { type: String, enum: ['LABORATORY', 'IMAGING'], required: true },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'RECEIVED',
        'SAMPLE_COLLECTED',
        'IN_PROGRESS',
        'RESULT_ENTERED',
        'REPORT_ENTERED',
        'VERIFIED',
        'COMPLETED',
      ],
      default: 'DRAFT',
      required: true,
    },
    priority: {
      type: String,
      enum: ['ROUTINE', 'URGENT', 'STAT'],
      default: 'ROUTINE',
      required: true,
    },
    destination: { type: String, default: null },
    specimenType: { type: String, default: null },
    items: { type: [clinicalOrderItemSchema], default: [] },
    clinicalNotes: { type: String, default: null },
    instructions: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdClinicalOrderSchema.index(
  { visitId: 1, orderType: 1 },
  {
    name: 'visitId_orderType_unique_objectId',
    unique: true,
    partialFilterExpression: { visitId: { $type: 'objectId' } },
  },
);
opdClinicalOrderSchema.index(
  { sourceType: 1, sourceId: 1, orderType: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' } } },
);
opdClinicalOrderSchema.index({ patientId: 1, orderType: 1, createdAt: -1 });
opdClinicalOrderSchema.index({ doctorId: 1, orderType: 1, createdAt: -1 });
opdClinicalOrderSchema.index({ orderType: 1, status: 1, priority: 1, submittedAt: -1 });
opdClinicalOrderSchema.index({ branchId: 1, orderType: 1, status: 1, submittedAt: -1 });
opdClinicalOrderSchema.index({ admissionId: 1, orderType: 1, status: 1, submittedAt: -1 });
opdClinicalOrderSchema.index({ procedureId: 1, orderType: 1, status: 1, submittedAt: -1 });

export const OpdClinicalOrderModel = mongoose.model<OpdClinicalOrderFields>(
  'OpdClinicalOrder',
  opdClinicalOrderSchema,
);
