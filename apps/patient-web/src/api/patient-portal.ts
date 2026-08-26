import { apiClient } from './client';

export type PatientPortalOverview = {
  patient: {
    id: string;
    patient_number: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    date_of_birth: string;
    gender: string;
    phone: string | null;
    email: string | null;
    address: Record<string, string | null>;
    emergency_contact: {
      name?: string | null;
      relationship?: string | null;
      phone?: string | null;
    };
    blood_group: string | null;
    status: string;
    created_at: string;
  };
  summary: {
    upcoming_appointments: number;
    outstanding_invoices: number;
    verified_lab_results: number;
    verified_imaging_reports: number;
  };
  appointments: Array<{
    id: string;
    appointment_number: string;
    doctor_name: string;
    doctor_specialization: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    visit_type: string;
    status: string;
    reason: string | null;
    branch: { id: string; name: string; city: string | null; address: string | null } | null;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
  }>;
  laboratory_results: Array<{
    id: string;
    result_items: Array<{
      serviceName: string;
      value: string;
      unit?: string | null;
      referenceRange?: string | null;
      comments?: string | null;
    }>;
    remarks: string | null;
    entered_at: string;
    verified_at: string;
  }>;
  imaging_reports: Array<{
    id: string;
    findings: string;
    impression: string;
    recommendations: string | null;
    entered_at: string;
    verified_at: string;
  }>;
  prescriptions: Array<{
    id: string;
    doctor_name: string;
    status: 'SUBMITTED' | 'DISPENSED';
    submitted_at: string;
    follow_up_date: string | null;
    doctor_instructions: string | null;
    patient_instructions: string | null;
    items: Array<{
      id: string;
      medicine_name: string;
      strength: string | null;
      dosage: string;
      route: string;
      frequency: string;
      duration: string;
      quantity: number | null;
      instructions: string | null;
    }>;
  }>;
  purchased_medicines: Array<{
    id: string;
    medicine_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    purchased_at: string;
    invoice_number: string;
    payment_status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
    branch: { id: string; name: string; city: string | null } | null;
  }>;
};

export type PatientPortalContext = {
  account: {
    type: 'PATIENT' | 'GUARDIAN';
    full_name: string;
    email: string | null;
    phone: string | null;
    guardian_profile: null | {
      relationship: 'PARENT' | 'LEGAL_GUARDIAN';
      address: Record<string, string | null>;
      identification: { type?: string | null; number?: string | null };
      legal_consent_accepted: boolean;
      legal_consent_accepted_at: string;
    };
  };
  patients: Array<{
    id: string;
    patient_number: string;
    full_name: string;
    date_of_birth: string;
    gender: string;
    relationship: 'SELF' | 'PARENT' | 'LEGAL_GUARDIAN';
    is_primary: boolean;
    preferred_branch: {
      id: string;
      name: string;
      city: string | null;
      address: string | null;
    } | null;
  }>;
};

export type PortalAppointment = {
  id: string;
  appointment_number: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  department_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  visit_type: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW' | 'SKIPPED' | 'COMPLETED';
  reason: string | null;
  rescheduled_from_id: string | null;
  rescheduled_to_id: string | null;
  branch: { id: string; name: string; city: string | null; address: string | null } | null;
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

export type PublicList<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type PublicBranch = {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
};

export type PublicDepartment = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch: { id: string; name: string; city: string | null };
};

export type PublicService = {
  id: string;
  code: string;
  name: string;
  service_type: 'GENERAL' | 'LAB_TEST' | 'IMAGING_SERVICE';
  category: string | null;
  description: string | null;
  standard_price: number;
  department: { id: string; name: string };
  branch: { id: string; name: string; city: string | null };
};

export type PublicDoctor = {
  id: string;
  display_name: string;
  specialization: string;
  qualification: string | null;
  experience_years: number | null;
  consultation_room: string | null;
  available_days: string[];
  branch: { id: string; name: string; city: string | null };
  department: { id: string; name: string };
};

export type PortalDocument = {
  id: string;
  patient_id: string;
  document_type: 'INSURANCE' | 'CLINICAL' | 'OTHER';
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  description: string | null;
  source: 'HOSPITAL' | 'PATIENT' | 'GUARDIAN';
  review_status: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  document_date: string | null;
  provider_name: string | null;
  created_at: string;
};

export type PortalInvoiceDetails = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  patient: {
    id: string;
    patient_number: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: Record<string, string | null>;
  } | null;
  branch: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
  } | null;
  items: Array<{
    id: string;
    service_name: string;
    service_type: 'CONSULTATION' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PHARMACY';
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  payments: Array<{
    id: string;
    payment_number: string;
    amount: number;
    payment_method: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
    payment_date: string;
    reference_number: string | null;
  }>;
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
      { auth: false },
    );
  },
  publicDepartments(input?: { page?: number; limit?: number; search?: string; branchId?: string }) {
    return apiClient.request<PublicList<PublicDepartment>>(
      `/patient-portal/public/departments?${listQuery(input)}`,
      { auth: false },
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
      { auth: false },
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
      { auth: false },
    );
  },
  publicDoctorSlots(doctorId: string, date: string) {
    return apiClient.request<{
      doctor_id: string;
      date: string;
      is_available: boolean;
      unavailable_reason: string | null;
      slots: Array<{ start_time: string; end_time: string }>;
    }>(
      `/patient-portal/public/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`,
      { auth: false },
    );
  },
  overview(patientId?: string) {
    return apiClient.request<PatientPortalOverview>(
      `/patient-portal/overview${patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ''}`,
    );
  },
  invoice(patientId: string, invoiceId: string) {
    return apiClient.request<PortalInvoiceDetails>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/invoices/${encodeURIComponent(invoiceId)}`,
    );
  },
  context() {
    return apiClient.request<PatientPortalContext>('/patient-portal/context');
  },
  documents(patientId: string) {
    return apiClient.request<PublicList<PortalDocument>>(
      `/patient-portal/documents?patient_id=${encodeURIComponent(patientId)}&limit=100`,
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
    });
  },
  downloadDocument(patientId: string, documentId: string) {
    return apiClient.download(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/download`,
    );
  },
  signup(input: {
    account_type: 'PATIENT' | 'GUARDIAN';
    full_name: string;
    email: string;
    phone: string;
    otp: string;
    guardian_profile?: {
      relationship: 'PARENT' | 'LEGAL_GUARDIAN';
      address?: Record<string, string | null>;
      identification?: { type?: string | null; number?: string | null };
      legal_consent_accepted: true;
    };
  }) {
    return apiClient.request<{
      id: string;
      username: string;
      email: string;
      phone: string;
      accountType: string;
    }>('/patient-portal/signup', { auth: false, method: 'POST', body: input });
  },
  activateExistingPatient(input: {
    patient_number: string;
    phone: string;
    date_of_birth: string;
    email: string;
    otp: string;
  }) {
    return apiClient.request<{ account: { id: string }; patientId: string; patientNumber: string }>(
      '/patient-portal/existing-patient/activate',
      { auth: false, method: 'POST', body: input },
    );
  },
  completeProfile(input: PortalPatientInput) {
    return apiClient.request<{ patientId: string }>('/patient-portal/profile', {
      method: 'POST',
      body: input,
    });
  },
  addDependent(input: PortalPatientInput & { relationship: 'PARENT' | 'LEGAL_GUARDIAN' }) {
    return apiClient.request<{ patientId: string }>('/patient-portal/dependents', {
      method: 'POST',
      body: input,
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
      { method: 'POST', body: input },
    );
  },
  updatePatient(patientId: string, input: PortalPatientUpdateInput) {
    return apiClient.request<{ patientId: string; patientNumber: string }>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}`,
      { method: 'PATCH', body: input },
    );
  },
  updateGuardian(patientId: string, input: PortalGuardianUpdateInput) {
    return apiClient.request<{ patientId: string; relationship: 'PARENT' | 'LEGAL_GUARDIAN' }>(
      `/patient-portal/patients/${encodeURIComponent(patientId)}/guardian-profile`,
      { method: 'PATCH', body: input },
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
      { method: 'POST', body: input },
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
    return apiClient.request<PublicList<PortalAppointment>>(`/patient-portal/appointments?${params}`);
  },
  rescheduleEligibility(appointmentId: string) {
    return apiClient.request<{ eligible: boolean; reason: string | null; minimum_notice_hours: number }>(
      `/patient-portal/appointments/${encodeURIComponent(appointmentId)}/reschedule-eligibility`,
    );
  },
  rescheduleAppointment(appointmentId: string, input: {
    doctor_id: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
  }) {
    return apiClient.request<{ id: string; appointment_number: string; status: string }>(
      `/patient-portal/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      { method: 'PATCH', body: input },
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
      { method: 'POST', body: input },
    );
  },
};
