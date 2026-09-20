import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { opdApi, type DentalChairsideImage } from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export type UseDentalChairsideImagingOptions = {
  visitId: string;
  episodeId?: string | null;
  selectedTooth?: number | null;
  enabled?: boolean;
};

export function useDentalChairsideImaging({
  visitId,
  episodeId,
  selectedTooth,
  enabled = true,
}: UseDentalChairsideImagingOptions) {
  const queryClient = useQueryClient();

  const visitImagesQuery = useQuery<DentalChairsideImage[]>({
    queryKey: ['dental-chairside-images', visitId],
    queryFn: () => opdApi.listDentalChairsideImages(visitId),
    enabled: Boolean(enabled && visitId),
  });

  const episodeImagesQuery = useQuery<DentalChairsideImage[]>({
    queryKey: ['dental-episode-chairside-images', episodeId],
    queryFn: () => (episodeId ? opdApi.listEpisodeChairsideImages(episodeId) : Promise.resolve([])),
    enabled: Boolean(enabled && episodeId),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      fileName,
      toothNumber,
      notes,
    }: {
      file: File | Blob;
      fileName?: string;
      toothNumber?: number | null;
      notes?: string;
    }) => {
      const formData = new FormData();
      if (toothNumber !== null && toothNumber !== undefined) {
        formData.append('toothNumber', String(toothNumber));
      }
      if (episodeId) {
        formData.append('episodeId', episodeId);
      }
      if (notes) {
        formData.append('notes', notes);
      }
      const defaultFileName = toothNumber ? `Tooth_${toothNumber}_${Date.now()}.png` : `Tooth_Image_${Date.now()}.png`;
      const actualFile =
        file instanceof File
          ? file
          : new File([file], fileName || defaultFileName, { type: file.type || 'image/png' });

      formData.append('file', actualFile);

      return opdApi.uploadDentalChairsideImage(visitId, formData);
    },
    onSuccess: (newImage) => {
      toast.success(`Chairside image ${newImage.file_name} saved immediately.`);
      queryClient.setQueryData<DentalChairsideImage[]>(
        ['dental-chairside-images', visitId],
        (old = []) => [newImage, ...old.filter((img) => img.id !== newImage.id)],
      );
      void queryClient.invalidateQueries({ queryKey: ['dental-chairside-images', visitId] });
      if (episodeId) {
        queryClient.setQueryData<DentalChairsideImage[]>(
          ['dental-episode-chairside-images', episodeId],
          (old = []) => [newImage, ...old.filter((img) => img.id !== newImage.id)],
        );
        void queryClient.invalidateQueries({ queryKey: ['dental-episode-chairside-images', episodeId] });
      }
    },
    onError: (err) => {
      toast.error(getOpdErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => opdApi.deleteDentalChairsideImage(imageId),
    onSuccess: (_, imageId) => {
      toast.success('Chairside image deleted.');
      queryClient.setQueryData<DentalChairsideImage[]>(
        ['dental-chairside-images', visitId],
        (old = []) => old.filter((img) => img.id !== imageId),
      );
      void queryClient.invalidateQueries({ queryKey: ['dental-chairside-images', visitId] });
      if (episodeId) {
        queryClient.setQueryData<DentalChairsideImage[]>(
          ['dental-episode-chairside-images', episodeId],
          (old = []) => old.filter((img) => img.id !== imageId),
        );
        void queryClient.invalidateQueries({ queryKey: ['dental-episode-chairside-images', episodeId] });
      }
    },
    onError: (err) => {
      toast.error(getOpdErrorMessage(err));
    },
  });

  const allVisitImages = visitImagesQuery.data ?? [];
  const filteredVisitImages = selectedTooth
    ? allVisitImages.filter((img) => img.tooth_number === selectedTooth || img.tooth_number === null)
    : allVisitImages;

  const episodeImages = (episodeImagesQuery.data ?? []).filter(
    (img) => img.visit_id !== visitId,
  );

  return {
    images: filteredVisitImages,
    allVisitImages,
    episodeImages,
    isLoading: visitImagesQuery.isLoading,
    isError: visitImagesQuery.isError,
    error: visitImagesQuery.error,
    refetch: () => {
      void visitImagesQuery.refetch();
      if (episodeId) void episodeImagesQuery.refetch();
    },
    uploadImage: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteImage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
