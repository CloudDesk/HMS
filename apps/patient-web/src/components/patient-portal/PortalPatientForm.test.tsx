import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { patientPortalApi } from '../../api/patient-portal';
import { PortalPatientForm } from './PortalPatientForm';

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({
  data: { data: [{ id: 'branch-1', name: 'Hospital' }] }, isLoading: false, isError: false,
}) }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('completes a minor SELF profile without guardian details', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const save = vi.spyOn(patientPortalApi, 'completeProfile').mockResolvedValue({ patientId: 'patient-1' });
  const onSaved = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PortalPatientForm mode="SELF" defaultFullName="Young Patient" onSaved={onSaved} />));
    for (const [name, value] of [['date_of_birth', '2020-01-01'], ['preferred_branch_id', 'branch-1']]) {
      const field = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      if (!field) throw new Error(`Missing ${name}`);
      await act(async () => {
        Object.getOwnPropertyDescriptor(field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
          'value')?.set?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ date_of_birth: '2020-01-01', emergency_contact: undefined }));
    expect(onSaved).toHaveBeenCalledWith('patient-1');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
