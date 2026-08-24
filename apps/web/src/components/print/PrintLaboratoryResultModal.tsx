import type { DiagnosticOrder, LaboratoryResult } from '../../api/laboratory';
import { formatDate } from '../../pages/patient-utils';
import { Modal } from '../ui/Modal';
import { PrintReceiptLayout } from './PrintReceiptLayout';

type Props = {
  order: DiagnosticOrder;
  result: LaboratoryResult;
  onClose: () => void;
};

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function PrintLaboratoryResultModal({ order, result, onClose }: Props) {
  const gridItems = [
    { label: 'Report No', value: result.id.slice(0, 8).toUpperCase() },
    { label: 'Order No', value: order.originating_order_id.slice(0, 8).toUpperCase() },
    { label: 'Reported', value: formatDate(result.entered_at) },
    { label: 'Patient', value: order.patient_name },
    { label: 'Patient Number', value: order.patient_number },
    { label: 'Source', value: label(order.source_type) },
    { label: 'Encounter', value: order.encounter_id?.slice(-8).toUpperCase() ?? '-' },
    { label: 'Status', value: label(order.status) },
  ];

  return <Modal onClose={onClose} open title="Laboratory Report">
    <div style={{ position: 'relative' }}>
      <PrintReceiptLayout gridItems={gridItems} title="Official Laboratory Report">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead><tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
            <th style={{ padding: '0.5rem' }}>Test</th><th style={{ padding: '0.5rem' }}>Result</th>
            <th style={{ padding: '0.5rem' }}>Unit</th><th style={{ padding: '0.5rem' }}>Reference Range</th>
          </tr></thead>
          <tbody>{result.result_items.map((item) => <tr key={item.service_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{item.service_name}</td>
            <td style={{ padding: '0.75rem 0.5rem' }}>{item.value}</td>
            <td style={{ padding: '0.75rem 0.5rem' }}>{item.unit ?? '-'}</td>
            <td style={{ padding: '0.75rem 0.5rem' }}>{item.reference_range ?? '-'}</td>
          </tr>)}</tbody>
        </table>
        {result.remarks ? <div style={{ marginTop: '1rem' }}><strong>Remarks</strong><p>{result.remarks}</p></div> : null}
        <div style={{ marginTop: '1rem', color: '#64748b' }}>
          {result.verified_at ? `Verified ${formatDate(result.verified_at)}` : 'Result awaiting verification'}
        </div>
      </PrintReceiptLayout>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', padding: '0 2rem 2rem' }}>
        <button className="doc-btn" onClick={onClose} type="button">Close</button>
        <button className="doc-btn primary" onClick={() => window.print()} type="button"><i className="ph ph-printer" /> Print Report</button>
      </div>
    </div>
  </Modal>;
}
