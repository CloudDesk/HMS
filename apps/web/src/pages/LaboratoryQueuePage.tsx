import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';
import { useLaboratoryQueueFeature } from '../hooks/laboratory/useLaboratoryQueueFeature';

export function LaboratoryQueuePage() {
  const feature = useLaboratoryQueueFeature();

  return (
    <DiagnosticQueue
      module="laboratory"
      statuses={['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
