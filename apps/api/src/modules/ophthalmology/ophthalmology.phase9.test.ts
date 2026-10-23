import mongoose, { Types } from 'mongoose';
import Fastify from 'fastify';
import { createServiceRegistry } from '../../shared/services/service-registry.js';
import { registerOphthalmologyRoutes } from './ophthalmology.routes.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { ServiceModel } from '../services/service.model.js';
import { BillingInvoiceItemModel } from '../billing/billing.model.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { EmergencyEncounterModel } from '../emergency/emergency.model.js';
import { EmergencyRepository } from '../emergency/emergency.repository.js';
import { SequenceService } from '../../shared/sequence/sequence.service.js';
import { OphthalmologyAlertModel, OphthalmologyIntakeModel } from './ophthalmology-intake.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdFollowUpModel } from '../opd/opd-follow-up.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { ProcedureBookingModel, ProcedureRecommendationModel } from '../surgery/surgery.model.js';
import { OpdConsultationService } from '../opd/opd-consultation.service.js';
import { OpdVitalsRepository } from '../opd/opd-vitals.repository.js';
import { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { PatientTimelineEventModel, PatientModel } from '../patients/patient.model.js';
import { UserModel } from '../users/user.model.js';
import { RoleModel } from '../roles/role.model.js';
import { OphthalmologyPublicationModel } from './ophthalmology-phase10.model.js';
import { OphthalmologyConsultationFinalizationModel } from './ophthalmology-consultation.model.js';
import { OphthalmologyClinicalReviewModel } from './ophthalmology-review.model.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyContextModel } from './ophthalmology.model.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 9 consultation finalization', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository(); const visitRepository = new OpdVisitRepository();
  const service = new OphthalmologyService(repository, visitRepository, new NotificationService(new NotificationRepository()),
    new OpdConsultationRepository(), new AppointmentRepository(), new PatientRepository(), createServiceRegistry().billing);
  let visitId: string; let userId: string; let contextId: string;

  beforeAll(async () => {
    process.env.MONGOMS_STARTUP_TIMEOUT = '60000';
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyConsultationFinalizationModel.init(), OphthalmologyClinicalReviewModel.init(),
      OphthalmologyContextModel.init(), OphthalmologyConfigurationModel.init(), OpdVisitModel.init(), OpdConsultationModel.init(),
      PatientTimelineEventModel.init(), OphthalmologyTestTaskModel.init(), OphthalmologyTestResultModel.init(), BillingInvoiceModel.init(), EmergencyEncounterModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    await Promise.all([OphthalmologyConsultationFinalizationModel.syncIndexes(), OphthalmologyClinicalReviewModel.syncIndexes(),
      OphthalmologyContextModel.syncIndexes(), OpdVisitModel.syncIndexes(), OpdConsultationModel.syncIndexes(), EmergencyEncounterModel.syncIndexes()]);
    const branch = await BranchModel.create({ code: 'OPH-P9', name: 'Ophthalmology Phase 9', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    await ServiceModel.create({ code: 'OPHTHALMOLOGY_CONSULTATION', name: 'Ophthalmology consultation', departmentId: department._id,
      serviceType: 'GENERAL', standardPrice: 500, status: 'ACTIVE' });
    const user = await UserModel.create({ username: 'oph.phase9', email: 'oph.phase9@example.test', fullName: 'Phase Nine Doctor', passwordHash: 'not-used',
      roleIds: [], branchIds: [branch._id], departmentIds: [department._id], status: 'active' }); userId = user._id.toString();
    const viewPermission = await PermissionModel.create({ code: 'OPH_VIEW', name: 'View', module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View', status: 'active' });
    const clinicalRole = await RoleModel.create({ code: 'OPH_CLINICIAN', name: 'Ophthalmology clinician', permissionIds: [viewPermission._id], status: 'active' });
    await UserModel.updateOne({ _id: user._id }, { $set: { roleIds: [clinicalRole._id] } });
    const doctor = await DoctorModel.create({ doctorNumber: 'OPH-P9-DOC', userId: user._id, firstName: 'Phase', lastName: 'Nine', displayName: 'Dr Phase Nine',
      specialization: 'Ophthalmology', branchId: branch._id, departmentId: department._id, status: 'ACTIVE', availability: [] });
    const patient = await PatientModel.create({ patientNumber: 'P9-001', firstName: 'Completion', lastName: 'Patient', dateOfBirth: new Date('1980-01-01'),
      gender: 'UNKNOWN', status: 'ACTIVE' });
    const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P9-001', queueTokenNumber: 1, patientId: patient._id, patientNumber: patient.patientNumber,
      patientName: 'Completion Patient', doctorId: doctor._id, doctorName: doctor.displayName, doctorSpecialization: doctor.specialization,
      branchId: branch._id, departmentId: department._id, visitDate: new Date(), checkInTime: new Date(), visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE', status: 'IN_CONSULTATION', version: 0 }); visitId = visit._id.toString();
    const config = await OphthalmologyConfigurationModel.create({ branchId: branch._id, type: 'COMPLETION_PROFILE', code: 'P9-COMPLETE',
      name: 'Phase 9 completion', revision: 3, status: 'ACTIVE', values: { visit_subtypes: ['NEW_CONSULTATION'], allow_override: true,
        required_requirements: ['ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED',
          'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED'] }, version: 0, createdBy: user._id, updatedBy: user._id });
    const context = await OphthalmologyContextModel.create({ visitId: visit._id, patientId: patient._id, branchId: branch._id, departmentId: department._id,
      doctorId: doctor._id, visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OU', workflowStatus: 'CLINICAL_REVIEW',
      configurationVersionId: config._id, workflowProfileVersionId: new Types.ObjectId(), version: 0, createdBy: user._id, updatedBy: user._id });
    contextId = context._id.toString();
    await OpdConsultationModel.create({ visitId: visit._id, patientId: patient._id, patientNumber: patient.patientNumber, patientName: 'Completion Patient',
      doctorId: doctor._id, doctorName: doctor.displayName, status: 'DRAFT', version: 0, assessment: 'Stable cataract',
      diagnoses: [{ code: '9B10', display: 'Cataract', codingSystem: 'ICD-11', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED', differential: false }],
      treatmentPlan: 'Observe', createdBy: user._id, updatedBy: user._id });
    await OphthalmologyClinicalReviewModel.create({ contextId: context._id, visitId: visit._id, patientId: patient._id, branchId: branch._id,
      departmentId: department._id, currentClinicalVersion: 1, status: 'DRAFT', versions: [{ clinicalVersion: 1,
        clinicalSummary: 'Cataract assessed and discussed', treatmentPlans: [{ _id: new Types.ObjectId(), diagnosisCode: '9B10', diagnosisLaterality: 'OU',
          treatment: 'Observe', actionType: 'OTHER', category: null, priority: 'ROUTINE', status: 'ACTIVE', clinicalOrderIds: [], clinicianUserId: user._id }],
        followUpDecision: 'NO_FOLLOW_UP', patientInstructions: 'Return for visual change', createdBy: user._id, createdAt: new Date() }],
      version: 0, createdBy: user._id, updatedBy: user._id });
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const completion = (expectedVersion = 0, contextVersion = 0, consultationVersion = 0, reviewVersion = 0) => ({
    expected_version: expectedVersion, expected_context_version: contextVersion, expected_consultation_version: consultationVersion,
    expected_clinical_review_version: reviewVersion,
  });

  const httpApp = async (actor = userId) => {
    const services = createServiceRegistry();
    services.ophthalmology = service;
    vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({ id: actor, username: 'test', fullName: 'Test', email: null, status: 'active', patientId: null });
    const app = Fastify();
    await registerOphthalmologyRoutes(app, services);
    return app;
  };
  const grant = async (screen: string, action: string) => {
    const permission = await PermissionModel.create({ code: `TEST_${screen.replaceAll(' ', '_')}_${action}`, name: action, module: 'OPD', screen, action, status: 'active', type: 'SCREEN' });
    const role = await RoleModel.create({ code: `TEST_${action}`, name: action, permissionIds: [permission._id], status: 'active' });
    await UserModel.updateOne({ _id: userId }, { $addToSet: { roleIds: role._id } });
  };
  const emergencyAlert = async (status: 'ACTIVE' | 'ACKNOWLEDGED') => {
    const context = await OphthalmologyContextModel.findById(contextId).orFail();
    return OphthalmologyAlertModel.create({ contextId, visitId, intakeId: new Types.ObjectId(), patientId: context.patientId,
      branchId: context.branchId, departmentId: context.departmentId, type: 'EMERGENCY_SCREENING', status, sourceVersion: 1,
      criterionCodes: ['SUDDEN_VISION_LOSS'], reason: 'Urgent assessment', triggeredBy: userId, triggeredAt: new Date() });
  };
  const completedIntake = async () => {
    const context = await OphthalmologyContextModel.findById(contextId).orFail();
    await OphthalmologyIntakeModel.create({ contextId, visitId, patientId: context.patientId, branchId: context.branchId,
      departmentId: context.departmentId, complaintConfigurationVersionId: context.configurationVersionId,
      emergencyConfigurationVersionId: context.configurationVersionId, affectedEye: 'OU', status: 'COMPLETED', createdBy: userId, updatedBy: userId });
  };

  it.each(['RECEPTIONIST', 'BILLING_USER', 'BILLING_AUTHORIZED', 'PATIENT', 'GUARDIAN'])('denies escalation and completion over HTTP for %s', async (code) => {
    const role = await RoleModel.create({ code, name: code, permissionIds: [], status: 'active' });
    await UserModel.updateOne({ _id: userId }, { $set: { roleIds: [role._id] } });
    const app = await httpApp();
    try {
      for (const [path, payload] of [['alerts/escalate', { reason: 'Urgent assessment', priority: 'EMERGENCY' }], ['complete', completion()]] as const) {
        const result = await app.inject({ method: 'POST', url: `/api/opd/visits/${visitId}/ophthalmology/${path}`,
          headers: { authorization: 'Bearer test', 'idempotency-key': 'role-negative' }, payload });
        expect(result.statusCode).toBe(403);
      }
      expect(await OphthalmologyAlertModel.countDocuments()).toBe(0);
      expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    } finally { await app.close(); }
  });

  it.each(['ACTIVE', 'ACKNOWLEDGED'] as const)('resumes routine care only after authorized HTTP clearance of %s', async (status) => {
    const alert = await emergencyAlert(status);
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });
    await grant('Ophthalmology Intake', 'Escalate');
    const app = await httpApp();
    const request = { method: 'POST' as const, url: `/api/opd/visits/${visitId}/ophthalmology/alerts/${alert.id}/clear`,
      headers: { authorization: 'Bearer test' }, payload: { disposition: 'RESUME_ROUTINE_OPD', clearance_rationale: 'Assessed and safe to resume', resumption_permitted: true, expected_version: 0 } };
    try {
      expect((await app.inject(request)).statusCode).toBe(403);
      await grant('Ophthalmology Consultation', 'Complete');
      const response = await app.inject(request);
      expect(response.statusCode, response.body).toBe(200);
      expect(await OphthalmologyAlertModel.findById(alert.id).lean()).toMatchObject({ status: 'CLEARED', clearance: { resumptionPermitted: true, clearedBy: new Types.ObjectId(userId) } });
      await expect(service.getCompletionReadiness(visitId, userId)).resolves.toBeDefined();
      expect((await app.inject(request)).statusCode).toBe(409);
    } finally { await app.close(); }
  });

  it('rejects non-practitioner clearance and retains the routine lock when resumption is false', async () => {
    const alert = await emergencyAlert('ACKNOWLEDGED');
    const outsider = await UserModel.create({ username: 'not-a-doctor', email: 'not-a-doctor@example.test', fullName: 'Non clinician', passwordHash: 'unused', status: 'active', roleIds: [],
      branchIds: [alert.branchId], departmentIds: [alert.departmentId] });
    const body = { disposition: 'TRANSFER_EXTERNAL' as const, clearance_rationale: 'Transfer required', resumption_permitted: false, expected_version: 0 };
    await expect(service.clearAlert(visitId, alert.id, body, outsider.id)).rejects.toMatchObject({ statusCode: 403 });
    await service.clearAlert(visitId, alert.id, body, userId);
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });
    expect((await service.getPatientJourneyStatus(visitId, userId)).journey_completed).toBe(false);
  });

  it('atomically bills finalization once and closes the journey only after settlement', async () => {
    await completedIntake();
    await BillingInvoiceModel.syncIndexes();
    await service.completeConsultation(visitId, completion(), 'billing-finalization', userId);
    await service.completeConsultation(visitId, completion(), 'billing-finalization', userId);
    expect(await BillingInvoiceModel.countDocuments({ visitId })).toBe(1);
    const invoice = await BillingInvoiceModel.findOne({ visitId }).orFail();
    expect(invoice).toMatchObject({ finalizationKey: `${visitId}:finalization`, totalAmount: 500, balanceAmount: 500 });
    expect(await BillingInvoiceItemModel.countDocuments({ invoiceId: invoice._id })).toBe(1);
    const unpaid = await service.getPatientJourneyStatus(visitId, userId);
    expect(unpaid.journey_completed).toBe(false);
    expect(unpaid.unmet_obligations).toEqual(['Billing has an outstanding balance']);
    const billing = createServiceRegistry().billing;
    await billing.update(invoice.id, { status: 'PENDING' }, userId, {});
    await billing.collectPayment(invoice.id, { amount: 500, payment_method: 'CASH' }, userId, {});
    expect((await service.getPatientJourneyStatus(visitId, userId)).journey_completed).toBe(true);
    await emergencyAlert('ACKNOWLEDGED');
    expect((await service.getPatientJourneyStatus(visitId, userId)).journey_completed).toBe(false);
  });

  it('rolls billing and clinical completion back together on finalization audit failure', async () => {
    const audit = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.completeConsultation(visitId, completion(), 'atomic-billing', userId)).rejects.toThrow('audit unavailable');
    expect(await BillingInvoiceModel.countDocuments()).toBe(0);
    expect(await BillingInvoiceItemModel.countDocuments()).toBe(0);
    expect((await OpdVisitModel.findById(visitId).orFail()).status).toBe('IN_CONSULTATION');
    audit.mockRestore();
    await service.completeConsultation(visitId, completion(), 'atomic-billing', userId);
    expect(await BillingInvoiceModel.countDocuments()).toBe(1);
  });

  it('reuses the consultation invoice already collected at check-in', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).orFail();
    const tariff = await ServiceModel.findOne({ code: 'OPHTHALMOLOGY_CONSULTATION' }).orFail();
    const invoice = await BillingInvoiceModel.create({ invoiceNumber: 'PREPAID', patientId: context.patientId, visitId, branchId: context.branchId,
      invoiceDate: new Date(), status: 'PAID', subtotal: 500, totalAmount: 500, paidAmount: 500, balanceAmount: 0 });
    await BillingInvoiceItemModel.create({ invoiceId: invoice._id, serviceId: tariff._id, serviceName: tariff.name,
      serviceType: 'CONSULTATION', quantity: 1, unitPrice: 500, lineTotal: 500 });
    await service.completeConsultation(visitId, completion(), 'prepaid-finalization', userId);
    expect(await BillingInvoiceModel.countDocuments()).toBe(1);
    expect(await BillingInvoiceItemModel.countDocuments()).toBe(1);
    expect(await BillingInvoiceModel.findById(invoice._id).lean()).toMatchObject({ status: 'PAID', balanceAmount: 0, finalizationKey: `${visitId}:finalization` });
  });

  it('fails closed without a configured tariff and preserves the clinical draft', async () => {
    await ServiceModel.deleteMany({});
    await expect(service.completeConsultation(visitId, completion(), 'missing-tariff', userId))
      .rejects.toMatchObject({ code: 'BILLING_CONSULTATION_MAPPING_REQUIRED', statusCode: 409 });
    expect(await BillingInvoiceModel.countDocuments()).toBe(0);
    expect((await OpdVisitModel.findById(visitId).orFail()).status).toBe('IN_CONSULTATION');
  });

  it('retains downstream obligations until linked emergency medication and referral are handled', async () => {
    await completedIntake();
    await service.completeConsultation(visitId, completion(), 'downstream-gates', userId);
    await BillingInvoiceModel.updateOne({ visitId }, { $set: { balanceAmount: 0, paidAmount: 500, status: 'PAID' } });
    const context = await OphthalmologyContextModel.findById(contextId).orFail();
    const prescription = await OpdPrescriptionModel.create({ visitId, consultationId: new Types.ObjectId(), sourceType: 'OPD_VISIT', sourceId: visitId,
      branchId: context.branchId, patientId: context.patientId, patientNumber: 'P9-001', patientName: 'Completion Patient', doctorId: context.doctorId,
      doctorName: 'Doctor', status: 'SUBMITTED', items: [], createdBy: userId, updatedBy: userId });
    const referralId = new Types.ObjectId();
    await OphthalmologyClinicalReviewModel.updateOne({ visitId }, { $set: {
      'versions.0.treatmentPlans.0.priority': 'EMERGENCY', 'versions.0.treatmentPlans.0.medicationPrescriptionId': prescription._id,
      'versions.0.treatmentPlans.0.referralId': referralId,
    } });
    const pending = await service.getPatientJourneyStatus(visitId, userId);
    expect(pending.journey_completed).toBe(false);
    expect(pending.unmet_obligations).toEqual(expect.arrayContaining(['Required emergency medication is not dispensed', 'Required referral has not been submitted']));
    await OpdPrescriptionModel.updateOne({ _id: prescription._id }, { $set: { status: 'DISPENSED' } });
    const dispensed = await service.getPatientJourneyStatus(visitId, userId);
    expect(dispensed.unmet_obligations).not.toContain('Required emergency medication is not dispensed');
    expect(dispensed.journey_completed).toBe(false);
  });

  it.each(['ACTIVE', 'ACKNOWLEDGED'] as const)('does not allow %s emergency screening to authorize routine sign-off or overrides', async (status) => {
    const context = await OphthalmologyContextModel.findById(contextId).lean(); if (!context) throw new Error('Missing context');
    await OphthalmologyAlertModel.create({ contextId, visitId, intakeId: new Types.ObjectId(), patientId: context.patientId,
      branchId: context.branchId, departmentId: context.departmentId, type: 'EMERGENCY_SCREENING', status, sourceVersion: 1,
      criterionCodes: ['SUDDEN_VISION_LOSS'], reason: 'Screening requires urgent assessment', triggeredBy: userId, triggeredAt: new Date() });
    // Even omitting the receipt requirement cannot bypass the clinical guard.
    await OphthalmologyConfigurationModel.updateOne({ _id: context.configurationVersionId }, { $set: { 'values.required_requirements': ['DIAGNOSIS_RECORDED'] } });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });
    await expect(service.overrideCompletion(visitId, { expected_version: 0, expected_unmet_codes: ['ALERTS_ACKNOWLEDGED'], reason: 'Receipt is not clearance' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });
    await expect(service.completeConsultation(visitId, completion(), 'emergency-guard', userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
  });

  it('reuses the Emergency referral appointment chain with validated source metadata and no duplicate encounters', async () => {
    const visit = await OpdVisitModel.findById(visitId).lean(); if (!visit) throw new Error('Missing visit');
    const appointment = await AppointmentModel.create({ appointmentNumber: 'TRACE-APPT', patientId: visit.patientId,
      patientNumber: visit.patientNumber, patientName: visit.patientName, doctorId: visit.doctorId, doctorName: visit.doctorName,
      doctorSpecialization: visit.doctorSpecialization, branchId: visit.branchId, departmentId: visit.departmentId,
      durationMinutes: 20, visitType: 'NEW_CONSULTATION', priority: 'URGENT', status: 'CHECKED_IN' });
    await OpdVisitModel.updateOne({ _id: visitId }, { $set: { appointmentId: appointment._id } });
    const emergency = await EmergencyEncounterModel.create({ encounterNumber: 'TRACE-ER', emergencyIdentifier: 'TRACE-ID',
      branchId: visit.branchId, departmentId: new Types.ObjectId(), patientId: visit.patientId, patientName: visit.patientName,
      arrivalMode: 'WALK_IN', arrivalAt: new Date(), chiefComplaint: 'Private emergency assessment', createdBy: userId, updatedBy: userId,
      referral: { sourceType: 'EMERGENCY_ENCOUNTER', targetDepartmentId: visit.departmentId, targetDepartmentName: 'Ophthalmology',
        targetDoctorId: visit.doctorId, priority: 'URGENT', reason: 'Private reason', clinicalNotes: 'Private note', status: 'SUBMITTED',
        submittedAt: new Date(), submittedBy: userId } });
    const emergencyRepository = new EmergencyRepository(new SequenceService());
    const appointmentDto = await new AppointmentRepository().getById(appointment.id); if (!appointmentDto) throw new Error('Missing appointment');
    expect((await service.getConsultationSummary(visitId, userId)).summary.emergency_source).toBeNull();
    expect(await emergencyRepository.linkReferralAppointment(emergency.id, visit.branchId.toString(),
      { ...appointmentDto, branch_id: new Types.ObjectId().toString() }, userId)).toBeNull();
    expect(await emergencyRepository.linkReferralAppointment(emergency.id, visit.branchId.toString(),
      { ...appointmentDto, patient_id: new Types.ObjectId().toString() }, userId)).toBeNull();
    expect(await emergencyRepository.linkReferralAppointment(emergency.id, visit.branchId.toString(), appointmentDto, userId))
      .toMatchObject({ appointment_id: appointment.id });
    expect(await emergencyRepository.linkReferralAppointment(emergency.id, visit.branchId.toString(), appointmentDto, userId)).toBeNull();
    const summary = await service.getConsultationSummary(visitId, userId);
    expect(summary.summary.emergency_source).toMatchObject({ emergency_encounter_id: emergency.id, appointment_id: appointment.id,
      visit_id: visitId, patient_id: visit.patientId.toString() });
    expect(JSON.stringify(summary.summary.emergency_source)).not.toContain('Private');
    expect((await service.getConsultationSummary(visitId, userId)).summary.emergency_source).toEqual(summary.summary.emergency_source);
    expect(await OpdVisitModel.countDocuments()).toBe(1); expect(await EmergencyEncounterModel.countDocuments()).toBe(1);
    for (const field of ['patientId', 'branchId', 'referral.targetDepartmentId', 'referral.targetDoctorId']) {
      const original = field === 'patientId' ? visit.patientId : field === 'branchId' ? visit.branchId
        : field === 'referral.targetDepartmentId' ? visit.departmentId : visit.doctorId;
      await EmergencyEncounterModel.updateOne({ _id: emergency._id }, { $set: { [field]: new Types.ObjectId() } });
      expect((await service.getConsultationSummary(visitId, userId)).summary.emergency_source).toBeNull();
      await EmergencyEncounterModel.updateOne({ _id: emergency._id }, { $set: { [field]: original } });
    }
    await expect(OpdVisitModel.create({ ...visit, _id: new Types.ObjectId(), visitNumber: 'TRACE-DUP', appointmentId: appointment._id }))
      .rejects.toMatchObject({ code: 11000 });
    await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { patientId: new Types.ObjectId() } });
    expect((await service.getConsultationSummary(visitId, userId)).summary.emergency_source).toBeNull();
    await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { patientId: visit.patientId } });
    await EmergencyEncounterModel.create({ ...emergency.toObject(), _id: new Types.ObjectId(), encounterNumber: 'TRACE-ER-2',
      emergencyIdentifier: 'TRACE-ID-2', referral: { ...emergency.referral, appointmentId: appointment._id } });
    await expect(service.getConsultationSummary(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SOURCE_CONFLICT' });
  });

  it('allows clinical sign-off with draft follow-up fulfillment, preserves the signed snapshot, and refreshes source status', async () => {
    const consultation = await OpdConsultationModel.findOne({ visitId }).lean(); if (!consultation) throw new Error('Missing consultation');
    const visit = await OpdVisitModel.findById(visitId).lean(); if (!visit) throw new Error('Missing visit');
    const prescription = await OpdPrescriptionModel.create({ sourceType: 'OPD_VISIT', sourceId: visitId, visitId,
      branchId: visit.branchId, patientId: visit.patientId, patientNumber: visit.patientNumber, patientName: visit.patientName,
      doctorId: visit.doctorId, doctorName: visit.doctorName, status: 'SUBMITTED', items: [] });
    const followUp = await OpdFollowUpModel.create({ visitId, consultationId: consultation._id, patientId: consultation.patientId,
      patientNumber: consultation.patientNumber, patientName: consultation.patientName, originatingDoctorId: consultation.doctorId,
      originatingDoctorName: consultation.doctorName, status: 'DRAFT', reminderType: 'NONE', notes: 'Arrange review' });
    const completed = await service.completeConsultation(visitId, completion(), 'pending-follow-up', userId);
    expect(completed.status).toBe('COMPLETED');
    expect(await service.completeConsultation(visitId, completion(), 'pending-follow-up', userId)).toEqual(completed);
    expect((await service.getConsultationSummary(visitId, userId)).summary.follow_ups[0]).toMatchObject({ status: 'DRAFT', appointment_id: null });
    expect((await service.getConsultationSummary(visitId, userId)).summary.medication_prescriptions[0]).toMatchObject({ status: 'SUBMITTED' });
    // Simulate the shared scheduling owner completing its independent operation.
    await OpdFollowUpModel.updateOne({ _id: followUp._id }, { $set: { status: 'SCHEDULED', nextVisitDate: new Date('2026-11-01T00:00:00Z'), appointmentId: new Types.ObjectId() } });
    // Pharmacy owns this state; the specialty projection must read it, not infer it.
    await OpdPrescriptionModel.updateOne({ _id: prescription._id }, { $set: { status: 'DISPENSED' } });
    expect((await service.getConsultationSummary(visitId, userId)).summary.medication_prescriptions[0]).toMatchObject({ status: 'DISPENSED' });
    expect((await service.getConsultationSummary(visitId, userId)).summary.follow_ups[0]).toMatchObject({ status: 'SCHEDULED', follow_up_date: '2026-11-01T00:00:00.000Z' });
    expect(await repository.getFinalizationByVisit(visitId)).toEqual(completed);
    expect(await OpdFollowUpModel.countDocuments()).toBe(1);
  });

  it('reads procedure booking completion only from the linked same-patient record', async () => {
    const visit = await OpdVisitModel.findById(visitId).lean(); if (!visit) throw new Error('Missing visit');
    const source = { patientId: visit.patientId, patientNumber: visit.patientNumber, patientName: visit.patientName,
      branchId: visit.branchId, departmentId: visit.departmentId, departmentName: 'Ophthalmology', serviceId: new Types.ObjectId(),
      serviceName: 'Configured procedure', createdBy: userId, updatedBy: userId };
    const recommendation = await ProcedureRecommendationModel.create({ ...source, recommendationNumber: 'TRACE-PROC',
      recommendingDoctorId: visit.doctorId, recommendingDoctorName: visit.doctorName, encounterType: 'OPD_VISIT', encounterId: visitId,
      clinicalReason: 'Recorded plan', status: 'BOOKED' });
    const booking = await ProcedureBookingModel.create({ ...source, recommendationId: recommendation._id, bookingNumber: 'TRACE-BOOK',
      doctorId: visit.doctorId, doctorName: visit.doctorName, scheduledStart: new Date('2026-10-20T00:00:00Z'),
      scheduledEnd: new Date('2026-10-20T00:30:00Z'), durationMinutes: 30, status: 'BOOKED' });
    await ProcedureRecommendationModel.updateOne({ _id: recommendation._id }, { $set: { bookingId: booking._id } });
    expect((await service.getConsultationSummary(visitId, userId)).summary.procedure_recommendations[0])
      .toMatchObject({ procedure_name: 'Configured procedure', status: 'BOOKED', booking_status: 'BOOKED', reason: 'Recorded plan' });
    await ProcedureBookingModel.updateOne({ _id: booking._id }, { $set: { status: 'COMPLETED' } });
    expect((await service.getConsultationSummary(visitId, userId)).summary.procedure_recommendations[0]?.booking_status).toBe('COMPLETED');
    await ProcedureBookingModel.updateOne({ _id: booking._id }, { $set: { patientId: new Types.ObjectId() } });
    expect((await service.getConsultationSummary(visitId, userId)).summary.procedure_recommendations[0]?.booking_status).toBeNull();
  });

  it('reviews the exact completed clinical result version and rejects stale review requests', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean(); const now = new Date(); const stationId = new Types.ObjectId();
    const task = await OphthalmologyTestTaskModel.create({ contextId: context!._id, visitId: context!.visitId, patientId: context!.patientId,
      branchId: context!.branchId, departmentId: context!.departmentId, testCatalogueVersionId: new Types.ObjectId(),
      workflowProfileVersionId: context!.workflowProfileVersionId, testCode: 'VISUAL_ACUITY', testName: 'Visual acuity', laterality: 'OU',
      priority: 'ROUTINE', sourceType: 'WORKFLOW', status: 'COMPLETED', stationId, doctorReviewRequired: true,
      idempotencyKey: 'p9-review-task', requestFingerprint: 'fingerprint', assignmentHistory: [], transitionHistory: [], routingHistory: [],
      orderedAt: now, completedAt: now, version: 0, createdBy: userId, updatedBy: userId });
    await OphthalmologyTestResultModel.create({ taskId: task._id, contextId: context!._id, visitId: context!.visitId,
      patientId: context!.patientId, branchId: context!.branchId, departmentId: context!.departmentId, currentClinicalVersion: 1,
      status: 'COMPLETED', versions: [{ clinicalVersion: 1, status: 'COMPLETED', formType: 'VISUAL_ACUITY', formSchemaVersion: '1.0',
        formProfileVersionId: new Types.ObjectId(), formProfileRevision: 1, formProfileSnapshot: {}, laterality: 'OU', stationId,
        performerUserId: userId, performedAt: now, sourceType: 'MANUAL', reliability: 'GOOD', documentIds: [], payload: { conclusion_codes: ['STABLE'] },
        completedAt: now, createdBy: userId, createdAt: now }], version: 1, createdBy: userId, updatedBy: userId });
    await expect(service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 2 }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    const reviewed = await service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 1, comment: 'Reviewed against the consultation' }, userId);
    expect(reviewed).toMatchObject({ status: 'REVIEWED', reviewed_by: userId, reviewed_clinical_version: 1, version: 1 });
    await expect(service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 1 }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('serves a minimal same-department clinical header and bound configuration without exposing generic notes', async () => {
    await OpdVisitModel.updateOne({ _id: visitId }, { $set: { notes: 'Internal shared note' } });
    const workspace = await service.getClinicalWorkspace(visitId, userId);
    expect(workspace.visit).toMatchObject({ id: visitId }); expect(workspace.visit).not.toHaveProperty('notes');
    expect(workspace.context).toMatchObject({ id: contextId });
    expect(await service.getClinicalConfiguration(visitId, userId)).toMatchObject({ type: 'COMPLETION_PROFILE' });
    await UserModel.updateOne({ _id: userId }, { $set: { departmentIds: [] } });
    await expect(service.getClinicalWorkspace(visitId, userId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getClinicalConfiguration(visitId, userId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects missing configured mandatory tests instead of passing an empty task set', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean(); if (!context) throw new Error('Missing context');
    await OphthalmologyConfigurationModel.updateOne({ _id: context.configurationVersionId }, { $set: {
      'values.required_requirements': ['MANDATORY_TESTS_REVIEWED'], 'values.mandatory_test_codes': ['VISUAL_ACUITY'] } });
    const readiness = await service.getCompletionReadiness(visitId, userId);
    expect(readiness.ready).toBe(false);
    expect(readiness.requirements[0]).toMatchObject({ code: 'MANDATORY_TESTS_REVIEWED', satisfied: false, resource_ids: [] });
    expect(readiness.requirements[0]?.details).toContain('VISUAL_ACUITY');
    await expect(service.completeConsultation(visitId, completion(), 'missing-mandatory', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments({ visitId })).toBe(0);
    await OphthalmologyConfigurationModel.updateOne({ _id: context.configurationVersionId }, { $set: { 'values.mandatory_test_codes': [] } });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
  });

  it('blocks generic OPD completion for a specialty context and for its authoritative department before context activation', async () => {
    const generic = new OpdConsultationService(new OpdConsultationRepository(), visitRepository, new OpdVitalsRepository(), new PatientRepository(), new AppointmentRepository());
    await expect(generic.complete(visitId, { expected_version: 0, expected_status: 'DRAFT' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED' });
    await OphthalmologyContextModel.deleteOne({ _id: contextId });
    await expect(generic.complete(visitId, {}, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED' });
    expect((await OpdVisitModel.findById(visitId).lean())?.status).toBe('IN_CONSULTATION');
    expect((await OpdConsultationModel.findOne({ visitId }).lean())?.status).toBe('DRAFT');
  });

  it('returns structured unmet requirements and requires an exact override snapshot', async () => {
    await OpdConsultationModel.updateOne({ visitId }, { $set: { diagnoses: [] } });
    await OphthalmologyClinicalReviewModel.updateOne({ visitId }, { $set: { 'versions.$[version].treatmentPlans': [] } },
      { arrayFilters: [{ 'version.clinicalVersion': 1 }] });
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    await OphthalmologyConfigurationModel.updateOne({ _id: context!.configurationVersionId }, { $set: {
      'values.required_requirements': ['ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED',
        'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED'],
    } });
    const readiness = await service.getCompletionReadiness(visitId, userId);
    expect(readiness.ready).toBe(false);
    expect(readiness.requirements.find((item) => item.code === 'DIAGNOSIS_RECORDED')).toMatchObject({ satisfied: false });
    await expect(service.overrideCompletion(visitId, { expected_version: 0, expected_unmet_codes: ['CLINICAL_REVIEW_RECORDED'], reason: 'Incorrect snapshot' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_REQUIREMENTS_CHANGED' });
    const override = await service.overrideCompletion(visitId, { expected_version: 0, expected_unmet_codes: ['DIAGNOSIS_RECORDED'], reason: 'Urgent transfer' }, userId);
    expect(override).toMatchObject({ status: 'OPEN', version: 1, overrides: [{ unmet_codes: ['DIAGNOSIS_RECORDED'] }] });
    await OphthalmologyConfigurationModel.updateOne({ _id: context!.configurationVersionId }, { $set: { 'values.allow_override': false } });
    await expect(service.completeConsultation(visitId, { ...completion(), expected_version: 1 }, 'override-disabled', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION' });
  });

  it('rejects ambiguous active completion profiles instead of guessing', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    await OphthalmologyConfigurationModel.create({ branchId: context!.branchId, type: 'COMPLETION_PROFILE', code: 'P9-SECOND',
      name: 'Ambiguous profile', revision: 1, status: 'ACTIVE', values: { visit_subtypes: ['NEW_CONSULTATION'],
        required_requirements: ['DIAGNOSIS_RECORDED'] }, version: 0, createdBy: userId, updatedBy: userId });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
  });

  it('completes OPD and specialty records atomically and replays the same idempotency key', async () => {
    expect((await service.getCompletionReadiness(visitId, userId)).ready).toBe(true);
    const completed = await service.completeConsultation(visitId, completion(), 'p9-complete-1', userId);
    expect(completed).toMatchObject({ status: 'COMPLETED', version: 1, completions: [{ clinical_version: 1, configuration_revision: 3 }] });
    expect(await service.completeConsultation(visitId, completion(), 'p9-complete-1', userId)).toMatchObject({ id: completed.id, version: 1 });
    await expect(service.completeConsultation(visitId, { ...completion(), expected_context_version: 99 }, 'p9-complete-1', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT' });
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'COMPLETED', version: 1 });
    expect(await OpdConsultationModel.findOne({ visitId }).lean()).toMatchObject({ status: 'COMPLETED', version: 1 });
    expect(await OphthalmologyContextModel.findById(contextId).lean()).toMatchObject({ workflowStatus: 'CONSULTATION_COMPLETED', version: 1 });
    expect(await PatientTimelineEventModel.countDocuments({ patientId: (await OpdVisitModel.findById(visitId).lean())!.patientId })).toBe(1);
    await expect(service.saveClinicalReviewDraft(visitId, { expected_version: 1, clinical_summary: 'Forbidden overwrite',
      treatment_plans: [], follow_up_decision: 'NO_FOLLOW_UP' }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONSULTATION_LOCKED' });
  });

  it('rejects unauthorized and concurrent completion attempts', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    const outsider = await UserModel.create({ username: 'oph.p9.outsider', email: 'oph.p9.outsider@example.test', fullName: 'Not Doctor', passwordHash: 'none',
      roleIds: [], branchIds: [context!.branchId], departmentIds: [context!.departmentId], status: 'active' });
    await expect(service.completeConsultation(visitId, completion(), 'outsider', outsider._id.toString())).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCTOR_REQUIRED' });

    // Non-doctor SUPER_ADMIN must also be rejected without doctor fallback
    const superAdminRole = await RoleModel.create({ code: 'SUPER_ADMIN', name: 'Super Admin', status: 'active' });
    const adminUser = await UserModel.create({ username: 'oph.p9.admin', email: 'oph.p9.admin@example.test', fullName: 'Admin Non-Doctor', passwordHash: 'none',
      roleIds: [superAdminRole._id], branchIds: [context!.branchId], departmentIds: [context!.departmentId], status: 'active' });
    await expect(service.completeConsultation(visitId, completion(), 'admin-impersonation', adminUser._id.toString()))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCTOR_REQUIRED' });
    const outcomes = await Promise.allSettled([0, 1].map((index) => service.completeConsultation(visitId, completion(), `p9-race-${index}`, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('rejects a treatment plan whose diagnosis changed after saving, without partial finalization', async () => {
    await OpdConsultationModel.updateOne({ visitId }, { $set: { 'diagnoses.0.laterality': 'OD' } });
    await expect(service.completeConsultation(visitId, completion(), 'changed-diagnosis', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DIAGNOSIS_MISMATCH' });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
    expect(await OphthalmologyClinicalReviewModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
    expect(await PatientTimelineEventModel.countDocuments()).toBe(0);
  });

  it('blocks readiness and completion when an active plan diagnosis becomes ruled out', async () => {
    await OpdConsultationModel.updateOne({ visitId }, { $set: { 'diagnoses.0.status': 'RULED_OUT' } });
    await expect(service.getCompletionReadiness(visitId, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RULED_OUT_DIAGNOSIS_ACTIVE_TREATMENT', statusCode: 409 });
    await expect(service.completeConsultation(visitId, completion(), 'ruled-out-diagnosis', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RULED_OUT_DIAGNOSIS_ACTIVE_TREATMENT', statusCode: 409 });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
    expect(await OphthalmologyClinicalReviewModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
  });

  it('revalidates linked follow-ups at sign-off and permits retry after restoring the valid source', async () => {
    const consultation = await OpdConsultationModel.findOne({ visitId }).lean();
    if (!consultation) throw new Error('Missing consultation fixture');
    const followUp = await OpdFollowUpModel.create({ visitId, consultationId: consultation._id,
      patientId: consultation.patientId, patientNumber: consultation.patientNumber, patientName: consultation.patientName,
      originatingDoctorId: consultation.doctorId, originatingDoctorName: consultation.doctorName,
      status: 'DRAFT', reminderType: 'NONE' });
    const review = await repository.getClinicalReviewByVisit(visitId);
    if (!review) throw new Error('Missing review fixture');
    const saved = await service.saveClinicalReviewDraft(visitId, { ...review.current, expected_version: review.version,
      treatment_plans: review.current.treatment_plans.map((plan) => ({ ...plan, action_type: 'FOLLOW_UP' as const,
        follow_up_id: followUp.id })) }, userId);
    const context = await repository.getContextByVisit(visitId);
    if (!context) throw new Error('Missing context fixture');
    const body = completion(0, context.version, 0, saved.version);
    await OpdFollowUpModel.updateOne({ _id: followUp._id }, { $set: { deletedAt: new Date() } });
    await expect(service.completeConsultation(visitId, body, 'follow-up-retry', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
    await OpdFollowUpModel.updateOne({ _id: followUp._id }, { $set: { deletedAt: null } });
    expect(await service.completeConsultation(visitId, body, 'follow-up-retry', userId)).toMatchObject({ status: 'COMPLETED' });
  });

  it('rolls back shared and specialty completion when audit persistence fails', async () => {
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.completeConsultation(visitId, completion(), 'p9-rollback', userId)).rejects.toThrow('audit unavailable');
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
    expect(await OpdConsultationModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
    expect(await OphthalmologyClinicalReviewModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
  });

  it('corrects structured treatment plans and follow-up decisions with immutable sources and rollback', async () => {
    const completed = await service.completeConsultation(visitId, completion(), 'p9-structured', userId);
    const reopened = await service.reopenConsultation(visitId, { expected_version: completed.version, expected_status: 'COMPLETED', reason: 'Correct treatment record' }, userId);
    const episode = reopened.amendment_episodes[0]; if (!episode) throw new Error('Missing amendment episode');
    const original = await repository.getClinicalReviewByVisit(visitId); if (!original) throw new Error('Missing clinical source');
    const plans = original.current.treatment_plans.map(({ clinician_user_id, legacy_category, ...plan }) => {
      void clinician_user_id; void legacy_category; return plan;
    });
    const first = plans[0]; if (!first) throw new Error('Missing plan');
    const command = { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN' as const, episode_id: episode.id, section: 'treatment_plans', before_value: original.current.treatment_plans, reason: 'Correct observation plan' };
    await expect(service.amendConsultation(visitId, { ...command, after_value: plans }, userId)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, diagnosis_code: 'FOREIGN' }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DIAGNOSIS_MISMATCH' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, id: new Types.ObjectId().toString() }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, action_type: 'REFERRAL',
      referral_id: new Types.ObjectId().toString() }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
    const after = [{ ...first, treatment: 'Observe with documented precautions' }];
    const failingAudit = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit failed'));
    await expect(service.amendConsultation(visitId, { ...command, after_value: after }, userId)).rejects.toThrow('audit failed'); failingAudit.mockRestore();
    expect((await repository.getClinicalReviewByVisit(visitId))?.version).toBe(original.version);
    const changed = await service.amendConsultation(visitId, { ...command, after_value: after }, userId);
    const source = await repository.getClinicalReviewByVisit(visitId); expect(source?.current.treatment_plans[0]).toMatchObject({ id: first.id, treatment: after[0]?.treatment });
    expect(source?.history[0]?.treatment_plans[0]?.treatment).toBe('Observe'); expect(source?.status).toBe('DRAFT');
    await expect(service.amendConsultation(visitId, { ...command, expected_version: changed.version, after_value: after }, userId)).rejects.toMatchObject({ statusCode: 409 });
    const decision = await service.amendConsultation(visitId, { expected_version: changed.version, expected_status: 'AMENDMENT_OPEN', episode_id: episode.id, section: 'follow_up_decision', before_value: 'NO_FOLLOW_UP', after_value: null, reason: 'Decision needs review' }, userId);
    expect((await repository.getClinicalReviewByVisit(visitId))?.current.follow_up_decision).toBeNull();
    await expect(service.completeConsultation(visitId, completion(decision.version, 2, 1, 3), 'p9-missing-decision', userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
  });

  it('reopens into an append-only amendment episode and requires doctor reapproval', async () => {
    const completed = await service.completeConsultation(visitId, completion(), 'p9-original', userId);
    const source = await OphthalmologyContextModel.findById(contextId).lean(); if (!source) throw new Error('Missing context');
    const publication = await OphthalmologyPublicationModel.create({ contextId, visitId, patientId: source.patientId, branchId: source.branchId,
      departmentId: source.departmentId, sourceType: 'CONSULTATION_SUMMARY', sourceId: completed.id, sourceVersion: 1,
      status: 'APPROVED_FOR_PORTAL', portalPayload: { kind: 'CONSULTATION_SUMMARY' }, idempotencyKey: 'amendment-publication',
      requestFingerprint: 'qa', publishedBy: userId, publishedAt: new Date(), version: 0 });
    const reopened = await service.reopenConsultation(visitId, { expected_version: completed.version, expected_status: 'COMPLETED', reason: 'Correct instruction' }, userId);
    expect(await OphthalmologyPublicationModel.findById(publication._id).lean()).toMatchObject({ status: 'WITHDRAWN', version: 1 });
    const episodeId = reopened.amendment_episodes[0]!.id;
    await expect(service.amendConsultation(visitId, { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN', episode_id: episodeId,
      section: 'patient_instructions', before_value: 'wrong source', after_value: 'QA correction', reason: 'QA' }, userId)).rejects.toMatchObject({ statusCode: 409 });
    const amended = await service.amendConsultation(visitId, { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN', episode_id: episodeId,
      section: 'patient_instructions', before_value: 'Return for visual change', after_value: 'Return urgently for visual change', reason: 'Clarify urgency' }, userId);
    const approved = await service.completeConsultation(visitId, completion(amended.version, 2, 1, 2), 'p9-amendment', userId);
    const correctedReview = await repository.getClinicalReviewByVisit(visitId);
    expect(correctedReview?.current.patient_instructions).toBe('Return urgently for visual change');
    expect(correctedReview?.history[0]?.patient_instructions).toBe('Return for visual change');
    expect(correctedReview?.status).toBe('COMPLETED');
    expect(approved).toMatchObject({ status: 'COMPLETED', version: 4, completions: [{ clinical_version: 1 },
      { clinical_version: 2, supersedes_clinical_version: 1 }], amendment_episodes: [{ status: 'COMPLETED' }] });
    expect(await AuditLogModel.countDocuments({ eventType: { $in: ['ophthalmology.consultation.reopened',
      'ophthalmology.consultation.amended', 'ophthalmology.consultation.amendment_approved'] } })).toBe(3);
  });
  it('returns properly mapped doctor review summary with clean typed contract', async () => {
    const summaryData = await service.getConsultationSummary(visitId, userId);
    expect(summaryData.summary).toBeDefined();
    expect(summaryData.summary.tasks).toBeDefined();
    expect(Array.isArray(summaryData.summary.tasks)).toBe(true);
    if (summaryData.summary.tasks.length > 0) {
      expect(summaryData.summary.tasks[0]).toHaveProperty('test_name');
      expect(summaryData.summary.tasks[0]).toHaveProperty('laterality');
      expect(summaryData.summary.tasks[0]).toHaveProperty('status');
    }
  });

  it('escalates emergency clinical alert and activates fail-closed routine test booking guard', async () => {
    const alert = await service.escalateEmergency(visitId, {
      reason: 'Acute intraocular pressure spike OD with severe pain',
      trigger_findings: ['IOP_SPIKE', 'ACUTE_ANGLE_CLOSURE'],
      urgency: 'EMERGENCY',
    }, userId);

    expect(alert).toMatchObject({
      type: 'EMERGENCY_SCREENING',
      status: 'ACTIVE',
      reason: 'Acute intraocular pressure spike OD with severe pain',
      criterion_codes: ['IOP_SPIKE', 'ACUTE_ANGLE_CLOSURE'],
    });

    // Verify emergency escalation activates clinical emergency guard blocking completion readiness
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
    });

    // Verify idempotent replay: sending identical alert request returns the same active alert without duplicate creation
    const notificationCount = await NotificationModel.countDocuments();
    const replayed = await service.escalateEmergency(visitId, {
      reason: 'Acute intraocular pressure spike OD with severe pain',
      trigger_findings: ['IOP_SPIKE', 'ACUTE_ANGLE_CLOSURE'],
      urgency: 'EMERGENCY',
    }, userId);
    expect(replayed.id).toBe(alert.id);
    expect(replayed.source_version).toBe(alert.source_version);
    expect(await NotificationModel.countDocuments()).toBe(notificationCount);
    const alertCount = await OphthalmologyAlertModel.countDocuments({ contextId: alert.context_id });
    expect(alertCount).toBe(1);

    // Verify rejecting duplicate active escalation with conflict when reason differs
    await expect(service.escalateEmergency(visitId, {
      reason: 'Different acute event while previous alert is still active',
      urgency: 'EMERGENCY',
    }, userId)).rejects.toMatchObject({
      statusCode: 409,
      code: 'OPHTHALMOLOGY_STATUS_CONFLICT',
    });

    // Verify acknowledging first alert, then allowing a legitimate subsequent separate emergency with monotonic source version
    await OphthalmologyAlertModel.updateOne({ _id: alert.id }, { $set: { status: 'ACKNOWLEDGED' } });

    const secondAlert = await service.escalateEmergency(visitId, {
      reason: 'Subsequent new acute corneal injury OS',
      trigger_findings: ['CORNEAL_LACERATION'],
      urgency: 'EMERGENCY',
    }, userId);
    expect(secondAlert.status).toBe('ACTIVE');
    expect(secondAlert.source_version).toBe(alert.source_version + 1);
    const totalAlertCount = await OphthalmologyAlertModel.countDocuments({ contextId: alert.context_id });
    expect(totalAlertCount).toBe(2);

    // Verify emergency escalation blocks routine test task creation (requireEmergencyClearance guard)
    const sourceContext = await OphthalmologyContextModel.findById(contextId).lean();
    if (!sourceContext) throw new Error('Missing context');
    const catalogue = await OphthalmologyConfigurationModel.create({
      branchId: sourceContext.branchId,
      type: 'TEST_CATALOGUE',
      code: 'P9-CATALOGUE',
      name: 'P9 Catalogue',
      revision: 1,
      status: 'ACTIVE',
      values: { tests: [{ code: 'VISUAL_ACUITY', name: 'Visual Acuity', active: true }] },
      version: 0,
      createdBy: userId,
      updatedBy: userId,
    });

    await expect(service.createTestTask(visitId, {
      expected_context_version: sourceContext.version,
      test_catalogue_version_id: catalogue._id.toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OU',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, 'routine-task-blocked', userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
    });

    // Acknowledging the alert records receipt only; routine test booking and completion remain blocked
    await OphthalmologyAlertModel.updateOne({ _id: secondAlert.id }, { $set: { status: 'ACKNOWLEDGED' } });
    await expect(service.createTestTask(visitId, {
      expected_context_version: sourceContext.version,
      test_catalogue_version_id: catalogue._id.toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OU',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, 'routine-task-blocked-2', userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
    });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
    });

    // Blocked Scenario OPD-013 / Node D2-34: Clearance with resumption_permitted: false leaves routine care blocked
    await service.clearAlert(visitId, secondAlert.id, {
      disposition: 'ADMIT_TO_INPATIENT',
      clearance_rationale: 'Severe corneal laceration requires immediate inpatient surgical admission',
      resumption_permitted: false,
    }, userId);

    await expect(service.createTestTask(visitId, {
      expected_context_version: sourceContext.version,
      test_catalogue_version_id: catalogue._id.toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OU',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, 'routine-task-blocked-after-no-resumption', userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
    });

    // Idempotency: Rejecting second clearance call on already CLEARED alert
    await expect(service.clearAlert(visitId, secondAlert.id, {
      disposition: 'RESUME_ROUTINE_OPD',
      clearance_rationale: 'Re-evaluating',
      resumption_permitted: true,
    }, userId)).rejects.toMatchObject({
      code: 'OPHTHALMOLOGY_STATUS_CONFLICT',
    });

    // Clear all alerts with resumption_permitted: true to unblock routine care
    await OphthalmologyAlertModel.updateMany(
      { contextId: sourceContext._id },
      {
        $set: {
          status: 'CLEARED',
          clearance: {
            clearedBy: new Types.ObjectId(userId),
            clearedAt: new Date(),
            disposition: 'RESUME_ROUTINE_OPD',
            clearanceRationale: 'Condition stabilized following clinical intervention; routine care resumed',
            resumptionPermitted: true,
          },
        },
      },
    );

    // Routine test task creation now succeeds without error!
    const unblockedTask = await service.createTestTask(visitId, {
      expected_context_version: sourceContext.version,
      test_catalogue_version_id: catalogue._id.toString(),
      test_code: 'VISUAL_ACUITY',
      laterality: 'OU',
      priority: 'ROUTINE',
      source_type: 'WORKFLOW',
    }, 'routine-task-unblocked', userId);
    expect(unblockedTask.status).toBe('ORDERED');
    expect(unblockedTask.priority).toBe('ROUTINE');

    // Blocked Scenario Node D2-36: Inbound emergency provenance linkage and duplicate protection
    const emergencyRepo = new EmergencyRepository(new SequenceService());
    const emergencyEncounter = await emergencyRepo.create(
      {
        branch_id: sourceContext.branchId.toString(),
        department_id: sourceContext.departmentId.toString(),
        patient_id: sourceContext.patientId.toString(),
        arrival_mode: 'OPD_SPECIALTY_TRANSFER',
        chief_complaint: 'Emergency screening escalation: chemical injury',
        originatingSource: {
          sourceType: 'OPD_SPECIALTY_ALERT',
          specialty: 'OPHTHALMOLOGY',
          sourceAlertId: secondAlert.id,
          originatingVisitId: visitId,
          escalatedBy: userId,
          escalatedAt: new Date().toISOString(),
        },
      },
      {
        patientId: sourceContext.patientId,
        patientNumber: 'P-OPH-P9',
        patientName: 'Completion Patient',
      },
      userId,
    );

    expect(emergencyEncounter.originatingSource).toMatchObject({
      sourceType: 'OPD_SPECIALTY_ALERT',
      specialty: 'OPHTHALMOLOGY',
      sourceAlertId: secondAlert.id,
      originatingVisitId: visitId,
      escalatedBy: userId,
    });
    expect(emergencyEncounter.originating_source).toMatchObject({
      source_type: 'OPD_SPECIALTY_ALERT',
      specialty: 'OPHTHALMOLOGY',
      source_alert_id: secondAlert.id,
      originating_visit_id: visitId,
      escalated_by: userId,
    });

    // Ensure database partial unique index on originatingSource.sourceAlertId prevents duplicate emergency records
    await expect(
      emergencyRepo.create(
        {
          branch_id: sourceContext.branchId.toString(),
          department_id: sourceContext.departmentId.toString(),
          patient_id: sourceContext.patientId.toString(),
          arrival_mode: 'OPD_SPECIALTY_TRANSFER',
          chief_complaint: 'Duplicate escalation retry',
          originatingSource: {
            sourceType: 'OPD_SPECIALTY_ALERT',
            specialty: 'OPHTHALMOLOGY',
            sourceAlertId: secondAlert.id,
            originatingVisitId: visitId,
            escalatedBy: userId,
            escalatedAt: new Date().toISOString(),
          },
        },
        {
          patientId: sourceContext.patientId,
          patientNumber: 'P-OPH-P9',
          patientName: 'Completion Patient',
        },
        userId,
      ),
    ).rejects.toMatchObject({ code: 11000, keyPattern: { 'originatingSource.sourceAlertId': 1 } });

    const duplicateEmergency = await emergencyRepo.getActiveByPatient(sourceContext.patientId.toString());
    expect(duplicateEmergency).not.toBeNull();
    expect(duplicateEmergency?.encounterNumber).toBe(emergencyEncounter.encounter_number);
  });

  it('projects billing invoices into doctor review consultation summary and evaluates journey status', async () => {
    const source = await OphthalmologyContextModel.findById(contextId).lean();
    if (!source) throw new Error('Missing context');

    await BillingInvoiceModel.create({
      invoiceNumber: 'INV-OPH-2026-999',
      patientId: source.patientId,
      visitId: source.visitId,
      branchId: source.branchId,
      invoiceDate: new Date(),
      status: 'PARTIALLY_PAID',
      subtotal: 3500,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 3500,
      paidAmount: 1000,
      balanceAmount: 2500,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const summary = await service.getConsultationSummary(visitId, userId);
    expect(summary.summary).toHaveProperty('invoices');
    const invoices = (summary.summary as unknown as { invoices: Array<{ invoiceNumber: string; balanceAmount: number; status: string }> }).invoices;
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      invoiceNumber: 'INV-OPH-2026-999',
      balanceAmount: 2500,
      status: 'PARTIALLY_PAID',
    });

    const journey = await service.getPatientJourneyStatus(visitId, userId);
    expect(journey.journey_completed).toBe(false);
    expect(journey.stages.billing.invoices_count).toBe(1);
    expect(journey.stages.billing.balance_amount).toBe(2500);
    expect(journey.stages.billing.is_settled).toBe(false);
    expect(journey.unmet_obligations.length).toBeGreaterThan(0);
  });
});
