type KpiTone = 'blue' | 'green' | 'orange' | 'purple' | 'red';

type KpiCardProps = {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone?: KpiTone;
};

export function KpiCard({ icon, label, value, detail, tone = 'blue' }: KpiCardProps) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <i className={`ph ${icon}`} aria-hidden="true" />
      </div>
      <div className="stat-info">
        <p>{label}</p>
        <h3>{value}</h3>
        <span>{detail}</span>
      </div>
    </article>
  );
}
