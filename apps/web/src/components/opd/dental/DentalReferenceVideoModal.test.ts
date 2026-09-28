import { describe, expect, it } from 'vitest';
import { getEmbeddableVideo } from './DentalReferenceVideoModal';

describe('dental reference video embedding', () => {
  it('converts YouTube links to privacy-enhanced embed URLs', () => {
    expect(getEmbeddableVideo('https://www.youtube.com/watch?v=abc123')).toEqual({
      kind: 'iframe',
      src: 'https://www.youtube-nocookie.com/embed/abc123',
    });
    expect(getEmbeddableVideo('https://youtu.be/xyz789')).toEqual({
      kind: 'iframe',
      src: 'https://www.youtube-nocookie.com/embed/xyz789',
    });
  });

  it('recognizes direct video files and safely falls back for ordinary pages', () => {
    expect(getEmbeddableVideo('https://cdn.example.org/procedure.mp4').kind).toBe('video');
    expect(getEmbeddableVideo('https://example.org/procedure-guide').kind).toBe('link');
  });
});
