import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';
import { useLaboratoryQueueFeature } from '../hooks/laboratory/useLaboratoryQueueFeature';

export function LaboratoryQueuePage() {
  const feature = useLaboratoryQueueFeature();

  return (
    <DiagnosticQueue
      module="laboratory"
      title="Laboratory Work Queue"
      description="Manage laboratory orders, sample processing, and test results"
      statuses={['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
