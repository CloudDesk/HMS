import type { ClientSession } from 'mongoose';
import { SequenceModel } from './sequence.model.js';

export class SequenceService {
  async getNextSequence(sequenceKey: string, session?: ClientSession): Promise<number> {
    const query = SequenceModel.findOneAndUpdate(
      { _id: sequenceKey },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    if (session) {
      query.session(session);
    }
    const result = await query;
    return result!.sequence;
  }

  formatStandardSequence(prefix: string, sequence: number, padding = 6): string {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(sequence).padStart(padding, '0')}`;
  }

  formatTimestampSequence(prefix: string | null, sequence: number): string {
    const timestamp = Date.now();
    return prefix ? `${prefix}-${timestamp}-${sequence}` : `${timestamp}-${sequence}`;
  }
}
