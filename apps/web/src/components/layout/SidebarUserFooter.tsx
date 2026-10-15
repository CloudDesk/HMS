import { useAuth } from '../../auth/useAuth';
import { NotificationsMenu } from './NotificationsMenu';

type SidebarUserFooterProps = {
  collapsed?: boolean;
};

export function SidebarUserFooter({ collapsed = false }: SidebarUserFooterProps) {
  const { user, logout } = useAuth();

  const roleName = user?.roles?.[0]?.name;
  const displayName = user?.fullName || roleName || user?.username || 'Super Admin';
  const displayRoleOrName = roleName || displayName;
  const initials = (displayName || 'SA')
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('') || 'SA';

  const statusText = user?.status
    ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase()
    : 'Active';

  return (
    <div className={`sidebar-footer-user${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-user-row">
        <div className="sidebar-user-avatar" title={displayName}>
          {initials}
        </div>

        <div className="sidebar-user-info">
          <span className="sidebar-user-name" title={displayName}>
            {displayRoleOrName}
          </span>
          <span className="sidebar-user-status">
            <span className="status-dot-active" />
            <span>{statusText}</span>
          </span>
        </div>

        <div className="sidebar-user-notifications">
          <NotificationsMenu variant="sidebar" />
        </div>
      </div>

      <button
        className="sidebar-signout-btn"
        onClick={() => void logout()}
        title="Sign out"
        type="button"
      >
        <i className="ph ph-sign-out" aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </div>
  );
}
