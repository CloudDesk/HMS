import { useState } from 'react';
import { mockNotifications } from '../../data/ui-foundation';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="notifications">
      <button className="icon-btn" onClick={() => setOpen((current) => !current)} type="button">
        <i className="ph ph-bell" aria-hidden="true" />
        <span className="notification-dot" />
        <span className="sr-only">Notifications</span>
      </button>
      {open ? (
        <div className="notification-panel">
          <div className="notification-panel__header">
            <strong>Notifications</strong>
            <span>{mockNotifications.length} new</span>
          </div>
          <div className="notification-list">
            {mockNotifications.map((notification) => (
              <article className="notification-item" key={notification.id}>
                <span className={`notification-icon ${notification.tone}`} />
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.description}</p>
                  <small>{notification.time}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
