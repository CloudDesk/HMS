import { ophthalmologyReportsApi } from '../api/ophthalmology-reports';
import { ophthalmologyPublicationsApi } from '../api/ophthalmology-publications';
import { ophthalmologyApi } from '../api/ophthalmology';
import { ophthalmologyAdminApi } from '../api/ophthalmology-admin';
import { ophthalmologyCompletionApi } from '../api/ophthalmology-completion';
import { ophthalmologyCareApi } from '../api/ophthalmology-care';
import { ophthalmologyQueueApi } from '../api/ophthalmology-queue';

// The service preserves the published wire contract; orchestration belongs in feature hooks.
export const ophthalmologyService = { ...ophthalmologyApi, admin: ophthalmologyAdminApi, queue: ophthalmologyQueueApi, care: ophthalmologyCareApi, completion: ophthalmologyCompletionApi, reports: ophthalmologyReportsApi, publications: ophthalmologyPublicationsApi };
