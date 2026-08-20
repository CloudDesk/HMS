import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/api-error';
import { SessionExpiredNotice } from '../components/SessionExpiredNotice';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from '../routing/navigation';

export function LoginPage() {
  const { status, authError, clearAuthError, login } = useAuth();
  const location = useAppLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const showExpiredNotice = status === 'session-expired' || query.get('reason') === 'session-expired';

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();
    setFormError(null);

    if (!identifier.trim() || !password) {
      setFormError('Enter your username or email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(identifier.trim(), password);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('We could not complete the sign in request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorMessage = formError ?? authError;

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Hospital Management System">
        <div className="auth-hero__content">
          <p className="eyebrow">Hospital Management System</p>
          <h1>Secure HMS access</h1>
          <p>
            Sign in to continue to the hospital workspace. Access is verified before dashboard
            routes are displayed.
          </p>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-panel__header">
          <p className="eyebrow">Staff sign in</p>
          <h2 id="login-title">Welcome back</h2>
        </div>

        <SessionExpiredNotice visible={showExpiredNotice} />

        {errorMessage ? (
          <div className="auth-alert auth-alert--error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Username or email</span>
            <input
              autoComplete="username"
              inputMode="email"
              name="identifier"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin"
              type="text"
              value={identifier}
            />
          </label>

          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-input">
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={isPasswordVisible}
                className="password-input__toggle"
                onClick={() => setIsPasswordVisible((current) => !current)}
                type="button"
              >
                <i
                  aria-hidden="true"
                  className={`ph ${isPasswordVisible ? 'ph-eye-slash' : 'ph-eye'}`}
                />
              </button>
            </div>
          </div>

          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* <button className="link-action" onClick={() => navigate('/forgot-password')} type="button">
          Need password help?
        </button> */}

        {/* <dl className="runtime-list" aria-label="Frontend runtime configuration">
          <div>
            <dt>Mode</dt>
            <dd>{appConfig.appEnv}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>{appConfig.apiBaseUrl}</dd>
          </div>
        </dl> */}
      </section>
    </main>
  );
}
