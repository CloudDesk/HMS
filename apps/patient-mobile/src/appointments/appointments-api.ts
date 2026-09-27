import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager';
import {
  appointmentCreatedSchema,
  bookAppointmentInputSchema,
  portalAppointmentsResponseSchema,
  publicBranchSchema,
  publicDepartmentSchema,
  publicDoctorSchema,
  publicDoctorSlotsSchema,
  rescheduleAppointmentInputSchema,
  rescheduleEligibilitySchema,
  type AppointmentCreated,
  type BookAppointmentInput,
  type PortalAppointmentsResponse,
  type PublicBranch,
  type PublicDepartment,
  type PublicDoctor,
  type PublicDoctorSlots,
  type RescheduleAppointmentInput,
  type RescheduleEligibility,
} from './contracts';

export class AppointmentsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async listAppointments(
    patientId: string,
    options: { scope?: 'upcoming' | 'past'; status?: string; page?: number; limit?: number } = {}
  ): Promise<PortalAppointmentsResponse> {
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/appointments',
      portalAppointmentsResponseSchema,
      {
        query: {
          patient_id: patientId,
          scope: options.scope ?? 'upcoming',
          status: options.status,
          page: options.page ?? 1,
          limit: options.limit ?? 20,
        },
      }
    );
  }

  async getBranches(): Promise<PublicBranch[]> {
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/public/branches',
      z.object({ data: z.array(publicBranchSchema) }),
      { query: { limit: 50 } }
    );
    return response.data;
  }

  async getDepartments(branchId?: string): Promise<PublicDepartment[]> {
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/public/departments',
      z.object({ data: z.array(publicDepartmentSchema) }),
      { query: { branch_id: branchId, limit: 50 } }
    );
    return response.data;
  }

  async getDoctors(branchId?: string, departmentId?: string): Promise<PublicDoctor[]> {
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/public/doctors',
      z.object({ data: z.array(publicDoctorSchema) }),
      { query: { branch_id: branchId, department_id: departmentId, limit: 50 } }
    );
    return response.data;
  }

  async getDoctorSlots(doctorId: string, date: string): Promise<PublicDoctorSlots> {
    return this.sessionManager.authenticatedRequest(
      `/patient-portal/public/doctors/${doctorId}/slots`,
      publicDoctorSlotsSchema,
      { query: { date } }
    );
  }

  async bookAppointment(input: BookAppointmentInput): Promise<AppointmentCreated> {
    const payload = bookAppointmentInputSchema.parse(input);
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/appointments',
      appointmentCreatedSchema,
      { method: 'POST', body: payload }
    );
  }

  async checkRescheduleEligibility(appointmentId: string): Promise<RescheduleEligibility> {
    return this.sessionManager.authenticatedRequest(
      `/patient-portal/appointments/${appointmentId}/reschedule-eligibility`,
      rescheduleEligibilitySchema
    );
  }

  async rescheduleAppointment(
    appointmentId: string,
    input: RescheduleAppointmentInput
  ): Promise<AppointmentCreated> {
    const payload = rescheduleAppointmentInputSchema.parse(input);
    return this.sessionManager.authenticatedRequest(
      `/patient-portal/appointments/${appointmentId}/reschedule`,
      appointmentCreatedSchema,
      { method: 'PATCH', body: payload }
    );
  }
}
