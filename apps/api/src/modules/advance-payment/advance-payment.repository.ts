import type { ClientSession, Types } from 'mongoose';
import { AdvancePaymentModel } from './advance-payment.model.js';
import type { AdvancePaymentFields, AdvancePaymentRecord, AdvanceSourceType, AdvanceRequirementStatus } from './advance-payment.types.js';

type AdvancePaymentLean = AdvancePaymentFields & { _id: Types.ObjectId };

const toRecord = (doc: AdvancePaymentLean): AdvancePaymentRecord => ({
  id: doc._id.toString(),
  patient_id: doc.patient_id,
  source_type: doc.source_type,
  source_id: doc.source_id,
  branch_id: doc.branch_id,
  required_amount: doc.required_amount,
  paid_amount: doc.paid_amount,
  balance_amount: doc.balance_amount,
  requirement_status: doc.requirement_status,
  payment_status: doc.payment_status,
  created_by: doc.created_by,
  updated_by: doc.updated_by,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

export class AdvancePaymentRepository {
  async findBySource(sourceType: AdvanceSourceType, sourceId: string): Promise<AdvancePaymentRecord | null> {
    const doc = await AdvancePaymentModel.findOne({ source_type: sourceType, source_id: sourceId }).lean<AdvancePaymentLean>();
    return doc ? toRecord(doc) : null;
  }

  async syncRequirement(
    data: {
      patient_id: string;
      source_type: AdvanceSourceType;
      source_id: string;
      branch_id: string;
      required_amount: number;
      requirement_status: AdvanceRequirementStatus;
    },
    userId: string,
    session?: ClientSession,
  ): Promise<AdvancePaymentRecord> {

    const doc = await AdvancePaymentModel.findOneAndUpdate(
      { source_type: data.source_type, source_id: data.source_id },
      {
        $set: {
          patient_id: data.patient_id,
          branch_id: data.branch_id,
          required_amount: data.required_amount,
          requirement_status: data.requirement_status,
          updated_by: userId,
        },
        $setOnInsert: {
          paid_amount: 0,
          payment_status: 'PENDING',
          created_by: userId,
        },
      },
      { new: true, upsert: true, session },
    ).lean<AdvancePaymentLean>();

    if (!doc) {
      throw new Error('Failed to sync advance payment requirement');
    }

    // Recalculate balance and payment status if it was just updated or created
    const paid = doc.paid_amount;
    const required = doc.required_amount;
    const balance = Math.max(0, required - paid);
    let payment_status = doc.payment_status;

    if (payment_status !== 'CANCELLED') {
      if (paid >= required && required > 0) {
        payment_status = 'PAID';
      } else if (paid > 0 && paid < required) {
        payment_status = 'PARTIALLY_PAID';
      } else {
        payment_status = 'PENDING';
      }
    }

    const updatedDoc = await AdvancePaymentModel.findOneAndUpdate(
      { _id: doc._id },
      { $set: { balance_amount: balance, payment_status } },
      { new: true, session },
    ).lean<AdvancePaymentLean>();

    return toRecord(updatedDoc!);
  }

  async addPayment(
    sourceType: AdvanceSourceType,
    sourceId: string,
    amount: number,
    userId: string,
    session?: ClientSession,
  ): Promise<AdvancePaymentRecord | null> {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const updated = await AdvancePaymentModel.findOneAndUpdate(
      { source_type: sourceType, source_id: sourceId },
      [
        {
          $set: {
            paid_amount: { $add: ['$paid_amount', amount] },
            balance_amount: {
              $max: [0, { $subtract: ['$required_amount', { $add: ['$paid_amount', amount] }] }],
            },
            payment_status: {
              $cond: {
                if: { $eq: ['$payment_status', 'CANCELLED'] },
                then: 'CANCELLED',
                else: {
                  $cond: {
                    if: {
                      $and: [
                        { $gt: ['$required_amount', 0] },
                        { $gte: [{ $add: ['$paid_amount', amount] }, '$required_amount'] },
                      ],
                    },
                    then: 'PAID',
                    else: {
                      $cond: {
                        if: { $gt: [{ $add: ['$paid_amount', amount] }, 0] },
                        then: 'PARTIALLY_PAID',
                        else: 'PENDING',
                      },
                    },
                  },
                },
              },
            },
            updated_by: userId,
          },
        },
      ],
      { returnDocument: 'after', session, updatePipeline: true },
    ).lean<AdvancePaymentLean>();

    return updated ? toRecord(updated) : null;
  }
}
