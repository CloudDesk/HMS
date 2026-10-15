import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ loading: false, error: null as Error | null, query: vi.fn() }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../hooks/settings/useSettings', () => ({ useHospitalSettings: () => ({ hospitalName: 'Test' }) }));
vi.mock('../components/ui/Modal', () => ({ Modal: () => null }));
vi.mock('./PatientRegistrationPage', () => ({ PatientRegistrationPage: () => null }));
vi.mock('../components/patients/PatientEditModal', async () => {
  const { z } = await import('zod');
  return { PatientEditModal: () => null, updatePatientSchema: z.object({}) };
});
vi.mock('../hooks/patients/usePatientSearchFeature', () => ({
  usePatientSearchFeature: (query: { currentPage: number }) => {
    state.query(query);
    return { state: { patients: [], meta: { page: query.currentPage, limit: 10, total: 30, totalPages: 3 }, loading: state.loading, loadError: state.error }, actions: { retry: vi.fn() }, mutations: { updatePatient: vi.fn() } };
  },
}));
import { PatientSearchPage } from './PatientSearchPage';
import { navigate } from '../routing/navigation';

describe('patient directory pagination', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    state.loading = false;
    state.error = null;
    state.query.mockClear();
    window.history.replaceState(null, '', '/patients/search?search=Alex&page=2');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  const render = async () => { await act(async () => root.render(<PatientSearchPage />)); };
  const click = async (label: string) => {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(button).not.toBeNull();
    await act(async () => button?.click());
  };
  it('restores the URL page, retains filters on Next and disables Next at the last page', async () => {
    await render();
    expect(state.query).toHaveBeenLastCalledWith({ currentPage: 2, appliedFilters: { searchTerms: 'Alex', gender: '', status: '' } });
    await click('Next page');
    expect(new URLSearchParams(window.location.search).get('page')).toBe('3');
    expect(new URLSearchParams(window.location.search).get('search')).toBe('Alex');
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.disabled).toBe(true);
  });
  it('resets to page one on Search and clears applied filters on Reset', async () => {
    await render();
    await act(async () => { container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(new URLSearchParams(window.location.search).get('page')).toBe('1');
    await click('Reset filters');
    expect(window.location.search).toBe('');
    expect(container.querySelector<HTMLInputElement>('#search-name')?.value).toBe('');
  });
  it('updates fields on browser history and normalizes invalid page/status values', async () => {
    await render();
    await act(async () => { navigate('/patients/search?page=-2&search=Sam&status=invalid'); });
    expect(container.querySelector<HTMLInputElement>('#search-name')?.value).toBe('Sam');
    expect(state.query).toHaveBeenLastCalledWith({ currentPage: 1, appliedFilters: { searchTerms: 'Sam', gender: '', status: '' } });
  });
  it('disables navigation while loading and permits recovery from an error on a later page', async () => {
    state.loading = true;
    await render();
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.disabled).toBe(true);
    state.loading = false;
    state.error = new Error('offline');
    await render();
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')?.disabled).toBe(false);
    expect(container.textContent).toContain('Results unavailable');
    expect(container.textContent).not.toContain('Showing 0-');
  });

  it('renders all 5 active filters and action buttons in 2-row layout while excluding removed filters', async () => {
    await render();
    // 5 active filters are present
    expect(container.querySelector<HTMLInputElement>('#search-mrn')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('#search-name')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('#search-mobile')).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>('#search-gender')).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>('#search-status')).not.toBeNull();

    // Action buttons are present
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Reset filters"]')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')).not.toBeNull();

    // Removed filters are NOT present in DOM
    expect(container.querySelector('#search-natid')).toBeNull();
    expect(container.querySelector('#search-dob')).toBeNull();
    expect(container.querySelector('#search-blood')).toBeNull();
    expect(container.querySelector('#search-regdate')).toBeNull();
  });
});
