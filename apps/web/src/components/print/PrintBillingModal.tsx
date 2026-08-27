import React from 'react';
import type { BillingInvoice } from '../../api/billing';
import type { PatientResponse } from '../../api/patients';
import { PrintReceiptLayout } from './PrintReceiptLayout';
import { Modal } from '../ui/Modal';
import { formatDate } from '../../pages/patient-utils';
import { useCurrencyFormatter } from '../../api/useSettings';

type Props = {
  invoice: BillingInvoice | null;
  patient: PatientResponse | null;
  onClose: () => void;
};

export function PrintBillingModal({ invoice, patient, onClose }: Props) {
  const formatCurrency = useCurrencyFormatter();
  if (!invoice || !patient) return null;

  const handlePrint = () => {
    window.print();
  };

  const gridItems = [
    { label: 'Invoice No', value: invoice.invoice_number },
    { label: 'Date', value: formatDate(invoice.created_at) },
    { label: 'Patient', value: `${patient.first_name} ${patient.last_name}` },
    { label: 'Patient Number', value: patient.patient_number },
    { label: 'Status', value: invoice.status },
  ];

  return (
    <Modal onClose={onClose} open={Boolean(invoice)} title="Print Invoice">
      <div style={{ position: 'relative' }}>
        <PrintReceiptLayout gridItems={gridItems} title="Official Invoice">
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              Billed Services
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.5rem' }}>Description</th>
                  <th style={{ padding: '0.5rem' }}>Quantity</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: '#0f172a' }}>{item.service_name}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.quantity}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
                {(!invoice.items || invoice.items.length === 0) && (
                  <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No services billed</td></tr>
                )}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '0.875rem' }}>
                <span style={{ color: '#64748b' }}>Total Amount:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(invoice.total_amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '0.875rem' }}>
                <span style={{ color: '#64748b' }}>Balance Due:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(invoice.balance_amount)}</strong>
              </div>
              
              {invoice.status === 'PAID' && (
                <div style={{ 
                  marginTop: '1rem', 
                  backgroundColor: '#dcfce7', 
                  color: '#166534', 
                  padding: '1rem', 
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%'
                }}>
                  <strong style={{ fontSize: '1rem' }}>Amount Paid</strong>
                  <strong style={{ fontSize: '1rem' }}>{formatCurrency(invoice.total_amount - invoice.balance_amount)}</strong>
                </div>
              )}
            </div>
          </div>
        </PrintReceiptLayout>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', padding: '0 2rem 2rem' }}>
          <button className="doc-btn" onClick={onClose} type="button">Close</button>
          <button className="doc-btn primary" onClick={handlePrint} type="button"><i className="ph ph-printer" /> Print Invoice</button>
        </div>
      </div>
    </Modal>
  );
}
