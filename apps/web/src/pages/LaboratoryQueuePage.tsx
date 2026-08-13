import { laboratoryApi } from '../api/laboratory';
import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';

export function LaboratoryQueuePage() {
  return <DiagnosticQueue module="laboratory" statuses={['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']} list={laboratoryApi.list} summary={laboratoryApi.summary} />;
}
