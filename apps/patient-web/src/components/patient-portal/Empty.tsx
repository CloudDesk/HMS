export function Empty({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="portal-empty">
      <i className={`ph ${icon}`} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
