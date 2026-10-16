import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ allowed: true, error: false, loading: false, refresh: vi.fn() }));
vi.mock('../hooks/ophthalmology/useOphthalmologyReportsFeature', () => ({ useOphthalmologyReportsFeature: () => ({ canView: state.allowed, canStations: false, type: 'REPEAT_UNABLE', branchId: '', query: null, invalid: null, branches: [], branchesQuery: {}, stationsQuery: {}, reportQuery: { isLoading: state.loading }, error: state.error ? 'Unavailable' : null, refresh: state.refresh }) }));
import { OphthalmologyReportsPage, ReportTable } from './OphthalmologyReportsPage';
import { parseReport } from '../api/ophthalmology-reports';
const id = '111111111111111111111111'; const meta = { page: 1, total: 1, totalPages: 1, limit: 20 };
describe('B6 report coverage and unavailable values', () => {
  let root: Root; let element: HTMLDivElement;
  beforeEach(() => { state.allowed = true; state.error = false; state.loading = false; state.refresh.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
  it('renders permission denial without report data', async () => { state.allowed = false; await act(async () => root.render(<OphthalmologyReportsPage />)); expect(element.textContent).toContain('View permission is required'); expect(element.textContent).not.toContain('Repeat / unable'); });
  it('discloses missing reasons/rates and excludes invented export or publication actions', async () => { await act(async () => root.render(<OphthalmologyReportsPage />)); expect(element.textContent).toContain('Reasons, rates and their denominators are unavailable'); expect(element.textContent).toContain('Publication/withdrawal controls require'); expect([...element.querySelectorAll('button')].some((b) => /^(Export|Publish|Withdraw)/.test(b.textContent ?? ''))).toBe(false); expect(element.textContent).not.toContain('0 matching'); });
  it('renders null intervals as unavailable and actual zero as zero minutes', async () => { const report = parseReport('TEST_TURNAROUND', { data: [{ task_id: id, test_code: 'OCT', station_id: null, status: 'ORDERED', order_to_start_ms: null, start_to_completion_ms: 0, completion_to_review_ms: 90000 }], meta }); await act(async () => root.render(<ReportTable report={report} />)); expect(element.textContent).toContain('Unavailable'); expect(element.textContent).toContain('0.00 min'); expect(element.textContent).toContain('1.50 min'); expect(element.querySelectorAll('th[scope="col"]')).toHaveLength(7); });
  it('retains a retry action on failure without claiming an empty successful report', async () => { state.error = true; await act(async () => root.render(<OphthalmologyReportsPage />)); const retry = [...element.querySelectorAll('button')].find((b) => b.textContent === 'Retry report'); await act(async () => retry?.click()); expect(state.refresh).toHaveBeenCalledOnce(); expect(element.textContent).not.toContain('No matching rows'); });
});
