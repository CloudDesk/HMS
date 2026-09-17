import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import type { useSidebarNotifications } from '../../hooks/notifications/useNotifications';
import styles from './SidebarUtilities.module.css';

export function NotificationsMenu({ notifications }: { notifications: ReturnType<typeof useSidebarNotifications> }) {
  const { query, total, markRead, isMarking, markError } = notifications;
  return <>
    <div className={styles.notificationToolbar}>
      <span aria-live="polite">{total} unread</span>
      <button type="button" disabled={!total || isMarking || query.isPending} onClick={() => void markRead()}>
        {isMarking ? 'Marking as read…' : 'Mark all read'}
      </button>
    </div>
    <div className={styles.scrollBody} aria-busy={isMarking || query.isPending}>
      {query.isPending && <p role="status">Loading notifications…</p>}
      {query.isError && <div role="alert"><p>Unable to load notifications.</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div>}
      {markError && <p role="alert">Some notifications could not be marked as read. Please retry.</p>}
      {!query.isPending && !query.isError && !total && <div className={styles.empty}>
        <i className="ph ph-bell-simple-slash" aria-hidden="true" />
        <strong>No notifications</strong><span>You’re all caught up.</span>
      </div>}
      {query.data?.data.map((notification) => {
        const date = parseISO(notification.created_at);
        const icon = notification.type === 'REFERRAL' ? 'ph-user-switch' : notification.type === 'CALL_NEXT_PATIENT' ? 'ph-megaphone' : 'ph-bell';
        return <article className={styles.notification} key={notification.id}>
          <i className={`ph ${icon} ${notification.type === 'REFERRAL' ? styles.referral : styles.neutral}`} aria-hidden="true" />
          <div className={styles.notificationCopy}>
            <strong>{notification.title}</strong>
            <p title={notification.message}>{notification.message}</p>
            <time dateTime={isValid(date) ? notification.created_at : undefined} title={isValid(date) ? date.toLocaleString() : undefined}>
              {isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Time unavailable'}
            </time>
          </div>
          {!notification.is_read && <button type="button" className={styles.unread} disabled={isMarking}
            aria-label={`Mark ${notification.title} as read`} title="Unread — mark as read" onClick={() => void markRead(notification.id)}>●</button>}
        </article>;
      })}
      {total > (query.data?.data.length ?? 0) && <p className={styles.muted}>Showing the latest 10 unread notifications. Marking these read reveals earlier items.</p>}
    </div>
  </>;
}
