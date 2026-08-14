import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';
import type { OpdVitalsRepository } from './opd-vitals.repository.js';
import type { CreateOpdVitalsDTO, OpdVitalsListQuery } from './opd-vitals.types.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

const calculateBmi = (weightKg?: number | null, heightCm?: number | null) => {
  if (!weightKg || !heightCm) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
};

export class OpdVitalsService {
  constructor(
    private readonly repository: OpdVitalsRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  async listByVisit(visitId: string, query: OpdVitalsListQuery) {
    await this.getVisit(visitId);
    return this.repository.listByVisit(visitId, query);
  }

  async getLatestByVisit(visitId: string) {
    await this.getVisit(visitId);
    return this.repository.getLatestByVisit(visitId);
  }

  async create(visitId: string, data: CreateOpdVitalsDTO, userId: string) {
    const visit = await this.getVisit(visitId);
    this.ensureOpenVisit(visit);
    this.validateVitals(data);

    const vitals = await this.repository.create(
      {
        ...data,
        bmi: calculateBmi(data.weight_kg, data.height_cm),
        visit,
      },
      userId,
    );

    if (visit.status === 'CHECKED_IN' || visit.status === 'WAITING_FOR_VITALS') {
      await this.visitRepository.updateStatus(
        visit.id,
        {
          notes: 'Vitals recorded and patient ready for doctor consultation.',
          status: 'READY_FOR_CONSULTATION',
        },
        userId,
      );
    }

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'VITALS_RECORDED',
        title: 'Vitals recorded',
        description: `${visit.visit_number}: BP ${vitals.blood_pressure}, BMI ${vitals.bmi}.`,
      },
      userId,
    );

    return vitals;
  }

  private async getVisit(visitId: string) {
    this.validateId(visitId, 'OPD visit id is invalid');
    const visit = await this.visitRepository.getById(visitId);

    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }

    return visit;
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError('Vitals cannot be recorded for a closed OPD visit', 400, 'VISIT_CLOSED');
    }
  }

  private validateVitals(data: CreateOpdVitalsDTO) {
    if (data.blood_pressure_systolic !== undefined && data.blood_pressure_systolic !== null) {
      this.validateRange(data.blood_pressure_systolic, 50, 260, 'Systolic blood pressure must be between 50 and 260');
    }
    if (data.blood_pressure_diastolic !== undefined && data.blood_pressure_diastolic !== null) {
      this.validateRange(data.blood_pressure_diastolic, 30, 160, 'Diastolic blood pressure must be between 30 and 160');
    }
    if (data.weight_kg !== undefined && data.weight_kg !== null) {
      this.validateRange(data.weight_kg, 1, 350, 'Weight must be between 1 and 350 kg');
    }
    if (data.height_cm !== undefined && data.height_cm !== null) {
      this.validateRange(data.height_cm, 30, 250, 'Height must be between 30 and 250 cm');
    }

    if (
      data.blood_pressure_systolic !== undefined &&
      data.blood_pressure_systolic !== null &&
      data.blood_pressure_diastolic !== undefined &&
      data.blood_pressure_diastolic !== null &&
      data.blood_pressure_diastolic >= data.blood_pressure_systolic
    ) {
      throw new AppError('Systolic blood pressure must be greater than diastolic blood pressure', 400, 'VALIDATION_ERROR');
    }

    if (data.temperature_c !== undefined && data.temperature_c !== null) {
      this.validateRange(data.temperature_c, 30, 45, 'Temperature must be between 30 and 45 C');
    }

    if (data.pulse_bpm !== undefined && data.pulse_bpm !== null) {
      this.validateRange(data.pulse_bpm, 20, 240, 'Pulse must be between 20 and 240 bpm');
    }

    if (data.respiratory_rate_per_min !== undefined && data.respiratory_rate_per_min !== null) {
      this.validateRange(data.respiratory_rate_per_min, 5, 80, 'Respiratory rate must be between 5 and 80 per minute');
    }

    if (data.oxygen_saturation_percent !== undefined && data.oxygen_saturation_percent !== null) {
      this.validateRange(data.oxygen_saturation_percent, 50, 100, 'Oxygen saturation must be between 50 and 100 percent');
    }
  }

  private validateRange(value: number, min: number, max: number, message: string) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
