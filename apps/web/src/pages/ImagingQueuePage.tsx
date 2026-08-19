import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';
import { useImagingQueueFeature } from '../hooks/imaging/useImagingQueueFeature';

export function ImagingQueuePage() {
  const feature = useImagingQueueFeature();

  return (
    <DiagnosticQueue
      module="imaging"
      statuses={['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
