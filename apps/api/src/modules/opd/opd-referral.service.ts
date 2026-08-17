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

export class OpdReferralService {
  constructor(
    private readonly repository: OpdReferralRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly appointmentService: AppointmentService,
    private readonly patientRepository: PatientRepository,
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

    if (wantsAppointment && data.referral_type !== 'INTERNAL') {
      throw new AppError('Only internal referrals can create HMS appointments', 400, 'INVALID_REFERRAL_APPOINTMENT');
    }
    if (wantsAppointment && (!data.appointment_date || !data.appointment_start_time || !data.appointment_duration_minutes)) {
      throw new AppError('Referral appointment date, time and duration must all be provided', 400, 'VALIDATION_ERROR');
    }

    const appointment = wantsAppointment
      ? await this.appointmentService.create(
          {
            patient_id: visit.patient_id,
            doctor_id: data.referred_doctor_id!,
            appointment_date: data.appointment_date!,
            start_time: data.appointment_start_time!,
            duration_minutes: data.appointment_duration_minutes!,
            visit_type: 'NEW_CONSULTATION',
            priority: data.priority ?? 'ROUTINE',
            reason: data.reason,
            notes: `Internal referral from OPD visit ${visit.visit_number}.`,
          },
          userId,
        )
      : null;

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
        description: `${data.referral_type} referral to ${doctor?.display_name ?? data.referred_doctor_name?.trim() ?? data.facility?.trim()}${appointment ? `; appointment ${appointment.appointment_number} created` : ''}.`,
      },
      userId,
    );
    await this.patientRepository.auditClinicalEvent('opd.referral.submitted', userId, {
      appointmentId: appointment?.id ?? null,
      patientId: visit.patient_id,
      referralId: referral.id,
      referralType: data.referral_type,
      visitId: visit.id,
    });
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
