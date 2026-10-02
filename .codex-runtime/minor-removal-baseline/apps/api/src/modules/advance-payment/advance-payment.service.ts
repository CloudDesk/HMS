import type { ClientSession } from 'mongoose';
import { AdvancePaymentRepository } from './advance-payment.repository.js';
import type { SyncAdvancePaymentDTO, AdvanceSourceType } from './advance-payment.types.js';

export class AdvancePaymentService {
  constructor(private readonly repository: AdvancePaymentRepository) {}

  async getBySource(sourceType: AdvanceSourceType, sourceId: string) {
    return this.repository.findBySource(sourceType, sourceId);
  }

  async syncRequirement(data: SyncAdvancePaymentDTO, userId: string, session?: ClientSession) {
    return this.repository.syncRequirement(data, userId, session);
  }

  async processPayment(sourceType: AdvanceSourceType, sourceId: string, amount: number, userId: string, session?: ClientSession) {
    return this.repository.addPayment(sourceType, sourceId, amount, userId, session);
  }
}
