import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientPortalApi } from '../../api/patient-portal';
import { portalQueryKeys } from '../../api/query-keys';

type PatientAvatarProps = {
  patientId: string;
  initials: string;
  large?: boolean;
};

export function PatientAvatar({ patientId, initials, large = false }: PatientAvatarProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const documentsQuery = useQuery({
    queryKey: portalQueryKeys.documents(patientId),
    queryFn: () => patientPortalApi.documents(patientId),
  });
  const profilePhoto = documentsQuery.data?.data.find(
    (document) => document.consent_kind === 'PROFILE_PHOTO',
  );
  const photoQuery = useQuery({
    queryKey: ['patient-portal-profile-photo', patientId, profilePhoto?.id ?? 'none'],
    queryFn: () => patientPortalApi.downloadDocument(patientId, profilePhoto!.id),
    enabled: Boolean(profilePhoto),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!photoQuery.data?.blob) {
      setPhotoUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(photoQuery.data.blob);
    setPhotoUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photoQuery.data]);

  return (
    <div className={`patient-avatar${large ? ' large' : ''}`}>
      {photoUrl ? <img alt="Patient profile" src={photoUrl} /> : initials}
    </div>
  );
}
