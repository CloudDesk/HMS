/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIncisalOrOcclusalFace, parseAnatomicalToothObj } from './tooth-3d';

const SUPPORTED_FDI_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
];

const getDentalAsset = (toothNumber: number) => {
  const quadrant = Math.floor(toothNumber / 10);
  const position = toothNumber % 10;
  const upper = [1, 2, 5, 6].includes(quadrant);
  const primary = quadrant >= 5;
  const primaryAssetPositions = [1, 2, 3, 6, 7] as const;
  const assetPosition = primary
    ? primaryAssetPositions[position - 1]
    : Math.min(position, 7);
  if (!assetPosition) throw new Error(`Unsupported test tooth ${toothNumber}`);
  return join(
    process.cwd(),
    'apps',
    'web',
    'public',
    'models',
    'dental',
    `${upper ? 'upper' : 'lower'}-${assetPosition}.obj`,
  );
};

const getSurfaceStats = (mesh: ReturnType<typeof parseAnatomicalToothObj>, surfaceId: number) => {
  let vertices = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let index = 0; index < mesh.surfaces.length; index++) {
    if (mesh.surfaces[index] !== surfaceId) continue;
    vertices++;
    x += mesh.positions[index * 3] ?? 0;
    y += mesh.positions[index * 3 + 1] ?? 0;
    z += mesh.positions[index * 3 + 2] ?? 0;
  }
  return {
    ratio: vertices / mesh.surfaces.length,
    centre: { x: x / vertices, y: y / vertices, z: z / vertices },
  };
};

const getLargestConnectedShare = (
  mesh: ReturnType<typeof parseAnatomicalToothObj>,
  surfaceId: number,
) => {
  const triangles: number[][] = [];
  for (let index = 0; index < mesh.surfaces.length; index += 3) {
    if (mesh.surfaces[index] !== surfaceId) continue;
    triangles.push([index, index + 1, index + 2]);
  }
  const parents = triangles.map((_, index) => index);
  const find = (value: number): number => parents[value] === value
    ? value
    : (parents[value] = find(parents[value]!));
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const owners = new Map<string, number>();
  triangles.forEach((triangle, triangleIndex) => {
    triangle.forEach((vertexIndex) => {
      const key = [0, 1, 2]
        .map((axis) => Math.round((mesh.positions[vertexIndex * 3 + axis] ?? 0) * 100_000))
        .join(',');
      const owner = owners.get(key);
      if (owner === undefined) owners.set(key, triangleIndex);
      else union(triangleIndex, owner);
    });
  });
  const sizes = new Map<number, number>();
  triangles.forEach((_, index) => {
    const root = find(index);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  });
  return Math.max(0, ...sizes.values()) / triangles.length;
};

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

  it('provides all five interactive surfaces for every supported FDI tooth', () => {
    for (const toothNumber of SUPPORTED_FDI_TEETH) {
      const source = readFileSync(getDentalAsset(toothNumber), 'utf8');
      const mesh = parseAnatomicalToothObj(source, toothNumber);
      const surfaceCounts = [1, 2, 3, 4, 5].map((surfaceId) =>
        mesh.surfaces.reduce((count, value) => count + Number(value === surfaceId), 0));

      expect(surfaceCounts, `FDI tooth ${toothNumber}`).not.toContain(0);
      if (toothNumber % 10 === 3) {
        expect(
          surfaceCounts[0]! / mesh.surfaces.length,
          `FDI canine ${toothNumber} incisal region`,
        ).toBeLessThan(0.12);
      }
    }
  });

  it('keeps all five regions anatomically separated and proportionate on every tooth', () => {
    for (const toothNumber of SUPPORTED_FDI_TEETH) {
      const source = readFileSync(getDentalAsset(toothNumber), 'utf8');
      const mesh = parseAnatomicalToothObj(source, toothNumber);
      const [incisal, mesial, distal, buccal, lingual] = [1, 2, 3, 4, 5]
        .map((surfaceId) => getSurfaceStats(mesh, surfaceId));

      expect(incisal!.centre.y, `FDI tooth ${toothNumber} incisal/occlusal height`)
        .toBeGreaterThan(Math.max(mesial!.centre.y, distal!.centre.y, buccal!.centre.y, lingual!.centre.y));
      expect(mesial!.centre.x * distal!.centre.x, `FDI tooth ${toothNumber} mesial/distal separation`)
        .toBeLessThan(0);
      expect(buccal!.centre.z * lingual!.centre.z, `FDI tooth ${toothNumber} facial/lingual separation`)
        .toBeLessThan(0);

      for (const [index, stats] of [incisal, mesial, distal, buccal, lingual].entries()) {
        expect(stats!.ratio, `FDI tooth ${toothNumber}, surface ${index + 1} minimum area`)
          .toBeGreaterThan(0.005);
        expect(stats!.ratio, `FDI tooth ${toothNumber}, surface ${index + 1} maximum area`)
          .toBeLessThan(0.55);
      }
    }
  });

  it('does not produce detached canine incisal highlight fragments', () => {
    for (const toothNumber of SUPPORTED_FDI_TEETH.filter((value) => value % 10 === 3)) {
      const source = readFileSync(getDentalAsset(toothNumber), 'utf8');
      const mesh = parseAnatomicalToothObj(source, toothNumber);
      expect(
        getLargestConnectedShare(mesh, 1),
        `FDI canine ${toothNumber} connected incisal region`,
      ).toBeGreaterThan(0.9);
    }
  });

  it('keeps each selectable region predominantly connected on every tooth', () => {
    for (const toothNumber of SUPPORTED_FDI_TEETH) {
      const source = readFileSync(getDentalAsset(toothNumber), 'utf8');
      const mesh = parseAnatomicalToothObj(source, toothNumber);
      for (const surfaceId of [1, 2, 3, 4, 5]) {
        expect(
          getLargestConnectedShare(mesh, surfaceId),
          `FDI tooth ${toothNumber}, surface ${surfaceId} connected region`,
        ).toBeGreaterThan(surfaceId === 1 ? 0.6 : 0.8);
      }
    }
  });
});
