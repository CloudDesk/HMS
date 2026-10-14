import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { ServiceRepository } from '../src/modules/services/service.repository.js';
import { ServiceCatalogueService } from '../src/modules/services/service.service.js';
import { DepartmentRepository } from '../src/modules/departments/department.repository.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../src/modules/surgery/surgery.model.js';
import { OpdClinicalOrderModel } from '../src/modules/opd/opd-clinical-order.model.js';
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { AppError } from '../src/shared/errors/app-error.js';

describe('Service Catalogue Deletion Dependency Checks', () => {
  let serviceRepository: ServiceRepository;
  let departmentRepository: DepartmentRepository;
  let serviceCatalogue: ServiceCatalogueService;

  const actorUserId = createObjectId().toString();
  const branchId = createObjectId();
  const departmentId = createObjectId();
  const dummyMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeAll(async () => {
    await setupTestDatabase();
    serviceRepository = new ServiceRepository();
    departmentRepository = new DepartmentRepository();
    serviceCatalogue = new ServiceCatalogueService(serviceRepository, departmentRepository);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  const createDummyService = async (code: string, name: string, type: 'PROCEDURE' | 'LAB_TEST' | 'GENERAL' = 'PROCEDURE') => {
    return ServiceModel.create({
      code,
      name,
      serviceType: type,
      departmentId,
      standardPrice: 150,
      defaultDurationMinutes: 30,
      bookingCapacity: 1,
      status: 'ACTIVE',
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
  };

  it('blocks deletion when active procedure recommendation exists', async () => {
    const service = await createDummyService('PROC-ACTIVE-REC', 'Active Rec Procedure');

    await ProcedureRecommendationModel.create({
      recommendationNumber: `REC-${Date.now()}`,
      patientId: createObjectId(),
      patientNumber: 'P-101',
      patientName: 'John Doe',
      branchId,
      departmentId,
      departmentName: 'General Surgery',
      recommendingDoctorId: createObjectId(),
      recommendingDoctorName: 'Dr. Smith',
      serviceId: service._id,
      serviceName: service.name,
      clinicalReason: 'Diagnostic check',
      status: 'ACTIVE',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    let thrownError: unknown;
    try {
      await serviceCatalogue.delete(service.id, actorUserId, dummyMetadata);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    const appError = thrownError as AppError;
    expect(appError.statusCode).toBe(409);
    expect(appError.code).toBe('SERVICE_HAS_DEPENDENCIES');

    // Confirm service is not soft deleted
    const unchanged = await ServiceModel.findById(service._id);
    expect(unchanged?.deletedAt).toBeFalsy();
  });

  it('blocks deletion when pending procedure booking exists', async () => {
    const service = await createDummyService('PROC-PENDING-BOOK', 'Pending Booking Procedure');

    await ProcedureBookingModel.create({
      bookingNumber: `PB-${Date.now()}`,
      recommendationId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-102',
      patientName: 'Jane Smith',
      branchId,
      departmentId,
      departmentName: 'Orthopedics',
      serviceId: service._id,
      serviceName: service.name,
      doctorId: createObjectId(),
      doctorName: 'Dr. Adams',
      scheduledStart: new Date(Date.now() + 86400000),
      scheduledEnd: new Date(Date.now() + 90000000),
      durationMinutes: 60,
      status: 'PENDING_CONFIRMATION',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).rejects.toThrowError(AppError);

    try {
      await serviceCatalogue.delete(service.id, actorUserId, dummyMetadata);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('SERVICE_HAS_DEPENDENCIES');
    }
  });

  it('blocks deletion when confirmed (BOOKED) procedure booking exists', async () => {
    const service = await createDummyService('PROC-BOOKED', 'Booked Procedure');

    await ProcedureBookingModel.create({
      bookingNumber: `PB-${Date.now()}`,
      recommendationId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-103',
      patientName: 'Robert Taylor',
      branchId,
      departmentId,
      departmentName: 'Cardiology',
      serviceId: service._id,
      serviceName: service.name,
      doctorId: createObjectId(),
      doctorName: 'Dr. Vance',
      scheduledStart: new Date(Date.now() + 86400000),
      scheduledEnd: new Date(Date.now() + 90000000),
      durationMinutes: 60,
      status: 'BOOKED',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).rejects.toThrow('Service cannot be deleted while active procedure bookings, recommendations, or clinical orders reference it');
  });

  it('blocks deletion when active clinical order references the service', async () => {
    const service = await createDummyService('LAB-ORDER-ACTIVE', 'Active Blood Test', 'LAB_TEST');

    await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-104',
      patientName: 'Emma Watson',
      doctorId: createObjectId(),
      doctorName: 'Dr. House',
      branchId,
      orderType: 'LABORATORY',
      status: 'IN_PROGRESS',
      priority: 'ROUTINE',
      items: [
        {
          _id: createObjectId(),
          serviceId: service._id,
          serviceName: service.name,
          investigationName: service.name,
          category: 'Pathology',
        },
      ],
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).rejects.toThrowError(AppError);
  });

  it('blocks deletion when active dental treatment plan item references the service', async () => {
    const service = await createDummyService('DENT-PLAN-ACTIVE', 'Dental Composite Filling', 'PROCEDURE');

    await OpdDentalExaminationModel.create({
      visitId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-105',
      patientName: 'Alice Green',
      doctorId: createObjectId(),
      doctorName: 'Dr. Teeth',
      branchId,
      departmentId,
      status: 'DRAFT',
      teeth: [],
      treatmentPlanItems: [
        {
          serviceId: service.id,
          procedureName: service.name,
          status: 'PROPOSED',
        },
      ],
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).rejects.toThrowError(AppError);
  });

  it('allows deletion when service has no references', async () => {
    const service = await createDummyService('PROC-UNUSED', 'Unused Procedure');

    await serviceCatalogue.delete(service.id, actorUserId, dummyMetadata);

    const deleted = await ServiceModel.findById(service._id);
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.deletedBy?.toString()).toBe(actorUserId);
  });

  it('allows deletion when procedure booking is terminal (COMPLETED or CANCELLED)', async () => {
    const service = await createDummyService('PROC-TERMINAL-BOOK', 'Completed Procedure');

    await ProcedureBookingModel.create({
      bookingNumber: `PB-${Date.now()}-1`,
      recommendationId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-106',
      patientName: 'Mark Lee',
      branchId,
      departmentId,
      departmentName: 'Dermatology',
      serviceId: service._id,
      serviceName: service.name,
      doctorId: createObjectId(),
      doctorName: 'Dr. Grey',
      scheduledStart: new Date(Date.now() - 86400000),
      scheduledEnd: new Date(Date.now() - 80000000),
      durationMinutes: 45,
      status: 'COMPLETED',
      completedAt: new Date(),
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await ProcedureBookingModel.create({
      bookingNumber: `PB-${Date.now()}-2`,
      recommendationId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-107',
      patientName: 'Mark Lee 2',
      branchId,
      departmentId,
      departmentName: 'Dermatology',
      serviceId: service._id,
      serviceName: service.name,
      doctorId: createObjectId(),
      doctorName: 'Dr. Grey',
      scheduledStart: new Date(Date.now() - 50000000),
      scheduledEnd: new Date(Date.now() - 40000000),
      durationMinutes: 45,
      status: 'CANCELLED',
      cancellationReason: 'Patient cancelled',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).resolves.not.toThrow();

    const deleted = await ServiceModel.findById(service._id);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it('allows deletion when procedure recommendation is terminal (BOOKED or CANCELLED)', async () => {
    const service = await createDummyService('PROC-TERMINAL-REC', 'Cancelled Rec Procedure');

    await ProcedureRecommendationModel.create({
      recommendationNumber: `REC-${Date.now()}-1`,
      patientId: createObjectId(),
      patientNumber: 'P-108',
      patientName: 'Sara Connor',
      branchId,
      departmentId,
      departmentName: 'Neurology',
      recommendingDoctorId: createObjectId(),
      recommendingDoctorName: 'Dr. Strange',
      serviceId: service._id,
      serviceName: service.name,
      clinicalReason: 'Initial consult',
      status: 'CANCELLED',
      cancellationReason: 'No longer indicated',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await ProcedureRecommendationModel.create({
      recommendationNumber: `REC-${Date.now()}-2`,
      patientId: createObjectId(),
      patientNumber: 'P-109',
      patientName: 'Kyle Reese',
      branchId,
      departmentId,
      departmentName: 'Neurology',
      recommendingDoctorId: createObjectId(),
      recommendingDoctorName: 'Dr. Strange',
      serviceId: service._id,
      serviceName: service.name,
      clinicalReason: 'Second consult',
      status: 'BOOKED',
      createdBy: createObjectId(),
      updatedBy: createObjectId(),
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).resolves.not.toThrow();
  });

  it('allows deletion when clinical order is COMPLETED or soft-deleted', async () => {
    const service = await createDummyService('LAB-TERMINAL-ORDER', 'Done Blood Test', 'LAB_TEST');

    // Completed order
    await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-110',
      patientName: 'Order Patient 1',
      doctorId: createObjectId(),
      doctorName: 'Dr. House',
      branchId,
      orderType: 'LABORATORY',
      status: 'COMPLETED',
      priority: 'ROUTINE',
      items: [
        {
          _id: createObjectId(),
          serviceId: service._id,
          serviceName: service.name,
          investigationName: service.name,
          category: 'Pathology',
        },
      ],
    });

    // Soft-deleted order
    await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-111',
      patientName: 'Order Patient 2',
      doctorId: createObjectId(),
      doctorName: 'Dr. House',
      branchId,
      orderType: 'LABORATORY',
      status: 'SUBMITTED',
      priority: 'ROUTINE',
      deletedAt: new Date(),
      items: [
        {
          _id: createObjectId(),
          serviceId: service._id,
          serviceName: service.name,
          investigationName: service.name,
          category: 'Pathology',
        },
      ],
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).resolves.not.toThrow();
  });

  it('allows deletion when dental treatment plan item is terminal (COMPLETED, DECLINED, or CANCELLED)', async () => {
    const service = await createDummyService('DENT-PLAN-DONE', 'Finished Dental Scaling', 'PROCEDURE');

    await OpdDentalExaminationModel.create({
      visitId: createObjectId(),
      patientId: createObjectId(),
      patientNumber: 'P-112',
      patientName: 'Dent Patient 1',
      doctorId: createObjectId(),
      doctorName: 'Dr. Teeth',
      branchId,
      departmentId,
      status: 'COMPLETED',
      teeth: [],
      treatmentPlanItems: [
        {
          serviceId: service.id,
          procedureName: service.name,
          status: 'COMPLETED',
        },
        {
          serviceId: service.id,
          procedureName: service.name,
          status: 'CANCELLED',
        },
      ],
    });

    await expect(
      serviceCatalogue.delete(service.id, actorUserId, dummyMetadata),
    ).resolves.not.toThrow();
  });

  describe('bulkDelete dependency checks', () => {
    it('blocks bulk deletion if any selected service has active dependencies and identifies offending IDs', async () => {
      const cleanService = await createDummyService('BULK-CLEAN', 'Clean Service');
      const blockedService = await createDummyService('BULK-BLOCKED', 'Blocked Service');

      await ProcedureBookingModel.create({
        bookingNumber: `PB-BULK-${Date.now()}`,
        recommendationId: createObjectId(),
        patientId: createObjectId(),
        patientNumber: 'P-113',
        patientName: 'Bulk Patient',
        branchId,
        departmentId,
        departmentName: 'Surgery',
        serviceId: blockedService._id,
        serviceName: blockedService.name,
        doctorId: createObjectId(),
        doctorName: 'Dr. Surgeon',
        scheduledStart: new Date(Date.now() + 86400000),
        scheduledEnd: new Date(Date.now() + 90000000),
        durationMinutes: 60,
        status: 'BOOKED',
        createdBy: createObjectId(),
        updatedBy: createObjectId(),
      });

      let thrownError: unknown;
      try {
        await serviceCatalogue.bulkDelete(
          [cleanService.id, blockedService.id],
          departmentId.toString(),
          actorUserId,
          dummyMetadata,
        );
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      const appErr = thrownError as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('SERVICE_HAS_DEPENDENCIES');
      expect(appErr.details).toEqual({
        service_ids: [blockedService.id],
      });

      // Verify neither service was deleted
      const checkClean = await ServiceModel.findById(cleanService._id);
      const checkBlocked = await ServiceModel.findById(blockedService._id);
      expect(checkClean?.deletedAt).toBeFalsy();
      expect(checkBlocked?.deletedAt).toBeFalsy();
    });

    it('succeeds with bulk deletion when all selected services are free of active dependencies', async () => {
      const cleanService1 = await createDummyService('BULK-OK-1', 'Clean Service 1');
      const cleanService2 = await createDummyService('BULK-OK-2', 'Clean Service 2');

      const result = await serviceCatalogue.bulkDelete(
        [cleanService1.id, cleanService2.id],
        departmentId.toString(),
        actorUserId,
        dummyMetadata,
      );

      expect(result).toEqual({ success: true, deleted: 2 });

      const check1 = await ServiceModel.findById(cleanService1._id);
      const check2 = await ServiceModel.findById(cleanService2._id);
      expect(check1?.deletedAt).not.toBeNull();
      expect(check2?.deletedAt).not.toBeNull();
    });
  });
});
