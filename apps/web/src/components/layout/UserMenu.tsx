import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const displayName = user?.fullName ?? user?.username ?? 'User';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="user-profile">
      <button className="user-profile__button" onClick={() => setOpen((current) => !current)} type="button">
        <span className="avatar-initials blue">{initials}</span>
        <span className="user-info">
          <strong>{displayName}</strong>
          <small>{user?.status ?? 'HMS User'}</small>
        </span>
        <i className="ph ph-caret-down" aria-hidden="true" />
      </button>
      {open ? (
        <div className="user-menu">
          <button type="button">
            <i className="ph ph-user" aria-hidden="true" />
            Profile
          </button>
          <button type="button">
            <i className="ph ph-gear-six" aria-hidden="true" />
            Preferences
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <i className="ph ph-sign-out" aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
