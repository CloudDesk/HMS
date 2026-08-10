type EmptyStateProps = {
  icon?: string;
  title: string;
  message: string;
};

export function EmptyState({ icon = 'ph-folder-open', title, message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`ph ${icon}`} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
