import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentQueuePage } from './AppointmentQueuePage';

const state = vi.hoisted(() => ({ direct: true, vitals: true, status: 'CHECKED_IN' }));
vi.mock('../components/opd/VitalsCaptureModal', () => ({ VitalsCaptureModal: () => null }));
vi.mock('../hooks/appointments/useAppointmentQueueFeature', () => ({
  useAppointmentQueueFeature: () => ({
    state: {
      departmentFilter: '', doctorFilter: '', statusFilter: '', priorityFilter: '',
      branchFilter: '', queueDate: '2026-09-21', departments: [], doctors: [], branches: [],
      appointments: [{ id: 'a1', patient_name: 'Test Patient', patient_number: 'P1',
        doctor_specialization: 'Dental', doctor_name: 'Test Doctor', start_time: '10:30',
        priority: 'ROUTINE', status: 'CHECKED_IN' }],
      callNotifications: [], loading: false, loadError: '', opdLoadError: '', updating: false,
      currentAppointment: null, nextAppointment: null, canCreateVitals: state.vitals,
      canEditVisit: true, canCheckIn: true, canViewConsultation: true,
    },
    actions: {
      visitForAppointment: () => ({ id: 'v1', status: state.status, queue_token_number: 1 }),
      canGoDirectlyToConsultation: () => state.direct,
      handleDirectConsultation: vi.fn(),
    },
  }),
}));

describe('Appointment queue dental choices', () => {
  beforeEach(() => { state.direct = true; state.vitals = true; state.status = 'CHECKED_IN'; });

  it('shows both vitals and direct consultation when available', () => {
    const html = renderToStaticMarkup(<AppointmentQueuePage />);
    expect(html).toContain('Take Vitals');
    expect(html).toContain('Go to Consultation');
  });

  it('keeps consultation available when the user cannot capture vitals', () => {
    state.vitals = false;
    const html = renderToStaticMarkup(<AppointmentQueuePage />);
    expect(html).not.toContain('Take Vitals');
    expect(html).toContain('Go to Consultation');
  });

  it('hides the direct option when the feature hook denies it', () => {
    state.direct = false;
    const html = renderToStaticMarkup(<AppointmentQueuePage />);
    expect(html).toContain('Take Vitals');
    expect(html).not.toContain('Go to Consultation');
  });

  it('offers reopening for a visit already in consultation', () => {
    state.direct = false;
    state.status = 'IN_CONSULTATION';
    const html = renderToStaticMarkup(<AppointmentQueuePage />);
    expect(html).toContain('Open Consultation');
    expect(html).not.toContain('Go to Consultation');
    expect(html).not.toContain('Take Vitals');
  });
});
