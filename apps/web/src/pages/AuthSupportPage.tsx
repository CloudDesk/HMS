import { navigate } from '../routing/navigation';

type AuthSupportPageProps = {
  mode: 'forgot-password' | 'reset-password';
};

export function AuthSupportPage({ mode }: AuthSupportPageProps) {
  const isReset = mode === 'reset-password';

  return (
    <main className="app-shell app-shell--center">
      <section className="auth-support-panel" aria-labelledby="auth-support-title">
        <p className="eyebrow">{isReset ? 'Password reset' : 'Password assistance'}</p>
        <h1 id="auth-support-title">{isReset ? 'Reset password' : 'Password help'}</h1>
        <p>
          {isReset
            ? 'Use the reset link issued by your HMS administrator to complete this step.'
            : 'Contact your HMS administrator to receive password reset instructions.'}
        </p>
        <button className="secondary-action" onClick={() => navigate('/login')} type="button">
          Back to sign in
        </button>
      </section>
    </main>
  );
}
