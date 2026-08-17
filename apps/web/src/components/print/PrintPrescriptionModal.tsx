import React from 'react';
import type { OpdPrescriptionResponse } from '../../api/opd';
import type { PatientResponse } from '../../api/patients';
import { PrintReceiptLayout } from './PrintReceiptLayout';
import { Modal } from '../ui/Modal';
import { formatDate } from '../../pages/patient-utils';

type Props = {
  prescription: OpdPrescriptionResponse | null;
  patient: PatientResponse | null;
  onClose: () => void;
};

export function PrintPrescriptionModal({ prescription, patient, onClose }: Props) {
  if (!prescription || !patient) return null;

  const handlePrint = () => {
    window.print();
  };

  const gridItems = [
    { label: 'Prescription No', value: prescription.id.slice(0, 8).toUpperCase() },
    { label: 'Date', value: formatDate(prescription.created_at) },
    { label: 'Patient', value: `${patient.first_name} ${patient.last_name}` },
    { label: 'Patient Number', value: patient.patient_number },
    { label: 'Doctor', value: prescription.doctor_name || '-' },
    { label: 'Status', value: prescription.status },
  ];

  return (
    <Modal onClose={onClose} open={Boolean(prescription)} title="Print Prescription">
      <div style={{ position: 'relative' }}>
        <PrintReceiptLayout gridItems={gridItems} title="Official Prescription">
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              Prescribed Medicines
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.5rem' }}>Medicine</th>
                  <th style={{ padding: '0.5rem' }}>Dosage</th>
                  <th style={{ padding: '0.5rem' }}>Frequency</th>
                  <th style={{ padding: '0.5rem' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {prescription.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: '#0f172a' }}>{item.medicine_name}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.dosage}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.frequency}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.duration}</td>
                  </tr>
                ))}
                {(!prescription.items || prescription.items.length === 0) && (
                  <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No items</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PrintReceiptLayout>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', padding: '0 2rem 2rem' }} className="print-hidden">
          <button className="doc-btn" onClick={onClose} type="button">Close</button>
          <button className="doc-btn primary" onClick={handlePrint} type="button"><i className="ph ph-printer" /> Print Prescription</button>
        </div>
      </div>
    </Modal>
  );
}
