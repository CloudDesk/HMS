import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';
import { apiClient } from '../../api/client';

type AuthenticatedMediaImageProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
  src?: string | null;
};

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function AuthenticatedMediaImage({ src, onError, ...props }: AuthenticatedMediaImageProps) {
  const [displaySrc, setDisplaySrc] = useState(src ?? transparentPixel);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    setDisplaySrc(src ?? transparentPixel);
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) return;

    let disposed = false;
    let objectUrl = '';

    void apiClient.requestBlob(src)
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setDisplaySrc(objectUrl);
      })
      .catch(() => {
        if (!disposed) {
          setLoadFailed(true);
        }
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return (
    <img
      {...props}
      src={displaySrc}
      data-media-unavailable={loadFailed || !src ? 'true' : undefined}
      onError={(event) => {
        setLoadFailed(true);
        setDisplaySrc(transparentPixel);
        onError?.(event);
      }}
    />
  );
}
