import { DiagnosticWorkspace } from '../components/diagnostics/DiagnosticWorkspace';
import { useImagingWorkspaceFeature } from '../hooks/imaging/useImagingWorkspaceFeature';

export function ImagingWorkspacePage() {
  const feature = useImagingWorkspaceFeature();

  return (
    <DiagnosticWorkspace
      module="imaging"
      statuses={['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
