import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import {
  type ApiPatientDocumentType,
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
} from './usePatients';
import { getPatientErrorMessage } from '../../pages/patient-utils';

export type PatientDocumentRecord = {
  id: string;
  name: string;
  type: string;
  category: string;
  uploadedBy: string;
  uploadedDate: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  fileName: string;
  createdAt: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));

const detectCategoryFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'Image';
  if (['doc', 'docx'].includes(ext)) return 'Word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Excel';
  if (['txt', 'rtf'].includes(ext)) return 'Scanned File';
  return 'PDF';
};

const toDocumentRecord = (document: PatientDocumentResponse): PatientDocumentRecord => ({
  id: document.id,
  name: document.title || document.file_name,
  type: document.document_type,
  category: detectCategoryFromFileName(document.file_name),
  uploadedBy: document.uploaded_by_name ?? 'Unknown user',
  uploadedDate: formatDate(document.created_at),
  status: 'Verified',
  fileName: document.file_name,
  createdAt: document.created_at,
});

export function usePatientDocumentsFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const searchParams = new URLSearchParams(location.search);
  const searchPatientId = searchParams.get('id') || null;

  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Patients', screen: 'Documents', action,
  });

  const canCreate = can('Create');
  const canDelete = can('Delete');
  const canView = can('View');
  const canEdit = can('Edit');

  const { data: listRes } = usePatientsList({ limit: 50 });
  const patientList = listRes?.data || [];

  let initialTargetId = searchPatientId;
  if (!initialTargetId && patientList.length > 0 && patientList[0]) {
    initialTargetId = patientList[0].id;
  }

  const [activePatientId, setActivePatientId] = useState<string>(initialTargetId || '');
      
  useEffect(() => {
    if (!activePatientId && initialTargetId) {
      setActivePatientId(initialTargetId);
    }
  }, [initialTargetId, activePatientId]);

  const { data: patient, isLoading: loadingPatient } = usePatientDetails(activePatientId);
  const { data: docsRes, isLoading: loadingDocs, isError, error: docsError } = usePatientDocuments(activePatientId, { limit: 100 });

  const documents = (docsRes?.data || []).map(toDocumentRecord);
  const loading = loadingPatient || loadingDocs;
  const loadError = isError ? getPatientErrorMessage(docsError) : '';

  const uploadDoc = useUploadPatientDocument();
  const deleteDoc = useDeletePatientDocument();
  const downloadDoc = useDownloadPatientDocument();
  const replaceDoc = useReplacePatientDocument();

  const handlePatientChange = (id: string) => {
    if (id) {
      setActivePatientId(id);
      navigate(`/patients/documents?id=${encodeURIComponent(id)}`);
    }
  };

  const handleDownloadDocument = async (doc: PatientDocumentRecord) => {
    if (!activePatientId) return;
    try {
      const downloadRes = await downloadDoc.mutateAsync({ patientId: activePatientId, docId: doc.id });
      const url = URL.createObjectURL(downloadRes.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadRes.fileName ?? doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${doc.name}`);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const handleViewDocument = async (doc: PatientDocumentRecord) => {
    if (!activePatientId) return;
    try {
      const download = await downloadDoc.mutateAsync({ patientId: activePatientId, docId: doc.id });
      const url = URL.createObjectURL(download.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getPatientErrorMessage(error));
    }
  };

  const handleDeleteDocument = async (doc: PatientDocumentRecord) => {
    if (!activePatientId) return;
    try {
      await deleteDoc.mutateAsync({ id: activePatientId, documentId: doc.id });
      toast.success(`${doc.name} deleted.`);
    } catch {
      // handled in mutation hook usually, but we can catch here if needed
    }
  };

  const handleReplaceFile = async (doc: PatientDocumentRecord, file: File) => {
    if (!activePatientId) return;
    try {
      await replaceDoc.mutateAsync({
        id: activePatientId,
        documentId: doc.id,
        payload: {
          document_type: doc.type as ApiPatientDocumentType,
          title: doc.name,
          file,
        }
      });
      toast.success(`${doc.name} replaced successfully.`);
    } catch {
      //
    }
  };
  
  const handleUploadFiles = async (
    files: File[], 
    docName: string, 
    docType: ApiPatientDocumentType
  ) => {
    if (!activePatientId) return;
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      const title = files.length > 1 ? `${docName.trim()} (${i + 1})` : docName.trim();
      await uploadDoc.mutateAsync({
        id: activePatientId,
        payload: {
          document_type: docType,
          title,
          file,
        }
      });
      successCount++;
    }
    toast.success(`${successCount} document(s) uploaded successfully.`);
  };

  return {
    state: {
      patient,
      patientList,
      activePatientId,
      documents,
      loading,
      loadError,
      uploading: uploadDoc.isPending,
      deleting: deleteDoc.isPending,
      replacing: replaceDoc.isPending,
    },
    capabilities: {
      canCreate,
      canDelete,
      canView,
      canEdit,
    },
    actions: {
      handlePatientChange,
      handleDownloadDocument,
      handleViewDocument,
      handleDeleteDocument,
      handleReplaceFile,
      handleUploadFiles,
      detectCategoryFromFileName,
    },
  };
}
