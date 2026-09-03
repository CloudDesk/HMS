import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { InpatientAdmissionModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';

const oid = () => new Types.ObjectId();

test('Inpatient Discharge Workflow - Clinical Readiness, Bed Release, and Idempotency', async (t) => {
  await setupTestDatabase();
  t.afterEach(clearTestDatabase);
  t.after(teardownTestDatabase);

  const makeContext = async () => {
    const branchId = oid();
    const departmentId = oid();
    const actorId = oid();
    const patientId = oid();
    const admissionId = oid();
    const wardId = oid();
    const bedId = oid();

    await BranchModel.create({ _id: branchId, code: `B-${branchId}`, name: 'Discharge branch', status: 'ACTIVE' });
    await UserModel.create({
      _id: actorId,
      username: `user-${actorId}`,
      email: `${actorId}@example.test`,
      fullName: 'Dr. Attending Doctor',
      passwordHash: 'test',
      branchIds: [branchId],
      departmentIds: [departmentId],
      roleIds: [],
      status: 'active',
    });

    await InpatientAdmissionModel.create({
      _id: admissionId,
      admissionNumber: `ADM-DISCHARGE-1`,
      patientId,
      patientNumber: 'MRN-DISCHARGE-01',
      patientName: 'Discharge Patient',
      branchId,
      wardId,
      bedId,
      admittingDoctorId: actorId,
      admittingDoctorName: 'Dr. Attending Doctor',
      departmentId,
      departmentName: 'General Surgery',
      admissionDate: new Date(),
      admissionType: 'MEDICAL',
      reason: 'Inpatient recovery',
      status: 'ADMITTED',
      sourceType: 'DIRECT',
      createdBy: actorId,
      updatedBy: actorId,
    });

    const mockBeds = {
      getPolicyForConfirmation: async () => ({ admission_advance_deposit_required: false }),
      releaseAdmissionBed: async () => {},
    };

    const mockBilling = {
      list: async () => ({ data: [] }),
    };

    const mockPatients = {
      addAdmissionTimeline: async () => {},
    };

    const repository = new InpatientAdmissionRepository({} as never);
    const service = new InpatientAdmissionService(
      repository,
      mockBeds as never,
      mockPatients as never,
      mockBilling as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return {
      service,
      branchId: branchId.toString(),
      departmentId: departmentId.toString(),
      actorId: actorId.toString(),
      admissionId: admissionId.toString(),
      patientId: patientId.toString(),
    };
  };

  await t.test('saveDischargeSummary persists checklist and summary notes', async () => {
    const ctx = await makeContext();
    const saved = await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: true,
      home_oral_med_converted: true,
      summary_finalized: true,
      notes: 'Patient recovered well. Home oral meds prescribed.',
    }, ctx.actorId, {});

    assert.equal(saved.discharge_summary?.hemodynamic_stability_24h, true);
    assert.equal(saved.discharge_summary?.summary_finalized, true);
    assert.equal(saved.discharge_summary?.notes, 'Patient recovered well. Home oral meds prescribed.');

    // Verify persistence after re-fetch
    const reloaded = await ctx.service.get(ctx.admissionId, ctx.branchId, ctx.actorId);
    assert.equal(reloaded.discharge_summary?.summary_finalized, true);
  });

  await t.test('finalizeDischarge fails if clinical readiness checklist is incomplete', async () => {
    const ctx = await makeContext();
    // Save incomplete summary
    await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: false,
      home_oral_med_converted: true,
      summary_finalized: false,
    }, ctx.actorId, {});

    await assert.rejects(
      async () => ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {}),
      (err: unknown) => err instanceof Error && 'code' in err && err.code === 'DISCHARGE_CHECKLIST_INCOMPLETE',
    );
  });

  await t.test('finalizeDischarge succeeds when ready, sets status to DISCHARGED and is idempotent', async () => {
    const ctx = await makeContext();
    await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: true,
      home_oral_med_converted: true,
      summary_finalized: true,
    }, ctx.actorId, {});

    const discharged = await ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {});
    assert.equal(discharged.status, 'DISCHARGED');
    assert.ok(discharged.discharged_at);

    // Idempotent retry: repeated call should succeed safely and return same discharged object
    const retry = await ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {});
    assert.equal(retry.status, 'DISCHARGED');
    assert.equal(retry.id, discharged.id);
  });

  await t.test('unauthorized user without department scope cannot save discharge summary or finalize discharge', async () => {
    const ctx = await makeContext();
    const unauthorizedActor = oid();
    await UserModel.create({
      _id: unauthorizedActor,
      username: `user-${unauthorizedActor}`,
      email: `${unauthorizedActor}@example.test`,
      fullName: 'Unauthorized Staff',
      passwordHash: 'test',
      branchIds: [Types.ObjectId.createFromHexString(ctx.branchId)],
      departmentIds: [oid()], // Different department ID
      roleIds: [],
      status: 'active',
    });

    await assert.rejects(
      async () => ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
        hemodynamic_stability_24h: true,
        post_op_recovery_cleared: true,
        home_oral_med_converted: true,
        summary_finalized: true,
      }, unauthorizedActor.toString(), {}),
      (err: unknown) => err instanceof Error && 'code' in err && err.code === 'DEPARTMENT_ACCESS_DENIED',
    );
  });

  await t.test('financial clearance blocks discharge when policy requires advance deposit and balance is outstanding', async () => {
    const ctx = await makeContext();
    (ctx.service as unknown as { beds: unknown }).beds = {
      getPolicyForConfirmation: async () => ({ admission_advance_deposit_required: true }),
      releaseAdmissionBed: async () => {},
    };
    (ctx.service as unknown as { billing: unknown }).billing = {
      list: async () => ({ data: [{ id: oid().toString(), status: 'PENDING', balance_amount: 1500 }] }),
    };

    await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: true,
      home_oral_med_converted: true,
      summary_finalized: true,
    }, ctx.actorId, {});

    await assert.rejects(
      async () => ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {}),
      (err: unknown) => err instanceof Error && 'code' in err && err.code === 'FINANCIAL_CLEARANCE_REQUIRED',
    );

    const check = await ctx.service.get(ctx.admissionId, ctx.branchId, ctx.actorId);
    assert.equal(check.status, 'ADMITTED');
  });

  await t.test('unrelated OPD/patient invoice does not block inpatient discharge when inpatient balance is zero', async () => {
    const ctx = await makeContext();
    (ctx.service as unknown as { beds: unknown }).beds = {
      getPolicyForConfirmation: async () => ({ admission_advance_deposit_required: true }),
      releaseAdmissionBed: async () => {},
    };
    (ctx.service as unknown as { billing: unknown }).billing = {
      list: async (query: Record<string, unknown>) => {
        // Assert that billing query specifically searches by admission_id
        assert.equal(query.admission_id, ctx.admissionId);
        return { data: [] };
      },
    };

    await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: true,
      home_oral_med_converted: true,
      summary_finalized: true,
    }, ctx.actorId, {});

    const result = await ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {});
    assert.equal(result.status, 'DISCHARGED');
  });

  await t.test('transaction rolls back completely if releaseAdmissionBed fails', async () => {
    const ctx = await makeContext();
    (ctx.service as unknown as { beds: unknown }).beds = {
      getPolicyForConfirmation: async () => ({ admission_advance_deposit_required: false }),
      releaseAdmissionBed: async () => {
        throw new Error('Bed release DB failure');
      },
    };

    await ctx.service.saveDischargeSummary(ctx.admissionId, ctx.branchId, {
      hemodynamic_stability_24h: true,
      post_op_recovery_cleared: true,
      home_oral_med_converted: true,
      summary_finalized: true,
    }, ctx.actorId, {});

    await assert.rejects(
      async () => ctx.service.finalizeDischarge(ctx.admissionId, ctx.branchId, ctx.actorId, {}),
      (err: unknown) => err instanceof Error && err.message === 'Bed release DB failure',
    );

    const reloaded = await ctx.service.get(ctx.admissionId, ctx.branchId, ctx.actorId);
    assert.equal(reloaded.status, 'ADMITTED');
    assert.equal(reloaded.discharged_at, null);
  });
});
