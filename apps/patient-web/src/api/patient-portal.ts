import type { z } from 'zod';
import { apiClient } from './client';
import {
  appointmentCreatedSchema,
  createPublicListSchema,
  guardianUpdatedSchema,
  patientPortalContextSchema,
  patientPortalOverviewSchema,
  patientSavedSchema,
  portalAppointmentSchema,
  portalDocumentSchema,
  portalInvoiceDetailsSchema,
  provisionAccountSchema,
  publicBranchSchema,
  publicDepartmentSchema,
  publicDoctorSchema,
  publicDoctorSlotsSchema,
  publicServiceSchema,
  rescheduleEligibilitySchema,
} from './patient-portal.schemas';

export type PatientPortalOverview = z.infer<typeof patientPortalOverviewSchema>;
export type PatientPortalContext = z.infer<typeof patientPortalContextSchema>;
export type PortalAppointment = z.infer<typeof portalAppointmentSchema>;
export type PortalDocument = z.infer<typeof portalDocumentSchema>;
export type PortalInvoiceDetails = z.infer<typeof portalInvoiceDetailsSchema>;
export type PublicBranch = z.infer<typeof publicBranchSchema>;
export type PublicDepartment = z.infer<typeof publicDepartmentSchema>;
export type PublicService = z.infer<typeof publicServiceSchema>;
export type PublicDoctor = z.infer<typeof publicDoctorSchema>;

export type PublicList<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type PortalPatientInput = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  preferred_branch_id: string;
  blood_group?: string | null;
  emergency_contact?: { name?: string | null; relationship?: string | null; phone?: string | null } | null;
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  };
};

export type PortalPatientUpdateInput = PortalPatientInput & {
  middle_name?: string | null;
  email?: string | null;
  phone?: string | null;
  emergency_contact?: { name?: string | null; relationship?: string | null; phone?: string | null };
};

export type PortalGuardianUpdateInput = {
  full_name: string;
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  };
  identification?: { type?: string | null; number?: string | null };
};

const listQuery = (
  input: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    branchId?: string;
  } = {},
) => {
  const params = new URLSearchParams();
  params.set('page', String(input.page ?? 1));
  params.set('limit', String(input.limit ?? 8));
  if (input.search) params.set('search', input.search);
  if (input.departmentId) params.set('department_id', input.departmentId);
  if (input.branchId) params.set('branch_id', input.branchId);
  return params.toString();
};

export const patientPortalApi = {
  publicBranches(input?: { page?: number; limit?: number; search?: string }) {
    return apiClient.request<PublicList<PublicBranch>>(
      `/patient-portal/public/branches?${listQuery(input)}`,
      { auth: false, schema: createPublicListSchema(publicBranchSchema) },
    );
  },
  publicDepartments(input?: { page?: number; limit?: number; search?: string; branchId?: string }) {
    return apiClient.request<PublicList<PublicDepartment>>(
      `/patient-portal/public/departments?${listQuery(input)}`,
      { auth: false, schema: createPublicListSchema(publicDepartmentSchema) },
    );
  },
  publicServices(input?: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    branchId?: string;
  }) {
    return apiClient.request<PublicList<PublicService>>(
      `/patient-portal/public/services?${listQuery(input)}`,
      { auth: false, schema: createPublicListSchema(publicServiceSchema) },
    );
  },
  publicDoctors(input?: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    branchId?: string;
  }) {
    return apiClient.request<PublicList<PublicDoctor>>(
      `/patient-portal/public/doctors?${listQuery(input)}`,
      { auth: false, schema: createPublicListSchema(publicDoctorSchema) },
    );
  },
  publicDoctorSlots(doctorId: string, date: string) {
    return apiClient.request<z.infer<typeof publicDoctorSlotsSchema>>(
      `/patient-portal/public/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`,
      { auth: false, schema: publicDoctorSlotsSchema },
    );
  },
  overview(patientId?: string) {
    return apiClient.request<PatientPortalOverview>(
      `/patient-portal/overview${patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ''}`,
      { schema: patientPortalOverviewSchema },
    );
  },
  invoice(patientId: string, invoiceId: string) {
    return apiClient.request<PortalInvoiceDetails>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/invoices/${encodeURIComponent(invoiceId)}`,
      { schema: portalInvoiceDetailsSchema },
    );
  },
  context() {
    return apiClient.request<PatientPortalContext>('/patient-portal/context', {
      schema: patientPortalContextSchema,
    });
  },
  documents(patientId: string) {
    return apiClient.request<PublicList<PortalDocument>>(
      `/patient-portal/documents?patient_id=${encodeURIComponent(patientId)}&limit=100`,
      { schema: createPublicListSchema(portalDocumentSchema) },
    );
  },
  uploadDocument(input: {
    patientId: string;
    documentType: 'INSURANCE' | 'CLINICAL' | 'OTHER';
    title: string;
    providerName?: string;
    documentDate?: string;
    description?: string;
    file: File;
  }) {
    const formData = new FormData();
    formData.set('patient_id', input.patientId);
    formData.set('document_type', input.documentType);
    formData.set('title', input.title);
    formData.set('file', input.file);
    if (input.providerName) formData.set('provider_name', input.providerName);
    if (input.documentDate) formData.set('document_date', input.documentDate);
    if (input.description) formData.set('description', input.description);
    return apiClient.request<PortalDocument>('/patient-portal/documents/upload', {
      method: 'POST',
      body: formData,
      schema: portalDocumentSchema,
    });
  },
  downloadDocument(patientId: string, documentId: string) {
    return apiClient.download(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/download`,
    );
  },
  completeProfile(input: PortalPatientInput) {
    return apiClient.request<{ patientId: string }>('/patient-portal/profile', {
      method: 'POST',
      body: input,
      schema: patientSavedSchema,
    });
  },
  addDependent(input: PortalPatientInput & { relationship: 'PARENT' | 'LEGAL_GUARDIAN' }) {
    return apiClient.request<{ patientId: string }>('/patient-portal/dependents', {
      method: 'POST',
      body: input,
      schema: patientSavedSchema,
    });
  },
  linkDependent(input: {
    patient_number: string;
    date_of_birth: string;
    relationship: 'PARENT' | 'LEGAL_GUARDIAN';
    legal_consent_accepted: true;
  }) {
    return apiClient.request<{ patientId: string; patientNumber: string }>(
      '/patient-portal/dependents/link',
      { method: 'POST', body: input, schema: patientSavedSchema as z.ZodType<{ patientId: string; patientNumber: string }> },
    );
  },
  updatePatient(patientId: string, input: PortalPatientUpdateInput) {
    return apiClient.request<{ patientId: string; patientNumber: string }>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}`,
      { method: 'PATCH', body: input, schema: patientSavedSchema as z.ZodType<{ patientId: string; patientNumber: string }> },
    );
  },
  updateGuardian(patientId: string, input: PortalGuardianUpdateInput) {
    return apiClient.request<{ patientId: string; relationship: 'PARENT' | 'LEGAL_GUARDIAN' }>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/guardian-profile`,
      { method: 'PATCH', body: input, schema: guardianUpdatedSchema },
    );
  },
  bookAppointment(input: {
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
    visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE';
    reason: string;
  }) {
    return apiClient.request<{ id: string; appointment_number: string; status: string }>(
      '/patient-portal/appointments',
      { method: 'POST', body: input, schema: appointmentCreatedSchema },
    );
  },
  appointments(input: {
    patientId: string;
    scope: 'upcoming' | 'past';
    status?: PortalAppointment['status'];
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams({
      patient_id: input.patientId,
      scope: input.scope,
      page: String(input.page ?? 1),
      limit: String(input.limit ?? 10),
    });
    if (input.status) params.set('status', input.status);
    return apiClient.request<PublicList<PortalAppointment>>(
      `/patient-portal/appointments?${params}`,
      { schema: createPublicListSchema(portalAppointmentSchema) },
    );
  },
  rescheduleEligibility(appointmentId: string) {
    return apiClient.request<{ eligible: boolean; reason: string | null; minimum_notice_hours: number }>(
      `/patient-portal/appointments/${encodeURIComponent(appointmentId)}/reschedule-eligibility`,
      { schema: rescheduleEligibilitySchema },
    );
  },
  rescheduleAppointment(
    appointmentId: string,
    input: {
      doctor_id: string;
      appointment_date: string;
      start_time: string;
      duration_minutes: number;
    },
  ) {
    return apiClient.request<{ id: string; appointment_number: string; status: string }>(
      `/patient-portal/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      { method: 'PATCH', body: input, schema: appointmentCreatedSchema },
    );
  },
  provisionAccount(input: {
    patient_id: string;
    username: string;
    email: string;
    password: string;
  }) {
    return apiClient.request<{ id: string; username: string; email: string; status: string }>(
      '/patient-portal/accounts',
      { method: 'POST', body: input, schema: provisionAccountSchema },
    );
  },
};
