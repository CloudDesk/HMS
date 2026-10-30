import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { canAccessRoute } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { NavLink } from './NavLink';
import { NotificationsMenu } from './NotificationsMenu';

type SidebarUserFooterProps = {
  collapsed?: boolean;
};

export function SidebarUserFooter({ collapsed = false }: SidebarUserFooterProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, bottom: 76, width: 264 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const roleName = user?.roles?.[0]?.name;
  const displayName = user?.fullName || roleName || user?.username || 'Super Admin';
  const displayRoles = user?.roles?.map((role) => role.name).join(', ') || roleName;
  const canOpenSettings = canAccessRoute('/administration/settings', user?.permissions ?? [], user?.roles ?? []);
  const initials = (displayName || 'SA')
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('') || 'SA';

  const statusText = user?.status
    ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase()
    : 'Active';

  const closeAccount = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const toggleAccount = () => {
    if (!open && triggerRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const sidebar = triggerRef.current.closest('.sidebar')?.getBoundingClientRect();
      const width = Math.min(240, Math.max(192, (sidebar?.width ?? 216) - 24), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min((sidebar?.left ?? trigger.left) + 12, window.innerWidth - width - 12)),
        bottom: Math.max(12, window.innerHeight - trigger.top + 12),
        width,
      });
    }
    setOpen((current) => !current);
  };

  return (
    <div className={`sidebar-footer-user${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-user-row">
        <div className="sidebar-user-notifications">
          <NotificationsMenu variant="sidebar" />
        </div>
        <button
          ref={triggerRef}
          className="sidebar-account-trigger"
          type="button"
          aria-label={`Your account: ${displayName}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title={displayName}
          onClick={toggleAccount}
        >
          <span className="sidebar-user-avatar">{initials}</span>
        </button>
      </div>
      {open && createPortal(
        <div ref={panelRef} id={panelId} className="sidebar-account-popover" role="dialog" aria-labelledby={`${panelId}-title`} style={position}>
          <div className="sidebar-account-heading">
            <h2 id={`${panelId}-title`}>Your account</h2>
            <button ref={closeRef} type="button" aria-label="Close account" onClick={closeAccount}><i className="ph ph-x" aria-hidden="true" /></button>
          </div>
          <div className="sidebar-account-identity">
            <div className="sidebar-user-avatar" aria-hidden="true">{initials}<span className={`sidebar-account-status-dot ${user?.status || 'active'}`} /></div>
            <div className="sidebar-account-details">
              <span className="sidebar-user-name">{displayName}</span>
              {displayRoles && <span>{displayRoles}</span>}
              {user?.email && <span>{user.email}</span>}
              <span className="sidebar-account-status-text">{statusText}</span>
            </div>
          </div>
          {canOpenSettings && <NavLink className="sidebar-account-settings" href="/administration/settings" onClick={() => setOpen(false)}><i className="ph ph-gear" aria-hidden="true" />System Settings</NavLink>}
          <div className="sidebar-account-divider" />
          <button className="sidebar-signout-btn" onClick={() => void logout()} title="Sign out" type="button">
            <i className="ph ph-sign-out" aria-hidden="true" /><span>Sign out</span>
          </button>
        </div>, document.body,
      )}
    </div>
  );
}
