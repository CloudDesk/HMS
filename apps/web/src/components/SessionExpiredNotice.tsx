type SessionExpiredNoticeProps = {
  visible: boolean;
};

export function SessionExpiredNotice({ visible }: SessionExpiredNoticeProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="auth-alert auth-alert--warning" role="status">
      Your session has expired. Sign in again to continue.
    </div>
  );
}
