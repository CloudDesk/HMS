import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminConfigurationSchema } from '../api/ophthalmology-admin';
const state = vi.hoisted(() => ({ selected: undefined as unknown, canEdit: true, save: vi.fn(), setQuery: vi.fn() }));
vi.mock('../hooks/ophthalmology/useOphthalmologyAdministrationFeature', () => ({ useOphthalmologyAdministrationFeature: () => ({
  canView: true, canCreate: true, canEdit: state.canEdit, branchId: '111111111111111111111111', resource: 'masters', editId: '222222222222222222222222', selected: state.selected,
  listParams: {}, list: {}, branchQuery: {}, rows: [], branches: [], modalOpen: true, save: state.save, setQuery: state.setQuery, page: 1, branchPage: 1,
}) }));
import { OphthalmologyConfigurationPage } from './OphthalmologyConfigurationPage';
const record = (version: number) => adminConfigurationSchema.parse({ id: '222222222222222222222222', branch_id: '111111111111111111111111', type: 'COMPLAINT', code: 'QA', name: 'QA configuration', status: 'DRAFT', revision: 1, version, description: null, effective_from: null, effective_to: null, values: { options: [{ code: 'QA', label: 'QA', active: true }], opaque: { preserve: true } } });
describe('ophthalmology configuration editor', () => {
  let root: Root; let container: HTMLDivElement;
  beforeEach(() => { state.selected = record(1); state.canEdit = true; state.save.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('keeps the editing version and clinical values when a refreshed record changes', async () => {
    await act(async () => root.render(<OphthalmologyConfigurationPage />));
    const input = document.querySelector<HTMLInputElement>('#oph-master-form input[name="name"]'); if (!input) throw new Error('Name input missing');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => { setter?.call(input, 'Edited name'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    state.selected = record(2); await act(async () => root.render(<OphthalmologyConfigurationPage />));
    await act(async () => { document.querySelector('#oph-master-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ expected_version: 1, body: expect.objectContaining({ name: 'Edited name', values: record(1).values }) }));
  });
  it('does not expose editing controls to a view-only user', async () => {
    state.canEdit = false; await act(async () => root.render(<OphthalmologyConfigurationPage />));
    expect(document.querySelector('#oph-master-form fieldset')?.hasAttribute('disabled')).toBe(true);
  });
});
