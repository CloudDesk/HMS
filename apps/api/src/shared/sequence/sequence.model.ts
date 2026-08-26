import mongoose, { Schema } from 'mongoose';

export type SequenceFields = {
  _id: string;
  sequence: number;
};

const sequenceSchema = new Schema<SequenceFields>({
  _id: { type: String, required: true },
  sequence: { type: Number, required: true, default: 0 },
});

export const SequenceModel = mongoose.model<SequenceFields>('Sequence', sequenceSchema);
