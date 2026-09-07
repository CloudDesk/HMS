import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { InpatientAdmissionModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { createInpatientRoundNoteSchema } from '../src/modules/inpatient-admissions/inpatient-admission.schemas.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';
import { AppError } from '../src/shared/errors/app-error.js';

const oid = () => new Types.ObjectId();

describe('H-005 inpatient clinical records are authoritative and scoped', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const makeContext = async () => {
    const branchId = oid(); const departmentId = oid(); const actorId = oid(); const patientId = oid(); const admissionId = oid();
    await BranchModel.create({ _id: branchId, code: `B-${branchId}`, name: 'Clinical branch', status: 'ACTIVE' });
    await UserModel.create({ _id: actorId, username: `user-${actorId}`, email: `${actorId}@example.test`, fullName: 'Authorized Clinician', passwordHash: 'test', branchIds: [branchId], departmentIds: [departmentId], roleIds: [], status: 'active' });
    await InpatientAdmissionModel.create({ _id: admissionId, admissionNumber: `IP-${admissionId}`, patientId, patientNumber: 'MRN-H005', patientName: 'Scoped Patient', branchId, wardId: oid(), bedId: oid(), admittingDoctorId: oid(), admittingDoctorName: 'Admitting Doctor', departmentId, departmentName: 'Medicine', admissionDate: new Date(), admissionType: 'MEDICAL', reason: 'Clinical care', status: 'ADMITTED', sourceType: 'OPD_VISIT', sourceId: oid(), createdBy: actorId, updatedBy: actorId });
    const repository = new InpatientAdmissionRepository({} as ConstructorParameters<typeof InpatientAdmissionRepository>[0]);
    const service = new InpatientAdmissionService(repository, ...Array.from({ length: 8 }, () => ({})) as ConstructorParameters<typeof InpatientAdmissionService> extends [unknown, ...infer Rest] ? Rest : never);
    return { service, branchId: branchId.toString(), departmentId: departmentId.toString(), actorId: actorId.toString(), admissionId: admissionId.toString(), patientId: patientId.toString() };
  };

  it('round notes and vitals persist with server-derived context and reload', async () => {
    const context = await makeContext();
    const note = await context.service.createRoundNote(context.admissionId, context.branchId, { subjective: 'Improving', objective: 'Stable', assessment: 'Recovering', plan: 'Continue care' }, context.actorId, {});
    const vital = await context.service.createVital(context.admissionId, context.branchId, { bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature: 36.8, spo2: 98, respiratory_rate: 16, pain_score: 1 }, context.actorId, {});
    expect(note.patient_id).toBe(context.patientId);
    expect(note.branch_id).toBe(context.branchId);
    expect(note.doctor_name).toBe('Authorized Clinician');
    expect(vital.patient_id).toBe(context.patientId);
    expect(vital.branch_id).toBe(context.branchId);
    expect(vital.recorded_by).toBe('Authorized Clinician');
    expect((await context.service.listRoundNotes(context.admissionId, context.branchId, context.actorId))[0]?.id).toBe(note.id);
    expect((await context.service.listVitals(context.admissionId, context.branchId, context.actorId))[0]?.id).toBe(vital.id);
  });

  it('changing branch or admission context cannot retrieve or modify records', async () => {
    const context = await makeContext();
    const otherBranch = oid().toString();
    await expect(context.service.listRoundNotes(context.admissionId, otherBranch, context.actorId)).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'BRANCH_ACCESS_DENIED');
    await expect(context.service.createVital(oid().toString(), context.branchId, { bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature: 36.8, spo2: 98, respiratory_rate: 16, pain_score: 1 }, context.actorId, {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'ADMISSION_NOT_FOUND');
  });

  it('client-controlled clinical context fields are rejected', () => {
    expect(() => createInpatientRoundNoteSchema.parse({ subjective: 'S', objective: 'O', assessment: 'A', plan: 'P', patient_id: oid().toString() })).toThrow();
  });
});
