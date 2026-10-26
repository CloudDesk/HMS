import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';
import { useImagingQueueFeature } from '../hooks/imaging/useImagingQueueFeature';

export function ImagingQueuePage() {
  const feature = useImagingQueueFeature();

  return (
    <DiagnosticQueue
      module="imaging"
      title="Imaging Work Queue"
      description="Track imaging requisitions, capture scan status, and review radiology reports"
      statuses={['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
