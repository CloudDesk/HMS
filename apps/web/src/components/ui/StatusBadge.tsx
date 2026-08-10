type StatusTone = 'green' | 'orange' | 'purple' | 'red' | 'blue' | 'gray';

type StatusBadgeProps = {
  children: string;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = 'gray' }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
