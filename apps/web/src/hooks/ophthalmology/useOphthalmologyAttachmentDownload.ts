import { useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useDownloadPatientDocument } from '../patients/usePatients';
import type { OphthalmologyAttachment } from '../../api/ophthalmology';
import type { OphthalmologyResultWorkspace } from './useOphthalmologyResultFeature';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function useOphthalmologyAttachmentDownload(workspace: OphthalmologyResultWorkspace, taskId: string, attachments: OphthalmologyAttachment[], fresh: boolean) {
  const { user } = useAuth();
  const permitted = Boolean(user?.roles.some((r) => r.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'Patients', screen: 'Patient Documents', action: 'View' });
  const canDownload = permitted && workspace.canView && !workspace.scopeError && Boolean(workspace.context && workspace.visit && taskId) && !workspace.visitQuery.isError && !workspace.contextQuery.isError && fresh;
  const mutation = useDownloadPatientDocument();
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [workspace.visitId, workspace.context?.id, taskId, canDownload]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [failure, setFailure] = useState<{ scope: typeof lifecycle; message: string } | null>(null);
  return { canDownload, downloading: mutation.isPending, downloadError: failure?.scope === lifecycle ? failure.message : null,
    downloadAttachment: async (attachmentId: string) => {
      const source = attachments.find((row) => row.id === attachmentId && row.task_id === taskId && row.visit_id === workspace.visitId && row.context_id === workspace.context?.id && row.patient_id === workspace.visit?.patient_id && row.branch_id === workspace.visit.branch_id && row.department_id === workspace.visit.department_id);
      if (!canDownload || !source || lifecycle.pending) return;
      lifecycle.pending = true; setFailure(null);
      try {
        const file = await mutation.mutateAsync({ patientId: source.patient_id, docId: source.patient_document_id });
        if (!lifecycle.active) return;
        const url = URL.createObjectURL(file.blob);
        try { const link = document.createElement('a'); link.href = url; link.download = file.fileName ?? source.original_file_name; document.body.appendChild(link); link.click(); link.remove(); }
        finally { URL.revokeObjectURL(url); }
      } catch (error) { if (lifecycle.active) setFailure({ scope: lifecycle, message: getOpdErrorMessage(error) }); }
      finally { lifecycle.pending = false; }
    },
  };
}
