import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';
import { apiClient } from '../../api/client';

type AuthenticatedMediaImageProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
  src?: string | null;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
};

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function AuthenticatedMediaImage({ src, onError, onLoad, ...props }: AuthenticatedMediaImageProps) {
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
      .catch((err) => {
        if (!disposed) {
          setLoadFailed(true);
          onError?.(err as any);
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
      onLoad={onLoad}
      onError={(event) => {
        if (displaySrc.startsWith('blob:') || displaySrc.startsWith('data:')) {
          setLoadFailed(true);
          setDisplaySrc(transparentPixel);
          onError?.(event);
        }
      }}
    />
  );
}
