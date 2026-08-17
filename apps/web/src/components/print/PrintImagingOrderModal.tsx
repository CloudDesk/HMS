import React from 'react';
import type { DiagnosticOrder } from '../../api/laboratory';
import type { PatientResponse } from '../../api/patients';
import { PrintReceiptLayout } from './PrintReceiptLayout';
import { Modal } from '../ui/Modal';
import { formatDate } from '../../pages/patient-utils';

type Props = {
  order: DiagnosticOrder | null; // Reusing DiagnosticOrder as per Imaging API integration typically
  patient: PatientResponse | null;
  onClose: () => void;
};

export function PrintImagingOrderModal({ order, patient, onClose }: Props) {
  if (!order || !patient) return null;

  const handlePrint = () => {
    window.print();
  };

  const gridItems = [
    { label: 'Order No', value: order.id.slice(0, 8).toUpperCase() },
    { label: 'Date', value: formatDate(order.created_at) },
    { label: 'Patient', value: `${patient.first_name} ${patient.last_name}` },
    { label: 'Patient Number', value: patient.patient_number },
    { label: 'Doctor', value: order.doctor_name || '-' },
    { label: 'Status', value: order.status },
  ];

  return (
    <Modal onClose={onClose} open={Boolean(order)} title="Print Imaging Order">
      <div style={{ position: 'relative' }}>
        <PrintReceiptLayout gridItems={gridItems} title="Official Imaging Order">
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              Scans Requested
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.5rem' }}>Scan / Modality</th>
                  <th style={{ padding: '0.5rem' }}>Category</th>
                  <th style={{ padding: '0.5rem' }}>Priority</th>
                  <th style={{ padding: '0.5rem' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: '#0f172a' }}>{item.investigation_name}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.category || '-'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span className={`status-badge priority-${order.priority.toLowerCase()}`}>{order.priority}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{'-'}</td>
                  </tr>
                ))}
                {(!order.items || order.items.length === 0) && (
                  <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No items</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PrintReceiptLayout>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', padding: '0 2rem 2rem' }}>
          <button className="doc-btn" onClick={onClose} type="button">Close</button>
          <button className="doc-btn primary" onClick={handlePrint} type="button"><i className="ph ph-printer" /> Print Imaging Order</button>
        </div>
      </div>
    </Modal>
  );
}
