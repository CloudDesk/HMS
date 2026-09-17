import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/useAuth';
import { useSidebarNotifications } from '../../hooks/notifications/useNotifications';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { BranchSelector } from './BranchSelector';
import { NotificationsMenu } from './NotificationsMenu';
import { UserMenu } from './UserMenu';
import styles from './SidebarUtilities.module.css';

// 'signout' and 'branch' are accessed through the UserMenu popup.
type Utility = 'branch' | 'notifications' | 'user';
const titles: Record<Utility, string> = { branch: 'Branch', notifications: 'Notifications', user: 'Your account' };
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]';

export function SidebarUtilityBar() {
  const { user, status, logout } = useAuth();
  const notifications = useSidebarNotifications(status === 'authenticated');
  const [active, setActive] = useState<Utility | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  // confirmSignOut drives the separate ConfirmDialog (triggered from UserMenu → onSignOut)
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Utility>('user');
  const signOutPending = useRef(false);
  const [anchor, setAnchor] = useState({ left: 8, top: 0, width: 192, height: 36, viewportWidth: 1024, viewportHeight: 768 });
  const headingId = useId();
  const panelId = useId();
  const name = user?.fullName || user?.username || 'User';
  const role = user?.roles.map((item) => item.name).join(', ') || 'No role assigned';
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';

  const close = useCallback(() => {
    if (signOutPending.current) return;
    setActive(null);
    requestAnimationFrame(() => slot.current?.querySelector<HTMLButtonElement>(`[data-utility="${opener.current}"]`)?.focus());
  }, []);

  const toggle = (utility: Utility) => {
    if (active === utility) { close(); return; }
    opener.current = utility;
    setSignOutError(false);
    setActive(utility);
  };

  useLayoutEffect(() => {
    const measure = () => {
      const rect = slot.current?.getBoundingClientRect();
      if (rect) setAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height,
        viewportWidth: window.visualViewport?.width ?? window.innerWidth,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (slot.current) observer?.observe(slot.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const getTarget = () => dialog.current;
    const frame = requestAnimationFrame(() => getTarget()?.querySelector<HTMLElement>(focusable)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      const target = getTarget();
      if (event.key !== 'Tab' || !target) return;
      const items = Array.from(target.querySelectorAll<HTMLElement>(focusable));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !target.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !target.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    // Background remains visually dimmed and unavailable to keyboard/assistive input.
    const background = slot.current?.closest<HTMLElement>('.dashboard-container');
    const wasInert = background?.inert ?? false;
    if (background) background.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
      if (background) background.inert = wasInert;
      document.body.style.overflow = previousOverflow;
    };
  }, [active, close]);

  const handleSignOut = async () => {
    if (signOutPending.current) return;
    signOutPending.current = true;
    setSigningOut(true);
    setSignOutError(false);
    try { await logout(); }
    catch { setSignOutError(true); }
    finally { signOutPending.current = false; setSigningOut(false); }
  };

  const controls = (
    <div className={`${styles.controls} ${anchor.width < 100 ? styles.compact : ''}`}>
      <button
        data-utility="notifications"
        type="button"
        className={`sidebar-footer-btn ${active === 'notifications' ? styles.active : ''}`}
        aria-label={`Notifications${notifications.total ? `, ${notifications.total} unread` : ''}`}
        aria-expanded={active === 'notifications'}
        aria-haspopup="dialog"
        aria-controls={active === 'notifications' ? panelId : undefined}
        title={active === 'notifications' ? undefined : 'Notifications'}
        onClick={() => toggle('notifications')}
      >
        <i className="ph ph-bell" aria-hidden="true" />
        {notifications.total > 0 && (
          <span className="sidebar-badge-dot">{notifications.total > 9 ? '9+' : notifications.total}</span>
        )}
      </button>
      <button
        data-utility="user"
        type="button"
        className={`sidebar-footer-btn ${active === 'user' ? styles.active : ''}`}
        aria-label={`User profile: ${name} (${role})`}
        aria-expanded={active === 'user'}
        aria-haspopup="dialog"
        aria-controls={active === 'user' ? panelId : undefined}
        title={active === 'user' ? undefined : `${name} — ${role}`}
        onClick={() => toggle('user')}
      >
        <span className={styles.footerAvatar}>{initials}</span>
      </button>
    </div>
  );

  // Popup width = sidebar slot width (never exceeds sidebar). Fall back to a minimum of 180px.
  const popupWidth = Math.max(180, anchor.width);
  const margin = 4;
  const bottom = Math.min(Math.max(margin, anchor.viewportHeight - anchor.top + 8), Math.max(margin, anchor.viewportHeight - 180));
  // Left-align popup with the sidebar slot — it should stay within the sidebar.
  const left = anchor.left;

  return <>
    <div ref={slot} className={styles.slot}>
      <div aria-hidden={active ? true : undefined} style={{ visibility: active ? 'hidden' : undefined }}>{controls}</div>
    </div>
    {active && createPortal(<>
      <div className={styles.backdrop} onClick={close} data-testid="sidebar-utility-backdrop" />
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.dialog} id={panelId}>
        <section className={styles.panel} style={{ left, bottom, width: popupWidth, maxHeight: Math.max(120, anchor.viewportHeight - bottom - margin) }}>
          <header className={styles.header}><h2 id={headingId}>{titles[active]}</h2>
            <button type="button" aria-label={`Close ${titles[active]}`} onClick={close}><i className="ph ph-x" aria-hidden="true" /></button>
          </header>
          {active === 'notifications' && <NotificationsMenu notifications={notifications} />}
          {active === 'branch' && <BranchSelector onSelected={close} />}
          {active === 'user' && <UserMenu onBranch={() => { opener.current = 'user'; setActive('branch'); }} onSignOut={() => { close(); setConfirmSignOut(true); }} onNavigate={close} />}
        </section>
        <div className={styles.floatingControls} style={{ left: anchor.left, top: anchor.top, width: anchor.width }}>{controls}</div>
      </div>
    </>, document.body)}
    {confirmSignOut && <ConfirmDialog open title="Sign out?" message={signOutError ? 'Unable to sign out. Please try again.' : 'Are you sure you want to sign out?'}
      confirmLabel="Sign out" loading={signingOut} onCancel={() => setConfirmSignOut(false)} onConfirm={() => void handleSignOut()} />}
  </>;
}
