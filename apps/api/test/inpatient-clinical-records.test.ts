import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { InpatientAdmissionModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { createInpatientRoundNoteSchema } from '../src/modules/inpatient-admissions/inpatient-admission.schemas.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';

const oid = () => new Types.ObjectId();

test('H-005 inpatient clinical records are authoritative and scoped', async (t) => {
  await setupTestDatabase();
  t.afterEach(clearTestDatabase);
  t.after(teardownTestDatabase);

  const makeContext = async () => {
    const branchId = oid(); const departmentId = oid(); const actorId = oid(); const patientId = oid(); const admissionId = oid();
    await BranchModel.create({ _id: branchId, code: `B-${branchId}`, name: 'Clinical branch', status: 'ACTIVE' });
    await UserModel.create({ _id: actorId, username: `user-${actorId}`, email: `${actorId}@example.test`, fullName: 'Authorized Clinician', passwordHash: 'test', branchIds: [branchId], departmentIds: [departmentId], roleIds: [], status: 'active' });
    await InpatientAdmissionModel.create({ _id: admissionId, admissionNumber: `IP-${admissionId}`, patientId, patientNumber: 'MRN-H005', patientName: 'Scoped Patient', branchId, wardId: oid(), bedId: oid(), admittingDoctorId: oid(), admittingDoctorName: 'Admitting Doctor', departmentId, departmentName: 'Medicine', admissionDate: new Date(), admissionType: 'MEDICAL', reason: 'Clinical care', status: 'ADMITTED', sourceType: 'OPD_VISIT', sourceId: oid(), createdBy: actorId, updatedBy: actorId });
    const repository = new InpatientAdmissionRepository({} as ConstructorParameters<typeof InpatientAdmissionRepository>[0]);
    const service = new InpatientAdmissionService(repository, ...Array.from({ length: 8 }, () => ({})) as ConstructorParameters<typeof InpatientAdmissionService> extends [unknown, ...infer Rest] ? Rest : never);
    return { service, branchId: branchId.toString(), departmentId: departmentId.toString(), actorId: actorId.toString(), admissionId: admissionId.toString(), patientId: patientId.toString() };
  };

  await t.test('round notes and vitals persist with server-derived context and reload', async () => {
    const context = await makeContext();
    const note = await context.service.createRoundNote(context.admissionId, context.branchId, { subjective: 'Improving', objective: 'Stable', assessment: 'Recovering', plan: 'Continue care' }, context.actorId, {});
    const vital = await context.service.createVital(context.admissionId, context.branchId, { bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature: 36.8, spo2: 98, respiratory_rate: 16, pain_score: 1 }, context.actorId, {});
    assert.equal(note.patient_id, context.patientId); assert.equal(note.branch_id, context.branchId); assert.equal(note.doctor_name, 'Authorized Clinician');
    assert.equal(vital.patient_id, context.patientId); assert.equal(vital.branch_id, context.branchId); assert.equal(vital.recorded_by, 'Authorized Clinician');
    assert.equal((await context.service.listRoundNotes(context.admissionId, context.branchId, context.actorId))[0]?.id, note.id);
    assert.equal((await context.service.listVitals(context.admissionId, context.branchId, context.actorId))[0]?.id, vital.id);
  });

  await t.test('changing branch or admission context cannot retrieve or modify records', async () => {
    const context = await makeContext();
    const otherBranch = oid().toString();
    await assert.rejects(() => context.service.listRoundNotes(context.admissionId, otherBranch, context.actorId), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'BRANCH_ACCESS_DENIED');
    await assert.rejects(() => context.service.createVital(oid().toString(), context.branchId, { bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature: 36.8, spo2: 98, respiratory_rate: 16, pain_score: 1 }, context.actorId, {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ADMISSION_NOT_FOUND');
  });

  await t.test('client-controlled clinical context fields are rejected', () => {
    assert.throws(() => createInpatientRoundNoteSchema.parse({ subjective: 'S', objective: 'O', assessment: 'A', plan: 'P', patient_id: oid().toString() }));
  });
});
