import { useState } from 'react';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="notifications">
      <button className="icon-btn" onClick={() => setOpen((current) => !current)} type="button">
        <i className="ph ph-bell" aria-hidden="true" />
        <span className="sr-only">Notifications</span>
      </button>
      {open ? (
        <div className="notification-panel">
          <div className="notification-panel__header">
            <strong>Notifications</strong>
            <span>0 new</span>
          </div>
          <div className="notification-list">
            <div className="patient-empty-inline">No notifications are available.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
