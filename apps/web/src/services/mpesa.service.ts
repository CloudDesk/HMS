import {
  mpesaApi,
  type CreateMpesaAttemptPayload,
  type ListMpesaAttemptsParams,
  type SubmitMpesaAttemptPayload,
} from '../api/mpesa';

export const mpesaService = {
  createAttempt: (invoiceId: string, payload: CreateMpesaAttemptPayload) =>
    mpesaApi.createAttempt(invoiceId, payload),

  submitAttempt: (attemptId: string, payload: SubmitMpesaAttemptPayload) =>
    mpesaApi.submitAttempt(attemptId, payload),

  getAttempt: (attemptId: string) => mpesaApi.getAttempt(attemptId),

  verifyAttempt: (attemptId: string) => mpesaApi.verifyAttempt(attemptId),

  postPayment: (attemptId: string) => mpesaApi.postPayment(attemptId),

  getPayment: (attemptId: string) => mpesaApi.getPayment(attemptId),

  getReceipt: (attemptId: string) => mpesaApi.getReceipt(attemptId),

  listExceptions: (params?: { page?: number; limit?: number }) =>
    mpesaApi.listExceptions(params),

  listAttempts: (params?: ListMpesaAttemptsParams) =>
    mpesaApi.listAttempts(params),
};
