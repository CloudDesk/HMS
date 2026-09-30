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

export function normalizeImageUpload(file: {
  uri: string;
  name?: string;
  type?: string;
}): { uri: string; name: string; type: string } {
  let uri = file.uri.trim();

  // Ensure local file paths have valid scheme prefix so React Native networking can resolve it
  if (uri.startsWith('file:/') && !uri.startsWith('file:///')) {
    uri = uri.replace(/^file:\/+/, 'file:///');
  } else if (
    !uri.startsWith('file://') &&
    !uri.startsWith('content://') &&
    !uri.startsWith('http://') &&
    !uri.startsWith('https://')
  ) {
    uri = uri.startsWith('/') ? `file://${uri}` : `file:///${uri}`;
  }

  // Derive and normalize MIME type
  let mimeType = file.type?.trim().toLowerCase();
  if (!mimeType || mimeType === 'image' || !mimeType.includes('/')) {
    const cleanPath = (uri.split('?')[0] ?? '').split('#')[0] ?? '';
    const ext = cleanPath.split('.').pop()?.toLowerCase();
    if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    } else if (ext === 'heic') {
      mimeType = 'image/heic';
    } else if (ext === 'heif') {
      mimeType = 'image/heif';
    } else {
      mimeType = 'image/jpeg';
    }
  } else if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }

  // Derive and normalize file name with matching extension
  let fileName = file.name?.trim();
  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/heic'
      ? 'heic'
      : mimeType === 'image/heif'
      ? 'heif'
      : 'jpg';

  if (!fileName) {
    fileName = `profile-${Date.now()}.${ext}`;
  } else if (!fileName.includes('.')) {
    fileName = `${fileName}.${ext}`;
  }

  return { uri, name: fileName, type: mimeType };
}

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
    const normalized = normalizeImageUpload(file);
    const formData = new FormData();

    formData.append('patient_id', patientId);
    formData.append('file', {
      uri: normalized.uri,
      name: normalized.name,
      type: normalized.type,
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


