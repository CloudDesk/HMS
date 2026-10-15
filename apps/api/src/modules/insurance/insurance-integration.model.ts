import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  interventionCode: { type: String, required: true, trim: true },
  effectiveFrom: { type: String, required: true }, effectiveTo: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
  version: { type: Number, default: 0, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ serviceId: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } });
schema.index({ serviceId: 1, createdAt: -1 });
export const ShaServiceMappingModel = mongoose.model('ShaServiceMapping', schema);
