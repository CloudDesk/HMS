import React from 'react';
import { useAuth } from '../../auth/useAuth';
import { useActiveBranch } from '../../context/BranchContext';
import { useHospitalSettings } from '../../hooks/settings/useSettings';

type PrintReceiptLayoutProps = {
  title: string;
  gridItems: { label: string; value: React.ReactNode }[];
  children: React.ReactNode;
};

export function PrintReceiptLayout({ title, gridItems, children }: PrintReceiptLayoutProps) {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const { hospitalName, phone, email, address, logoUrl } = useHospitalSettings();

  const branchName =
    user?.branches?.find((b) => b.id === activeBranchId)?.name ||
    user?.branches?.[0]?.name ||
    '';

  const displayName = hospitalName
    ? branchName && branchName !== hospitalName
      ? `${hospitalName} - ${branchName}`
      : hospitalName
    : branchName || 'HMS Enterprise';

  const contactDetails = [address, phone, email].filter(Boolean).join(' · ');

  const dateStr = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <article className="print-receipt-paper billing-receipt-paper" style={{ padding: '2rem', backgroundColor: 'white', color: 'black' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {logoUrl ? (
          <img alt={hospitalName} src={logoUrl} style={{ height: '48px', maxWidth: '200px', objectFit: 'contain', margin: '0 auto 0.5rem', display: 'block' }} />
        ) : (
          <i className="ph-fill ph-hospital" style={{ fontSize: '2rem', color: '#0f172a' }} />
        )}
        <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 600 }}>{displayName}</h3>
        {contactDetails ? (
          <p style={{ margin: '0 0 0.5rem', color: '#475569', fontSize: '0.8rem' }}>{contactDetails}</p>
        ) : null}
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{title}</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '1.5rem',
          marginBottom: '2.5rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1.5rem'
        }}
      >
        {gridItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              {item.label}
            </span>
            <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{item.value || '-'}</strong>
          </div>
        ))}
      </div>

      <div style={{ minHeight: '200px' }}>
        {children}
      </div>

      <footer style={{ marginTop: '3rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', textAlign: 'center' }}>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem' }}>
          Generated {dateStr} · Electronically generated document
        </p>
      </footer>
    </article>
  );
}
