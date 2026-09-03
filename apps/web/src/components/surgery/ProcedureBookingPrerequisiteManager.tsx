import { useMemo } from 'react';
import type { ProcedureBooking } from '../../api/surgery';
import type { BedHold } from '../../api/admissions-configuration';
import { StatusBadge } from '../ui/StatusBadge';
import { usePatientDocuments } from '../../hooks/patients/usePatients';
import { useBillingInvoiceDetails } from '../../hooks/billing/useBilling';
import { useReservedBeds } from '../../hooks/admissions/useBedAvailability';

export function ProcedureBookingPrerequisiteManager({
  booking,
  branchId,
  procedure,
  selectedConsentId,
  selectedHoldId,
  onSelectConsent,
  onSelectHold,
}: {
  booking: ProcedureBooking;
  branchId: string;
  procedure?: {
    requires_consent: boolean;
    requires_advance_deposit: boolean;
    minimum_advance_deposit_amount?: number | null;
    requires_bed: boolean;
  };
  selectedConsentId: string;
  selectedHoldId: string;
  onSelectConsent: (id: string) => void;
  onSelectHold: (id: string) => void;
}) {
  const docsQuery = usePatientDocuments(booking.patient_id, {}, Boolean(procedure?.requires_consent));
  const invoiceQuery = useBillingInvoiceDetails(booking.deposit_invoice_id);
  const reservedBedsQuery = useReservedBeds(branchId, Boolean(procedure?.requires_bed && branchId));
  const bedHolds: BedHold[] = useMemo(() => {
    return (reservedBedsQuery.data?.data ?? [])
      .filter((b) => b.patient_id === booking.patient_id && b.current_hold_id)
      .map((b) => ({
        id: b.current_hold_id!,
        hold_number: b.hold_number ?? 'HOLD',
        idempotency_key: '',
        patient_id: b.patient_id!,
        branch_id: b.branch_id,
        ward_id: b.ward_id,
        bed_id: b.id,
        admission_id: null,
        bed_number: b.bed_number,
        ward_name: b.ward_name,
        room_number: b.room_number,
        status: 'ACTIVE' as const,
        held_at: '',
        expires_at: b.hold_expires_at ?? '',
        reason: 'Procedure Hold',
        terminal_reason: null,
        version: b.version,
        created_at: b.created_at,
        updated_at: b.updated_at,
      }));
  }, [reservedBedsQuery.data, booking.patient_id]);

  const consentRequired = Boolean(procedure?.requires_consent);
  const consentSatisfied =
    !consentRequired || Boolean(booking.consent_document_id) || Boolean(selectedConsentId);

  const depositRequired = Boolean(procedure?.requires_advance_deposit);
  const minDeposit = procedure?.minimum_advance_deposit_amount ?? 0;
  const invoice = invoiceQuery.data;
  const paidAmount = invoice?.paid_amount ?? 0;
  const depositSatisfied =
    !depositRequired ||
    Boolean(booking.deposit_invoice_id && (paidAmount >= minDeposit || invoice?.status === 'PAID'));

  const bedRequired = Boolean(procedure?.requires_bed);
  const bedSatisfied = !bedRequired || Boolean(booking.hold_id) || Boolean(selectedHoldId);

  const docsList = Array.isArray(docsQuery.data) ? docsQuery.data : (docsQuery.data?.data ?? []);
  const validConsentDocs = docsList.filter(
    (d: {
      document_type?: string;
      consent_category?: string | null;
      title?: string;
    }) =>
      d.document_type === 'CONSENT' ||
      d.consent_category ||
      (d.title && d.title.toLowerCase().includes('consent'))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Info Summary */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
            PROCEDURE
          </span>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{booking.service_name}</strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{booking.department_name}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
            PATIENT
          </span>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{booking.patient_name}</strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MRN: {booking.patient_number}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
            SURGEON / OPERATING DOCTOR
          </span>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{booking.doctor_name}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block' }}>
            SCHEDULED WINDOW
          </span>
          <strong style={{ fontSize: '0.85rem', color: '#0284c7' }}>
            {new Date(booking.scheduled_start).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </strong>
        </div>
      </div>

      <div
        style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: '#334155',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: '4px',
        }}
      >
        Service Prerequisite Verification
      </div>

      {/* 1. Consent Card */}
      <div
        style={{
          border: `1px solid ${consentSatisfied ? '#bbf7d0' : '#fde68a'}`,
          background: consentSatisfied ? '#f0fdf4' : '#fffbeb',
          borderRadius: '8px',
          padding: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: consentRequired && !booking.consent_document_id ? '10px' : '0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i
              className={`ph-fill ${consentSatisfied ? 'ph-check-circle' : 'ph-warning'}`}
              style={{ color: consentSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }}
            />
            <strong
              style={{
                fontSize: '0.85rem',
                color: consentSatisfied ? '#15803d' : '#92400e',
              }}
            >
              Consent Document
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: consentSatisfied ? '#166534' : '#b45309',
            }}
          >
            {!consentRequired ? '✓ Not required' : consentSatisfied ? '✓ Satisfied' : '⚠ Required'}
          </span>
        </div>

        {consentRequired && !booking.consent_document_id ? (
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Select Signed Consent Document for Patient:
            </label>
            <select
              value={selectedConsentId}
              onChange={(e) => onSelectConsent(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                padding: '0 8px',
                fontSize: '0.82rem',
                background: '#ffffff',
              }}
            >
              <option value="">-- Select Patient Consent Document --</option>
              {validConsentDocs.map(
                (doc: {
                  id: string;
                  title: string;
                  consent_category?: string | null;
                  document_type: string;
                  created_at: string;
                  consent_status?: string | null;
                  review_status: string;
                }) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.consent_category ?? doc.document_type}) — Uploaded{' '}
                    {new Date(doc.created_at).toLocaleDateString()} [{doc.consent_status ?? doc.review_status}]
                  </option>
                )
              )}
            </select>
            {validConsentDocs.length === 0 ? (
              <small
                style={{
                  color: '#b45309',
                  fontSize: '0.74rem',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                No consent document on file for this patient. Please upload a consent document under Patient Documents first.
              </small>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 2. Advance Payment Card */}
      <div
        style={{
          border: `1px solid ${depositSatisfied ? '#bbf7d0' : '#fde68a'}`,
          background: depositSatisfied ? '#f0fdf4' : '#fffbeb',
          borderRadius: '8px',
          padding: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: depositRequired ? '10px' : '0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i
              className={`ph-fill ${depositSatisfied ? 'ph-check-circle' : 'ph-warning'}`}
              style={{ color: depositSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }}
            />
            <strong
              style={{
                fontSize: '0.85rem',
                color: depositSatisfied ? '#15803d' : '#92400e',
              }}
            >
              Advance Payment / Deposit
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: depositSatisfied ? '#166534' : '#b45309',
            }}
          >
            {!depositRequired
              ? '✓ Not required'
              : depositSatisfied
                ? '✓ Satisfied'
                : '⚠ Action Required'}
          </span>
        </div>

        {depositRequired ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                  INVOICE #
                </span>
                <strong>{invoice?.invoice_number ?? 'Auto-generated'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                  REQUIRED ADVANCE
                </span>
                <strong>KES {minDeposit.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                  PAID AMOUNT
                </span>
                <strong style={{ color: paidAmount >= minDeposit ? '#16a34a' : '#dc2626' }}>
                  KES {paidAmount.toLocaleString()}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                  STATUS
                </span>
                <StatusBadge tone={depositSatisfied ? 'green' : 'orange'}>
                  {invoice?.status ?? 'PENDING'}
                </StatusBadge>
              </div>
            </div>
            {!depositSatisfied ? (
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: '0.75rem',
                  color: '#b45309',
                }}
              >
                Please collect payment of KES {minDeposit.toLocaleString()} for Invoice{' '}
                <strong>{invoice?.invoice_number}</strong> under Billing History before confirming this booking.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 3. Bed Hold Card */}
      <div
        style={{
          border: `1px solid ${bedSatisfied ? '#bbf7d0' : '#fde68a'}`,
          background: bedSatisfied ? '#f0fdf4' : '#fffbeb',
          borderRadius: '8px',
          padding: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: bedRequired && !booking.hold_id ? '10px' : '0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i
              className={`ph-fill ${bedSatisfied ? 'ph-check-circle' : 'ph-warning'}`}
              style={{ color: bedSatisfied ? '#16a34a' : '#d97706', fontSize: '1.2rem' }}
            />
            <strong
              style={{
                fontSize: '0.85rem',
                color: bedSatisfied ? '#15803d' : '#92400e',
              }}
            >
              Inpatient Bed Hold
            </strong>
          </div>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: bedSatisfied ? '#166534' : '#b45309',
            }}
          >
            {!bedRequired ? '✓ Not required' : bedSatisfied ? '✓ Satisfied' : '⚠ Required'}
          </span>
        </div>

        {bedRequired && !booking.hold_id ? (
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Select Active Bed Reservation for Patient:
            </label>
            <select
              value={selectedHoldId}
              onChange={(e) => onSelectHold(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                padding: '0 8px',
                fontSize: '0.82rem',
                background: '#ffffff',
              }}
            >
              <option value="">-- Select Active Reserved Bed --</option>
              {bedHolds.map((hold) => (
                <option key={hold.id} value={hold.id}>
                  {hold.ward_name} — Bed {hold.bed_number} (Expires:{' '}
                  {hold.expires_at
                    ? new Date(hold.expires_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Active'}
                  )
                </option>
              ))}
            </select>
            {bedHolds.length === 0 ? (
              <small
                style={{
                  color: '#b45309',
                  fontSize: '0.74rem',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                No active bed hold found for this patient. Please create a bed hold in IP Admissions configuration first.
              </small>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
