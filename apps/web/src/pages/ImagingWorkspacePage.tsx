import { imagingApi } from '../api/imaging';
import { DiagnosticWorkspace } from '../components/diagnostics/DiagnosticWorkspace';

export function ImagingWorkspacePage() {
  return <DiagnosticWorkspace module="imaging" statuses={['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']} getOrder={imagingApi.get} updateStatus={imagingApi.updateStatus} />;
}
