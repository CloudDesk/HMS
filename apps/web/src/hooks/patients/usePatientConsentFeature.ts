
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import {
  type ApiPatientConsentStatus,
  type PatientDocumentResponse,
} from '../../api/patients';
import {
  usePatientsList,
  usePatientDetails,
  usePatientDocuments,
  useUploadPatientDocument,
  useDeletePatientDocument,
  useDownloadPatientDocument,
  useReplacePatientDocument,
  useVerifyPatientConsent,
} from './usePatients';
import { useConsentTemplates } from '../consents/useConsents';
import type { ConsentContextType } from '../../api/consents';
import { getPatientErrorMessage } from '../../pages/patient-utils';

export function usePatientConsentFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedPatientId = searchParams.get('id') || null;

  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Patients', screen: 'Consent', action,
  });

  const canCreate = can('Attach');
  const canDelete = can('Delete');
  const canView = can('View');
  const canEdit = can('Attach');
  const canVerify = can('Verify');

  const { data: listRes } = usePatientsList({ status: 'ACTIVE', limit: 100 });
  const patients = listRes?.data || [];
  const patientId = requestedPatientId || patients[0]?.id || null;

  const { data: patient, isLoading: loadingPatient } = usePatientDetails(patientId);
  const { data: templates = [], isLoading: loadingTemplates } = useConsentTemplates({ branch_id: patient?.registration_branch_id ?? '', status: 'ACTIVE' }, canView && Boolean(patient?.registration_branch_id));
  const { data: docsRes, isLoading: loadingDocs } = usePatientDocuments(patientId, { document_type: 'CONSENT', limit: 100 });
  const consents = docsRes?.data || [];
  const loading = loadingPatient || loadingDocs || loadingTemplates;

  const uploadDoc = useUploadPatientDocument();
  const deleteDoc = useDeletePatientDocument();
  const downloadDoc = useDownloadPatientDocument();
  const replaceDoc = useReplacePatientDocument();
  const verifyDoc = useVerifyPatientConsent();

  const handlePatientChange = (id: string) => {
    navigate(`/patients/consent?id=${encodeURIComponent(id)}`);
  };

  const handleDownload = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await downloadDoc.mutateAsync({ patientId: patient.id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = download.fileName ?? document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const handleView = async (document: PatientDocumentResponse) => {
    if (!patient) return;
    try {
      const download = await downloadDoc.mutateAsync({ patientId: patient.id, docId: document.id });
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const handleDelete = async (docId: string) => {
    if (!patient) return;
    try {
      await deleteDoc.mutateAsync({ id: patient.id, documentId: docId });
      toast.success('Consent file deleted.');
    } catch {
      //
    }
  };

  const handleReplace = async (
    replacing: PatientDocumentResponse,
    replacementFile: File
  ) => {
    if (!patient) return;
    try {
      await replaceDoc.mutateAsync({
        id: patient.id,
        documentId: replacing.id,
        payload: {
          document_type: 'CONSENT',
          title: replacing.title,
          description: replacing.description,
          consent_status: 'ATTACHED',
          signed_at: replacing.signed_at ?? undefined,
          valid_until: replacing.valid_until ?? undefined,
          signed_by_name: replacing.signed_by_name ?? undefined,
          file: replacementFile,
        }
      });
      toast.success('Consent file replaced successfully.');
    } catch {
      // Handled globally
    }
  };

  const handleUpload = async (
    file: File,
    title: string,
    description: string,
    status: ApiPatientConsentStatus,
    signedAt: string,
    validUntil: string,
    signedByName: string,
    templateId: string,
    contextType: ConsentContextType,
    contextId: string,
  ) => {
    if (!patient) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template || !patient.registration_branch_id) throw new Error('Select a valid consent template.');
    await uploadDoc.mutateAsync({
      id: patient.id,
      payload: {
        document_type: 'CONSENT',
        title: title.trim(),
        description: description.trim() || undefined,
        consent_status: status,
        consent_template_id: template.id,
        consent_category: template.category,
        consent_version: template.version,
        branch_id: patient.registration_branch_id,
        context_type: contextType,
        context_id: contextId || patient.id,
        visit_id: contextType === 'PROCEDURE' ? contextId : undefined,
        procedure_id: contextType === 'PROCEDURE' ? contextId : undefined,
        admission_id: contextType === 'ADMISSION' ? contextId : undefined,
        signed_at: signedAt || undefined,
        valid_until: validUntil || undefined,
        signed_by_name: signedByName.trim() || undefined,
        file,
      }
    });
    toast.success('Consent file uploaded successfully.');
  };

  const handleVerify = async (documentId: string) => {
    if (!patient) return;
    await verifyDoc.mutateAsync({ id: patient.id, documentId });
    toast.success('Consent verified.');
  };

  return {
    state: {
      patient,
      patients,
      consents,
      templates,
      loading,
      isSubmitting: uploadDoc.isPending || replaceDoc.isPending,
    },
    capabilities: {
      canCreate,
      canDelete,
      canView,
      canEdit,
      canVerify,
    },
    actions: {
      handlePatientChange,
      handleUpload,
      handleDownload,
      handleView,
      handleDelete,
      handleReplace,
      handleVerify,
    },
  };
}
