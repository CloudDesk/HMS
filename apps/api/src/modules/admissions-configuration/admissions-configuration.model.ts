import mongoose, { Schema, Types } from 'mongoose';
import type { BedGenderRestriction, BedStatus, WardStatus } from './admissions-configuration.types.js';

export type WardFields = { branchId: Types.ObjectId; name: string; wardType: string; roomType?: string | null; floor: string; capacity?: number | null; description?: string | null; status: WardStatus; createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type BedFields = { branchId: Types.ObjectId; wardId: Types.ObjectId; bedNumber: string; bedCategory: string; bedType?: string; chargeCategory?: string; genderRestriction?: BedGenderRestriction; roomNumber?: string | null; status: BedStatus; createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date };

const audit = { createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } } as const;
const wardSchema = new Schema<WardFields>({ branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, name: { type: String, required: true, trim: true }, wardType: { type: String, required: true, trim: true }, roomType: { type: String, default: null, trim: true }, floor: { type: String, required: true, trim: true }, capacity: { type: Number, min: 1, default: null }, description: { type: String, default: null, trim: true }, status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }, ...audit }, { timestamps: true });
const bedSchema = new Schema<BedFields>({ branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, wardId: { type: Schema.Types.ObjectId, ref: 'HmsWard', required: true }, bedNumber: { type: String, required: true, trim: true, uppercase: true }, bedCategory: { type: String, required: true, trim: true }, bedType: { type: String, trim: true }, chargeCategory: { type: String, trim: true }, genderRestriction: { type: String, enum: ['ANY', 'MALE', 'FEMALE', 'OTHER'], default: 'ANY' }, roomNumber: { type: String, default: null, trim: true }, status: { type: String, enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'], default: 'AVAILABLE', required: true }, ...audit }, { timestamps: true });
wardSchema.index({ branchId: 1, name: 1 }, { unique: true });
wardSchema.index({ branchId: 1, status: 1, floor: 1 });
bedSchema.index({ branchId: 1, wardId: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ branchId: 1, status: 1, wardId: 1 });
bedSchema.index({ branchId: 1, bedCategory: 1, roomNumber: 1 });

export const WardModel = mongoose.model<WardFields>('HmsWard', wardSchema);
export const BedModel = mongoose.model<BedFields>('HmsBed', bedSchema);
