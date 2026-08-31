import { useEffect, useState, useRef } from 'react';
import { notificationsApi, type NotificationResponse } from '../../api/notifications';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.listMe({ is_read: false, limit: 10 });
      setNotifications(res.data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notifications-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        className="doc-btn icon-only"
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '8px',
          border: open ? '1px solid #3b82f6' : '1px solid #e2e8f0',
          background: open ? '#eff6ff' : '#ffffff',
          color: open ? '#2563eb' : '#475569',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title="Notifications"
        type="button"
      >
        <i className="ph ph-bell" style={{ fontSize: '1.2rem' }} aria-hidden="true" />
        {notifications.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '999px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
              border: '2px solid #ffffff',
            }}
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown-card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '440px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #edf2f7',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Notifications</h3>
              {notifications.length > 0 && (
                <span
                  style={{
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '10px',
                  }}
                >
                  {notifications.length} new
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                fontSize: '1rem',
              }}
              title="Close"
              type="button"
            >
              <i className="ph ph-x" />
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 0.75rem',
                    color: '#94a3b8',
                    fontSize: '1.4rem',
                  }}
                >
                  <i className="ph ph-bell-simple-slash" />
                </div>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                  No new notifications
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>You are all caught up with hospital updates.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#2563eb',
                      marginTop: '6px',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 0.2rem 0',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                        lineHeight: 1.3,
                      }}
                    >
                      {n.title}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.78rem',
                        color: '#64748b',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </p>
                  </div>
                  <button
                    disabled={loading}
                    onClick={(e) => handleMarkAsRead(n.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'color 0.15s ease',
                    }}
                    title="Mark as read"
                    type="button"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#16a34a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                    }}
                  >
                    <i className="ph ph-check-circle" style={{ fontSize: '1.15rem' }} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
