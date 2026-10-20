import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { expect, it, vi } from 'vitest';
import type { BookingFormData } from '../pages/AppointmentBookingPage';
import { emptyAppointmentSpecialtyForm } from '../hooks/appointments/appointment-specialty-form';
import { AppointmentOphthalmologyFields, type AppointmentSpecialtyFieldsState } from './AppointmentOphthalmologyFields';
const id = '111111111111111111111111';
it('retains explicit scheduling fields and maps a selected subtype to its shared type', async () => {
  let form: ReturnType<typeof useForm<BookingFormData>> | undefined;
  const query = { data: { doctor_id: id, branch_id: id, department_id: id, eligible: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  const state: AppointmentSpecialtyFieldsState = { specialtyServices: query, specialtyChoices: query, specialtyReady: true };
  function Harness() { form = useForm<BookingFormData>({ defaultValues: { patient_id: id, doctor_id: id, appointment_date: '2026-11-20', start_time: '10:00', visit_type: 'NEW_CONSULTATION', priority: 'ROUTINE', ...emptyAppointmentSpecialtyForm, specialty_enabled: true } }); return <AppointmentOphthalmologyFields register={form.register} watch={form.watch} setValue={form.setValue} state={state} open page={1} setQuery={vi.fn()} />; }
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  try { await act(async () => root.render(<Harness />)); const select = element.querySelector<HTMLSelectElement>('select[name="specialty_subtype"]'); if (!select) throw new Error('Missing subtype input');
    await act(async () => { select.value = 'POST_OPERATIVE'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(form?.getValues('visit_type')).toBe('REVIEW'); expect(form?.getValues('specialty_subtype')).toBe('POST_OPERATIVE'); expect(form?.getValues('specialty_eye')).toBe('');
    expect(element.textContent).toContain('No active branch sub-speciality options are configured');
  } finally { await act(async () => root.unmount()); element.remove(); }
});
