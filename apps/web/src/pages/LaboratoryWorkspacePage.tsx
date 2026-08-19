import { DiagnosticWorkspace } from '../components/diagnostics/DiagnosticWorkspace';
import { useLaboratoryWorkspaceFeature } from '../hooks/laboratory/useLaboratoryWorkspaceFeature';

export function LaboratoryWorkspacePage() {
  const feature = useLaboratoryWorkspaceFeature();

  return (
    <DiagnosticWorkspace
      module="laboratory"
      statuses={['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']}
      {...feature}
    />
  );
}
