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
import { getToothName } from '../../../pages/dental-utils';
import styles from './DentalStageScheduleModal.module.css';

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

function formatDoctorName(name: string | undefined | null): string {
  if (!name) return '';
  const clean = name.replace(/^Dr\.?\s+/i, '').trim();
  return clean ? `Dr. ${clean}` : '';
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSlotEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  const [hStr, mStr] = startTime.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const totalM = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalM / 60) % 24;
  const endM = totalM % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

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

  // Lock background scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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

  const availableSlotsCount = useMemo(() => {
    return filteredSlots.filter((s) => s.available !== false && s.is_available !== false).length;
  }, [filteredSlots]);

  const selectedDoctorName = useMemo(() => {
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    if (doc) return doc.display_name || `${doc.first_name} ${doc.last_name}`.trim();
    return stage.assigned_doctor_name;
  }, [doctors, selectedDoctorId, stage.assigned_doctor_name]);

  const toothName = useMemo(() => {
    return stage.tooth_number ? getToothName(stage.tooth_number) : null;
  }, [stage.tooth_number]);

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
        notes: reason || null,
      };
      scheduleMutation.mutate(
        { stageId: stage.id, payload },
        { onSuccess: () => onClose() },
      );
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={isReschedule ? 'Reschedule Stage Appointment' : 'Schedule Stage Appointment'}
    >
      <div className={styles.modalCard}>
        {/* 1. Fixed Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h3 className={styles.modalTitle}>
              <i className={`ph ${isReschedule ? 'ph-calendar-x' : 'ph-calendar-plus'}`} />
              {isReschedule ? 'Reschedule' : 'Schedule'} Appointment
            </h3>
            <p className={styles.modalSubtitle}>
              {isReschedule
                ? 'Reschedule the stage appointment with an available doctor.'
                : 'Schedule the selected treatment stage with an available doctor.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Form enclosing scrollable Body and fixed Footer */}
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {/* 2. Scrollable Body */}
          <div className={styles.modalBody}>
            {/* Treatment Stage Context Card */}
            <div className={styles.stageContextCard}>
              <div className={styles.stageContextTop}>
                <span className={styles.stageContextTag}>TREATMENT STAGE</span>
                <span className={styles.stageBadge}>STAGE {stage.sequence}</span>
              </div>
              <div className={styles.stageContextNameRow}>
                <h4 className={styles.stageName}>{stage.stage_name}</h4>
                {stage.tooth_number ? (
                  <span className={styles.stageTooth}>
                    Tooth #{stage.tooth_number}{toothName ? ` · ${toothName}` : ''}
                  </span>
                ) : null}
              </div>
              <div className={styles.stageDoctorRow}>
                <i className="ph ph-stethoscope" />
                <span>{formatDoctorName(selectedDoctorName)}</span>
              </div>
            </div>

            {/* Doctor Selection (if multiple doctors available) */}
            {doctors.length > 1 && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Assigned Doctor <span className={styles.req}>*</span>
                </label>
                <select
                  className={styles.selectInput}
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {formatDoctorName(doc.display_name || `${doc.first_name} ${doc.last_name}`.trim())} ({doc.specialization || 'Dental'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Appointment Date & Duration Grid */}
            <div className={styles.detailsGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Appointment Date <span className={styles.req}>*</span>
                </label>
                <input
                  type="date"
                  className={styles.textInput}
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Procedure Duration <span className={styles.req}>*</span>
                </label>
                <select
                  className={styles.selectInput}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  {[15, 20, 30, 45, 60, 75, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Preference Segmented Control */}
            <div className={styles.preferenceSection}>
              <span className={styles.sectionLabel}>Time Preference</span>
              <div className={styles.segmentedControl}>
                {(['ALL', 'MORNING', 'AFTERNOON', 'EVENING'] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setTimePreference(pref)}
                    className={`${styles.segmentedBtn} ${
                      timePreference === pref ? styles.segmentedBtnActive : ''
                    }`}
                  >
                    {pref === 'ALL' ? 'All' : pref.charAt(0) + pref.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Time Slots Section */}
            <div className={styles.slotsContainer}>
              <div className={styles.slotsHeader}>
                <span className={styles.slotsTitle}>Available Time Slots</span>
                {slotsData?.is_available && !slotsLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={styles.slotsSubtitle}>{formatLongDate(date)}</span>
                    <span className={styles.slotsCountBadge}>{availableSlotsCount} slots</span>
                  </div>
                )}
              </div>

              {slotsLoading && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ph ph-spinner" style={{ animation: 'spin 1s linear infinite' }} /> Loading available slots…
                </div>
              )}

              {slotsError && !slotsLoading && (
                <div style={{ fontSize: '0.8rem', color: '#dc2626', padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
                  <i className="ph ph-warning-circle" style={{ marginRight: 4 }} /> {slotsError}
                </div>
              )}

              {slotsData && !slotsLoading && (
                <>
                  {!slotsData.is_available && (
                    <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px' }}>
                      <i className="ph ph-warning" style={{ marginRight: 4 }} /> Doctor unavailable on this date
                      {slotsData.unavailable_reason ? `: ${slotsData.unavailable_reason}` : ''}
                    </div>
                  )}

                  {slotsData.is_available && filteredSlots.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 0' }}>
                      {slotsData.slots.length > 0
                        ? 'No slots match the selected time preference.'
                        : 'No available slots for this date and duration.'}
                    </div>
                  )}

                  {filteredSlots.length > 0 && (
                    <div className={styles.slotsGrid}>
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
                            className={`${styles.slotBtn} ${
                              isSelected ? styles.slotBtnSelected : ''
                            } ${!isAvailable ? styles.slotBtnDisabled : ''}`}
                          >
                            <div className={styles.slotTimeRange}>
                              {isSelected && <span className={styles.slotCheckmark}>✓</span>}
                              <span>{slot.start_time} – {slot.end_time}</span>
                            </div>
                            {isPatientConflict ? (
                              <span className={styles.slotConflictBadge}>
                                Patient Conflict
                              </span>
                            ) : !isAvailable && slot.reason ? (
                              <span className={styles.slotReasonBadge}>
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

              {/* Selected Slot Confirmation Bar */}
              {selectedSlot && (
                <div className={styles.selectedSlotNotice}>
                  <i className="ph ph-check-circle" />
                  <span>
                    Selected appointment: <strong>{formatShortDate(date)} · {selectedSlot} – {formatSlotEndTime(selectedSlot, durationMinutes)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Appointment Notes / Reason */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                {isReschedule ? 'Reschedule Reason' : 'Appointment Notes'}
              </label>
              <textarea
                rows={2}
                className={styles.textareaInput}
                placeholder={
                  isReschedule
                    ? 'e.g. Patient request, doctor conflict…'
                    : 'e.g. First RCT appointment, severe pain, chairside review…'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Submission Error Banner */}
            {submitErrorMessage && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#b91c1c',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className="ph ph-warning-circle" style={{ fontSize: '1rem', flexShrink: 0 }} />
                <span>{submitErrorMessage}</span>
              </div>
            )}

            {/* 3. Appointment Summary (Before Action) */}
            {selectedSlot && (
              <div className={styles.appointmentSummaryCard}>
                <div className={styles.summaryTitle}>Appointment Summary</div>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>WHAT</span>
                    <span className={styles.summaryValue}>{stage.stage_name}</span>
                  </div>
                  {stage.tooth_number ? (
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>WHERE</span>
                      <span className={styles.summaryValue}>Tooth #{stage.tooth_number}</span>
                    </div>
                  ) : null}
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>WHO</span>
                    <span className={styles.summaryValue}>{formatDoctorName(selectedDoctorName)}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>WHEN</span>
                    <span className={styles.summaryValue}>
                      {formatShortDate(date)} · {selectedSlot} – {formatSlotEndTime(selectedSlot, durationMinutes)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Fixed Footer */}
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isPending || !selectedSlot || !date}
            >
              <i className={`ph ${isReschedule ? 'ph-calendar-x' : 'ph-calendar-check'}`} />
              {isPending
                ? isReschedule
                  ? 'Rescheduling…'
                  : 'Scheduling…'
                : isReschedule
                ? 'Reschedule'
                : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
