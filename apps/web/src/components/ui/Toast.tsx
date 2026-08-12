type ToastProps = {
  message: string;
  tone: 'success' | 'error';
  visible: boolean;
};

export function Toast({ message, tone, visible }: ToastProps) {
  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`toast toast--${tone}${visible ? ' show' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {message}
    </div>
  );
}
