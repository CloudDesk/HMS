type ToastProps = {
  message: string;
  tone?: 'success' | 'error';
  visible: boolean;
};

export function Toast({ message, tone = 'success', visible }: ToastProps) {
  if (!visible) return null;
  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`toast toast--${tone}${visible ? ' show' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <i className={`ph ${tone === 'error' ? 'ph-x-circle' : 'ph-check-circle'}`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
