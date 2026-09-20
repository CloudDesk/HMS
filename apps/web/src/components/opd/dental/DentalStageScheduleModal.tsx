import React, { useEffect, useMemo, useState } from 'react';
import { doctorsApi, type DoctorAvailableSlotsResponse, type DoctorResponse } from '../../../api/doctors';
import {
  useScheduleDentalStage,
  useRescheduleDentalStage,
} from '../../../hooks/opd/useOpd';
import type {
  DentalTreatmentStageResponse,
  ScheduleDentalStagePayload,
  RescheduleDentalStagePayload,
} from '../../../api/opd';
import styles from './DentalExamination.module.css';

interface DentalStageScheduleModalProps {
  stage: DentalTreatmentStageResponse;
  /** Available doctors for assignment */
  doctors?: DoctorResponse[];
  /** Pass existing appointment date+time when rescheduling */
  existingDate?: string | null;
  existingStartTime?: string | null;
  existingDurationMinutes?: number | null;
  onClose: () => void;
}

type TimePreference = 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING';

export const DentalStageScheduleModal: React.FC<DentalStageScheduleModalProps> = ({
  stage,
  doctors = [],
  existingDate,
  existingStartTime,
  existingDurationMinutes,
  onClose,
}) => {
  const isReschedule = Boolean(stage.appointment_id);

  const today = new Date().toISOString().split('T')[0] as string;
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(stage.assigned_doctor_id);
  const [date, setDate] = useState<string>(existingDate ?? today);
  const [durationMinutes, setDurationMinutes] = useState<number>(existingDurationMinutes ?? 60);
  const [selectedSlot, setSelectedSlot] = useState<string>(existingStartTime ?? '');
  const [timePreference, setTimePreference] = useState<TimePreference>('ALL');
  const [reason, setReason] = useState('');
  const [slotsData, setSlotsData] = useState<DoctorAvailableSlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const scheduleMutation = useScheduleDentalStage();
  const rescheduleMutation = useRescheduleDentalStage();

  const isPending = scheduleMutation.isPending || rescheduleMutation.isPending;

  // Fetch available slots when date, duration, or assigned doctor changes
  useEffect(() => {
    if (!date || !selectedDoctorId) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlotsData(null);
    setSelectedSlot('');

    doctorsApi
      .availableSlots(
        selectedDoctorId,
        date,
        durationMinutes,
        stage.patient_id,
        stage.appointment_id ?? undefined,
      )
      .then((data) => {
        setSlotsData(data);
        setSlotsLoading(false);
        // If rescheduling keep prior slot selected if still available
        if (
          existingStartTime &&
          data.slots.some(
            (s) =>
              s.start_time === existingStartTime &&
              (s.available !== false && s.is_available !== false),
          )
        ) {
          setSelectedSlot(existingStartTime);
        }
      })
      .catch((err: unknown) => {
        setSlotsError(err instanceof Error ? err.message : 'Failed to load available slots.');
        setSlotsLoading(false);
      });
  }, [date, durationMinutes, selectedDoctorId, stage.patient_id, stage.appointment_id, existingStartTime]);

  // Filter slots by patient time preference
  const filteredSlots = useMemo(() => {
    if (!slotsData?.slots) return [];
    if (timePreference === 'ALL') return slotsData.slots;

    return slotsData.slots.filter((slot) => {
      const hour = parseInt(slot.start_time.split(':')[0] || '0', 10);
      if (timePreference === 'MORNING') return hour < 12;
      if (timePreference === 'AFTERNOON') return hour >= 12 && hour < 17;
      if (timePreference === 'EVENING') return hour >= 17;
      return true;
    });
  }, [slotsData?.slots, timePreference]);

  const selectedDoctorName = useMemo(() => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    if (doc) return doc.display_name || `${doc.first_name} ${doc.last_name}`.trim();
    return stage.assigned_doctor_name;
  }, [doctors, selectedDoctorId, stage.assigned_doctor_name]);

  const rawSubmitError = scheduleMutation.error || rescheduleMutation.error;
  const submitErrorMessage = useMemo(() => {
    if (!rawSubmitError) return null;
    const errObj = rawSubmitError as {
      response?: { data?: { code?: string; message?: string } };
      message?: string;
    };
    const code = errObj.response?.data?.code;
    const msg = errObj.response?.data?.message || errObj.message || '';
    if (
      code === 'PATIENT_APPOINTMENT_CONFLICT' ||
      msg.includes('PATIENT_APPOINTMENT_CONFLICT') ||
      msg.toLowerCase().includes('patient already has an appointment')
    ) {
      return 'Patient has another appointment during this time. Please select another time.';
    }
    return msg || 'Failed to schedule appointment.';
  }, [rawSubmitError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    let utcDatetime: string | undefined;
    try {
      utcDatetime = new Date(`${date}T${selectedSlot}:00`).toISOString();
    } catch {
      utcDatetime = undefined;
    }

    if (isReschedule) {
      const payload: RescheduleDentalStagePayload = {
        appointment_date: date,
        start_time: selectedSlot,
        utc_datetime: utcDatetime,
        duration_minutes: durationMinutes,
        reschedule_reason: reason || null,
      };
      rescheduleMutation.mutate(
        { stageId: stage.id, payload },
        { onSuccess: () => onClose() },
      );
    } else {
      const payload: ScheduleDentalStagePayload = {
        doctor_id: selectedDoctorId !== stage.assigned_doctor_id ? selectedDoctorId : undefined,
        appointment_date: date,
        start_time: selectedSlot,
        utc_datetime: utcDatetime,
        duration_minutes: durationMinutes,
        reason: reason || null,
      };
      scheduleMutation.mutate(
        { stageId: stage.id, payload },
        { onSuccess: () => onClose() },
      );
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={isReschedule ? 'Reschedule Stage Appointment' : 'Schedule Stage Appointment'}>
      <div className={styles.modalCard} style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <i className={`ph ${isReschedule ? 'ph-calendar-x' : 'ph-calendar-plus'}`} style={{ color: '#2563eb' }} />
            {isReschedule ? 'Reschedule' : 'Schedule'} Appointment
          </h3>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Stage context */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: '0.8rem', color: '#0369a1' }}>
          <strong>Stage {stage.sequence}:</strong> {stage.stage_name}
          {stage.tooth_number ? ` (Tooth ${stage.tooth_number})` : ''} &nbsp;·&nbsp;
          <i className="ph ph-stethoscope" /> Dr. {selectedDoctorName}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Doctor Selection (if multiple doctors) */}
          {doctors.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <label className={styles.label} style={{ fontSize: '0.8rem' }}>
                Assigned Doctor <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className={styles.select}
                style={{ fontSize: '0.85rem' }}
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.display_name || `${doc.first_name} ${doc.last_name}`.trim()} ({doc.specialization || 'Dental'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Duration row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className={styles.label} style={{ fontSize: '0.8rem' }}>
                Appointment Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                className={styles.input}
                style={{ fontSize: '0.85rem' }}
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={styles.label} style={{ fontSize: '0.8rem' }}>
                Procedure Duration (min) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className={styles.select}
                style={{ fontSize: '0.85rem' }}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                {[15, 20, 30, 45, 60, 75, 90, 120].map((d) => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </div>
          </div>

          {/* Patient Time Preference Filter */}
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Time Preference
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'MORNING', 'AFTERNOON', 'EVENING'] as const).map((pref) => (
                <button
                  key={pref}
                  type="button"
                  onClick={() => setTimePreference(pref)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: timePreference === pref ? 700 : 500,
                    borderRadius: 4,
                    border: `1px solid ${timePreference === pref ? '#2563eb' : '#cbd5e1'}`,
                    background: timePreference === pref ? '#eff6ff' : '#f8fafc',
                    color: timePreference === pref ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {pref === 'ALL' ? 'All Slots' : pref.charAt(0) + pref.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Slot picker */}
          <div style={{ marginBottom: 14 }}>
            <label className={styles.label} style={{ fontSize: '0.8rem' }}>
              Available Time Slot <span style={{ color: '#dc2626' }}>*</span>
            </label>

            {slotsLoading && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
                <i className="ph ph-spinner" style={{ marginRight: 4 }} /> Loading available slots…
              </div>
            )}

            {slotsError && !slotsLoading && (
              <div style={{ fontSize: '0.8rem', color: '#dc2626', padding: '4px 0' }}>
                <i className="ph ph-warning-circle" /> {slotsError}
              </div>
            )}

            {slotsData && !slotsLoading && (
              <>
                {!slotsData.is_available && (
                  <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '6px 10px', marginBottom: 8 }}>
                    <i className="ph ph-warning" /> Doctor unavailable on this date
                    {slotsData.unavailable_reason ? `: ${slotsData.unavailable_reason}` : ''}
                  </div>
                )}

                {slotsData.is_available && filteredSlots.length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '4px 0' }}>
                    {slotsData.slots.length > 0
                      ? 'No slots match the selected time preference.'
                      : 'No available slots for this date and duration.'}
                  </div>
                )}

                {filteredSlots.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, maxHeight: 160, overflowY: 'auto', padding: 2 }}>
                    {filteredSlots.map((slot) => {
                      const isAvailable = slot.available !== false && slot.is_available !== false;
                      const isSelected = selectedSlot === slot.start_time;
                      const isPatientConflict = !isAvailable && slot.reason?.toLowerCase().includes('patient');

                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          disabled={!isAvailable}
                          title={!isAvailable ? (slot.reason || 'Unavailable') : undefined}
                          onClick={() => isAvailable && setSelectedSlot(slot.start_time)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 700 : 400,
                            border: `1.5px solid ${
                              isSelected
                                ? '#2563eb'
                                : !isAvailable
                                ? '#e2e8f0'
                                : '#cbd5e1'
                            }`,
                            borderRadius: 4,
                            background: isSelected
                              ? '#eff6ff'
                              : !isAvailable
                              ? '#f8fafc'
                              : '#fff',
                            color: isSelected
                              ? '#1d4ed8'
                              : !isAvailable
                              ? '#94a3b8'
                              : '#374151',
                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                            textDecoration: !isAvailable ? 'line-through' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: 95,
                          }}
                        >
                          <span>{slot.start_time} – {slot.end_time}</span>
                          {isPatientConflict ? (
                            <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600, textDecoration: 'none' }}>
                              Patient Conflict
                            </span>
                          ) : !isAvailable && slot.reason ? (
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', textDecoration: 'none' }}>
                              {slot.reason}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 16 }}>
            <label className={styles.label} style={{ fontSize: '0.8rem' }}>
              {isReschedule ? 'Reschedule Reason' : 'Reason / Notes'}
            </label>
            <input
              type="text"
              className={styles.input}
              style={{ fontSize: '0.85rem' }}
              placeholder={isReschedule ? 'e.g. Patient request, conflict…' : 'e.g. Root Canal Treatment — 1st appointment'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Submission Error Banner (e.g. Patient Conflict) */}
          {submitErrorMessage && (
            <div
              style={{
                fontSize: '0.8rem',
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="ph ph-warning-circle" style={{ fontSize: '1rem', flexShrink: 0 }} />
              <span>{submitErrorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={isPending}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isPending || !selectedSlot || !date}
            >
              <i className={`ph ${isReschedule ? 'ph-calendar-x' : 'ph-calendar-check'}`} />
              {isPending
                ? isReschedule ? 'Rescheduling…' : 'Scheduling…'
                : isReschedule ? 'Reschedule' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
