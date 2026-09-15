import { describe, expect, it } from 'vitest';
import { isIncisalOrOcclusalFace } from './tooth-3d';

describe('anatomical tooth surface classification', () => {
  it('limits Tooth 43 incisal highlighting to the canine cusp tip', () => {
    expect(isIncisalOrOcclusalFace(43, 0.03, 0.4)).toBe(true);
    expect(isIncisalOrOcclusalFace(43, 0.06, 0.8)).toBe(true);
    expect(isIncisalOrOcclusalFace(43, 0.08, 0.95)).toBe(false);
    expect(isIncisalOrOcclusalFace(43, 0.14, 0.9)).toBe(false);
  });

  it('applies the same narrow cusp-tip rule to canines in every FDI quadrant', () => {
    for (const toothNumber of [13, 23, 33, 43, 53, 63, 73, 83]) {
      expect(isIncisalOrOcclusalFace(toothNumber, 0.08, 0.95)).toBe(false);
    }
  });

  it('preserves the existing incisor and posterior occlusal regions', () => {
    expect(isIncisalOrOcclusalFace(41, 0.08, 0.4)).toBe(true);
    expect(isIncisalOrOcclusalFace(46, 0.17, 0.2)).toBe(true);
  });
});
