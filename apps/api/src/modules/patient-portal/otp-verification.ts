import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { OtpChallengeModel } from './otp-challenge.model.js';

const MAX_OTP_ATTEMPTS = 3;

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

const hashOtp = (phone: string, otp: string) =>
  createHash('sha256').update(`${normalizePhone(phone)}:${otp}`).digest('hex');

export const isPatientDemoOtp = (otp?: string) =>
  env.app.environment !== 'prod' &&
  Boolean(env.auth.patientPortalDemoOtp) &&
  otp === env.auth.patientPortalDemoOtp;

const invalidOtp = () =>
  new AppError('The verification code is invalid or has expired', 401, 'INVALID_OTP');

const tooManyAttempts = () =>
  new AppError(
    'Too many failed verification attempts. Please request a new code.',
    429,
    'MAX_ATTEMPTS_EXCEEDED',
  );

export async function verifyPatientOtp(phone: string, otp: string, consume = false) {
  if (isPatientDemoOtp(otp)) return;

  const now = new Date();
  const challenge = await OtpChallengeModel.findOne({
    phone: normalizePhone(phone),
    verifiedAt: null,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (!challenge) throw invalidOtp();
  if (challenge.attempts >= MAX_OTP_ATTEMPTS) throw tooManyAttempts();

  const otpHash = hashOtp(phone, otp);
  if (challenge.otpHash !== otpHash) {
    const updated = await OtpChallengeModel.findOneAndUpdate(
      { _id: challenge._id, verifiedAt: null, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (updated && updated.attempts >= MAX_OTP_ATTEMPTS) throw tooManyAttempts();
    throw invalidOtp();
  }

  const verified = await OtpChallengeModel.findOneAndUpdate(
    {
      _id: challenge._id,
      otpHash,
      verifiedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    {
      $set: {
        verifiedAt: now,
        ...(consume ? { expiresAt: now } : {}),
      },
    },
    { new: true },
  );

  if (!verified) throw invalidOtp();
}

export async function consumeVerifiedPatientOtp(phone: string, otp: string) {
  if (isPatientDemoOtp(otp)) return;

  const now = new Date();
  const consumed = await OtpChallengeModel.findOneAndUpdate(
    {
      phone: normalizePhone(phone),
      otpHash: hashOtp(phone, otp),
      verifiedAt: { $ne: null },
      expiresAt: { $gt: now },
      attempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    { $set: { expiresAt: now } },
    { new: true, sort: { createdAt: -1 } },
  );

  if (!consumed) {
    await verifyPatientOtp(phone, otp, true);
  }
}
