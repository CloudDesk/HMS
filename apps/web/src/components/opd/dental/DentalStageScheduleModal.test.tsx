// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DentalStageScheduleModal } from './DentalStageScheduleModal';
import type { DentalTreatmentStageResponse } from '../../../api/opd';
import type { DoctorResponse } from '../../../api/doctors';

const mockOpdApi = vi.hoisted(() => ({
  scheduleDentalStage: vi.fn(),
  rescheduleDentalStage: vi.fn(),
}));

const mockDoctorsApi = vi.hoisted(() => ({
  availableSlots: vi.fn(),
}));

vi.mock('../../../api/opd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/opd')>();
  return {
    ...actual,
    opdApi: {
      ...actual.opdApi,
      ...mockOpdApi,
    },
  };
});

vi.mock('../../../api/doctors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/doctors')>();
  return {
    ...actual,
    doctorsApi: {
      ...actual.doctorsApi,
      ...mockDoctorsApi,
    },
  };
});

describe('DentalStageScheduleModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const mockStageTooth12: DentalTreatmentStageResponse = {
    id: 'stage-12-1',
    episode_id: 'episode-tooth-12',
    plan_item_id: 'plan-item-12',
    tooth_number: 12,
    stage_name: 'Composite Restoration - Layering & Cure',
    sequence: 1,
    assigned_doctor_id: 'doc-anderson',
    assigned_doctor_name: 'Dr. Anderson James',
    status: 'PLANNED',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: 'patient-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockDoctor: DoctorResponse = {
    id: 'doc-anderson',
    doctor_number: 'DOC-AJ-01',
    user_id: 'user-aj-01',
    first_name: 'Anderson',
    last_name: 'James',
    display_name: 'Dr. Anderson James',
    specialization: 'Restorative Dentistry',
    qualification: 'BDS, MDS',
    registration_number: 'DEN-9988',
    experience_years: 10,
    branch_id: 'branch-1',
    department_id: 'dept-1',
    consultation_room: 'Chair 2',
    phone: '1234567890',
    email: 'anderson@dental.com',
    status: 'ACTIVE',
    notes: null,
    availability: [],
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    // @ts-expect-error test flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    mockDoctorsApi.availableSlots.mockResolvedValue({
      date: '2026-09-24',
      is_available: true,
      working_hours: { start_time: '09:00', end_time: '17:00' },
      slots: [
        { start_time: '11:30', end_time: '12:30', available: true, is_available: true },
        { start_time: '14:00', end_time: '15:00', available: true, is_available: true },
      ],
    });

    mockOpdApi.scheduleDentalStage.mockResolvedValue({
      stage: { ...mockStageTooth12, status: 'SCHEDULED' },
      appointment: {
        id: 'appt-123',
        appointment_number: 'APT-2026-0001',
        start_time: '11:30',
        appointment_date: '2026-09-24',
        duration_minutes: 60,
        visit_type: 'PROCEDURE',
      },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  it('submits scheduling payload with notes and without unrecognized reason field', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalStageScheduleModal
            stage={mockStageTooth12}
            doctors={[mockDoctor]}
            existingDate="2026-09-24"
            existingStartTime="11:30"
            existingDurationMinutes={60}
            onClose={onClose}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Enter appointment notes
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    await act(async () => {
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        nativeSetter?.call(textarea, 'First visit composite restoration for cavity on tooth 12');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Select slot 11:30
    const slotButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('11:30'),
    );
    expect(slotButtons.length).toBeGreaterThan(0);
    await act(async () => {
      slotButtons[0]?.click();
    });

    // Submit form
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn).toBeTruthy();
    expect(submitBtn?.textContent).toContain('Schedule Appointment');

    await act(async () => {
      submitBtn?.click();
    });

    expect(mockOpdApi.scheduleDentalStage).toHaveBeenCalledTimes(1);
    const calls = mockOpdApi.scheduleDentalStage.mock.calls;
    expect(calls.length).toBe(1);
    const firstCall = calls[0]!;
    expect(firstCall[0]).toBe('stage-12-1');
    expect(firstCall[1]).toEqual({
      doctor_id: undefined,
      appointment_date: '2026-09-24',
      start_time: '11:30',
      utc_datetime: expect.any(String),
      duration_minutes: 60,
      notes: 'First visit composite restoration for cavity on tooth 12',
    });
    // Ensure "reason" is not sent
    expect(firstCall[1]).not.toHaveProperty('reason');
    expect(onClose).toHaveBeenCalled();
  });
});
