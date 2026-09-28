import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AppointmentService } from './appointment.service.js';
import type { AppointmentRepository } from './appointment.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import type { SettingsRepository } from '../settings/settings.repository.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { OpdConsultationService } from '../opd/opd-consultation.service.js';
import type { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import type { OpdVitalsRepository } from '../opd/opd-vitals.repository.js';
import { PatientPortalService } from '../patient-portal/patient-portal.service.js';
import type { PatientPortalRepository } from '../patient-portal/patient-portal.repository.js';
import type { PatientOtpService } from '../patient-portal/patient-otp.service.js';
import type { UserService } from '../users/user.service.js';

describe('Patient Pre-Consultation History End-to-End Unit Tests', () => {
  const patientId = new Types.ObjectId().toString();
  const doctorId = new Types.ObjectId().toString();
  const appointmentId = new Types.ObjectId().toString();
  const branchId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  const mockPreConsultation = {
    id: new Types.ObjectId().toString(),
    patient_id: patientId,
    appointment_id: appointmentId,
    doctor_id: doctorId,
    chief_complaint: 'Severe headache and throbbing temple pain',
    history_present_illness: 'Started 2 days ago after long hours at computer screen.',
    past_medical_history: 'Hypertension on Telmisartan',
    family_history: 'Mother had migraines',
    allergies: 'Penicillin (rash)',
    submitted_at: new Date('2026-09-28T10:00:00Z'),
    created_at: new Date('2026-09-28T10:00:00Z'),
    updated_at: new Date('2026-09-28T10:00:00Z'),
  };

  describe('1. Appointment Repository Pre-Consultation Mapping', () => {
    it('retrieves pre-consultation record by appointment id', async () => {
      const mockRepo = {
        getPatientPreConsultationByAppointmentId: vi.fn().mockResolvedValue(mockPreConsultation),
        savePatientPreConsultation: vi.fn().mockResolvedValue(mockPreConsultation),
      } as unknown as AppointmentRepository;

      const result = await mockRepo.getPatientPreConsultationByAppointmentId(appointmentId);
      expect(result).toEqual(mockPreConsultation);
      expect(mockRepo.getPatientPreConsultationByAppointmentId).toHaveBeenCalledWith(appointmentId);
    });
  });

  describe('2. Appointment Service Pre-Consultation Handling', () => {
    it('provides getPreConsultationByAppointmentId with id validation', async () => {
      const mockRepo = {
        getPatientPreConsultationByAppointmentId: vi.fn().mockResolvedValue(mockPreConsultation),
      } as unknown as AppointmentRepository;

      const service = new AppointmentService(
        mockRepo,
        {} as PatientRepository,
        {} as DoctorRepository,
        {} as OpdVisitRepository,
        {} as SettingsRepository,
        {} as SequenceService,
      );

      const result = await service.getPreConsultationByAppointmentId(appointmentId);
      expect(result).toEqual(mockPreConsultation);
      expect(mockRepo.getPatientPreConsultationByAppointmentId).toHaveBeenCalledWith(appointmentId);
    });

    it('rejects invalid appointment id for pre-consultation query', async () => {
      const service = new AppointmentService(
        {} as AppointmentRepository,
        {} as PatientRepository,
        {} as DoctorRepository,
        {} as OpdVisitRepository,
        {} as SettingsRepository,
        {} as SequenceService,
      );

      await expect(service.getPreConsultationByAppointmentId('invalid-id')).rejects.toThrow(
        'Appointment id is invalid',
      );
    });
  });

  describe('3. OPD Consultation Service - Doctor View Pre-Consultation', () => {
    it('fetches patient pre-consultation history linked to the OPD visit appointment', async () => {
      const visitId = new Types.ObjectId().toString();
      const mockVisit = {
        id: visitId,
        visit_number: 'OPD-2026-000001',
        patient_id: patientId,
        appointment_id: appointmentId,
        doctor_id: doctorId,
        branch_id: branchId,
        status: 'READY_FOR_CONSULTATION',
      };

      const mockVisitRepo = {
        resolveBranchScope: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue(mockVisit),
      } as unknown as OpdVisitRepository;

      const mockAppointmentRepo = {
        getPatientPreConsultationByAppointmentId: vi.fn().mockResolvedValue(mockPreConsultation),
      } as unknown as AppointmentRepository;

      const opdService = new OpdConsultationService(
        {} as OpdConsultationRepository,
        mockVisitRepo,
        {} as OpdVitalsRepository,
        {} as PatientRepository,
        mockAppointmentRepo,
      );

      const result = await opdService.getPreConsultation(visitId, userId);
      expect(result).toEqual(mockPreConsultation);
      expect(mockAppointmentRepo.getPatientPreConsultationByAppointmentId).toHaveBeenCalledWith(
        appointmentId,
      );
    });

    it('returns null if the OPD visit was a walk-in without a prior scheduled appointment', async () => {
      const visitId = new Types.ObjectId().toString();
      const mockWalkInVisit = {
        id: visitId,
        visit_number: 'OPD-2026-000002',
        patient_id: patientId,
        appointment_id: null,
        doctor_id: doctorId,
        branch_id: branchId,
        status: 'READY_FOR_CONSULTATION',
      };

      const mockVisitRepo = {
        resolveBranchScope: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue(mockWalkInVisit),
      } as unknown as OpdVisitRepository;

      const mockAppointmentRepo = {
        getPatientPreConsultationByAppointmentId: vi.fn(),
      } as unknown as AppointmentRepository;

      const opdService = new OpdConsultationService(
        {} as OpdConsultationRepository,
        mockVisitRepo,
        {} as OpdVitalsRepository,
        {} as PatientRepository,
        mockAppointmentRepo,
      );

      const result = await opdService.getPreConsultation(visitId, userId);
      expect(result).toBeNull();
      expect(mockAppointmentRepo.getPatientPreConsultationByAppointmentId).not.toHaveBeenCalled();
    });
  });

  describe('4. Patient Portal Service - Authorized Access & Security', () => {
    it('allows patient to fetch pre-consultation for their own appointment', async () => {
      const mockAppointment = {
        id: appointmentId,
        patient_id: patientId,
      };

      const mockAppointments = {
        getForPortal: vi.fn().mockResolvedValue(mockAppointment),
        getPreConsultationByAppointmentId: vi.fn().mockResolvedValue(mockPreConsultation),
      } as unknown as AppointmentService;

      const mockPortalRepo = {
        resolveAccessiblePatientId: vi.fn().mockResolvedValue(patientId),
      } as unknown as PatientPortalRepository;

      const portalService = new PatientPortalService(
        mockPortalRepo,
        {} as UserService,
        mockAppointments,
        {} as DoctorService,
        {} as PatientService,
        {} as PatientOtpService,
      );

      const result = await portalService.getPreConsultation(userId, appointmentId);
      expect(result).toEqual(mockPreConsultation);
      expect(mockAppointments.getPreConsultationByAppointmentId).toHaveBeenCalledWith(appointmentId);
    });

    it('rejects cross-patient unauthorized access to another patient pre-consultation', async () => {
      const anotherPatientId = new Types.ObjectId().toString();
      const mockAppointment = {
        id: appointmentId,
        patient_id: anotherPatientId,
      };

      const mockAppointments = {
        getForPortal: vi.fn().mockResolvedValue(mockAppointment),
        getPreConsultationByAppointmentId: vi.fn().mockResolvedValue(mockPreConsultation),
      } as unknown as AppointmentService;

      const mockPortalRepo = {
        resolveAccessiblePatientId: vi.fn().mockResolvedValue(null), // Access denied
      } as unknown as PatientPortalRepository;

      const portalService = new PatientPortalService(
        mockPortalRepo,
        {} as UserService,
        mockAppointments,
        {} as DoctorService,
        {} as PatientService,
        {} as PatientOtpService,
      );

      await expect(portalService.getPreConsultation(userId, appointmentId)).rejects.toThrow(
        'You cannot view clinical history for this appointment',
      );
    });
  });
});
