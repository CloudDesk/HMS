import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import { SessionExpiredNotice } from '../components/SessionExpiredNotice';
import { useAuth } from '../auth/useAuth';
import { appConfig } from '../config';
import { navigate, useAppLocation } from '../routing/navigation';
import { authApi } from '../auth/auth-api';

const VERIFIED_MOBILE_KEY = 'hms_patient_verified_mobile';

export function PatientLoginPage() {
  const { status, user, authError, clearAuthError, loginWithOtp } = useAuth();
  const { search } = useAppLocation();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);
  const requestedPath = new URLSearchParams(search).get('return');
  const safeReturnPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : null;

  useEffect(() => {
    const isPortalUser = Boolean(user?.patientId || user?.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'));
    if (status === 'authenticated' && isPortalUser) navigate(safeReturnPath ?? '/portal', { replace: true });
  }, [safeReturnPath, status, user]);

  const continueToRegistration = (mode: 'new' | 'guardian') => {
    sessionStorage.setItem(VERIFIED_MOBILE_KEY, JSON.stringify({ phone: phone.trim(), mode, verifiedAt: Date.now() }));
    const params = new URLSearchParams({ mode, verified: '1' });
    if (safeReturnPath) params.set('return', safeReturnPath);
    navigate(`/signup?${params.toString()}`, { state: { phone: phone.trim(), otp, mode } });
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || submitting) return;
    setError(null);
    clearAuthError();
    setSubmitting(true);
    try {
      const res = await authApi.requestOtp(phone.trim());
      const secondsLeft = Math.max(0, Math.ceil((new Date(res.resendAvailableAt).getTime() - Date.now()) / 1000));
      setResendCountdown(secondsLeft || 60);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not resend verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); clearAuthError(); setError(null);
    if (step === 'phone') {
      const normalizedPhone = phone.trim().replace(/\D/g, '');
      if (normalizedPhone.length < 7) return setError('Enter a valid mobile number.');
      setSubmitting(true);
      try {
        const res = await authApi.requestOtp(phone.trim());
        const secondsLeft = Math.max(0, Math.ceil((new Date(res.resendAvailableAt).getTime() - Date.now()) / 1000));
        setResendCountdown(secondsLeft || 60);
        setStep('otp');
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : 'Could not send verification code. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!/^\d{4}$/.test(otp)) return setError('Enter the 4-digit verification code.');
    setSubmitting(true);
    try {
      await loginWithOtp(phone.trim(), otp);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'NEW_PATIENT_REQUIRES_REGISTRATION') {
        clearAuthError(); continueToRegistration('new');
      } else if (requestError instanceof ApiError && requestError.code === 'MINOR_GUARDIAN_ACCOUNT_REQUIRED') {
        clearAuthError(); continueToRegistration('guardian');
      } else {
        setError(requestError instanceof ApiError ? requestError.message : 'Sign in could not be completed. Please try again.');
      }
    } finally { setSubmitting(false); }
  };

  const resetNumber = () => {
    setStep('phone'); setOtp(''); setError(null); clearAuthError();
    sessionStorage.removeItem(VERIFIED_MOBILE_KEY);
  };
  const expired = status === 'session-expired' || new URLSearchParams(search).get('reason') === 'session-expired';

  return <main className="patient-login-page">
    <section className="patient-login-brand" aria-label="HMS patient portal"><div className="patient-login-brand__inner">
      <div className="patient-login-logo"><i className="ph ph-heartbeat" aria-hidden="true" /></div>
      <p className="patient-login-kicker">HMS Patient Portal</p><h1>Your care, clearly connected.</h1>
      <p>Review appointments, verified test results, imaging reports, and billing information for yourself or a linked dependent.</p>
      <ul><li><i className="ph ph-shield-check" /> Private access to linked health records</li><li><i className="ph ph-calendar-check" /> Appointment details when you need them</li><li><i className="ph ph-users-three" /> Parents manage care for minor patients</li></ul>
    </div></section>
    <section className="patient-login-panel" aria-labelledby="patient-login-title"><div className="patient-login-form-wrap">
      <div className="patient-login-mobile-mark"><i className="ph ph-heartbeat" /> HMS Patient Portal</div>
      <p className="patient-login-kicker">Patient portal sign in</p><h2 id="patient-login-title">Welcome</h2>
      <p className="patient-login-subtitle">{step === 'phone' ? 'Enter your mobile number. We will find your HMS record or help you register.' : `Enter the verification code for ${phone}.`}</p>
      <SessionExpiredNotice visible={expired} />
      {error ?? authError ? <div className="auth-alert auth-alert--error" role="alert">{error ?? authError}</div> : null}
      <form className="patient-login-form" onSubmit={submit} noValidate>
        <label><span>Mobile number <span className="required-asterisk">*</span></span><div className="patient-login-input"><i className="ph ph-phone" /><input autoComplete="tel" autoFocus name="phone" inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="Enter mobile number" readOnly={step !== 'phone'} value={phone} /></div></label>
        {step === 'otp' ? <label><span>Verification code <span className="required-asterisk">*</span></span><div className="patient-login-input"><i className="ph ph-shield-check" /><input autoComplete="one-time-code" autoFocus inputMode="numeric" maxLength={4} name="otp" onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="4-digit code" value={otp} /></div></label> : null}
        <button className="patient-login-submit" disabled={submitting} type="submit">{submitting ? 'Checking…' : step === 'phone' ? 'Continue' : 'Verify and continue'}<i className="ph ph-arrow-right" /></button>
        {step === 'otp' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <button className="patient-staff-link" onClick={resetNumber} type="button" style={{ margin: 0 }}>Change mobile number</button>
            <button
              className="patient-staff-link"
              disabled={resendCountdown > 0 || submitting}
              onClick={handleResend}
              type="button"
              style={{ margin: 0 }}
            >
              {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
            </button>
          </div>
        ) : null}
      </form>
      <div className="patient-login-help"><i className="ph ph-info" /><span>Existing patients are linked automatically when one adult record matches. New patients continue to personal information after verification.</span></div>
      {appConfig.staffWebUrl ? <button className="patient-staff-link" onClick={() => window.location.assign(appConfig.staffWebUrl)} type="button">Staff login <i className="ph ph-arrow-up-right" /></button> : null}
    </div></section>
  </main>;
}
