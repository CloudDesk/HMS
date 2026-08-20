import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdReferralRepository } from './opd-referral.repository.js';
import type { SaveOpdReferralDTO } from './opd-referral.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

import type { NotificationService } from '../notifications/notification.service.js';
import type { UserRepository } from '../users/user.repository.js';

export class OpdReferralService {
  constructor(
    private readonly repository: OpdReferralRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly appointmentService: AppointmentService,
    private readonly patientRepository: PatientRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  async getByVisit(visitId: string, userId: string) {
    await this.getVisit(visitId, userId);
    return this.repository.getByVisit(visitId);
  }

  async saveDraft(visitId: string, data: SaveOpdReferralDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    const current = await this.repository.getByVisit(visitId);
    if (current?.status === 'SUBMITTED') {
      throw new AppError('A submitted referral cannot be edited', 400, 'REFERRAL_SUBMITTED');
    }
    const doctor = await this.getInternalDoctor(data.referred_doctor_id);
    return this.repository.saveForVisit(
      { ...data, consultation, referredDoctorName: doctor?.display_name, status: 'DRAFT', visit },
      userId,
    );
  }

  async submit(visitId: string, data: SaveOpdReferralDTO, userId: string) {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    const consultation = await this.getConsultation(visitId);
    if (consultation.status !== 'COMPLETED') {
      throw new AppError('Complete the consultation before submitting referral', 400, 'CONSULTATION_NOT_COMPLETED');
    }
    const current = await this.repository.getByVisit(visitId);
    if (current?.status === 'SUBMITTED') {
      throw new AppError('Referral has already been submitted', 400, 'REFERRAL_SUBMITTED');
    }
    this.validateSubmission(data);
    const doctor = await this.getInternalDoctor(data.referred_doctor_id);
    const wantsAppointment = Boolean(data.appointment_date || data.appointment_start_time || data.appointment_duration_minutes);

    const appointment = null; // Appointment creation is now handled manually by receptionist

    const referral = await this.repository.saveForVisit(
      {
        ...data,
        appointment,
        consultation,
        referredDoctorName: doctor?.display_name,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        visit,
      },
      userId,
    );

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'OPD_REFERRAL_SUBMITTED',
        title: 'OPD referral submitted',
        description: `${data.referral_type} referral to ${doctor?.display_name ?? data.referred_doctor_name?.trim() ?? data.facility?.trim()}.`,
      },
      userId,
    );
    await this.patientRepository.auditClinicalEvent('opd.referral.submitted', userId, {
      appointmentId: null,
      patientId: visit.patient_id,
      referralId: referral.id,
      referralType: data.referral_type,
      visitId: visit.id,
    });

    // Generate notifications
    const patient = await this.patientRepository.getById(visit.patient_id);
    const patientName = patient ? `${patient.first_name || ''} ${patient.last_name}`.trim() : 'Unknown Patient';

    await this.notificationService.createNotification({
      recipient_role: 'RECEPTIONIST',
      title: 'New Patient Referral',
      message: `Patient ${patientName} has been referred for ${data.specialty}. Please schedule an appointment.`,
      type: 'REFERRAL',
      related_entity_id: visit.id,
    });

    if (data.referral_type === 'INTERNAL' && doctor) {
      // Find the user ID for this doctor
      if (doctor.user_id) {
        await this.notificationService.createNotification({
          recipient_user_id: doctor.user_id,
          title: 'New Patient Referral',
          message: `Patient ${patientName} has been referred to you for ${data.specialty}.`,
          type: 'REFERRAL',
          related_entity_id: visit.id,
        });
      }
    }

    return referral;
  }

  private validateSubmission(data: SaveOpdReferralDTO) {
    if (!data.referral_type || !data.specialty?.trim() || !data.reason?.trim() || !data.clinical_summary?.trim()) {
      throw new AppError('Referral type, specialty, reason and clinical summary are required', 400, 'VALIDATION_ERROR');
    }
    if (data.referral_type === 'INTERNAL' && !data.referred_doctor_id) {
      throw new AppError('An internal referral requires an HMS doctor', 400, 'REFERRED_DOCTOR_REQUIRED');
    }
    if (data.referral_type !== 'INTERNAL' && !data.facility?.trim()) {
      throw new AppError('External and emergency referrals require a facility', 400, 'REFERRAL_FACILITY_REQUIRED');
    }
  }

  private async getInternalDoctor(id: string | null | undefined) {
    if (!id) return null;
    if (!Types.ObjectId.isValid(id)) throw new AppError('Referred doctor id is invalid', 400, 'VALIDATION_ERROR');
    const doctor = await this.doctorRepository.getById(id);
    if (!doctor || doctor.status !== 'ACTIVE') throw new AppError('Active referred doctor is required', 400, 'INVALID_DOCTOR');
    return doctor;
  }

  private async getVisit(visitId: string, userId: string) {
    if (!Types.ObjectId.isValid(visitId)) throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);
    if (!visit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    return visit;
  }

  private async getConsultation(visitId: string) {
    const consultation = await this.consultationRepository.getByVisit(visitId);
    if (!consultation) throw new AppError('Start the consultation before creating referral', 400, 'CONSULTATION_REQUIRED');
    return consultation;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Referral cannot be changed for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }
}
