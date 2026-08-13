import { useAuth } from '../../auth/useAuth';

export function UserMenu() {
  const { user, logout } = useAuth();

  const displayName = user?.fullName ?? user?.username ?? 'User';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <span className="avatar-initials blue">{initials}</span>
        <span className="user-info">
          <strong>{displayName}</strong>
          <small>{user?.status ?? 'HMS User'}</small>
        </span>
      </div>
      <button
        className="doc-btn"
        onClick={() => void logout()}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
        title="Sign out"
        type="button"
      >
        <i className="ph ph-sign-out" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
