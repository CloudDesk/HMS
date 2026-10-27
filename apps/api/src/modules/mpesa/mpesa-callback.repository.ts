import { MpesaCallbackEventModel, type MpesaCallbackEvent } from './mpesa-callback.model.js';
import type { ClientSession } from 'mongoose';

export class MpesaCallbackRepository {
  get(id: string, session?: ClientSession) {
    return MpesaCallbackEventModel.findById(id).select('+phoneNumber').session(session ?? null).lean();
  }
  pending(environment: MpesaCallbackEvent['environment'], checkoutRequestId: string) {
    return MpesaCallbackEventModel.find({ environment, checkoutRequestId, processingStatus: 'UNMATCHED' })
      .select('_id').sort({ receivedAt: 1, _id: 1 }).limit(100).lean();
  }
  async mark(id: string, attemptId: string, conflict: string | undefined, session: ClientSession) {
    const result = await MpesaCallbackEventModel.updateOne({ _id: id, processingStatus: 'UNMATCHED' }, {
      $set: { attemptId, processingStatus: conflict ? 'CONFLICT' : 'MATCHED',
        processedAt: new Date(), ...(conflict ? { processingError: conflict } : {}) },
    }, { session });
    return result.modifiedCount === 1;
  }
  async record(event: MpesaCallbackEvent): Promise<void> {
    // _id's built-in unique index protects first delivery even before secondary
    // indexes exist. Identical retries never rewrite the original event.
    await MpesaCallbackEventModel.updateOne(
      { _id: event._id },
      { $setOnInsert: event },
      { upsert: true, writeConcern: { w: 'majority', j: true, wtimeout: 5000 } },
    ).exec();
  }
}
