import React, { useEffect } from 'react';
import styles from './DentalExamination.module.css';

type DentalReferenceVideoModalProps = {
  procedureName: string;
  referenceUrl: string;
  referenceTitle?: string | null;
  onClose: () => void;
};

export function getEmbeddableVideo(url: string): { kind: 'iframe' | 'video' | 'link'; src: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
      if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }

    if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(url)) return { kind: 'video', src: url };
  } catch {
    // Service Catalogue validation prevents invalid URLs; retain a safe fallback.
  }

  return { kind: 'link', src: url };
}

export const DentalReferenceVideoModal: React.FC<DentalReferenceVideoModalProps> = ({
  procedureName,
  referenceUrl,
  referenceTitle,
  onClose,
}) => {
  const video = getEmbeddableVideo(referenceUrl);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dental-reference-video-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(2, 6, 23, 0.8)',
      }}
    >
      <div className={styles.cinemaVideoModalCard}>
        {/* Cinema Header */}
        <div className={styles.cinemaVideoHeader}>
          <div>
            <div className={styles.cinemaVideoBadge}>
              <i className="ph ph-shield-check" aria-hidden="true" />
              Clinical Reference Media
            </div>
            <h3 id="dental-reference-video-title" className={styles.cinemaVideoTitle}>
              {referenceTitle || `${procedureName} — Clinical Reference`}
            </h3>
            <div style={{ marginTop: '3px', fontSize: '0.78rem', color: '#94a3b8' }}>
              Target Procedure: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{procedureName}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close reference video"
            style={{
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
            }}
          >
            <i className="ph ph-x" aria-hidden="true" style={{ fontSize: '1.1rem' }} />
          </button>
        </div>

        {/* Cinema Video Stage */}
        <div className={styles.cinemaVideoBody}>
          <div className={styles.cinemaVideoFrame}>
            {video.kind === 'iframe' ? (
              <iframe
                src={video.src}
                title={referenceTitle || `${procedureName} reference video`}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : video.kind === 'video' ? (
              <video
                src={video.src}
                controls
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              >
                Your browser does not support embedded video playback.
              </video>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: '#090d16',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <i className="ph ph-arrow-square-out" style={{ fontSize: '1.75rem', color: '#38bdf8' }} aria-hidden="true" />
                </div>
                <h4 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1rem', fontWeight: 600 }}>
                  External Procedure Protocol
                </h4>
                <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '0.82rem', maxWidth: '420px', lineHeight: 1.4 }}>
                  This video host does not allow direct embedded playback inside the clinical workspace. You can launch it securely in an external tab.
                </p>
                <a
                  href={video.src}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btnPrimary}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                  }}
                >
                  <i className="ph ph-play" /> Open Procedure Video
                </a>
              </div>
            )}
          </div>

          {/* Procedure Meta & Protocol Bar */}
          <div className={styles.cinemaVideoMetaBar}>
            <div className={styles.cinemaVideoProtocolText}>
              <i className="ph ph-info" style={{ color: '#38bdf8', fontSize: '0.95rem' }} />
              Educational reference only. Follow verified hospital clinical operative guidelines.
            </div>
            <a
              href={referenceUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.cinemaVideoExternalLink}
            >
              Open source link <i className="ph ph-arrow-square-out" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Cinema Footer */}
        <div className={styles.cinemaVideoFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '7px 18px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
