import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { PatientDocumentResponse } from '../../api/patients';
import {
  useEnterImagingReport,
  useImagingOrderDetails,
  useImagingReport,
  useUpdateImagingReport,
} from './useImaging';
import { navigate, useAppLocation } from '../../routing/navigation';
import type { ImagingReportPayload } from '../../api/imaging';
import {
  useDownloadPatientDocument,
  usePatientDocuments,
  useUploadPatientDocument,
} from '../patients/usePatients';
import { toast } from 'sonner';

export function useImagingReportFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const id = new URLSearchParams(location.search).get('id') ?? '';

  const orderQuery = useImagingOrderDetails(id || null);
  const order = orderQuery.data;

  const hasReport = ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const reportQuery = useImagingReport(id || null, hasReport);
  const report = reportQuery.data;

  const enterReport = useEnterImagingReport();
  const updateReport = useUpdateImagingReport();

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canEnterReport = superAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Imaging', screen: 'Orders', action: 'EnterReport',
  });
  const canViewAttachments = superAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Patients', screen: 'Patient Documents', action: 'View',
  });
  const canUploadAttachments = superAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Patients', screen: 'Patient Documents', action: 'Create',
  });

  const attachmentMarker = order ? `Imaging order ${order.originating_order_id}` : '';
  const attachmentsQuery = usePatientDocuments(order?.patient_id ?? null, {
    document_type: 'CLINICAL',
    visit_id: order?.visit_id,
    limit: 100,
  }, canViewAttachments && Boolean(order));
  const attachments = (attachmentsQuery.data?.data ?? []).filter(
    (document) => document.description === attachmentMarker,
  );
  const uploadAttachment = useUploadPatientDocument();
  const downloadAttachment = useDownloadPatientDocument();

  const readOnly = ['VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const canEdit = ['IN_PROGRESS', 'REPORT_ENTERED'].includes(order?.status ?? '');

  const isLoading = orderQuery.isLoading || (hasReport && reportQuery.isLoading);
  const isError = orderQuery.isError || !order || (hasReport && reportQuery.isError);
  const isSaving = enterReport.isPending || updateReport.isPending;

  const saveReport = (payload: ImagingReportPayload) => {
    if (!id || !order) return;

    const options = { onSuccess: () => navigate(`/imaging/workspace?id=${id}`) };

    if (order.status === 'IN_PROGRESS') {
      enterReport.mutate({ id, payload }, options);
    } else {
      updateReport.mutate({ id, payload }, options);
    }
  };

  const uploadAttachments = async (files: File[]) => {
    if (!order || !canUploadAttachments || files.length === 0) return;
    for (const file of files) {
      await uploadAttachment.mutateAsync({
        id: order.patient_id,
        payload: {
          visit_id: order.visit_id,
          admission_id: order.admission_id ?? undefined,
          procedure_id: order.procedure_id ?? undefined,
          branch_id: order.branch_id,
          document_type: 'CLINICAL',
          title: `Imaging attachment: ${file.name}`,
          description: attachmentMarker,
          file,
        },
      });
    }
    toast.success(`${files.length} imaging attachment${files.length === 1 ? '' : 's'} uploaded.`);
  };

  const downloadAttachmentFile = async (document: PatientDocumentResponse) => {
    if (!order || !canViewAttachments) return;
    try {
      const download = await downloadAttachment.mutateAsync({ patientId: order.patient_id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('The imaging attachment could not be downloaded.');
    }
  };

  return {
    id,
    order,
    report,
    isLoading,
    isError,
    isSaving,
    readOnly,
    canEdit,
    canEnterReport,
    canViewAttachments,
    canUploadAttachments,
    attachments,
    attachmentsLoading: attachmentsQuery.isLoading,
    attachmentsError: attachmentsQuery.isError,
    uploadingAttachments: uploadAttachment.isPending,
    downloadingAttachment: downloadAttachment.isPending,
    actions: {
      saveReport,
      uploadAttachments,
      downloadAttachment: downloadAttachmentFile,
    }
  };
}
