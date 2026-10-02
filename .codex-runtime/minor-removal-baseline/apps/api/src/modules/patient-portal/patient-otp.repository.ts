import { Types } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import type { RequestMetadata } from '../users/user.types.js';
import { OtpChallengeModel } from './otp-challenge.model.js';

export type PatientOtpChallenge = {
  id: string;
  phone: string;
  otpHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attempts: number;
  verifiedAt: Date | null;
};

const toChallenge = (challenge: {
  _id: unknown;
  phone: string;
  otpHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attempts: number;
  verifiedAt: Date | null;
}): PatientOtpChallenge => ({
  id: String(challenge._id),
  phone: challenge.phone,
  otpHash: challenge.otpHash,
  expiresAt: challenge.expiresAt,
  resendAvailableAt: challenge.resendAvailableAt,
  attempts: challenge.attempts,
  verifiedAt: challenge.verifiedAt,
});

export class PatientOtpRepository {
  async create(input: {
    phone: string;
    otpHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    const challenge = await OtpChallengeModel.create({
      ...input,
      attempts: 0,
      verifiedAt: null,
    });
    return toChallenge(challenge);
  }

  async findLatest(phone: string) {
    const challenge = await OtpChallengeModel.findOne({ phone })
      .sort({ createdAt: -1 })
      .lean();
    return challenge ? toChallenge(challenge) : null;
  }

  async invalidateActive(phone: string, now: Date) {
    await OtpChallengeModel.updateMany(
      { phone, verifiedAt: null },
      { $set: { verifiedAt: now } },
    );
  }

  async auditRateLimit(scope: string, keyHash: string, metadata: RequestMetadata) {
    await AuditLogModel.create({
      eventType: 'auth.patient_otp.rate_limited',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: { scope, keyHash },
    });
  }

  async incrementAttempts(id: string, now: Date, maxAttempts: number) {
    if (!Types.ObjectId.isValid(id)) return null;
    const challenge = await OtpChallengeModel.findOneAndUpdate(
      {
        _id: id,
        verifiedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', lean: true },
    );
    return challenge ? toChallenge(challenge) : null;
  }

  async consume(id: string, phone: string, otpHash: string, now: Date, maxAttempts: number) {
    if (!Types.ObjectId.isValid(id)) return null;
    const challenge = await OtpChallengeModel.findOneAndUpdate(
      {
        _id: id,
        phone,
        otpHash,
        verifiedAt: null,
        expiresAt: { $gt: now },
        attempts: { $lt: maxAttempts },
      },
      { $set: { verifiedAt: now } },
      { returnDocument: 'after', lean: true },
    );
    return challenge ? toChallenge(challenge) : null;
  }
}
