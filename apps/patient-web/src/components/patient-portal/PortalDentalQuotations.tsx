import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientPortalApi, type PortalDentalQuotation } from '../../api/patient-portal';
import { portalQueryKeys } from '../../api/query-keys';
import { Empty } from './Empty';
import { date, label, money } from '../../utils/formatters';
import { PortalQuotationDetailModal } from './modals/PortalQuotationDetailModal';

type PortalDentalQuotationsProps = {
  patientId: string;
};

function formatDoctorName(name?: string) {
  if (!name) return 'Dentist';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
}

export function PortalDentalQuotations({ patientId }: PortalDentalQuotationsProps) {
  const [selectedQuotation, setSelectedQuotation] = useState<PortalDentalQuotation | null>(null);

  const { data: quotations = [], isLoading, isError, refetch } = useQuery({
    queryKey: portalQueryKeys.dentalQuotations(patientId),
    queryFn: () => patientPortalApi.dentalQuotations(patientId),
    enabled: Boolean(patientId),
  });

  if (isLoading) {
    return (
      <div className="portal-empty" style={{ padding: '3rem' }}>
        <div className="portal-spinner" />
        <strong>Loading treatment quotations…</strong>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="portal-empty portal-empty--error" style={{ padding: '2rem' }}>
        <i className="ph ph-warning-circle" />
        <strong>Could not load treatment quotations</strong>
        <button onClick={() => void refetch()} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (!quotations.length) {
    return (
      <Empty
        icon="ph-tooth"
        message="When your dental care team prepares and sends a formal treatment quotation or treatment plan options, it will appear here for your review."
        title="No treatment quotations"
      />
    );
  }

  return (
    <>
      <div className="portal-billing-list" style={{ marginTop: '1rem' }}>
        {quotations.map((quote) => {
          const isPending = quote.status === 'SENT' || quote.status === 'POSTPONED';
          const isAccepted = quote.status === 'ACCEPTED';
          const optionsCount = quote.options?.length ?? 0;

          const statusLabel =
            quote.status === 'SENT'
              ? 'Pending Your Decision'
              : quote.status === 'ACCEPTED'
                ? 'Accepted'
                : quote.status === 'REJECTED'
                  ? 'Declined'
                  : quote.status === 'POSTPONED'
                    ? 'Decision Postponed'
                    : label(quote.status);

          const statusClass =
            quote.status === 'SENT'
              ? 'blue'
              : quote.status === 'ACCEPTED'
                ? 'paid'
                : quote.status === 'REJECTED'
                  ? 'due'
                  : 'pending';

          const minTotal = quote.options && quote.options.length > 0
            ? Math.min(...quote.options.map((o) => o.total))
            : quote.total;
          const maxTotal = quote.options && quote.options.length > 0
            ? Math.max(...quote.options.map((o) => o.total))
            : quote.total;

          const priceDisplay =
            minTotal === maxTotal
              ? money(minTotal)
              : `${money(minTotal)} – ${money(maxTotal)}`;

          return (
            <article
              className="portal-billing-card"
              key={quote.id}
              style={{
                border: isPending ? '2px solid #93c5fd' : undefined,
                background: isPending ? '#f8fafc' : undefined,
              }}
            >
              <div className="portal-billing-card-head">
                <div className="portal-list-icon" style={{ background: isAccepted ? '#dcfce7' : '#eff6ff', color: isAccepted ? '#16a34a' : '#2563eb' }}>
                  <i className={`ph ${isAccepted ? 'ph-check-circle' : 'ph-tooth'}`} />
                </div>
                <div>
                  <h2>{quote.quotation_number}</h2>
                  <span>
                    {formatDoctorName(quote.doctor_name)} · Sent {date(quote.sent_at || quote.created_at)}
                  </span>
                </div>
                <span className={`portal-status ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="portal-billing-amounts">
                <div>
                  <span>Treatment Options</span>
                  <strong>{optionsCount > 0 ? `${optionsCount} Option${optionsCount > 1 ? 's' : ''}` : 'Single Plan'}</strong>
                </div>
                <div>
                  <span>Estimated Total</span>
                  <strong>{priceDisplay}</strong>
                </div>
                <div className={isAccepted ? 'paid' : 'due'}>
                  <span>Status</span>
                  <strong>{isAccepted ? quote.selected_option_name || 'Accepted' : isPending ? 'Action Required' : statusLabel}</strong>
                </div>
              </div>

              {quote.notes && (
                <p style={{ margin: '0.5rem 1.25rem 0.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <em>"{quote.notes}"</em>
                </p>
              )}

              <footer>
                <small>
                  {isAccepted
                    ? `Accepted: ${quote.selected_option_name || 'Selected Option'}`
                    : isPending
                      ? 'Please review options and select your preferred treatment plan.'
                      : quote.status === 'REJECTED'
                        ? 'Quotation was declined.'
                        : 'Decision is pending.'}
                </small>
                <button
                  type="button"
                  onClick={() => setSelectedQuotation(quote)}
                  style={
                    isPending
                      ? {
                          background: 'var(--patient-primary)',
                          color: '#ffffff',
                          borderColor: 'var(--patient-primary)',
                        }
                      : undefined
                  }
                >
                  <i className={`ph ${isPending ? 'ph-cursor-click' : 'ph-eye'}`} />
                  {isPending ? 'Review Options & Respond' : 'View Quotation Details'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>

      <PortalQuotationDetailModal
        quotation={selectedQuotation}
        patientId={patientId}
        onClose={() => setSelectedQuotation(null)}
      />
    </>
  );
}
