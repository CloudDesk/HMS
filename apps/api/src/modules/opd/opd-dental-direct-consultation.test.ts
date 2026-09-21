import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentRepository } from '../departments/department.repository.js';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { DoctorRepository } from '../doctors/doctor.repository.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { SequenceService } from '../../shared/sequence/sequence.service.js';
import { OpdVisitRepository } from './opd-visit.repository.js';
import { OpdVisitService } from './opd-visit.service.js';
import { OpdConsultationRepository } from './opd-consultation.repository.js';
import { OpdConsultationService } from './opd-consultation.service.js';
import { OpdVitalsRepository } from './opd-vitals.repository.js';
import { OpdDentalExaminationService } from './opd-dental-examination.service.js';
import { areVitalsOptional } from './opd-vitals-policy.js';
import type { OpdVisit } from './opd-visit.types.js';

const id = '507f1f77bcf86cd799439011';
const visit: OpdVisit = {
  id, visit_number: 'OPD-1', queue_token_number: 1, appointment_id: null,
  patient_id: id, patient_number: 'P-1', patient_name: 'Test Patient',
  doctor_id: id, doctor_name: 'Test Doctor', doctor_specialization: 'Dental',
  branch_id: id, department_id: id, visit_date: new Date(), check_in_time: new Date(),
  visit_type: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CHECKED_IN',
  reason: null, notes: null, created_by: id, updated_by: id,
  created_at: new Date(), updated_at: new Date(),
};

describe('Dental consultation without vitals', () => {
  const visits = new OpdVisitRepository();
  const patients = new PatientRepository();
  const consultations = new OpdConsultationRepository();
  const appointments = new AppointmentRepository();
  const service = new OpdVisitService(visits, appointments, patients, new DoctorRepository(),
    consultations, new SequenceService(), new NotificationService(new NotificationRepository()));

  beforeEach(() => {
    vi.spyOn(visits, 'resolveBranchScope').mockResolvedValue([id]);
    vi.spyOn(visits, 'getById').mockResolvedValue(visit);
    vi.spyOn(visits, 'updateStatus').mockResolvedValue({ ...visit, status: 'IN_CONSULTATION' });
    vi.spyOn(visits, 'auditStatusTransition').mockResolvedValue(undefined);
    vi.spyOn(patients, 'addTimelineEvent').mockResolvedValue(undefined);
    vi.spyOn(DepartmentRepository.prototype, 'getById').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['CHECKED_IN', 'WAITING_FOR_VITALS'] as const)('starts a dental visit from %s with a conditional scoped update', async (status) => {
    vi.mocked(visits.getById).mockResolvedValue({ ...visit, status });
    await service.updateStatus(id, { status: 'IN_CONSULTATION' }, id);
    expect(visits.updateStatus).toHaveBeenCalledWith(id, { status: 'IN_CONSULTATION' }, id, [id], undefined, status);
    expect(visits.auditStatusTransition).toHaveBeenCalled();
    expect(patients.addTimelineEvent).toHaveBeenCalled();
  });

  it('rejects direct consultation for a non-dental visit', async () => {
    vi.mocked(visits.getById).mockResolvedValue({ ...visit, doctor_specialization: 'Cardiology' });
    await expect(service.updateStatus(id, { status: 'IN_CONSULTATION' }, id))
      .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    expect(visits.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reopen a closed dental visit', async () => {
    vi.mocked(visits.getById).mockResolvedValue({ ...visit, status: 'COMPLETED' });
    await expect(service.updateStatus(id, { status: 'IN_CONSULTATION' }, id))
      .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('rejects a concurrent status change before adding audit or timeline events', async () => {
    vi.mocked(visits.updateStatus).mockResolvedValue(undefined);
    await expect(service.updateStatus(id, { status: 'IN_CONSULTATION' }, id))
      .rejects.toMatchObject({ code: 'VISIT_STATUS_CONFLICT' });
    expect(visits.auditStatusTransition).not.toHaveBeenCalled();
    expect(patients.addTimelineEvent).not.toHaveBeenCalled();
  });

  it('keeps vitals mandatory for a non-dental consultation', async () => {
    vi.mocked(visits.getById).mockResolvedValue({ ...visit, status: 'IN_CONSULTATION', doctor_specialization: 'Cardiology' });
    vi.spyOn(OpdDentalExaminationService.prototype, 'validateAssessment').mockResolvedValue(undefined);
    const vitals = new OpdVitalsRepository();
    vi.spyOn(vitals, 'getLatestByVisit').mockResolvedValue(undefined);
    const consultationService = new OpdConsultationService(consultations, visits, vitals, patients, appointments);
    await expect(consultationService.complete(id, {}, id)).rejects.toMatchObject({ code: 'VITALS_REQUIRED' });
  });

  it('allows dental completion to pass the vitals gate', async () => {
    vi.mocked(visits.getById).mockResolvedValue({ ...visit, status: 'IN_CONSULTATION' });
    vi.spyOn(OpdDentalExaminationService.prototype, 'validateAssessment').mockResolvedValue(undefined);
    const vitals = new OpdVitalsRepository();
    const readVitals = vi.spyOn(vitals, 'getLatestByVisit');
    const reachedSave = new Error('Reached consultation persistence');
    vi.spyOn(consultations, 'saveForVisit').mockRejectedValue(reachedSave);
    const consultationService = new OpdConsultationService(consultations, visits, vitals, patients, appointments);
    await expect(consultationService.complete(id, {}, id)).rejects.toBe(reachedSave);
    expect(readVitals).not.toHaveBeenCalled();
  });

  it('does not exempt an unrecognized clinical context from vitals', async () => {
    await expect(areVitalsOptional({ ...visit, doctor_specialization: 'General Medicine' })).resolves.toBe(false);
  });

  it('recognizes dental department membership when specialization is generic', async () => {
    vi.mocked(DepartmentRepository.prototype.getById).mockResolvedValue({
      id, code: 'DENT', name: 'Dental', description: null, branch_ids: [id],
      status: 'ACTIVE', isClinical: true, hiddenModules: [], created_by: id,
      updated_by: id, created_at: new Date(), updated_at: new Date(),
    });
    await expect(areVitalsOptional({ ...visit, doctor_specialization: 'General Medicine' })).resolves.toBe(true);
  });
});
