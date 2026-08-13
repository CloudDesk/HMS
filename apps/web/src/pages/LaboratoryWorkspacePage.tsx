import { laboratoryApi } from '../api/laboratory';
import { DiagnosticWorkspace } from '../components/diagnostics/DiagnosticWorkspace';

export function LaboratoryWorkspacePage() {
  return <DiagnosticWorkspace module="laboratory" statuses={['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']} getOrder={laboratoryApi.get} updateStatus={laboratoryApi.updateStatus} />;
}
