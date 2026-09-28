import type { PortalDentalQuotationItem } from '../../../api/patient-portal';
import { Modal } from '../../ui/Modal';

type PortalProcedureVideoModalProps = {
  item: PortalDentalQuotationItem | null;
  onClose: () => void;
};

function getEmbeddableVideo(url: string): { kind: 'iframe' | 'video' | 'link'; src: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        return {
          kind: 'iframe',
          src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
        };
      }
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id =
        parsed.searchParams.get('v') ||
        parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      if (id) {
        return {
          kind: 'iframe',
          src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
        };
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
      if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }

    if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(url)) {
      return { kind: 'video', src: url };
    }
  } catch {
    // Invalid catalogue URLs fall back to a normal external link.
  }

  return { kind: 'link', src: url };
}

export function PortalProcedureVideoModal({ item, onClose }: PortalProcedureVideoModalProps) {
  const referenceUrl = item?.reference_video_url ?? '';
  const video = referenceUrl ? getEmbeddableVideo(referenceUrl) : null;
  const title = item?.reference_video_title || `${item?.procedure_name ?? 'Procedure'} reference`;

  return (
    <Modal
      footer={
        item ? (
          <div className="portal-reference-video-footer">
            <span>Educational reference provided by your dental care team.</span>
            <div>
              <a href={referenceUrl} target="_blank" rel="noreferrer">
                Open source <i className="ph ph-arrow-square-out" />
              </a>
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : undefined
      }
      icon="ph-play-circle"
      onClose={onClose}
      open={Boolean(item)}
      size="large"
      title={title}
    >
      {item && video ? (
        <div className="portal-reference-video">
          <div className="portal-reference-video-context">
            <i className="ph ph-tooth" />
            <span>
              {item.procedure_name}
              {item.tooth_number ? ` · Tooth #${item.tooth_number}` : ' · General treatment'}
            </span>
          </div>

          {video.kind === 'iframe' ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              src={video.src}
              title={title}
            />
          ) : video.kind === 'video' ? (
            <video controls preload="metadata" src={video.src}>
              Your browser does not support embedded video playback.
            </video>
          ) : (
            <div className="portal-reference-video-fallback">
              <i className="ph ph-arrow-square-out" />
              <strong>Open this procedure video in a new tab</strong>
              <span>This video provider does not support embedded playback.</span>
              <a href={video.src} target="_blank" rel="noreferrer">Open procedure video</a>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
