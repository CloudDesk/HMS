import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpdFollowUpService } from './opd-follow-up.service.js';
import type { OpdFollowUpRepository } from './opd-follow-up.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { PatientRepository } from '../patients/patient.repository.js';

describe('follow-up scheduling time guard', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-30T06:15:00Z')); });
  afterEach(() => vi.useRealTimers());

  function fixture() {
    const createAppointment = vi.fn().mockRejectedValue(new Error('Appointment validation reached'));
    const save = vi.fn();
    const service = new OpdFollowUpService(
      { getByVisit: vi.fn().mockResolvedValue(null), saveForVisit: save } as unknown as OpdFollowUpRepository,
      { resolveBranchScope: vi.fn().mockResolvedValue(null), getById: vi.fn().mockResolvedValue({ status: 'CLINICALLY_COMPLETED' }) } as unknown as OpdVisitRepository,
      { getByVisit: vi.fn().mockResolvedValue({ status: 'COMPLETED' }) } as unknown as OpdConsultationRepository,
      { create: createAppointment } as unknown as AppointmentService,
      {} as PatientRepository,
    );
    const payload = { follow_up_type: 'CLINICAL_REVIEW' as const, next_visit_date: '2026-10-30', start_time: '09:30',
      duration_minutes: 30, assigned_doctor_id: '111111111111111111111111', reason: 'Clinical review' };
    return { service, createAppointment, save, payload };
  }

  it.each(['2026-10-29T09:00:00Z', '2026-10-30T06:00:00Z', '2026-10-30T06:15:00Z', 'invalid'])(
    'rejects past, current or invalid appointment start %s before writes', async (utc_datetime) => {
      const f = fixture();
      await expect(f.service.schedule('111111111111111111111111', { ...f.payload, utc_datetime }, 'doctor'))
        .rejects.toMatchObject({ code: 'PAST_APPOINTMENT_TIME' });
      expect(f.createAppointment).not.toHaveBeenCalled();
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it('retains appointment availability and conflict validation for future starts', async () => {
    const f = fixture();
    await expect(f.service.schedule('111111111111111111111111', { ...f.payload, utc_datetime: '2026-10-30T06:30:00Z' }, 'doctor'))
      .rejects.toThrow('Appointment validation reached');
    expect(f.createAppointment).toHaveBeenCalledOnce();
    expect(f.save).not.toHaveBeenCalled();
  });
});
