import { imagingApi } from '../api/imaging';
import { DiagnosticQueue } from '../components/diagnostics/DiagnosticQueue';

export function ImagingQueuePage() {
  return <DiagnosticQueue module="imaging" statuses={['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']} list={imagingApi.list} summary={imagingApi.summary} />;
}
