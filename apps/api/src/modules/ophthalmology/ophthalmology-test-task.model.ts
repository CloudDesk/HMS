import mongoose, { Schema, Types } from 'mongoose';
import type {
  OphthalmologyLaterality,
  OphthalmologyTestTaskPriority,
  OphthalmologyTestTaskSourceType,
  OphthalmologyTestTaskStatus,
  OphthalmologyTaskRoutingTarget,
} from './ophthalmology.types.js';

export type OphthalmologyTestTaskFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  testCatalogueVersionId: Types.ObjectId; workflowProfileVersionId: Types.ObjectId; workflowStageCode?: string | null;
  testCode: string; testName: string; laterality: Exclude<OphthalmologyLaterality, 'NOT_SPECIFIED'>;
  priority: OphthalmologyTestTaskPriority; sourceType: OphthalmologyTestTaskSourceType;
  sourceOrderId?: Types.ObjectId | null; sourceOrderItemId?: Types.ObjectId | null; sourceOrderType?: 'LABORATORY' | 'IMAGING' | null;
  status: OphthalmologyTestTaskStatus; stationId?: Types.ObjectId | null; assignedUserId?: Types.ObjectId | null;
  deviceCode?: string | null; specialInstructions?: string | null; doctorReviewRequired: boolean;
  repeatOfTaskId?: Types.ObjectId | null; repeatTaskId?: Types.ObjectId | null; repeatRootTaskId?: Types.ObjectId | null;
  idempotencyKey: string; requestFingerprint: string;
  assignmentHistory: Array<{ action: 'ASSIGNED' | 'REASSIGNED'; fromStationId?: Types.ObjectId | null; toStationId: Types.ObjectId;
    fromUserId?: Types.ObjectId | null; toUserId?: Types.ObjectId | null; reason?: string | null; actorUserId: Types.ObjectId; occurredAt: Date }>;
  transitionHistory: Array<{ action: 'CALLED' | 'PATIENT_UNAVAILABLE' | 'STARTED' | 'DRAFT_SAVED' | 'COMPLETED' | 'AMENDED' | 'UNABLE_TO_PERFORM' | 'CANCELLED' | 'REPEAT_REQUESTED' | 'REVIEWED';
    fromStatus: OphthalmologyTestTaskStatus; toStatus: OphthalmologyTestTaskStatus; reason?: string | null;
    actorUserId: Types.ObjectId; occurredAt: Date }>;
  routingHistory: Array<{ target: OphthalmologyTaskRoutingTarget; targetTaskId?: Types.ObjectId | null; targetStationId?: Types.ObjectId | null;
    reason?: string | null; actorUserId: Types.ObjectId; occurredAt: Date }>;
  orderedAt: Date; assignedAt?: Date | null; waitingSince?: Date | null; calledAt?: Date | null; startedAt?: Date | null;
  completedAt?: Date | null; unableAt?: Date | null; cancelledAt?: Date | null; reviewedBy?: Types.ObjectId | null; reviewedAt?: Date | null;
  reviewedClinicalVersion?: number | null; reviewComment?: string | null; version: number; createdBy: Types.ObjectId; updatedBy: Types.ObjectId;
  createdAt: Date; updatedAt: Date;
};

const assignmentSchema = new Schema({
  action: { type: String, enum: ['ASSIGNED', 'REASSIGNED'], required: true },
  fromStationId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyStation', default: null },
  toStationId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyStation', required: true },
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, toUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, default: null, trim: true }, actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  occurredAt: { type: Date, required: true },
}, { _id: false });
const transitionSchema = new Schema({
  action: { type: String, enum: ['CALLED', 'PATIENT_UNAVAILABLE', 'STARTED', 'DRAFT_SAVED', 'COMPLETED', 'AMENDED', 'UNABLE_TO_PERFORM', 'CANCELLED', 'REPEAT_REQUESTED', 'REVIEWED'], required: true },
  fromStatus: { type: String, required: true }, toStatus: { type: String, required: true }, reason: { type: String, default: null, trim: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, occurredAt: { type: Date, required: true },
}, { _id: false });
const routingSchema = new Schema({
  target: { type: String, enum: ['NEXT_STATION', 'OPHTHALMOLOGIST'], required: true },
  targetTaskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', default: null },
  targetStationId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyStation', default: null }, reason: { type: String, default: null, trim: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, occurredAt: { type: Date, required: true },
}, { _id: false });

const statuses = ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'IN_PROGRESS', 'DRAFT', 'COMPLETED', 'SUBMITTED_FOR_REVIEW',
  'REVIEWED', 'REPEAT_REQUIRED', 'UNABLE_TO_PERFORM', 'CANCELLED'] as const;
const testTaskSchema = new Schema<OphthalmologyTestTaskFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  testCatalogueVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyConfiguration', required: true },
  workflowProfileVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyWorkflowProfile', required: true },
  workflowStageCode: { type: String, default: null, trim: true, uppercase: true }, testCode: { type: String, required: true, trim: true, uppercase: true },
  testName: { type: String, required: true, trim: true }, laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  priority: { type: String, enum: ['ROUTINE', 'PRIORITY', 'EMERGENCY'], required: true },
  sourceType: { type: String, enum: ['WORKFLOW', 'CLINICAL_ORDER_ITEM'], required: true },
  sourceOrderId: { type: Schema.Types.ObjectId, ref: 'OpdClinicalOrder', default: null }, sourceOrderItemId: { type: Schema.Types.ObjectId, default: null },
  sourceOrderType: { type: String, enum: ['LABORATORY', 'IMAGING', null], default: null }, status: { type: String, enum: statuses, default: 'ORDERED', required: true },
  stationId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyStation', default: null }, assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deviceCode: { type: String, default: null, trim: true, uppercase: true }, specialInstructions: { type: String, default: null, trim: true },
  doctorReviewRequired: { type: Boolean, default: false, required: true }, repeatOfTaskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', default: null },
  repeatTaskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', default: null }, repeatRootTaskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', default: null },
  idempotencyKey: { type: String, required: true, trim: true }, requestFingerprint: { type: String, required: true },
  assignmentHistory: { type: [assignmentSchema], default: [] }, transitionHistory: { type: [transitionSchema], default: [] },
  routingHistory: { type: [routingSchema], default: [] }, orderedAt: { type: Date, required: true }, assignedAt: { type: Date, default: null },
  waitingSince: { type: Date, default: null }, calledAt: { type: Date, default: null }, startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }, unableAt: { type: Date, default: null }, cancelledAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, reviewedAt: { type: Date, default: null },
  reviewedClinicalVersion: { type: Number, default: null }, reviewComment: { type: String, default: null, trim: true },
  version: { type: Number, default: 0, min: 0, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

testTaskSchema.index({ contextId: 1, idempotencyKey: 1 }, { unique: true });
testTaskSchema.index({ repeatOfTaskId: 1 }, { unique: true, partialFilterExpression: { repeatOfTaskId: { $type: 'objectId' } } });
testTaskSchema.index({ branchId: 1, stationId: 1, status: 1, priority: 1, waitingSince: 1 });
testTaskSchema.index({ assignedUserId: 1, status: 1, updatedAt: -1 });
testTaskSchema.index({ contextId: 1, testCode: 1, status: 1 });
testTaskSchema.index({ doctorReviewRequired: 1, branchId: 1, updatedAt: -1 });
testTaskSchema.index({ sourceOrderId: 1, sourceOrderItemId: 1 });
testTaskSchema.index({ repeatRootTaskId: 1, createdAt: 1 });

export const OphthalmologyTestTaskModel = mongoose.model<OphthalmologyTestTaskFields>('OphthalmologyTestTask', testTaskSchema);
