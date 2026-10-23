import Fastify from 'fastify';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceRegistry } from '../../shared/services/service-registry.js';
import { OpdVisitRepository } from './opd-visit.repository.js';
import { OpdConsultationRepository } from './opd-consultation.repository.js';
import { registerOpdConsultationRoutes } from './opd-consultation.routes.js';
import type { OpdVisit } from './opd-visit.types.js';

describe('OPD consultation HTTP ocular laterality contract', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each([
    { ophthalmology: true, code: '9B10', codingSystem: 'ICD-11' },
    { ophthalmology: false, code: 'H25.9', codingSystem: 'ICD-10' },
  ])('rejects omitted/null laterality without clinical extension fields: $code', async ({ ophthalmology, code, codingSystem }) => {
    const visitId = new Types.ObjectId().toString();
    const actor = new Types.ObjectId().toString();
    const visit: OpdVisit = { id: visitId, visit_number: 'TEST', queue_token_number: 1, appointment_id: null,
      patient_id: new Types.ObjectId().toString(), patient_number: 'P', patient_name: 'Test', doctor_id: new Types.ObjectId().toString(),
      doctor_name: 'Test', doctor_specialization: 'Ophthalmology', branch_id: new Types.ObjectId().toString(), department_id: new Types.ObjectId().toString(),
      visit_date: new Date(), check_in_time: new Date(), visit_type: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'IN_CONSULTATION', version: 0,
      reason: null, notes: null, created_by: actor, updated_by: actor, created_at: new Date(), updated_at: new Date() };
    vi.spyOn(OpdVisitRepository.prototype, 'resolveBranchScope').mockResolvedValue([visit.branch_id]);
    vi.spyOn(OpdVisitRepository.prototype, 'getById').mockResolvedValue(visit);
    vi.spyOn(OpdConsultationRepository.prototype, 'requiresOphthalmologyCompletion').mockResolvedValue(ophthalmology);
    vi.spyOn(OpdConsultationRepository.prototype, 'getByVisit').mockResolvedValue(null);
    const write = vi.spyOn(OpdConsultationRepository.prototype, 'saveForVisit');
    const services = createServiceRegistry();
    vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({ id: actor, username: 'doctor', fullName: 'Doctor', email: null, status: 'active', patientId: null });
    vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(true);
    const app = Fastify();
    await registerOpdConsultationRoutes(app, services);
    try {
      for (const laterality of [undefined, null, 'NOT_APPLICABLE']) {
        const response = await app.inject({ method: 'PUT', url: `/api/opd/visits/${visitId}/consultation`, headers: { authorization: 'Bearer test' },
          payload: { diagnoses: [{ code, display: 'Ocular diagnosis', codingSystem, type: 'PRIMARY', laterality }] } });
        expect(response.statusCode, response.body).toBe(400);
        expect(response.json().message).toContain('laterality');
      }
      expect(write).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
