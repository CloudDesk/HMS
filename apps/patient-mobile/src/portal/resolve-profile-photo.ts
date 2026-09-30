import type { DocumentsApi } from '../documents/documents-api';
import type { PortalOverview } from './contracts';

// The portal can have a PROFILE_PHOTO document without a profile_photo_url.
export async function resolveProfilePhoto(
  overview: PortalOverview,
  documentsApi: DocumentsApi,
): Promise<PortalOverview> {
  if (overview.patient.profile_photo_url) return overview;

  let page = 1;
  while (true) {
    const documents = await documentsApi.listDocuments(overview.patient.id, page);
    const photo = documents.data.find((document) => document.consent_kind === 'PROFILE_PHOTO');
    if (photo) {
      return {
        ...overview,
        patient: {
          ...overview.patient,
          profile_photo_url: `/api${documentsApi.getDownloadEndpoint(overview.patient.id, photo.id)}`,
        },
      };
    }
    if (documents.data.length === 0 || page * documents.meta.limit >= documents.meta.total) {
      return overview;
    }
    page += 1;
  }
}
