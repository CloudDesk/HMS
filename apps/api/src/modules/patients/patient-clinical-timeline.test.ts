import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatientTimelineEventModel } from './patient.model.js';
import { PatientRepository } from './patient.repository.js';
import { UserModel } from '../users/user.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdDentalExaminationModel } from '../opd/opd-dental-examination.model.js';
import { OpdFollowUpModel } from '../opd/opd-follow-up.model.js';
import { OpdReferralModel } from '../opd/opd-referral.model.js';
import { Types } from 'mongoose';

const patientId = '507f1f77bcf86cd799439011';

describe('PatientRepository clinical timeline', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters and paginates only doctor clinical actions and plans', async () => {
    let findFilter: Record<string, unknown> | undefined;
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    vi.spyOn(PatientTimelineEventModel, 'find').mockImplementation((filter) => {
      findFilter = filter as Record<string, unknown>;
      return { sort } as never;
    });
    const countDocuments = vi.spyOn(PatientTimelineEventModel, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(UserModel, 'find').mockReturnValue({ select: () => ({ lean: vi.fn().mockResolvedValue([]) }) } as never);

    const result = await new PatientRepository().listTimeline(patientId, {
      clinical_only: true,
      limit: 25,
      page: 2,
    });

    const expectedTypes = [
      'OPD_CONSULTATION_COMPLETED',
      'OPD_DENTAL_EXAMINATION_COMPLETED',
      'OPD_PRESCRIPTION_SUBMITTED',
      'OPD_LAB_ORDER_SUBMITTED',
      'OPD_IMAGING_ORDER_SUBMITTED',
      'OPD_FOLLOW_UP_SCHEDULED',
      'OPD_REFERRAL_SUBMITTED',
    ];
    expect(findFilter?.eventType).toEqual({ $in: expectedTypes });
    expect(countDocuments).toHaveBeenCalledWith(expect.objectContaining({ eventType: { $in: expectedTypes } }));
    expect(sort).toHaveBeenCalledWith({ occurredAt: -1 });
    expect(skip).toHaveBeenCalledWith(25);
    expect(limit).toHaveBeenCalledWith(25);
    expect(result.meta).toEqual({ total: 0, page: 2, limit: 25, totalPages: 1 });
  });

  it('reconstructs an old consultation from its original clinical records', async () => {
    const eventId = new Types.ObjectId();
    const visitId = new Types.ObjectId();
    const now = new Date('2026-09-02T10:00:00.000Z');
    const event = {
      _id: eventId,
      patientId: new Types.ObjectId(patientId),
      eventType: 'OPD_CONSULTATION_COMPLETED',
      title: 'OPD consultation completed',
      description: 'OPD-2026-000042: Clinical assessment recorded.',
      occurredAt: now,
      createdAt: now,
    };
    const leanEvents = vi.fn().mockResolvedValue([event]);
    vi.spyOn(PatientTimelineEventModel, 'find').mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: leanEvents }) }) }),
    } as never);
    vi.spyOn(PatientTimelineEventModel, 'countDocuments').mockResolvedValue(1);
    vi.spyOn(UserModel, 'find').mockReturnValue({ select: () => ({ lean: vi.fn().mockResolvedValue([]) }) } as never);
    vi.spyOn(OpdVisitModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      _id: visitId,
      visitNumber: 'OPD-2026-000042',
      reason: 'Severe tooth pain',
      doctorName: 'Dr. Tendai Chikore',
    }]) } as never);
    vi.spyOn(OpdConsultationModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      visitId,
      chiefComplaint: 'Severe tooth pain',
      assessment: 'Dental caries',
      treatmentPlan: 'Root canal treatment',
    }]) } as never);
    vi.spyOn(OpdPrescriptionModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      visitId,
      items: [{ medicineName: 'Ibuprofen', strength: '400 mg' }],
    }]) } as never);
    vi.spyOn(OpdClinicalOrderModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { visitId, orderType: 'LABORATORY', items: [{ investigationName: 'CBC' }] },
      { visitId, orderType: 'IMAGING', items: [{ investigationName: 'Dental X-ray' }] },
    ]) } as never);
    vi.spyOn(OpdDentalExaminationModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      visitId,
      teeth: [{ toothNumber: '16' }],
      treatmentPlanItems: [{ procedureName: 'Root canal' }],
    }]) } as never);
    vi.spyOn(OpdFollowUpModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      visitId,
      reason: 'Review healing',
      nextVisitDate: new Date('2026-09-09T00:00:00.000Z'),
      startTime: '09:00',
    }]) } as never);
    vi.spyOn(OpdReferralModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([{
      visitId,
      reason: 'Endodontist review',
    }]) } as never);

    const result = await new PatientRepository().listTimeline(patientId, { clinical_only: true });
    const description = result.data[0]?.description ?? '';

    expect(description).toContain('Problem: Severe tooth pain');
    expect(description).toContain('Assessment: Dental caries');
    expect(description).toContain('Treatment: Root canal treatment');
    expect(description).toContain('Medicines: Ibuprofen 400 mg');
    expect(description).toContain('Laboratory: CBC');
    expect(description).toContain('Imaging: Dental X-ray');
    expect(description).toContain('Dental findings: 1 tooth finding');
    expect(description).toContain('Dental plan: Root canal');
    expect(description).toContain('Referral: Endodontist review');
    expect(description).toContain('Follow-up: Review healing on 2026-09-09 at 09:00');
    expect(description).toContain('Doctor: Dr. Tendai Chikore');
  });
});
