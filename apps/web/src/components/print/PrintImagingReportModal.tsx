import type { ImagingReport } from '../../api/imaging';
import type { DiagnosticOrder } from '../../api/laboratory';
import { formatDate } from '../../pages/patient-utils';
import { Modal } from '../ui/Modal';
import { PrintReceiptLayout } from './PrintReceiptLayout';
import type { ReactNode } from 'react';

type Props = { order: DiagnosticOrder; report: ImagingReport; onClose: () => void };
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const ReportSection = ({ title, children }: { title: string; children: ReactNode }) => <section style={{ marginTop: '1rem' }}>
  <h4 style={{ borderBottom: '1px solid #e2e8f0', color: '#4f46e5', fontSize: '0.75rem', paddingBottom: '0.35rem', textTransform: 'uppercase' }}>{title}</h4>
  <p style={{ lineHeight: 1.6 }}>{children}</p>
</section>;

export function PrintImagingReportModal({ order, report, onClose }: Props) {
  const gridItems = [
    { label: 'Report No', value: report.id.slice(0, 8).toUpperCase() },
    { label: 'Order No', value: order.originating_order_id.slice(0, 8).toUpperCase() },
    { label: 'Reported', value: formatDate(report.entered_at) },
    { label: 'Patient', value: order.patient_name },
    { label: 'Patient Number', value: order.patient_number },
    { label: 'Source', value: label(order.source_type) },
    { label: 'Encounter', value: order.encounter_id?.slice(-8).toUpperCase() ?? '-' },
    { label: 'Status', value: label(order.status) },
  ];
  return <Modal onClose={onClose} open title="Imaging Report">
    <div style={{ position: 'relative' }}>
      <PrintReceiptLayout gridItems={gridItems} title="Official Imaging Report">
        <ReportSection title="Study">{order.items.map((item) => item.service_name).join(', ')}</ReportSection>
        <ReportSection title="Clinical Notes">{order.clinical_notes ?? 'None recorded.'}</ReportSection>
        <ReportSection title="Findings">{report.findings}</ReportSection>
        <ReportSection title="Impression"><strong>{report.impression}</strong></ReportSection>
        <ReportSection title="Recommendations">{report.recommendations ?? 'None recorded.'}</ReportSection>
        <div style={{ marginTop: '1rem', color: '#64748b' }}>{report.verified_at ? `Verified ${formatDate(report.verified_at)}` : 'Report awaiting verification'}</div>
      </PrintReceiptLayout>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', padding: '0 2rem 2rem' }}>
        <button className="doc-btn" onClick={onClose} type="button">Close</button>
        <button className="doc-btn primary" onClick={() => window.print()} type="button"><i className="ph ph-printer" /> Print Report</button>
      </div>
    </div>
  </Modal>;
}
