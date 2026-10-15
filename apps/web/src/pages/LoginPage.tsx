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
    <main className="auth-page">
      {/* Top-left Branding */}
      <header className="auth-brand" aria-label="Hospital Management System">
        <div className="auth-brand__logo-wrap">
          <svg
            className="auth-brand__icon"
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 4.5C12 3.67 12.67 3 13.5 3H18.5C19.33 3 20 3.67 20 4.5V11H26.5C27.33 11 28 11.67 28 12.5V17.5C28 18.33 27.33 19 26.5 19H20V27.5C20 28.33 19.33 29 18.5 29H13.5C12.67 29 12 28.33 12 27.5V19H5.5C4.67 19 4 18.33 4 17.5V12.5C4 11.67 4.67 11 5.5 11H12V4.5Z"
              stroke="#38e1b8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16H9.5L12 12.5L15 20L18 13L20.5 16H28"
              stroke="#38e1b8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="auth-brand__name">HOSPITAL MANAGEMENT SYSTEM</span>
      </header>

      <div className="auth-container">
        {/* Left Hero Section */}
        <section className="auth-hero" aria-label="Secure HMS Access">
          <div className="auth-hero__content">
            <h1 className="auth-hero__title">
              <span className="auth-hero__accent">Secure HMS</span>
              <span className="auth-hero__white">Access</span>
            </h1>
            <p className="auth-hero__description">
              Sign in to continue to the hospital workspace. Access is verified before dashboard
              routes are displayed.
            </p>
          </div>
        </section>

        {/* Right Glass Login Panel */}
        <section className="auth-panel" aria-labelledby="login-title">
          <div className="auth-panel__header">
            <h2 id="login-title" className="auth-panel__title">
              Welcome back
            </h2>
            <p className="auth-panel__subtitle">
              Please enter your credentials to access your workspace.
            </p>
          </div>

          <SessionExpiredNotice visible={showExpiredNotice} />

          {errorMessage ? (
            <div className="auth-alert auth-alert--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__group">
              <label htmlFor="login-identifier" className="auth-form__label">
                Username or email
              </label>
              <div className="auth-input-wrap">
                <i aria-hidden="true" className="ph ph-user auth-input-icon" />
                <input
                  autoComplete="username"
                  id="login-identifier"
                  inputMode="email"
                  name="identifier"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin"
                  type="text"
                  value={identifier}
                />
              </div>
            </div>

            <div className="auth-form__group">
              <label htmlFor="login-password" className="auth-form__label">
                Password
              </label>
              <div className="auth-input-wrap">
                <i aria-hidden="true" className="ph ph-lock auth-input-icon" />
                <input
                  autoComplete="current-password"
                  id="login-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={isPasswordVisible}
                  className="auth-password-toggle"
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

            <button
              className="auth-submit-btn"
              disabled={isSubmitting}
              type="submit"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
              {!isSubmitting && <i aria-hidden="true" className="ph ph-arrow-right" />}
            </button>
          </form>

          <div className="auth-security-notice">
            <i aria-hidden="true" className="ph ph-lock-key" />
            <span>Securely encrypted &amp; authorized access only.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
