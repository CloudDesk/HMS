import { AppError } from '../../shared/errors/app-error.js';
import type { AdmissionsConfigurationService } from '../admissions-configuration/admissions-configuration.service.js';
import type { BillingService } from '../billing/billing.service.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { Doctor } from '../doctors/doctor.types.js';
import type { PatientService } from '../patients/patient.service.js';
import type { SurgeryRepository } from './surgery.repository.js';
import type { BookingLean, RecommendationLean } from './surgery.repository.js';
import type { ConfirmProcedureBookingDTO, CreateProcedureBookingDTO, CreateProcedureRecommendationDTO, ReasonDTO, RescheduleProcedureBookingDTO, SurgeryListQuery, SurgeryMetadata } from './surgery.types.js';

const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const toMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toTimeString = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const formatTime12h = (time24: string) => {
  const [h, m] = time24.split(':').map(Number);
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM';
  const hour12 = ((h ?? 0) % 12) || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')} ${period}`;
};

function parseScheduleWindow(scheduledStart: string, durationMinutes: number) {
  const raw = scheduledStart.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) throw new AppError('Invalid scheduled date or time', 400, 'INVALID_PROCEDURE_SCHEDULE');

  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  const hour = match[4] !== undefined ? parseInt(match[4], 10) : 9;
  const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;

  const dateOnly = new Date(Date.UTC(year, month - 1, day));
  const dayName = dayNames[dateOnly.getUTCDay()]!;
  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + durationMinutes;
  const startTime = toTimeString(startMinutes);
  const endTime = toTimeString(endMinutes);

  const startDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const endDate = new Date(Date.UTC(year, month - 1, day, Math.floor(endMinutes / 60), endMinutes % 60));

  return { dateOnly, dayName, startMinutes, endMinutes, startTime, endTime, startDate, endDate, dateString: `${match[1]}-${match[2]}-${match[3]}` };
}

const duplicate = (error: unknown): never => { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw new AppError('An active recommendation or booking already exists', 409, 'PROCEDURE_DUPLICATE_CONFLICT'); throw error; };

export class SurgeryService {
  constructor(private readonly repository: SurgeryRepository, private readonly doctors: DoctorRepository, private readonly patients: PatientService, private readonly billing: BillingService, private readonly beds: AdmissionsConfigurationService) {}
  private async authorize(actor: string, branchId: string) { if (!await this.repository.hasBranchAccess(actor, branchId)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED'); }
  private async authorizeDepartment(actor: string, departmentId: string) { const scope = await this.repository.departmentScope(actor); if (scope && !scope.includes(departmentId)) throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED'); }
  async listRecommendations(query: SurgeryListQuery, actor: string) { await this.authorize(actor, query.branch_id); return this.repository.listRecommendations(query, await this.repository.departmentScope(actor)); }
  async listBookings(query: SurgeryListQuery, actor: string) { await this.authorize(actor, query.branch_id); return this.repository.listBookings(query, await this.repository.departmentScope(actor)); }
  async getBooking(id: string, branchId: string, actor: string) { await this.authorize(actor, branchId); const row = await this.repository.getBooking(id, branchId); if (!row) throw new AppError('Procedure booking not found', 404, 'PROCEDURE_BOOKING_NOT_FOUND'); await this.authorizeDepartment(actor, row.department_id); return row; }

  async createRecommendation(data: CreateProcedureRecommendationDTO, actor: string, metadata: SurgeryMetadata) {
    await this.authorize(actor, data.branch_id); await this.authorizeDepartment(actor, data.department_id); const session = await this.repository.session();
    try { let result; await session.withTransaction(async () => { const refs = await this.repository.recommendationReferences(data, session); if (!refs.patient) throw new AppError('Active patient not found', 404, 'PATIENT_NOT_FOUND'); if (!refs.doctor) throw new AppError('Active recommending doctor not found in the selected department', 404, 'DOCTOR_NOT_FOUND'); if (!refs.department) throw new AppError('Active department not found in the selected branch', 404, 'DEPARTMENT_NOT_FOUND'); if (!refs.service) throw new AppError('Active procedure service not found in the selected department', 404, 'PROCEDURE_SERVICE_NOT_FOUND'); if (data.encounter_id && !refs.encounter) throw new AppError('Clinical encounter does not match the selected patient and doctor', 409, 'ENCOUNTER_CONTEXT_MISMATCH'); result = await this.repository.createRecommendation(data, { patientNumber: refs.patient.patientNumber, patientName: [refs.patient.firstName, refs.patient.middleName, refs.patient.lastName].filter(Boolean).join(' '), doctorName: refs.doctor.displayName, departmentName: refs.department.name, serviceName: refs.service.name }, actor, session); await this.patients.addProcedureTimeline(data.patient_id, 'PROCEDURE_RECOMMENDATION_CREATED', 'Procedure recommended', `${result.recommendation_number} recommends ${result.service_name}.`, actor, session); await this.repository.audit('surgery.recommendation.created', actor, metadata, { recommendationId: result.id, patientId: data.patient_id, encounterId: data.encounter_id, serviceId: data.service_id, branchId: data.branch_id }, session); }); if (!result) throw new AppError('Procedure recommendation could not be created', 500, 'PROCEDURE_RECOMMENDATION_CREATE_FAILED'); return result; } catch (error) { return duplicate(error); } finally { await session.endSession(); }
  }

  async cancelRecommendation(id: string, branchId: string, data: ReasonDTO, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, branchId); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const current = await this.repository.getRecommendation(id, branchId, session); if (!current) throw new AppError('Procedure recommendation not found', 404, 'PROCEDURE_RECOMMENDATION_NOT_FOUND'); result = await this.repository.cancelRecommendation(id, branchId, data.reason, actor, session); if (!result) throw new AppError('Only an unbooked active recommendation can be cancelled', 409, 'PROCEDURE_RECOMMENDATION_STATE_CONFLICT'); await this.patients.addProcedureTimeline(current.patient_id, 'PROCEDURE_RECOMMENDATION_CANCELLED', 'Procedure recommendation cancelled', `${current.recommendation_number} was cancelled: ${data.reason}`, actor, session); await this.repository.audit('surgery.recommendation.cancelled', actor, metadata, { recommendationId: id, patientId: current.patient_id, branchId, reason: data.reason }, session); }); return result; } finally { await session.endSession(); } }

  async createBooking(data: CreateProcedureBookingDTO, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, data.branch_id); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const recommendation = await this.repository.getActiveRecommendationRecord(data.recommendation_id, data.branch_id, session); if (!recommendation) throw new AppError('Active unbooked procedure recommendation not found', 409, 'PROCEDURE_RECOMMENDATION_NOT_ACTIVE'); const refs = await this.repository.bookingReferences(recommendation, data.doctor_id, session); if (!refs.service || !refs.service.defaultDurationMinutes || !refs.service.bookingCapacity) throw new AppError('Procedure service configuration is incomplete', 409, 'PROCEDURE_SERVICE_CONFIGURATION_INVALID'); if (!refs.doctor) throw new AppError('Active procedure doctor not found in the selected branch and department', 404, 'DOCTOR_NOT_FOUND'); const win = parseScheduleWindow(data.scheduled_start, refs.service.defaultDurationMinutes); await this.validateSchedule(refs.doctor._id.toString(), win, refs.service._id.toString(), refs.service.bookingCapacity, undefined, session); result = await this.repository.createBooking(data, recommendation, { doctorName: refs.doctor.displayName, duration: refs.service.defaultDurationMinutes }, actor, session); const consumed = await this.repository.markRecommendationBooked(data.recommendation_id, result.id, actor, session); if (!consumed) throw new AppError('Recommendation was booked by another request', 409, 'PROCEDURE_RECOMMENDATION_STATE_CONFLICT'); await this.patients.addProcedureTimeline(recommendation.patientId.toString(), 'PROCEDURE_BOOKING_CREATED', 'Procedure booking created', `${result.booking_number} is pending confirmation for ${result.service_name}.`, actor, session); await this.repository.audit('surgery.booking.created', actor, metadata, { bookingId: result.id, recommendationId: data.recommendation_id, patientId: recommendation.patientId.toString(), branchId: data.branch_id, scheduledStart: win.startDate, scheduledEnd: win.endDate }, session); }); if (!result) throw new AppError('Procedure booking could not be created', 500, 'PROCEDURE_BOOKING_CREATE_FAILED'); return result; } catch (error) { return duplicate(error); } finally { await session.endSession(); } }

  async confirmBooking(id: string, branchId: string, data: ConfirmProcedureBookingDTO, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, branchId); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const booking = await this.requireBookingRecord(id, branchId, session, 'PENDING_CONFIRMATION'); const recommendation = await this.repository.getRecommendation(booking.recommendationId.toString(), branchId, session); const refs = await this.repository.bookingReferences(bookingRecommendation(booking), booking.doctorId.toString(), session); if (!recommendation || !refs.service || !refs.service.bookingCapacity) throw new AppError('Procedure booking context is no longer active', 409, 'PROCEDURE_BOOKING_CONTEXT_INVALID'); const win = parseScheduleWindow(booking.scheduledStart.toISOString(), refs.service.defaultDurationMinutes ?? booking.durationMinutes); await this.validateSchedule(booking.doctorId.toString(), win, booking.serviceId.toString(), refs.service.bookingCapacity, id, session); const holdId = data.hold_id ?? booking.holdId?.toString() ?? null; if (refs.service.requiresBed && (!holdId || !await this.repository.validateHold(holdId, booking.patientId.toString(), branchId, session))) throw new AppError('An active bed hold for this patient is required', 409, 'PROCEDURE_BED_HOLD_REQUIRED'); const consentId = data.consent_document_id ?? booking.consentDocumentId?.toString() ?? null; const consent = await this.patients.verifyContextConsent(booking.patientId.toString(), consentId, 'PROCEDURE_BOOKING', id, refs.service.requiresConsent, session); const invoiceId = data.deposit_invoice_id ?? booking.depositInvoiceId?.toString() ?? null; const requiredAmount = refs.service.minimumAdvanceDepositAmount ?? 0; const deposit = refs.service.requiresAdvanceDeposit ? await this.billing.verifyProcedureDeposit(booking.patientId.toString(), branchId, id, invoiceId, requiredAmount, actor, session) : { required_amount: requiredAmount, paid_amount: 0, remaining_amount: 0, satisfied: true, invoice_id: invoiceId, payment_ids: [], verified_at: new Date() }; if (!deposit.satisfied) throw new AppError(`An advance deposit of ${requiredAmount} is required before confirmation`, 409, 'ADVANCE_DEPOSIT_REQUIRED'); const snapshot = { consent_required: refs.service.requiresConsent, consent_satisfied: !refs.service.requiresConsent || Boolean(consent), consent_document_id: consent?.id ?? null, deposit_required: refs.service.requiresAdvanceDeposit, deposit_satisfied: deposit.satisfied, deposit_required_amount: deposit.required_amount, deposit_paid_amount: deposit.paid_amount, deposit_invoice_id: deposit.invoice_id, deposit_payment_ids: deposit.payment_ids, bed_required: refs.service.requiresBed, bed_hold_id: holdId, verified_at: new Date() }; result = await this.repository.confirmBooking(id, branchId, { holdId, consentId, invoiceId, snapshot }, actor, session); if (!result) throw new AppError('Booking changed before confirmation', 409, 'PROCEDURE_BOOKING_STATE_CONFLICT'); await this.patients.addProcedureTimeline(booking.patientId.toString(), 'PROCEDURE_BOOKING_CONFIRMED', 'Procedure booking confirmed', `${booking.bookingNumber} was confirmed for ${booking.scheduledStart.toISOString()}.`, actor, session); await this.repository.audit('surgery.booking.confirmed', actor, metadata, { bookingId: id, patientId: booking.patientId.toString(), branchId, prerequisiteSnapshot: snapshot }, session); }); return result; } finally { await session.endSession(); } }

  async rescheduleBooking(id: string, branchId: string, data: RescheduleProcedureBookingDTO, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, branchId); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const booking = await this.requireBookingRecord(id, branchId, session, 'BOOKED'); const doctorId = data.doctor_id ?? booking.doctorId.toString(); const refs = await this.repository.bookingReferences(bookingRecommendation(booking), doctorId, session); if (!refs.service || !refs.service.bookingCapacity || !refs.doctor) throw new AppError('Procedure booking context is no longer active', 409, 'PROCEDURE_BOOKING_CONTEXT_INVALID'); const win = parseScheduleWindow(data.scheduled_start, booking.durationMinutes); await this.validateSchedule(doctorId, win, booking.serviceId.toString(), refs.service.bookingCapacity, id, session); const holdId = data.hold_id ?? booking.holdId?.toString() ?? null; if (refs.service.requiresBed && (!holdId || !await this.repository.validateHold(holdId, booking.patientId.toString(), branchId, session))) throw new AppError('An active bed hold for this patient is required', 409, 'PROCEDURE_BED_HOLD_REQUIRED'); await this.patients.verifyContextConsent(booking.patientId.toString(), data.consent_document_id ?? booking.consentDocumentId?.toString() ?? null, 'PROCEDURE_BOOKING', id, refs.service.requiresConsent, session); const invoiceId = data.deposit_invoice_id ?? booking.depositInvoiceId?.toString() ?? null; if (refs.service.requiresAdvanceDeposit) { const deposit = await this.billing.verifyProcedureDeposit(booking.patientId.toString(), branchId, id, invoiceId, refs.service.minimumAdvanceDepositAmount ?? 0, actor, session); if (!deposit.satisfied) throw new AppError('Advance deposit prerequisite is no longer satisfied', 409, 'ADVANCE_DEPOSIT_REQUIRED'); } result = await this.repository.rescheduleBooking(booking, win.startDate, win.endDate, doctorId, refs.doctor.displayName, data.reason, holdId, actor, session); if (!result) throw new AppError('Booking changed before reschedule', 409, 'PROCEDURE_BOOKING_STATE_CONFLICT'); await this.patients.addProcedureTimeline(booking.patientId.toString(), 'PROCEDURE_BOOKING_RESCHEDULED', 'Procedure booking rescheduled', `${booking.bookingNumber} was rescheduled: ${data.reason}`, actor, session); await this.repository.audit('surgery.booking.rescheduled', actor, metadata, { bookingId: id, patientId: booking.patientId.toString(), branchId, previousStart: booking.scheduledStart, newStart: win.startDate, previousDoctorId: booking.doctorId.toString(), newDoctorId: doctorId, reason: data.reason }, session); }); return result; } finally { await session.endSession(); } }

  async cancelBooking(id: string, branchId: string, data: ReasonDTO, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, branchId); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const booking = await this.requireBookingRecord(id, branchId, session, ['PENDING_CONFIRMATION', 'BOOKED']); if (booking.holdId) await this.beds.cancelAdmissionRequestHold(booking.holdId.toString(), branchId, data.reason, actor, metadata, session); result = await this.repository.cancelBooking(id, branchId, data.reason, actor, session); if (!result) throw new AppError('Booking changed before cancellation', 409, 'PROCEDURE_BOOKING_STATE_CONFLICT'); await this.patients.addProcedureTimeline(booking.patientId.toString(), 'PROCEDURE_BOOKING_CANCELLED', 'Procedure booking cancelled', `${booking.bookingNumber} was cancelled: ${data.reason}`, actor, session); await this.repository.audit('surgery.booking.cancelled', actor, metadata, { bookingId: id, patientId: booking.patientId.toString(), branchId, reason: data.reason, releasedHoldId: booking.holdId?.toString() ?? null }, session); }); return result; } finally { await session.endSession(); } }

  async completeBooking(id: string, branchId: string, actor: string, metadata: SurgeryMetadata) { await this.authorize(actor, branchId); const session = await this.repository.session(); try { let result; await session.withTransaction(async () => { const booking = await this.requireBookingRecord(id, branchId, session, 'BOOKED'); result = await this.repository.completeBooking(id, branchId, actor, session); if (!result) throw new AppError('Only a started booked procedure can be completed', 409, 'PROCEDURE_BOOKING_NOT_COMPLETABLE'); await this.patients.addProcedureTimeline(booking.patientId.toString(), 'PROCEDURE_BOOKING_COMPLETED', 'Procedure booking completed', `${booking.bookingNumber} was marked completed.`, actor, session); await this.repository.audit('surgery.booking.completed', actor, metadata, { bookingId: id, patientId: booking.patientId.toString(), branchId }, session); }); return result; } finally { await session.endSession(); } }

  async getRecommendedDoctorSlots(doctorId: string, dateStr: string, durationMinutes: number, session?: import('mongoose').ClientSession) {
    try {
      const win = parseScheduleWindow(dateStr, durationMinutes);
      const doctor = await this.doctors.getById(doctorId);
      if (!doctor || doctor.status !== 'ACTIVE') return [];

      const now = new Date();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // If the selected date is in the past, do not return any recommended slots
      if (win.dateString < todayDateStr) {
        return [];
      }

      const isToday = win.dateString === todayDateStr;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (await this.doctors.hasActiveLeave(doctor.id, win.dateOnly)) return [];

      const exception = await this.doctors.getExceptionByDate(doctor.id, win.dateOnly);
      const recurring = doctor.availability.find((row) => row.day_of_week === win.dayName);
      const availability = exception ? { is_available: exception.is_available, working_blocks: exception.working_blocks } : recurring;
      if (!availability?.is_available || !availability.working_blocks?.length) return [];

      const appointments = await this.repository.listDoctorAppointments(doctorId, win.dateOnly, session);
      const surgeries = await this.repository.listDoctorSurgeries(doctorId, win.dateOnly, session);

      const minStartMinutes = isToday ? Math.max(win.startMinutes, currentMinutes) : win.startMinutes;
      const allSlots: Array<{ start_time: string; end_time: string; label: string; formatted: string }> = [];

      for (const block of availability.working_blocks) {
        const bStart = toMinutes(block.start_time);
        const bEnd = toMinutes(block.end_time);

        for (let current = bStart; current + durationMinutes <= bEnd; current += 30) {
          // If the date is today, skip time slots that have already passed in real-time
          if (isToday && current <= currentMinutes) {
            continue;
          }

          const slotEnd = current + durationMinutes;
          const sStartStr = toTimeString(current);
          const sEndStr = toTimeString(slotEnd);

          const hasAppt = appointments.some((a) => a.startTime < sEndStr && a.endTime > sStartStr);
          if (hasAppt) continue;

          const hasSurg = surgeries.some((s) => {
            const sHour = s.scheduledStart.getUTCHours();
            const sMin = s.scheduledStart.getUTCMinutes();
            const sEndHour = s.scheduledEnd.getUTCHours();
            const sEndMin = s.scheduledEnd.getUTCMinutes();
            const surgStartStr = `${String(sHour).padStart(2, '0')}:${String(sMin).padStart(2, '0')}`;
            const surgEndStr = `${String(sEndHour).padStart(2, '0')}:${String(sEndMin).padStart(2, '0')}`;
            return surgStartStr < sEndStr && surgEndStr > sStartStr;
          });
          if (hasSurg) continue;

          allSlots.push({
            start_time: sStartStr,
            end_time: sEndStr,
            label: formatTime12h(sStartStr),
            formatted: `${formatTime12h(sStartStr)} – ${formatTime12h(sEndStr)}`,
          });
        }
      }

      // Filter slots starting from the selected time onwards (excluding past time slots)
      const upcomingFromSelected = allSlots.filter((slot) => toMinutes(slot.start_time) >= minStartMinutes);
      return upcomingFromSelected.length > 0 ? upcomingFromSelected : allSlots;
    } catch {
      return [];
    }
  }

  async alternatives(branchId: string, departmentId: string, serviceId: string, scheduledStart: string, actor: string, doctorId?: string) {
    await this.authorize(actor, branchId);
    const service = await this.repository.getProcedureService(serviceId);
    if (!service || service.departmentId.toString() !== departmentId || !service.defaultDurationMinutes || !service.bookingCapacity) {
      throw new AppError('Active procedure service not found', 404, 'PROCEDURE_SERVICE_NOT_FOUND');
    }

    const duration = service.defaultDurationMinutes;
    const win = parseScheduleWindow(scheduledStart, duration);
    const doctors = await this.doctors.list({ branch_id: branchId, department_id: departmentId, status: 'ACTIVE', page: 1, limit: 100 });

    const available: Array<{ doctor_id: string; doctor_name: string }> = [];
    for (const doc of doctors.data) {
      try {
        await this.validateSchedule(doc.id, win, serviceId, service.bookingCapacity);
        available.push({ doctor_id: doc.id, doctor_name: doc.display_name });
      } catch {
        // Not available for this slot
      }
    }

    let recommendedSlots: Array<{ start_time: string; end_time: string; label: string; formatted: string }> = [];
    const targetDocId = doctorId || available[0]?.doctor_id || doctors.data[0]?.id;
    if (targetDocId) {
      recommendedSlots = await this.getRecommendedDoctorSlots(targetDocId, scheduledStart, duration);
    }

    return {
      available_doctors: available,
      recommended_slots: recommendedSlots,
    };
  }

  private async validateSchedule(doctorId: string, win: ReturnType<typeof parseScheduleWindow>, serviceId: string, capacity: number, excludeId?: string, session?: import('mongoose').ClientSession) {
    if (win.startMinutes < 0 || win.endMinutes > 24 * 60) {
      throw new AppError('Procedure cannot cross midnight', 400, 'INVALID_PROCEDURE_SCHEDULE');
    }

    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (win.dateString < todayDateStr || (win.dateString === todayDateStr && win.startMinutes < currentMinutes - 2)) {
      throw new AppError('Cannot schedule a procedure in the past', 400, 'PROCEDURE_SCHEDULE_IN_PAST');
    }

    const doctor = await this.doctors.getById(doctorId);
    if (!doctor || doctor.status !== 'ACTIVE') throw new AppError('Active doctor not found', 404, 'DOCTOR_NOT_FOUND');

    await this.validateDoctorAvailability(doctor, win);

    if (await this.repository.hasAppointmentOverlap(doctorId, win.dateOnly, win.startTime, win.endTime, session)) {
      throw new AppError(`Doctor has an overlapping patient appointment between ${formatTime12h(win.startTime)} and ${formatTime12h(win.endTime)}`, 409, 'DOCTOR_APPOINTMENT_CONFLICT');
    }
    if (await this.repository.hasDoctorOverlap(doctorId, win.startDate, win.endDate, excludeId, session)) {
      throw new AppError('Doctor has an overlapping procedure booking', 409, 'DOCTOR_PROCEDURE_CONFLICT');
    }
    if (await this.repository.countServiceOverlap(serviceId, win.startDate, win.endDate, excludeId, session) >= capacity) {
      throw new AppError('Procedure service capacity is full for the selected interval', 409, 'PROCEDURE_CAPACITY_CONFLICT');
    }
  }

  private async validateDoctorAvailability(doctor: Doctor, win: ReturnType<typeof parseScheduleWindow>) {
    if (await this.doctors.hasActiveLeave(doctor.id, win.dateOnly)) {
      throw new AppError('Doctor is on leave on this date', 409, 'DOCTOR_ON_LEAVE');
    }
    const exception = await this.doctors.getExceptionByDate(doctor.id, win.dateOnly);
    const recurring = doctor.availability.find((row) => row.day_of_week === win.dayName);
    const availability = exception ? { is_available: exception.is_available, working_blocks: exception.working_blocks } : recurring;

    if (!availability?.is_available || !availability.working_blocks?.length) {
      throw new AppError(`Doctor is not scheduled on ${win.dayName}`, 409, 'DOCTOR_NOT_AVAILABLE');
    }

    const matchesBlock = availability.working_blocks.some((block) => {
      const bStart = toMinutes(block.start_time);
      const bEnd = toMinutes(block.end_time);
      return win.startMinutes >= bStart && win.endMinutes <= bEnd;
    });

    if (!matchesBlock) {
      const blocksText = availability.working_blocks.map((b) => `${formatTime12h(b.start_time)} - ${formatTime12h(b.end_time)}`).join(', ');
      throw new AppError(`Doctor is unavailable at ${formatTime12h(win.startTime)}. Working hours on ${win.dayName}: ${blocksText}`, 409, 'DOCTOR_NOT_AVAILABLE');
    }
  }

  private async requireBookingRecord(id: string, branchId: string, session: import('mongoose').ClientSession, status: string | string[]) { const booking = await this.repository.getBookingRecord(id, branchId, session); const statuses = Array.isArray(status) ? status : [status]; if (!booking || !statuses.includes(booking.status)) throw new AppError('Procedure booking is not in the required state', 409, 'PROCEDURE_BOOKING_STATE_CONFLICT'); return booking; }
}

const bookingRecommendation = (booking: BookingLean): RecommendationLean => ({ _id: booking.recommendationId, recommendationNumber: '', patientId: booking.patientId, patientNumber: booking.patientNumber, patientName: booking.patientName, branchId: booking.branchId, departmentId: booking.departmentId, departmentName: booking.departmentName, recommendingDoctorId: booking.doctorId, recommendingDoctorName: booking.doctorName, serviceId: booking.serviceId, serviceName: booking.serviceName, encounterType: 'OPD_VISIT', encounterId: booking.recommendationId, clinicalReason: '', status: 'BOOKED', createdBy: booking.createdBy, updatedBy: booking.updatedBy, createdAt: booking.createdAt, updatedAt: booking.updatedAt });
