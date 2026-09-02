import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { SmsService } from '../../shared/services/sms.service.js';
import type { RequestMetadata } from '../users/user.types.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { PatientOtpRepository } from './patient-otp.repository.js';
import { RegistrationTokenModel } from './registration-token.model.js';

const verificationBrand = Symbol('patient-otp-verification');

export type PatientOtpVerification = {
  readonly phone: string;
  readonly challengeId: string;
  readonly [verificationBrand]: true;
};

export const isPatientOtpVerificationForPhone = (
  verification: PatientOtpVerification,
  phone: string,
) => verification[verificationBrand] === true && verification.phone === normalizePatientOtpIdentity(phone);

export const normalizePatientOtpIdentity = (phone: string) => {
  const normalizedPhone = phone.replace(/\D/g, '');
  if (normalizedPhone.length < 7) {
    throw new AppError('Enter a valid mobile number.', 400, 'VALIDATION_ERROR');
  }
  return normalizedPhone;
};

const hashOtp = (phone: string, otp: string) =>
  createHash('sha256').update(`${phone}:${otp}`).digest('hex');

const securelyEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

type PatientOtpOptions = {
  demoEnabled: boolean;
  demoOtp: string;
  ttlSeconds?: number;
  resendCooldownSeconds?: number;
  maxVerificationAttempts?: number;
  identityRequestLimit?: number;
  identityWindowSeconds?: number;
  ipRequestLimit?: number;
  ipRequestWindowSeconds?: number;
  verificationIpLimit?: number;
  verificationIdentityLimit?: number;
  verificationWindowSeconds?: number;
  now?: () => Date;
};

export class PatientOtpService {
  constructor(
    private readonly repository: PatientOtpRepository,
    private readonly sms: SmsService,
    private readonly options: PatientOtpOptions = {
      demoEnabled: env.auth.patientPortalDemoOtpEnabled,
      demoOtp: env.auth.patientPortalDemoOtp,
    },
    private readonly rateLimits = new AuthRateLimitRepository(),
  ) {}

  async request(phone: string, metadata: RequestMetadata) {
    const normalizedPhone = normalizePatientOtpIdentity(phone);
    const now = this.now();
    const latest = await this.repository.findLatest(normalizedPhone);
    if (latest && latest.resendAvailableAt.getTime() > now.getTime()) {
      const keyHash = this.keyHash(normalizedPhone);
      await this.auditRateLimitOnce('otp-resend', keyHash, metadata, this.resendCooldownSeconds(), now);
      throw new AppError('Too many authentication requests. Try again later.', 429, 'AUTH_RATE_LIMITED');
    }
    await this.enforceRequestLimits(normalizedPhone, metadata, now);
    const code = randomInt(1000, 10000).toString();
    await this.repository.invalidateActive(normalizedPhone, now);
    const challenge = await this.repository.create({
      phone: normalizedPhone,
      otpHash: hashOtp(normalizedPhone, code),
      expiresAt: new Date(now.getTime() + this.ttlSeconds() * 1000),
      resendAvailableAt: new Date(now.getTime() + this.resendCooldownSeconds() * 1000),
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });

    await this.sms.sendSms(
      phone.trim(),
      `Your HMS verification code is: ${code}. It is valid for ${Math.ceil(this.ttlSeconds() / 60)} minutes.`,
    );

    return { success: true, resendAvailableAt: challenge.resendAvailableAt };
  }

  async verifyAndConsume(phone: string, otp: string, metadata?: RequestMetadata): Promise<PatientOtpVerification> {
    const normalizedPhone = normalizePatientOtpIdentity(phone);
    await this.enforceVerificationLimits(normalizedPhone, metadata, this.now());
    if (this.isDemoOtp(otp)) {
      return this.verification(normalizedPhone, 'demo');
    }

    const now = this.now();
    const { challengeId, candidateHash } = await this.assertChallengeValid(
      normalizedPhone,
      otp,
      now,
    );

    const consumed = await this.repository.consume(
      challengeId,
      normalizedPhone,
      candidateHash,
      now,
      this.maxVerificationAttempts(),
    );
    if (!consumed) throw this.invalidOtp();
    return this.verification(normalizedPhone, consumed.id);
  }

  async assertValidForPendingFlow(phone: string, otp: string, metadata?: RequestMetadata) {
    const normalizedPhone = normalizePatientOtpIdentity(phone);
    await this.enforceVerificationLimits(normalizedPhone, metadata, this.now());
    if (this.isDemoOtp(otp)) return;
    await this.assertChallengeValid(normalizedPhone, otp, this.now());
  }

  async verifyAndIssueRegistrationToken(
    phone: string,
    otp: string,
    metadata?: RequestMetadata,
  ) {
    const verification = await this.verifyAndConsume(phone, otp, metadata);
    const token = randomBytes(32).toString('hex');
    await RegistrationTokenModel.create({
      phone: verification.phone,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      mode: 'any',
      expiresAt: new Date(this.now().getTime() + 15 * 60 * 1000),
      consumedAt: null,
    });
    return { registrationToken: token };
  }

  async consumeRegistrationToken(phone: string, token: string): Promise<PatientOtpVerification> {
    const normalizedPhone = normalizePatientOtpIdentity(phone);
    const now = this.now();
    const registrationToken = await RegistrationTokenModel.findOneAndUpdate(
      {
        phone: normalizedPhone,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { new: true },
    );
    if (!registrationToken) {
      throw new AppError(
        'The registration session is invalid or has expired. Please verify your mobile number again.',
        401,
        'INVALID_REGISTRATION_TOKEN',
      );
    }
    return this.verification(normalizedPhone, `registration:${registrationToken.id}`);
  }

  private async assertChallengeValid(normalizedPhone: string, otp: string, now: Date) {
    const challenge = await this.repository.findLatest(normalizedPhone);
    if (!challenge || challenge.verifiedAt || challenge.expiresAt.getTime() <= now.getTime()) {
      throw this.invalidOtp();
    }
    if (challenge.attempts >= this.maxVerificationAttempts()) {
      throw new AppError(
        'Too many failed verification attempts. Please request a new code.',
        429,
        'MAX_ATTEMPTS_EXCEEDED',
      );
    }

    const candidateHash = hashOtp(normalizedPhone, otp);
    if (!securelyEqual(challenge.otpHash, candidateHash)) {
      const updated = await this.repository.incrementAttempts(challenge.id, now, this.maxVerificationAttempts());
      if (updated && updated.attempts >= this.maxVerificationAttempts()) {
        await this.repository.auditRateLimit('verification-attempts', this.keyHash(normalizedPhone), {});
      }
      throw this.invalidOtp();
    }
    return { challengeId: challenge.id, candidateHash };
  }

  private isDemoOtp(otp: string) {
    return this.options.demoEnabled && securelyEqual(this.options.demoOtp, otp);
  }

  private async enforceRequestLimits(normalizedPhone: string, metadata: RequestMetadata, now: Date) {
    await this.consumeOrReject('otp-resend', normalizedPhone, 1, this.resendCooldownSeconds(), metadata, now);
    await this.consumeOrReject('otp-request-identity', normalizedPhone, this.options.identityRequestLimit ?? env.auth.otpIdentityRequestLimit, this.options.identityWindowSeconds ?? env.auth.otpIdentityWindowSeconds, metadata, now);
    if (metadata.ipAddress) {
      await this.consumeOrReject('otp-request-ip', metadata.ipAddress, this.options.ipRequestLimit ?? env.auth.otpIpRequestLimit, this.options.ipRequestWindowSeconds ?? env.auth.otpIpRequestWindowSeconds, metadata, now);
    }
  }

  private async enforceVerificationLimits(normalizedPhone: string, metadata: RequestMetadata | undefined, now: Date) {
    if (!metadata) return;
    const windowSeconds = this.options.verificationWindowSeconds ?? env.auth.otpVerificationWindowSeconds;
    await this.consumeOrReject('otp-verification-identity', normalizedPhone, this.options.verificationIdentityLimit ?? env.auth.otpVerificationIdentityLimit, windowSeconds, metadata, now);
    if (metadata.ipAddress) {
      await this.consumeOrReject('otp-verification-ip', metadata.ipAddress, this.options.verificationIpLimit ?? env.auth.otpVerificationIpLimit, windowSeconds, metadata, now);
    }
  }

  private async consumeOrReject(scope: string, key: string, limit: number, windowSeconds: number, metadata: RequestMetadata, now: Date) {
    const keyHash = this.keyHash(key);
    if (await this.rateLimits.consume(scope, keyHash, limit, windowSeconds, now)) return;
    await this.auditRateLimitOnce(scope, keyHash, metadata, windowSeconds, now);
    throw new AppError('Too many authentication requests. Try again later.', 429, 'AUTH_RATE_LIMITED');
  }

  private async auditRateLimitOnce(scope: string, keyHash: string, metadata: RequestMetadata, windowSeconds: number, now: Date) {
    if (await this.rateLimits.consume(`monitor:${scope}`, keyHash, 1, windowSeconds, now)) {
      await this.repository.auditRateLimit(scope, keyHash, metadata);
    }
  }

  private keyHash(value: string) {
    return createHmac('sha256', env.auth.accessTokenSecret).update(value).digest('hex');
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }

  private ttlSeconds() {
    return this.options.ttlSeconds ?? env.auth.otpTtlSeconds;
  }

  private resendCooldownSeconds() {
    return this.options.resendCooldownSeconds ?? env.auth.otpResendCooldownSeconds;
  }

  private maxVerificationAttempts() {
    return this.options.maxVerificationAttempts ?? env.auth.otpMaxVerificationAttempts;
  }

  private invalidOtp() {
    return new AppError('The verification code is invalid or has expired', 401, 'INVALID_OTP');
  }

  private verification(phone: string, challengeId: string): PatientOtpVerification {
    return { phone, challengeId, [verificationBrand]: true };
  }
}
