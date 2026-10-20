import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentModel } from './appointment.model.js';
import { AppointmentRepository } from './appointment.repository.js';
import { AppointmentService } from './appointment.service.js';
import { ophthalmologyAppointmentSchema } from './appointment-ophthalmology.contract.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { DoctorRepository } from '../doctors/doctor.repository.js';
import { PatientModel } from '../patients/patient.model.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { SettingsRepository } from '../settings/settings.repository.js';
import { SystemSettingsModel } from '../settings/settings.model.js';
import { defaultGeneralSettings, defaultUserPreferenceSettings } from '../settings/settings.defaults.js';
import { SequenceService } from '../../shared/sequence/sequence.service.js';
import { UserModel } from '../users/user.model.js';
import { ServiceModel } from '../services/service.model.js';
import { OphthalmologyConfigurationModel } from '../ophthalmology/ophthalmology.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
describe('authoritative Ophthalmology appointment intent', () => {
  let mongo: MongoMemoryReplSet; const repository = new AppointmentRepository();
  const service = new AppointmentService(repository, new PatientRepository(), new DoctorRepository(), new OpdVisitRepository(), new SettingsRepository(), new SequenceService());
  let branchId: string; let doctorId: string; let patientId: string; let actor: string; let catalogueId: string; let serviceId: string;
  const date = new Date(Date.now() + 30 * 86400000); date.setUTCHours(4, 30, 0, 0);
  const intent = () => ophthalmologyAppointmentSchema.parse({ visit_subtype: 'POST_OPERATIVE', affected_eye: 'OD', service_id: serviceId, sub_speciality_configuration_id: catalogueId, sub_speciality_code: 'QA-SUB', referral_source: 'EXTERNAL', referred_by: 'QA referring clinician' });
  const booking = () => ({ patient_id: patientId, doctor_id: doctorId, utc_datetime: date.toISOString(), duration_minutes: 30, visit_type: 'REVIEW' as const, ophthalmology: intent() });
  beforeAll(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri()); });
  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase(); await AppointmentModel.syncIndexes();
    const branch = await BranchModel.create({ code: 'QA-APPOINTMENT', name: 'Isolated appointment test', status: 'ACTIVE' }); branchId = branch._id.toString();
    const dept = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const user = await UserModel.create({ username: 'qa.oph.booking', email: 'qa.oph.booking@example.test', fullName: 'QA Booker', passwordHash: 'not-used', roleIds: [], branchIds: [branch._id], departmentIds: [dept._id], status: 'active' }); actor = user._id.toString();
    const doctor = await DoctorModel.create({ doctorNumber: 'QA-OPH-BOOK', firstName: 'QA', lastName: 'Consultant', displayName: 'QA Consultant', specialization: 'Ophthalmology', branchId: branch._id, departmentId: dept._id, status: 'ACTIVE', availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((dayOfWeek) => ({ dayOfWeek, isAvailable: true, workingBlocks: [{ startTime: '00:00', endTime: '23:30', slotDurationMinutes: 30, maxPatientsPerSlot: 1 }] })) }); doctorId = doctor._id.toString();
    const patient = await PatientModel.create({ patientNumber: 'QA-BOOK-1', firstName: 'QA', lastName: 'Patient', dateOfBirth: new Date('1990-01-01'), gender: 'UNKNOWN', status: 'ACTIVE' }); patientId = patient._id.toString();
    const catalogue = await OphthalmologyConfigurationModel.create({ branchId: branch._id, type: 'SUB_SPECIALITY', code: 'QA-SUBS', name: 'QA sub-speciality', revision: 1, status: 'ACTIVE', values: { options: [{ code: 'QA-SUB', label: 'QA sub-speciality', active: true }, { code: 'QA-INACTIVE', label: 'Inactive', active: false }] }, version: 0, createdBy: user._id, updatedBy: user._id }); catalogueId = catalogue._id.toString();
    const item = await ServiceModel.create({ code: 'QA-OPH-CONSULT', name: 'QA consultation service', serviceType: 'GENERAL', departmentId: dept._id, standardPrice: 0, status: 'ACTIVE' }); serviceId = item._id.toString();
    await SystemSettingsModel.create({ key: 'system', general: defaultGeneralSettings, hospital: { hospitalName: 'Isolated QA hospital', phone: '0000000000', email: 'qa@example.test', address: 'Synthetic test only' }, localization: { country: 'India', timezone: 'Asia/Kolkata', currency: 'INR', currencySymbol: 'INR', numberFormat: '1,000.00', firstDayOfWeek: 'Monday' }, userPreferences: defaultUserPreferenceSettings });
  });
  it('persists scheduling intent and retains it through ordinary rescheduling', async () => {
    const saved = await service.create(booking(), actor); expect(saved.ophthalmology).toEqual(intent()); expect(saved.visit_type).toBe('REVIEW');
    const updated = await service.update(saved.id, { utc_datetime: new Date(date.getTime() + 3600000).toISOString(), reschedule_reason: 'QA schedule change' }, actor);
    expect(updated.ophthalmology).toEqual(intent()); expect((await repository.getById(saved.id))?.ophthalmology).toEqual(intent());
  });
  it('checks catalogue, department and shared visit mapping rather than accepting frontend values', async () => {
    await expect(service.create({ ...booking(), visit_type: 'NEW_CONSULTATION' }, actor)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VISIT_TYPE_CONFLICT' });
    await expect(service.create({ ...booking(), ophthalmology: { ...intent(), sub_speciality_code: 'QA-INACTIVE' } }, actor)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_APPOINTMENT_REFERENCE_INVALID' });
    await expect(service.create({ ...booking(), ophthalmology: { ...intent(), service_id: new Types.ObjectId().toString() } }, actor)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_APPOINTMENT_REFERENCE_INVALID' });
    const user = await UserModel.create({ username: 'qa.outside', email: 'qa.outside@example.test', fullName: 'Outside', passwordHash: 'not-used', roleIds: [], branchIds: [], departmentIds: [], status: 'active' });
    await expect(service.create(booking(), user._id.toString())).rejects.toMatchObject({ statusCode: 403 }); expect(await AppointmentModel.countDocuments()).toBe(0);
  });
  it('uses exact timestamps and rolls back intent changes when their audit fails', async () => {
    const saved = await service.create(booking(), actor);
    await expect(service.update(saved.id, { ophthalmology: { ...intent(), affected_eye: 'OS' } }, actor)).rejects.toMatchObject({ code: 'APPOINTMENT_VERSION_CONFLICT' });
    const body = { ophthalmology: { ...intent(), affected_eye: 'OS' as const }, expected_updated_at: saved.updated_at.toISOString() };
    const audit = vi.spyOn(repository, 'auditOphthalmologyUpdated').mockRejectedValueOnce(new Error('audit failed'));
    await expect(service.update(saved.id, body, actor)).rejects.toThrow('audit failed'); audit.mockRestore(); expect((await repository.getById(saved.id))?.ophthalmology?.affected_eye).toBe('OD');
    const changed = await service.update(saved.id, body, actor); expect(changed.ophthalmology?.affected_eye).toBe('OS');
    await expect(service.update(saved.id, body, actor)).rejects.toMatchObject({ code: 'APPOINTMENT_VERSION_CONFLICT' }); expect(await AuditLogModel.countDocuments({ eventType: 'appointment.ophthalmology.updated' })).toBe(1);
  });
  it('offers only active scoped choices and never exposes prices or clinical rules', async () => {
    const choices = await service.ophthalmologyBookingOptions(doctorId, 'SUB_SPECIALITIES', 1, 1, actor); expect(choices).toMatchObject({ eligible: true, doctor_id: doctorId, branch_id: branchId, meta: { total: 1, limit: 1 } }); expect(choices.data[0]).toMatchObject({ id: catalogueId, code: 'QA-SUB' });
    const services = await service.ophthalmologyBookingOptions(doctorId, 'SERVICES', 1, 20, actor); expect(services.data[0]).toMatchObject({ id: serviceId }); expect(services.data[0]).not.toHaveProperty('standardPrice');
  });
});
