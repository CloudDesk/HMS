import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const id = '111111111111111111111111';
const state = vi.hoisted(() => ({ search: '', calls: [] as unknown[][], fetching: false, error: false, responseVersion: 2 }));
vi.mock('../../routing/navigation', () => ({ useAppLocation: () => ({ search: state.search }) }));
vi.mock('./useOphthalmology', () => ({ useOphthalmologyComparisons: (...args: unknown[]) => {
  state.calls.push(args); return { data: { task_id: '111111111111111111111111', result_id: '111111111111111111111111', expected_result_version: state.responseVersion, data: [], meta: { total: 0 } }, isSuccess: true, isError: state.error, isFetching: state.fetching };
} }));
import { useOphthalmologyComparisonFeature } from './useOphthalmologyComparisonFeature';
describe('saved comparison candidate gates', () => {
  let root: Root; let element: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyComparisonFeature>;
  function Harness({ ready = true, version = 2 }: { ready?: boolean; version?: number }) { feature = useOphthalmologyComparisonFeature(id, id, version, ready); return null; }
  beforeEach(() => { state.search = ''; state.calls = []; state.fetching = false; state.error = false; state.responseVersion = 2; element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
  it('does not fetch or expose cached candidates until opened with a saved unchanged permitted source', async () => {
    await act(async () => root.render(<Harness />)); expect(state.calls.at(-1)?.[3]).toBe(false); expect(feature.data).toBeUndefined();
    state.search = '?comparison_lookup=open'; await act(async () => root.render(<Harness ready={false} />)); expect(state.calls.at(-1)?.[3]).toBe(false); expect(feature.data).toBeUndefined();
    await act(async () => root.render(<Harness />)); expect(state.calls.at(-1)).toEqual([id, 2, 1, true]); expect(feature.canSelect).toBe(true);
  });
  it('binds pages to the exact saved version and prevents selection from stale or failed fetches', async () => {
    state.search = '?comparison_lookup=open&comparison_page=3'; await act(async () => root.render(<Harness version={3} />)); expect(state.calls.at(-1)).toEqual([id, 3, 3, true]); expect(feature.data).toBeUndefined();
    state.responseVersion = 3; state.fetching = true; await act(async () => root.render(<Harness version={3} />)); expect(feature.canSelect).toBe(false);
    state.fetching = false; state.error = true; await act(async () => root.render(<Harness version={3} />)); expect(feature.canSelect).toBe(false);
  });
});
