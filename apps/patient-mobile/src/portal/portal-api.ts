import { z } from 'zod';
import type { SessionManager } from '../auth/session-manager';
import {
  patientPortalContextSchema,
  patientPortalOverviewSchema,
  type PortalContext,
  type PortalOverview,
} from './contracts';

export const profilePhotoResponseSchema = z.object({
  success: z.boolean(),
  patient_id: z.string(),
  profile_photo_url: z.string(),
});

export const deleteProfilePhotoResponseSchema = z.object({
  success: z.boolean(),
  patient_id: z.string(),
});

export type ProfilePhotoResponse = z.infer<typeof profilePhotoResponseSchema>;

export class PortalApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async getContext(): Promise<PortalContext> {
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/context',
      patientPortalContextSchema
    );
  }

  async getOverview(patientId?: string): Promise<PortalOverview> {
    return this.sessionManager.authenticatedRequest(
      '/patient-portal/overview',
      patientPortalOverviewSchema,
      patientId ? { query: { patient_id: patientId } } : undefined
    );
  }

  async uploadProfilePhoto(
    patientId: string,
    file: { uri: string; name?: string; type?: string }
  ): Promise<ProfilePhotoResponse> {
    const formData = new FormData();
    const fileName = file.name || `profile-${Date.now()}.jpg`;
    const mimeType = file.type || 'image/jpeg';

    formData.append('file', {
      uri: file.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    return this.sessionManager.authenticatedMultipartRequest(
      `/patient-portal/patients/${patientId}/profile-photo`,
      profilePhotoResponseSchema,
      formData
    );
  }

  async deleteProfilePhoto(patientId: string): Promise<{ success: boolean; patient_id: string }> {
    return this.sessionManager.authenticatedRequest(
      `/patient-portal/patients/${patientId}/profile-photo`,
      deleteProfilePhotoResponseSchema,
      { method: 'DELETE' }
    );
  }
}

