import { FormEvent, useMemo, useState } from 'react';
import { ApiError } from '../api/api-error';
import { SessionExpiredNotice } from '../components/SessionExpiredNotice';
import { useAuth } from '../auth/useAuth';
import { useAppLocation } from '../routing/navigation';

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
    <main className="auth-page auth-page--glass">
      {/* Accessible off-screen brand text for screen readers */}
      <div className="visually-hidden">
        <h1>DENTO Mycare Secure Access - Dental Clinic &amp; Patient Management</h1>
        <p>Sign in to access your integrated dental care dashboard. Access is secure and verified for your peace of mind.</p>
      </div>

      <div className="auth-glass-container">
        <section className="auth-glass-card" aria-labelledby="login-title">
          <div className="auth-glass-card__header">
            <h2 id="login-title">Welcome back</h2>
            <p className="auth-glass-card__subtitle">Sign in to your account</p>
          </div>

          <SessionExpiredNotice visible={showExpiredNotice} />

          {errorMessage ? (
            <div className="auth-alert auth-alert--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="login-username">Username or email</label>
              <div className="input-with-icon">
                <input
                  autoComplete="username"
                  id="login-username"
                  inputMode="email"
                  name="identifier"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin"
                  type="text"
                  value={identifier}
                />
                <span className="input-trailing-icon" aria-hidden="true">
                  <i className="ph ph-shield-check" />
                </span>
              </div>
            </div>

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

            <div className="auth-form__helpers">
              <button
                type="button"
                className="auth-link-forgot"
                onClick={() => setFormError('Please contact your clinic administrator for password reset assistance.')}
              >
                Forgot Password?
              </button>
            </div>

            <button className="primary-action auth-submit-btn" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="auth-card-footer">
              <span>Don’t have an account? </span>
              <a
                href="mailto:admin@dentomycare.com?subject=Access%20Request%20-%20Dento%20Mycare"
                className="auth-link-admin"
              >
                Contact Admin
              </a>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
