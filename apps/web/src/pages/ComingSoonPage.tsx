import { DashboardLayout } from '../components/layout/DashboardLayout';

type ComingSoonPageProps = {
  title: string;
  icon?: string;
  description?: string;
  activeHref?: string;
  activeModule?: string;
};

/**
 * Placeholder page rendered for routes that exist in the sidebar navigation
 * but whose full page component has not yet been built. Displays inside the
 * real DashboardLayout so the sidebar, header, and navigation remain intact.
 */
export function ComingSoonPage({
  title,
  icon = 'ph-wrench',
  description,
}: ComingSoonPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        color: '#64748b',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <span
        style={{
          width: 72,
          height: 72,
          borderRadius: '16px',
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          color: '#94a3b8',
        }}
      >
        <i className={`ph ${icon}`} aria-hidden="true" />
      </span>
      <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#334155', fontWeight: 700 }}>
        {title}
      </h2>
      <p style={{ margin: 0, maxWidth: 380, fontSize: '0.92rem', lineHeight: 1.6 }}>
        {description ?? 'This module is under development and will be available soon.'}
      </p>
    </div>
  );
}
