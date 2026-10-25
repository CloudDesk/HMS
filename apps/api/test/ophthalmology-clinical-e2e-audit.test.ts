import mongoose, { Types } from 'mongoose';
import Fastify, { type FastifyInstance } from 'fastify';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createServiceRegistry } from '../src/shared/services/service-registry.js';
import { registerModules } from '../src/modules/index.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { PermissionModel } from '../src/modules/permissions/permission.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientModel, PatientDocumentModel, PatientTimelineEventModel } from '../src/modules/patients/patient.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { OpdConsultationModel } from '../src/modules/opd/opd-consultation.model.js';
import { OpdPrescriptionModel } from '../src/modules/opd/opd-prescription.model.js';
import {
  OphthalmologyContextModel,
  OphthalmologyConfigurationModel,
  OphthalmologyStationModel,
} from '../src/modules/ophthalmology/ophthalmology.model.js';
import { AdmissionRequestModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import {
  OphthalmologyIntakeModel,
  OphthalmologyAlertModel,
} from '../src/modules/ophthalmology/ophthalmology-intake.model.js';
import { OphthalmologyTestTaskModel } from '../src/modules/ophthalmology/ophthalmology-test-task.model.js';
import { OphthalmologyTestResultModel } from '../src/modules/ophthalmology/ophthalmology-test-result.model.js';
import {
  OphthalmologyClinicalReviewModel,
  OphthalmologyOpticalPrescriptionModel,
} from '../src/modules/ophthalmology/ophthalmology-review.model.js';
import { OphthalmologyConsultationFinalizationModel } from '../src/modules/ophthalmology/ophthalmology-consultation.model.js';
import {
  OphthalmologyAttachmentModel,
  OphthalmologyPublicationModel,
  OphthalmologyDashboardSnapshotModel,
} from '../src/modules/ophthalmology/ophthalmology-phase10.model.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../src/modules/surgery/surgery.model.js';
import { EmergencyEncounterModel } from '../src/modules/emergency/emergency.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';

describe('Clinical QA E2E Audit: Ophthalmology OPD Module', () => {
  let mongo: MongoMemoryReplSet;
  let app: FastifyInstance;
  let storagePath: string;
  let branchId: string;
  let departmentId: string;
  let serviceRegistry: ReturnType<typeof createServiceRegistry>;

  // Actor maps: username -> { id, user, token }
  const actors: Record<string, { id: string; user: { username: string; fullName: string; email: string; patientId?: string | null }; token: string }> = {};

  const setupActor = async (username: string, fullName: string, roleCode: string, permissions: Array<{ module: string; screen: string; action: string }>) => {
    const permDocs = await Promise.all(
      permissions.map(async (p) => {
        const code = `${p.module}_${p.screen}_${p.action}`.replaceAll(' ', '_').toUpperCase();
        return PermissionModel.findOneAndUpdate(
          { code },
          { $setOnInsert: { code, name: p.action, module: p.module, screen: p.screen, action: p.action, status: 'active', type: 'SCREEN' } },
          { upsert: true, returnDocument: 'after' }
        );
      })
    );
    const roleDoc = await RoleModel.create({
      code: roleCode,
      name: roleCode,
      permissionIds: permDocs.map((p) => p._id),
      status: 'active',
    });
    const userDoc = await UserModel.create({
      username,
      email: `${username}@hms.audit.test`,
      fullName,
      passwordHash: 'audited_hash',
      roleIds: [roleDoc._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(departmentId)],
      status: 'active',
    });
    const token = `bearer_${username}`;
    actors[username] = { id: userDoc._id.toString(), user: userDoc, token };
    return userDoc;
  };

  beforeAll(async () => {
    process.env.MONGOMS_STARTUP_TIMEOUT = '60000';
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
    await mongoose.connect(mongo.getUri());
    storagePath = await mkdtemp(path.join(os.tmpdir(), 'hms-audit-'));

    await Promise.all([
      BranchModel.init(),
      DepartmentModel.init(),
      UserModel.init(),
      RoleModel.init(),
      PermissionModel.init(),
      DoctorModel.init(),
      PatientModel.init(),
      OpdVisitModel.init(),
      OpdConsultationModel.init(),
      OpdPrescriptionModel.init(),
      OphthalmologyContextModel.init(),
      OphthalmologyConfigurationModel.init(),
      OphthalmologyIntakeModel.init(),
      OphthalmologyAlertModel.init(),
      OphthalmologyTestTaskModel.init(),
      OphthalmologyTestResultModel.init(),
      OphthalmologyClinicalReviewModel.init(),
      OphthalmologyOpticalPrescriptionModel.init(),
      OphthalmologyConsultationFinalizationModel.init(),
      OphthalmologyAttachmentModel.init(),
      OphthalmologyPublicationModel.init(),
      OphthalmologyDashboardSnapshotModel.init(),
      BillingInvoiceModel.init(),
      ProcedureRecommendationModel.init(),
      ProcedureBookingModel.init(),
      EmergencyEncounterModel.init(),
      ServiceModel.init(),
      AdmissionRequestModel.init(),
      OphthalmologyStationModel.init(),
      PatientDocumentModel.init(),
      PatientTimelineEventModel.init(),
    ]);

    const branch = await BranchModel.create({ code: 'AUDIT-BR', name: 'Audit Eye Center', status: 'ACTIVE' });
    branchId = branch._id.toString();
    const department = await DepartmentModel.create({
      code: 'OPHTHALMOLOGY',
      name: 'Ophthalmology',
      branchIds: [branch._id],
      status: 'ACTIVE',
      isClinical: true,
    });
    departmentId = department._id.toString();

    // 1. [ROLE-REC] rec_user_01
    await setupActor('rec_user_01', 'Receptionist One', 'ROLE-REC', [
      { module: 'OPD', screen: 'OPD Reception', action: 'View' },
      { module: 'OPD', screen: 'OPD Reception', action: 'Check In' },
      { module: 'Appointments', screen: 'Appointments', action: 'View' },
      { module: 'Appointments', screen: 'Appointments', action: 'Book' },
    ]);

    // 2. [ROLE-NUR] nurse_01
    await setupActor('nurse_01', 'Nurse One', 'ROLE-NUR', [
      { module: 'OPD', screen: 'OPD Vitals', action: 'Record' },
      { module: 'OPD', screen: 'OPD Vitals', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Intake', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Escalate' },
    ]);

    // 3. [ROLE-VTECH] vis_tech_01
    await setupActor('vis_tech_01', 'Vision Technician One', 'ROLE-VTECH', [
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
    ]);

    // 4. [ROLE-OPT] optom_01
    const optomUser = await setupActor('optom_01', 'Optometrist One', 'ROLE-OPT', [
      { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
    ]);
    await DoctorModel.create({
      doctorNumber: 'OPT-DOC-001',
      userId: optomUser._id,
      firstName: 'Optometrist',
      lastName: 'One',
      displayName: 'Optometrist One',
      specialization: 'Optometry',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      status: 'ACTIVE',
      availability: [],
    });

    // 5. [ROLE-TONO] tono_tech_01
    await setupActor('tono_tech_01', 'Tonometry Technician One', 'ROLE-TONO', [
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
    ]);

    // 6. [ROLE-DTECH] diag_tech_01
    await setupActor('diag_tech_01', 'Diagnostic Tech One', 'ROLE-DTECH', [
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Complete' },
      { module: 'OPD', screen: 'Ophthalmology Portal Publication', action: 'View' },
    ]);

    // 7. [ROLE-OPH] oph_doctor_01
    const ophUser = await setupActor('oph_doctor_01', 'Dr. Attending Ophthalmologist', 'ROLE-OPH', [
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Diagnose' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Complete' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Amend' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Reopen' },
      { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'Override' },
      { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Approve' },
      { module: 'OPD', screen: 'Ophthalmology Emergency', action: 'Clear' },
      { module: 'OPD', screen: 'Ophthalmology Intake', action: 'Escalate' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'View' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Edit' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Assign' },
      { module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Review' },
      { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Review' },
      { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Amend' },
      { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Request Repeat' },
      { module: 'Surgery', screen: 'Recommendations', action: 'Create' },
      { module: 'Surgery', screen: 'Recommendations', action: 'View' },
      { module: 'OPD', screen: 'OPD Consultation', action: 'View' },
      { module: 'OPD', screen: 'OPD Consultation', action: 'Edit' },
      { module: 'OPD', screen: 'OPD Prescription', action: 'Prescribe' },
      { module: 'OPD', screen: 'OPD Prescription', action: 'Edit' },
      { module: 'OPD', screen: 'OPD Prescription', action: 'View' },
    ]);
    await DoctorModel.create({
      doctorNumber: 'OPH-DOC-001',
      userId: ophUser._id,
      firstName: 'Attending',
      lastName: 'Ophthalmologist',
      displayName: 'Dr. Attending Ophthalmologist',
      specialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      status: 'ACTIVE',
      availability: [],
    });

    // 8. [ROLE-COUNS] couns_01
    await setupActor('couns_01', 'Surgical Counsellor One', 'ROLE-COUNS', [
      { module: 'Surgery', screen: 'Recommendations', action: 'View' },
      { module: 'Surgery', screen: 'Bookings', action: 'View' },
      { module: 'Surgery', screen: 'Bookings', action: 'Schedule' },
    ]);

    // 9. [ROLE-PHARM] pharm_01
    await setupActor('pharm_01', 'Pharmacy Dispenser One', 'ROLE-PHARM', [
      { module: 'Pharmacy', screen: 'Pharmacy Dispensing', action: 'View' },
      { module: 'Pharmacy', screen: 'Pharmacy Dispensing', action: 'Dispense' },
    ]);

    // 10. [ROLE-BILL] bill_01
    await setupActor('bill_01', 'Billing Officer One', 'ROLE-BILL', [
      { module: 'Billing', screen: 'Billing Invoices', action: 'View' },
      { module: 'Billing', screen: 'Billing Invoices', action: 'Settle' },
      { module: 'Billing', screen: 'Billing Payments', action: 'Collect' },
    ]);

    // 11. [ROLE-PAT] pat_portal_01
    await setupActor('pat_portal_01', 'Portal Patient', 'ROLE-PAT', [
      { module: 'Patient Portal', screen: 'Patient Portal', action: 'View' },
    ]);

    // Seed Billing tariff consultation service
    await ServiceModel.create({
      code: 'OPHTHALMOLOGY_CONSULTATION',
      name: 'Ophthalmology Consultation',
      departmentId: new Types.ObjectId(departmentId),
      serviceType: 'GENERAL',
      standardPrice: 250,
      status: 'ACTIVE',
    });

    // Seed Optical configuration options
    await OphthalmologyConfigurationModel.create({
      branchId: new Types.ObjectId(branchId),
      type: 'CLINICAL_THRESHOLD',
      code: 'OPTICAL-CONFIG',
      name: 'Optical Prescription Options',
      revision: 1,
      status: 'ACTIVE',
      values: {
        lens_types: ['SINGLE_VISION', 'BIFOCAL', 'PROGRESSIVE'],
        lens_materials: ['CR39', 'POLYCARBONATE', 'HI_INDEX'],
        coating_codes: ['ANTI_REFLECTIVE', 'UV_PROTECT', 'BLUE_FILTER'],
      },
      version: 0,
      createdBy: ophUser._id,
      updatedBy: ophUser._id,
    });

    // Seed Emergency completion profile
    await OphthalmologyConfigurationModel.create({
      branchId: new Types.ObjectId(branchId),
      type: 'COMPLETION_PROFILE',
      code: 'EMG-COMPLETE-1',
      name: 'Emergency Completion 1',
      revision: 1,
      status: 'ACTIVE',
      values: { visit_subtypes: ['EMERGENCY'], allow_override: true, required_requirements: ['ALERTS_ACKNOWLEDGED'] },
      version: 0,
      createdBy: ophUser._id,
      updatedBy: ophUser._id,
    });

    // Seed Routine completion profile
    await OphthalmologyConfigurationModel.create({
      branchId: new Types.ObjectId(branchId),
      type: 'COMPLETION_PROFILE',
      code: 'RTN-COMPLETE-1',
      name: 'Routine Completion 1',
      revision: 1,
      status: 'ACTIVE',
      values: {
        visit_subtypes: ['NEW_CONSULTATION'],
        allow_override: true,
        required_requirements: [
          'INTAKE_COMPLETED',
          'DIAGNOSIS_RECORDED',
          'CLINICAL_REVIEW_RECORDED',
          'TREATMENT_PLAN_RECORDED',
          'FOLLOW_UP_DECISION_RECORDED',
        ],
      },
      version: 0,
      createdBy: ophUser._id,
      updatedBy: ophUser._id,
    });

    // Service Registry & Fastify HTTP Server
    serviceRegistry = createServiceRegistry();

    // Mock token authentication to map directly to our actors
    vi.spyOn(serviceRegistry.auth, 'authenticateAccessToken').mockImplementation(async (token: string) => {
      const match = Object.values(actors).find((a) => a.token === token);
      if (match) {
        return {
          id: match.id,
          username: match.user.username,
          fullName: match.user.fullName,
          email: match.user.email,
          status: 'active',
          patientId: match.user.patientId ?? null,
        };
      }
      throw new Error('Authentication required');
    });

    app = Fastify();
    await registerModules(app, serviceRegistry);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo?.stop();
    await rm(storagePath, { recursive: true, force: true });
  });

  const dispatch = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, actorKey: string, payload?: unknown, headers?: Record<string, string>) => {
    const actor = actors[actorKey];
    return app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${actor.token}`,
        'content-type': 'application/json',
        ...headers,
      },
      payload: payload ? JSON.stringify(payload) : undefined,
    });
  };

  // =========================================================================
  // SCENARIO 1: The Emergency Inpatient Branch (Red & Pink Track)
  // =========================================================================
  it('SCENARIO 1: Emergency Inpatient Branch - fail closed locking & inpatient admission handoff', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-EMG-01',
      firstName: 'Emergency',
      lastName: 'Alkali',
      dateOfBirth: new Date('1995-03-12'),
      gender: 'MALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-EMG-01',
      queueTokenNumber: 101,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Emergency Alkali',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'EMERGENCY',
      priority: 'EMERGENCY',
      reason: 'Acute alkali splash OD',
      status: 'WAITING_FOR_VITALS',
      version: 0,
    });
    const visitId = visit._id.toString();

    const config = await OphthalmologyConfigurationModel.findOne({ code: 'EMG-COMPLETE-1' }).orFail();
    const context = await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'EMERGENCY',
      affectedEye: 'OD',
      workflowStatus: 'CHECKED_IN',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.rec_user_01.id),
      updatedBy: new Types.ObjectId(actors.rec_user_01.id),
    });

    // 2. [ROLE-REC] Negative Checks: clinical task or diagnosis
    const recTaskResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/test-tasks`, 'rec_user_01', {
      expected_context_version: context.version,
      test_catalogue_version_id: new Types.ObjectId().toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OD',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, { 'idempotency-key': 'rec-task-unauth' });
    expect(recTaskResp.statusCode).toBe(403);

    const recDiagResp = await dispatch('PUT', `/api/opd/visits/${visitId}/consultation`, 'rec_user_01', {
      expected_version: 0,
      diagnoses: [{ code: 'T26.11XA', display: 'Alkali burn cornea OD', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OD' }],
    });
    expect(recDiagResp.statusCode).toBe(403);

    // 3. [ROLE-NUR] Perform immediate clinical escalation
    const nurseEscalateResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/escalate`, 'nurse_01', {
      criterion_codes: ['ACUTE_CHEMICAL_INJURY'],
      reason: 'Acute alkali splash OD with severe epithelial defect',
      urgency: 'EMERGENCY',
    });
    expect(nurseEscalateResp.statusCode).toBe(200);
    const alertData = nurseEscalateResp.json().data;
    expect(alertData.status).toBe('ACTIVE');
    const alertId = alertData.id;

    // 4. [ROLE-REC] Negative Check: Routine booking / task check-in is locked
    const lockedTaskResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/test-tasks`, 'oph_doctor_01', {
      expected_context_version: context.version,
      test_catalogue_version_id: new Types.ObjectId().toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OD',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, { 'idempotency-key': 'oph-task-locked' });
    expect(lockedTaskResp.statusCode).toBe(409);
    expect(lockedTaskResp.json().code).toBe('OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED');

    // 5. [ROLE-OPH] Acknowledge alert, then attempt immediate finalization -> Assert 409
    const ackResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/${alertId}/acknowledge`, 'oph_doctor_01', {
      expected_version: alertData.version,
      expected_status: 'ACTIVE',
      note: 'On-call Ophthalmologist responding to emergency cubicle',
    });
    expect(ackResp.statusCode).toBe(200);

    const prematureFinalizeResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/complete`, 'oph_doctor_01', {
      expected_version: 0,
      expected_context_version: 0,
      expected_consultation_version: 0,
      expected_clinical_review_version: 0,
    }, { 'idempotency-key': 'premature-fin-1' });
    expect(prematureFinalizeResp.statusCode).toBe(409);

    // 6. [ROLE-OPH] Clear alert: disposition = 'ADMIT_TO_INPATIENT', resumption_permitted = false
    const clearResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/${alertId}/clear`, 'oph_doctor_01', {
      expected_version: ackResp.json().data.version,
      disposition: 'ADMIT_TO_INPATIENT',
      clearance_rationale: 'Corneal melting risk requiring immediate admission and irrigation',
      resumption_permitted: false,
    });
    expect(clearResp.statusCode).toBe(200);
    const clearedAlert = clearResp.json().data;
    expect(clearedAlert.status).toBe('CLEARED');
    expect(clearedAlert.clearance.disposition).toBe('ADMIT_TO_INPATIENT');
    expect(clearedAlert.clearance.resumption_permitted).toBe(false);
    expect(clearedAlert.clearance.admission_request_id).toBeDefined();

    // 7. Verify InpatientAdmission handoff generated
    const admissionReq = await AdmissionRequestModel.findById(clearedAlert.clearance.admission_request_id);
    expect(admissionReq).toBeDefined();
    expect(admissionReq?.priority).toBe('EMERGENCY');
    expect(admissionReq?.sourceType).toBe('OPD_VISIT');
    expect(admissionReq?.sourceId?.toString()).toBe(visitId);

    // Routine encounter remains fail-closed because resumption_permitted = false
    const stillBlockedTask = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/test-tasks`, 'oph_doctor_01', {
      expected_context_version: context.version,
      test_catalogue_version_id: new Types.ObjectId().toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OD',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, { 'idempotency-key': 'still-blocked-task' });
    expect(stillBlockedTask.statusCode).toBe(409);
    expect(stillBlockedTask.json().code).toBe('OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED');
  });

  // =========================================================================
  // SCENARIO 2: Emergency Stabilized & Resumed Routine Consultation (Red -> Blue Track)
  // =========================================================================
  it('SCENARIO 2: Emergency Stabilized & Resumed Routine Consultation - clearance releases fail-closed lock', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-EMG-02',
      firstName: 'Stabilized',
      lastName: 'ForeignBody',
      dateOfBirth: new Date('1990-07-22'),
      gender: 'FEMALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-EMG-02',
      queueTokenNumber: 102,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Stabilized ForeignBody',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'EMERGENCY',
      priority: 'EMERGENCY',
      reason: 'Corneal Foreign Body OD',
      status: 'WAITING_FOR_VITALS',
      version: 0,
    });
    const visitId = visit._id.toString();

    const config = await OphthalmologyConfigurationModel.findOne({ code: 'EMG-COMPLETE-1' }).orFail();
    await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'EMERGENCY',
      affectedEye: 'OD',
      workflowStatus: 'CHECKED_IN',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.nurse_01.id),
      updatedBy: new Types.ObjectId(actors.nurse_01.id),
    });

    // 1. [ROLE-NUR] Escalate at triage
    const escResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/escalate`, 'nurse_01', {
      criterion_codes: ['FOREIGN_BODY'],
      reason: 'Corneal Foreign Body OD with sensation',
      urgency: 'EMERGENCY',
    });
    expect(escResp.statusCode).toBe(200);
    const alertData = escResp.json().data;
    const alertId = alertData.id;

    // 2. [ROLE-BILL] Negative Check: Attempt emergency clearance via API
    const billClearResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/${alertId}/clear`, 'bill_01', {
      expected_version: alertData.version,
      disposition: 'RESUME_ROUTINE_OPD',
      resumption_permitted: true,
      clearance_rationale: 'Unauthorized clearance attempt by billing',
    });
    expect(billClearResp.statusCode).toBe(403);

    // 3. [ROLE-OPH] Authorized clearance with resumption_permitted = true
    const ophClearResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/alerts/${alertId}/clear`, 'oph_doctor_01', {
      expected_version: alertData.version,
      disposition: 'RESUME_ROUTINE_OPD',
      resumption_permitted: true,
      clearance_rationale: 'Foreign body removed; anterior chamber intact',
    });
    expect(ophClearResp.statusCode).toBe(200);
    expect(ophClearResp.json().data.status).toBe('CLEARED');
    expect(ophClearResp.json().data.clearance.resumption_permitted).toBe(true);

    // 4. Verification: Routine lock released, patient can proceed
    const journey = await serviceRegistry.ophthalmology.getPatientJourneyStatus(visitId, actors.oph_doctor_01.id);
    expect(journey.stages.preliminary_intake.emergency_alert).toBe(false);
  });

  // =========================================================================
  // SCENARIO 3: Routine Intake, Preliminary Tests & Technician Constraints (Central Blue Track)
  // =========================================================================
  it('SCENARIO 3: Routine Intake & Preliminary Tests - technician boundaries & IOP flag without automated diagnosis', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-RTN-01',
      firstName: 'Routine',
      lastName: 'Vision',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'MALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-RTN-01',
      queueTokenNumber: 201,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Routine Vision',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      reason: 'Routine vision checkup',
      status: 'IN_CONSULTATION',
      version: 0,
    });
    const visitId = visit._id.toString();

    const config = await OphthalmologyConfigurationModel.findOne({ code: 'RTN-COMPLETE-1' }).orFail();
    await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'NEW_CONSULTATION',
      affectedEye: 'OU',
      workflowStatus: 'PRELIMINARY_EXAMINATION',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.rec_user_01.id),
      updatedBy: new Types.ObjectId(actors.rec_user_01.id),
    });

    // 1. [ROLE-OPT] Enter Refraction and Lensometry draft via PUT /draft
    const optDraftResp = await dispatch('PUT', `/api/opd/visits/${visitId}/ophthalmology/optical-prescription/draft`, 'optom_01', {
      expected_version: 0,
      prescription_type: 'DISTANCE',
      power: {
        OD: { sphere: -1.5, cylinder: -0.5, axis: 90 },
        OS: { sphere: 0, cylinder: 0, axis: 0 },
      },
      pupillary_distance: { format: 'BINOCULAR', binocular: 63 },
      lens_type: 'SINGLE_VISION',
      material: 'CR39',
      coating_codes: ['ANTI_REFLECTIVE'],
      usage_instructions: 'Constant distance wear',
      valid_until: '2028-01-01T00:00:00.000Z',
    });
    expect(optDraftResp.statusCode).toBe(200);

    // [ROLE-OPT] Click 'Approve Optical Prescription' -> Assert action blocked / HTTP 403
    const unauthApprove = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/optical-prescription/approve`, 'optom_01', {
      expected_version: 0,
      expected_status: 'DRAFT',
    });
    expect(unauthApprove.statusCode).toBe(403);

    // [ROLE-OPT] Negative Check: Cannot sign regulated systemic prescriptions
    const unauthRx = await dispatch('PUT', `/api/opd/visits/${visitId}/prescription`, 'optom_01', {
      expected_version: 0,
      items: [{ medicine_name: 'Amoxicillin 500mg', dosage: '1 tab', route: 'Oral', frequency: 'TDS', duration: '5 days' }],
    });
    expect(unauthRx.statusCode).toBe(403);

    // [ROLE-OPT] Negative Check: Cannot complete encounters
    const unauthComplete = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/complete`, 'optom_01', {
      expected_version: 0,
      expected_context_version: 0,
      expected_consultation_version: 0,
      expected_clinical_review_version: 0,
    }, { 'idempotency-key': 'optom-unauth-complete' });
    expect(unauthComplete.statusCode).toBe(403);

    // 2. [ROLE-TONO] Tonometry IOP: OD = 28 mmHg (Goldmann), OS = 15 mmHg
    const consultation = await OpdConsultationModel.findOne({ visitId: visit._id });
    expect(consultation?.diagnoses ?? []).toHaveLength(0);
  });

  // =========================================================================
  // SCENARIO 4: Diagnostic Ordering, Unacceptable Scan & Repeat Lineage Loop (Yellow Loop)
  // =========================================================================
  it('SCENARIO 4: Diagnostic Repeat Lineage - unacceptable scan and parent-child repeat task preservation', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-OCT-01',
      firstName: 'Macular',
      lastName: 'Scan',
      dateOfBirth: new Date('1978-11-04'),
      gender: 'MALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-OCT-01',
      queueTokenNumber: 301,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Macular Scan',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      reason: 'Retinal evaluation',
      status: 'IN_CONSULTATION',
      version: 0,
    });
    const visitId = visit._id.toString();
    const config = await OphthalmologyConfigurationModel.findOne({ code: 'RTN-COMPLETE-1' }).orFail();
    const context = await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'NEW_CONSULTATION',
      affectedEye: 'OD',
      workflowStatus: 'CLINICAL_REVIEW',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    const stationDoc = await OphthalmologyStationModel.create({
      code: 'OCT-STATION-01',
      name: 'OCT Diagnostic Station',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      status: 'ACTIVE',
      supportedTestTypes: ['OCT', 'VISUAL_ACUITY'],
      memberUserIds: [new Types.ObjectId(actors.diag_tech_01.id), new Types.ObjectId(actors.oph_doctor_01.id)],
      devices: [],
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });
    const station = stationDoc._id;

    // 1. [ROLE-OPH] Order OCT Macula OD (Urgent)
    const task = await OphthalmologyTestTaskModel.create({
      contextId: context._id,
      visitId: new Types.ObjectId(visitId),
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      testCatalogueVersionId: new Types.ObjectId(),
      workflowProfileVersionId: new Types.ObjectId(),
      testCode: 'OCT',
      testName: 'Optical Coherence Tomography',
      laterality: 'OD',
      priority: 'PRIORITY',
      sourceType: 'WORKFLOW',
      specialInstructions: 'Rule out CME',
      status: 'ORDERED',
      stationId: station,
      orderedAt: new Date(),
      doctorReviewRequired: true,
      idempotencyKey: 'oct-task-original-1',
      requestFingerprint: 'oct-fp-original-1',
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });
    const originalTaskId = task._id.toString();

    // Complete task so it can be repeated
    await OphthalmologyTestTaskModel.updateOne(
      { _id: task._id },
      { $set: { status: 'COMPLETED', version: 1 } }
    );

    // 2. [ROLE-OPH] Attempt repeat without entering reason -> Assert validation fails
    const emptyRepeatResp = await dispatch('POST', `/api/ophthalmology/test-tasks/${originalTaskId}/request-repeat`, 'oph_doctor_01', {
      expected_version: 1,
      expected_status: 'COMPLETED',
      station_id: station.toString(),
      reason: '',
    }, { 'idempotency-key': 'repeat-empty-1' });
    expect(emptyRepeatResp.statusCode).toBe(400);

    // 3. [ROLE-OPH] Enter valid repeat reason
    const repeatResp = await dispatch('POST', `/api/ophthalmology/test-tasks/${originalTaskId}/request-repeat`, 'oph_doctor_01', {
      expected_version: 1,
      expected_status: 'COMPLETED',
      station_id: station.toString(),
      reason: 'Retake with central fixation target',
    }, { 'idempotency-key': 'repeat-valid-1' });
    expect(repeatResp.statusCode).toBe(200);
    const repeatTask = repeatResp.json().data;

    // 4. Assertions: Original task status = REPEAT_REQUIRED, child task links to parent
    const parentTask = await OphthalmologyTestTaskModel.findById(originalTaskId).orFail();
    expect(parentTask.status).toBe('REPEAT_REQUIRED');
    expect(parentTask.repeatTaskId?.toString()).toBe(repeatTask.id);
    expect(repeatTask.repeat_of_task_id).toBe(originalTaskId);
  });

  // =========================================================================
  // SCENARIO 5: Assessment, Multi-Track Treatment & Surgical Laterality
  // =========================================================================
  it('SCENARIO 5: Multi-Track Treatment & Surgical Laterality - strict OD/OS/OU enforcement', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-CAT-01',
      firstName: 'Cataract',
      lastName: 'Patient',
      dateOfBirth: new Date('1954-08-19'),
      gender: 'FEMALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-CAT-01',
      queueTokenNumber: 401,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Cataract Patient',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      reason: 'Progressive blurred vision',
      status: 'IN_CONSULTATION',
      version: 0,
    });
    const visitId = visit._id.toString();

    const config = await OphthalmologyConfigurationModel.findOne({ code: 'RTN-COMPLETE-1' }).orFail();
    await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'NEW_CONSULTATION',
      affectedEye: 'OD',
      workflowStatus: 'CLINICAL_REVIEW',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // 1. [ROLE-OPH] Diagnosis save without laterality -> Assert 400
    const noLateralityDiag = await dispatch('PUT', `/api/opd/visits/${visitId}/consultation`, 'oph_doctor_01', {
      expected_version: 0,
      diagnoses: [{ code: 'H25.11', display: 'Nuclear Cataract', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: null }],
    });
    expect(noLateralityDiag.statusCode).toBe(400);

    // 2. Set laterality = 'OD' -> Save succeeds
    const validDiag = await dispatch('PUT', `/api/opd/visits/${visitId}/consultation`, 'oph_doctor_01', {
      expected_version: 0,
      diagnoses: [{ code: 'H25.11', display: 'Nuclear Cataract', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OD', status: 'CONFIRMED' }],
    });
    expect(validDiag.statusCode).toBe(200);

    // 3. [ROLE-OPH] Prescribe ophthalmic drops without laterality -> Assert 400
    const noLateralityRx = await dispatch('PUT', `/api/opd/visits/${visitId}/prescription`, 'oph_doctor_01', {
      expected_version: 0,
      items: [{
        medicine_name: 'Prednisolone 1% Eye Drops',
        dosage: '1 drop',
        route: 'Ophthalmic',
        frequency: 'Four times daily',
        duration: '7 days',
        laterality: null,
      }],
    });
    expect(noLateralityRx.statusCode).toBe(400);

    // Valid laterality = 'OD'
    const validRx = await dispatch('PUT', `/api/opd/visits/${visitId}/prescription`, 'oph_doctor_01', {
      expected_version: 0,
      items: [{
        medicine_name: 'Prednisolone 1% Eye Drops',
        dosage: '1 drop',
        route: 'Ophthalmic',
        frequency: 'Four times daily',
        duration: '7 days',
        laterality: 'OD',
      }],
    });
    expect(validRx.statusCode).toBe(200);

    // 4. [ROLE-OPH] Authorize Optical Rx
    const optDraft = await dispatch('PUT', `/api/opd/visits/${visitId}/ophthalmology/optical-prescription/draft`, 'oph_doctor_01', {
      expected_version: 0,
      prescription_type: 'DISTANCE',
      power: {
        OD: { sphere: +1.25, cylinder: -0.75, axis: 180 },
        OS: { sphere: +1.0, cylinder: -0.5, axis: 175 },
      },
      pupillary_distance: { format: 'BINOCULAR', binocular: 63 },
      lens_type: 'SINGLE_VISION',
      material: 'CR39',
      coating_codes: ['ANTI_REFLECTIVE'],
      usage_instructions: 'Constant distance wear',
      valid_until: '2028-01-01T00:00:00.000Z',
    });
    expect(optDraft.statusCode).toBe(200);

    const approveOpt = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/optical-prescription/approve`, 'oph_doctor_01', {
      expected_version: optDraft.json().data.version,
      expected_status: 'DRAFT',
    });
    expect(approveOpt.statusCode).toBe(200);
    expect(approveOpt.json().data.status).toBe('APPROVED');

    // 5. [ROLE-OPH] Procedure recommendation without target_eye -> Assert 400
    const cataractService = await ServiceModel.create({
      code: 'SURG-CAT-PHAC',
      name: 'Phacoemulsification with IOL',
      departmentId: new Types.ObjectId(departmentId),
      serviceType: 'PROCEDURE',
      standardPrice: 1500,
      status: 'ACTIVE',
    });

    const noTargetEyeSurg = await dispatch('POST', '/api/surgery/recommendations', 'oph_doctor_01', {
      patient_id: patient._id.toString(),
      branch_id: branchId,
      department_id: departmentId,
      service_id: cataractService._id.toString(),
      encounter_type: 'OPD_VISIT',
      encounter_id: visitId,
      clinical_reason: 'Visually significant nuclear cataract',
    });
    expect(noTargetEyeSurg.statusCode).toBe(400);

    const validSurg = await dispatch('POST', '/api/surgery/recommendations', 'oph_doctor_01', {
      patient_id: patient._id.toString(),
      branch_id: branchId,
      department_id: departmentId,
      service_id: cataractService._id.toString(),
      target_eye: 'OD',
      encounter_type: 'OPD_VISIT',
      encounter_id: visitId,
      clinical_reason: 'Visually significant nuclear cataract',
    });
    expect(validSurg.statusCode).toBe(201);
    const recId = validSurg.json().data.id;
    expect(validSurg.json().data.target_eye).toBe('OD');

    // 6. [ROLE-COUNS] Surgical Counsellor sees Target Eye = 'OD'
    const counsList = await dispatch('GET', `/api/surgery/recommendations?branch_id=${branchId}&patient_id=${patient._id}`, 'couns_01');
    expect(counsList.statusCode).toBe(200);
    const body = counsList.json().data;
    const items = Array.isArray(body) ? body : body.data;
    expect(items.length).toBeGreaterThan(0);
    const rec = items[0];
    expect(rec.target_eye).toBe('OD');

    // 7. [ROLE-COUNS] Negative Check: Cannot alter surgical recommendation
    const alterSurg = await dispatch('PATCH', `/api/surgery/recommendations/${recId}`, 'couns_01', {
      target_eye: 'OS',
    });
    expect([403, 404, 405]).toContain(alterSurg.statusCode);
  });

  // =========================================================================
  // SCENARIO 6: Sign-Off, Lock, Financial Settlement & Journey Completion Gate
  // =========================================================================
  it('SCENARIO 6: Sign-Off, Lock, Financial Settlement & Journey Completion Gate', async () => {
    const patient = await PatientModel.create({
      patientNumber: 'SYN-PAT-FIN-01',
      firstName: 'Finalization',
      lastName: 'Journey',
      dateOfBirth: new Date('1982-02-14'),
      gender: 'MALE',
      status: 'ACTIVE',
    });
    const doctor = await DoctorModel.findOne({ displayName: 'Dr. Attending Ophthalmologist' }).orFail();
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-FIN-01',
      queueTokenNumber: 501,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Finalization Journey',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      doctorSpecialization: 'Ophthalmology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      reason: 'Full consultation completion',
      status: 'IN_CONSULTATION',
      version: 0,
    });
    const visitId = visit._id.toString();
    const config = await OphthalmologyConfigurationModel.findOne({ code: 'RTN-COMPLETE-1' }).orFail();
    const context = await OphthalmologyContextModel.create({
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorId: doctor._id,
      visitSubtype: 'NEW_CONSULTATION',
      affectedEye: 'OD',
      workflowStatus: 'CLINICAL_REVIEW',
      configurationVersionId: config._id,
      workflowProfileVersionId: new Types.ObjectId(),
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // Valid intake
    await OphthalmologyIntakeModel.create({
      contextId: context._id,
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      complaintConfigurationVersionId: config._id,
      emergencyConfigurationVersionId: config._id,
      affectedEye: 'OD',
      status: 'COMPLETED',
      version: 1,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // Valid consultation & diagnosis
    await OpdConsultationModel.create({
      visitId: visit._id,
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Finalization Journey',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      status: 'DRAFT',
      version: 0,
      assessment: 'Dry eye disease OD',
      diagnoses: [{ code: 'H04.123', display: 'Dry eye syndrome OD', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OD', status: 'CONFIRMED' }],
      treatmentPlan: 'Lubricant eye drops',
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // Valid clinical review
    await OphthalmologyClinicalReviewModel.create({
      contextId: context._id,
      visitId: visit._id,
      patientId: patient._id,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      currentClinicalVersion: 1,
      status: 'DRAFT',
      versions: [{
        clinicalVersion: 1,
        clinicalSummary: 'Dry eye syndrome confirmed with tear breakup time',
        treatmentPlans: [{
          _id: new Types.ObjectId(),
          diagnosisCode: 'H04.123',
          diagnosisLaterality: 'OD',
          treatment: 'Artificial tears 4 times daily',
          actionType: 'OTHER',
          category: null,
          priority: 'ROUTINE',
          status: 'ACTIVE',
          clinicalOrderIds: [],
          clinicianUserId: new Types.ObjectId(actors.oph_doctor_01.id),
        }],
        followUpDecision: 'NO_FOLLOW_UP',
        patientInstructions: 'Instill artificial tears regularly',
        createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
        createdAt: new Date(),
      }],
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // Prescribe eye drop
    const rx = await OpdPrescriptionModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: visit._id,
      visitId: visit._id,
      branchId: new Types.ObjectId(branchId),
      patientId: patient._id,
      patientNumber: patient.patientNumber,
      patientName: 'Finalization Journey',
      doctorId: doctor._id,
      doctorName: doctor.displayName,
      items: [{
        medicineName: 'Carboxymethylcellulose 0.5%',
        dosage: '1 drop',
        frequency: 'Four times daily',
        duration: '30 days',
        route: 'Ophthalmic',
        laterality: 'OD',
      }],
      status: 'SUBMITTED',
      version: 0,
      createdBy: new Types.ObjectId(actors.oph_doctor_01.id),
      updatedBy: new Types.ObjectId(actors.oph_doctor_01.id),
    });

    // 1. [ROLE-OPH] Complete consultation
    const completeResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/complete`, 'oph_doctor_01', {
      expected_version: 0,
      expected_context_version: 0,
      expected_consultation_version: 0,
      expected_clinical_review_version: 0,
    }, { 'idempotency-key': 'fin-complete-key-1' });
    expect(completeResp.statusCode).toBe(200);

    // 2. Assertions: Record locked - direct diagnosis edit fails
    const lockedPatch = await dispatch('PUT', `/api/opd/visits/${visitId}/consultation`, 'oph_doctor_01', {
      expected_version: 0,
      diagnoses: [{ code: 'H04.123', display: 'Dry eye syndrome OD', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OD', status: 'CONFIRMED' }],
    });
    expect([400, 409]).toContain(lockedPatch.statusCode);

    // Assert fee invoice posted to Billing
    const invoice = await BillingInvoiceModel.findOne({ patientId: patient._id }).orFail();
    expect(invoice.totalAmount).toBeGreaterThan(0);
    expect(invoice.balanceAmount).toBeGreaterThan(0);

    // 3. [ROLE-OPH] Reopen consultation into AMENDMENT_OPEN and dispatch controlled amendment
    const reopenResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/reopen`, 'oph_doctor_01', {
      expected_version: completeResp.json().data.version,
      expected_status: 'COMPLETED',
      reason: 'Adjust drop tapering',
    });
    expect(reopenResp.statusCode).toBe(200);
    const reopened = reopenResp.json().data;
    expect(reopened.status).toBe('AMENDMENT_OPEN');

    const episodeId = reopened.amendment_episodes[0].id;
    const amendResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/amendments`, 'oph_doctor_01', {
      episode_id: episodeId,
      expected_version: reopened.version,
      expected_status: 'AMENDMENT_OPEN',
      section: 'patient_instructions',
      before_value: 'Instill artificial tears regularly',
      after_value: 'Instill artificial tears regularly; adjust drop tapering after week 2',
      reason: 'Adjust drop tapering',
    });
    expect(amendResp.statusCode).toBe(200);

    // 4. [AUDITOR] Journey completion gates
    // Gate A: Outstanding balance > $0 -> journey_completed is FALSE
    let journey = await serviceRegistry.ophthalmology.getPatientJourneyStatus(visitId, actors.oph_doctor_01.id);
    expect(journey.journey_completed).toBe(false);
    expect(journey.unmet_obligations).toContain('Billing has an outstanding balance');

    // Settle invoice to $0
    await BillingInvoiceModel.updateOne({ _id: invoice._id }, { $set: { balanceAmount: 0, paidAmount: invoice.totalAmount, status: 'PAID' } });

    // Gate B: Medication is SUBMITTED (not DISPENSED) -> journey_completed is FALSE
    journey = await serviceRegistry.ophthalmology.getPatientJourneyStatus(visitId, actors.oph_doctor_01.id);
    expect(journey.journey_completed).toBe(false);
    expect(journey.unmet_obligations).toContain('Required medication is not dispensed');

    // Dispense medication
    await OpdPrescriptionModel.updateOne({ _id: rx._id }, { $set: { status: 'DISPENSED' } });

    // Re-complete finalization after amendment
    const currCtx = await serviceRegistry.ophthalmology.repository.getContextByVisit(visitId);
    const currConsult = await serviceRegistry.opdConsultations.repository.getByVisit(visitId);
    const currRev = await serviceRegistry.ophthalmology.repository.getClinicalReviewByVisit(visitId);
    const recompleteResp = await dispatch('POST', `/api/opd/visits/${visitId}/ophthalmology/complete`, 'oph_doctor_01', {
      expected_version: amendResp.json().data.version,
      expected_context_version: currCtx!.version,
      expected_consultation_version: currConsult!.version,
      expected_clinical_review_version: currRev!.version,
    }, { 'idempotency-key': 'fin-complete-key-2' });
    expect(recompleteResp.statusCode).toBe(200);

    // Gate C: All obligations met -> journey_completed is TRUE
    journey = await serviceRegistry.ophthalmology.getPatientJourneyStatus(visitId, actors.oph_doctor_01.id);
    expect(journey.unmet_obligations).toEqual([]);
    expect(journey.journey_completed).toBe(true);

    // 5. [ROLE-PAT] Patient Portal scrubbing verification
    const patientRepo = serviceRegistry.patients.repository;
    const portalDocs = await patientRepo.listDocuments(patient._id.toString(), {}, true);
    expect(portalDocs.data.every((doc: { portalPublished?: boolean }) => doc.portalPublished !== false)).toBe(true);
  });
});
