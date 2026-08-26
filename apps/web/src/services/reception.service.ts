import { opdApi, type BookOpdReferralPayload } from '../api/opd';
export const receptionService = {
  listReferrals: (params: { booked?: boolean; page?: number; limit?: number }) => opdApi.listReferrals(params),
  getReferral: (visitId: string) => opdApi.getReferral(visitId),
  bookReferral: (referralId: string, payload: BookOpdReferralPayload) => opdApi.bookReferral(referralId, payload),
};
