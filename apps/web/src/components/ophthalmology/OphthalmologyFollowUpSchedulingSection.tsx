import { useState, useMemo } from 'react';
import type { OpdVisitResponse } from '../../api/opd';

export type OphthalmologyFollowUpSchedulingProps = {
  followUp: { status?: string } | null;
  followUpDate: string;
  setFollowUpDate: (val: string) => void;
  followUpDoctorId: string;
  setFollowUpDoctorId: (val: string) => void;
  followUpStartTime: string;
  setFollowUpStartTime: (val: string) => void;
  followUpDurationMinutes: string;
  setFollowUpDurationMinutes: (val: string) => void;
  followUpReason: string;
  setFollowUpReason: (val: string) => void;
  followUpNotes: string;
  setFollowUpNotes: (val: string) => void;
  doctors: Array<{ id: string; display_name: string; specialization?: string }>;
  isVisitCompleted: boolean;
  updating: string;
  saveConsultationDraft: () => void;
  scheduleFollowUp: () => void;
  completeConsultation: () => void;
  completionBlocked?: boolean;
  visit?: OpdVisitResponse | null;
};

const STANDARD_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30',
];

const DURATION_OPTIONS = [
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '45 minutes', value: '45' },
];

function formatTime12h(time24?: string): string {
  if (!time24) return '09:00 AM';
  const parts = time24.split(':');
  const hStr = parts[0] ?? '9';
  const mStr = parts[1] ?? '0';
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return '09:00 AM';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mFmt = m < 10 ? `0${m}` : m;
  const hFmt = h12 < 10 ? `0${h12}` : h12;
  return `${hFmt}:${mFmt} ${ampm}`;
}

function formatDateDisplay(isoDateStr?: string): string {
  if (!isoDateStr) return '12 Oct 2026 (Mon)';
  const date = new Date(isoDateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '12 Oct 2026 (Mon)';
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${month} ${year} (${weekday})`;
}

export function OphthalmologyFollowUpSchedulingSection({
  followUp,
  followUpDate,
  setFollowUpDate,
  followUpDoctorId,
  setFollowUpDoctorId,
  followUpStartTime,
  setFollowUpStartTime,
  followUpDurationMinutes,
  setFollowUpDurationMinutes,
  followUpReason,
  setFollowUpReason,
  followUpNotes,
  setFollowUpNotes,
  doctors,
  isVisitCompleted,
  updating,
  saveConsultationDraft,
  scheduleFollowUp,
  completeConsultation,
  completionBlocked = false,
  visit,
}: OphthalmologyFollowUpSchedulingProps) {
  // Calendar month state
  const initialDate = useMemo(() => {
    if (followUpDate) {
      const parsed = new Date(followUpDate + 'T00:00:00');
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(2026, 9, 12); // Default Oct 2026 as per reference
  }, [followUpDate]);

  const [viewDate, setViewDate] = useState<Date>(initialDate);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth(); // 0-indexed

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateString: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isAvailable: boolean;
    }> = [];

    // Previous month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const mStr = String(prevMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateString = `${prevYear}-${mStr}-${dStr}`;
      days.push({
        dayNumber: dayNum,
        dateString,
        isCurrentMonth: false,
        isSelected: followUpDate === dateString,
        isAvailable: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateString = `${viewYear}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateString,
        isCurrentMonth: true,
        isSelected: followUpDate === dateString,
        isAvailable: true,
      });
    }

    // Next month days to fill grid (up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const mStr = String(nextMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateString = `${nextYear}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateString,
        isCurrentMonth: false,
        isSelected: followUpDate === dateString,
        isAvailable: false,
      });
    }

    return days;
  }, [viewYear, viewMonth, followUpDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: { dateString: string; isCurrentMonth: boolean }) => {
    if (followUp?.status === 'SCHEDULED' || isVisitCompleted) return;
    setFollowUpDate(day.dateString);
    if (!day.isCurrentMonth) {
      const parts = day.dateString.split('-').map(Number);
      const y = parts[0] ?? 2026;
      const m = parts[1] ?? 10;
      setViewDate(new Date(y, m - 1, 1));
    }
  };

  // Selected doctor
  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d.id === followUpDoctorId) || doctors[0];
  }, [doctors, followUpDoctorId]);

  const doctorDisplayName = selectedDoctor?.display_name || visit?.doctor_name || 'Dr. Aravind';
  const doctorSpecialization = selectedDoctor?.specialization || 'Ophthalmologist';

  const isScheduled = followUp?.status === 'SCHEDULED';
  const isBusy = updating === 'follow-up-draft' || updating === 'follow-up-schedule' || updating === 'consultation-complete';

  return (
    <article className="oph-followup-main-card">
      {/* Header */}
      <div className="oph-followup-header">
        <div className="oph-followup-icon-box">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div>
          <h3 className="oph-followup-title">Follow-up Schedule</h3>
          <p className="oph-followup-subtitle">Book next review date and doctor assignment</p>
        </div>
      </div>

      {/* 3-Region Desktop Arrangement */}
      <div className="oph-followup-grid">
        {/* Left Column: Select Date - Calendar (34%) */}
        <section className="oph-calendar-card">
          <h4 className="oph-calendar-title">Select Date</h4>

          {/* Month / Year header with navigation */}
          <div className="oph-calendar-nav-row">
            <span className="oph-calendar-month-name">{monthName}</span>
            <div className="oph-calendar-nav-btns">
              <button
                type="button"
                className="oph-calendar-chevron-btn"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                ‹
              </button>
              <button
                type="button"
                className="oph-calendar-chevron-btn"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="oph-calendar-weekdays">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days grid */}
          <div className="oph-calendar-days-grid">
            {calendarDays.map((d, index) => {
              const cellClasses = [
                'oph-calendar-day-cell',
                d.isCurrentMonth ? 'current-month' : 'other-month',
                d.isSelected ? 'selected' : '',
                d.isAvailable && !d.isSelected ? 'available' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={`${d.dateString}-${index}`}
                  type="button"
                  className={cellClasses}
                  disabled={isScheduled || isVisitCompleted}
                  onClick={() => handleSelectDay(d)}
                >
                  {d.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="oph-calendar-legend">
            <div className="oph-legend-item">
              <span className="oph-legend-dot available" />
              <span>Available</span>
            </div>
            <div className="oph-legend-item">
              <span className="oph-legend-dot unavailable" />
              <span>Unavailable</span>
            </div>
            <div className="oph-legend-item">
              <span className="oph-legend-dot selected" />
              <span>Selected</span>
            </div>
          </div>
        </section>

        {/* Center Column: Doctor, Start Time, Duration (32%) */}
        <section className="oph-scheduling-center">
          {/* Doctor Selection */}
          <div className="oph-field-group">
            <label className="oph-field-label" htmlFor="oph-fu-doctor">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Doctor</span>
              <span className="oph-required-star">*</span>
            </label>

            <div className="oph-doctor-select-wrapper">
              <div className="oph-doctor-display-card">
                <div className="oph-doctor-avatar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="oph-doctor-info">
                  <span className="oph-doctor-name">{doctorDisplayName}</span>
                  <span className="oph-doctor-role">{doctorSpecialization}</span>
                </div>
                <div className="oph-doctor-chevron">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Native select accessible overlay */}
              <select
                id="oph-fu-doctor"
                className="oph-doctor-native-select"
                disabled={isScheduled || isVisitCompleted}
                value={followUpDoctorId}
                onChange={(e) => setFollowUpDoctorId(e.target.value)}
              >
                <option value="">Select Doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_name} - {d.specialization || 'Ophthalmologist'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Time Selection */}
          <div className="oph-field-group">
            <label className="oph-field-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Start Time</span>
              <span className="oph-required-star">*</span>
            </label>

            <div className="oph-time-slots-grid">
              {STANDARD_TIME_SLOTS.map((slot) => {
                const isSelected = followUpStartTime === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`oph-time-slot-btn ${isSelected ? 'selected' : ''}`}
                    disabled={isScheduled || isVisitCompleted}
                    onClick={() => setFollowUpStartTime(slot)}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="oph-field-group">
            <label className="oph-field-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Duration</span>
              <span className="oph-required-star">*</span>
            </label>

            <div className="oph-duration-row">
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = followUpDurationMinutes === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`oph-duration-btn ${isSelected ? 'selected' : ''}`}
                    disabled={isScheduled || isVisitCompleted}
                    onClick={() => setFollowUpDurationMinutes(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Column: Follow-up Details (34%) */}
        <section className="oph-followup-details-card">
          <div className="oph-details-head">
            <div className="oph-details-icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h4 className="oph-details-title">Follow-up Details</h4>
          </div>

          {/* Info Rows */}
          <div className="oph-details-rows">
            <div className="oph-detail-row">
              <div className="oph-detail-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Follow-up Date</span>
              </div>
              <div className="oph-detail-val">{formatDateDisplay(followUpDate)}</div>
            </div>

            <div className="oph-detail-row">
              <div className="oph-detail-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Start Time</span>
              </div>
              <div className="oph-detail-val">{formatTime12h(followUpStartTime)}</div>
            </div>

            <div className="oph-detail-row">
              <div className="oph-detail-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <path d="M5 22h14" />
                  <path d="M5 2h14" />
                  <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                  <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                </svg>
                <span>Duration</span>
              </div>
              <div className="oph-detail-val">{followUpDurationMinutes} minutes</div>
            </div>

            <div className="oph-detail-row">
              <div className="oph-detail-left">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Doctor</span>
              </div>
              <div className="oph-detail-val" style={{ textAlign: 'right' }}>
                <div>{doctorDisplayName}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{doctorSpecialization}</div>
              </div>
            </div>
          </div>

          {/* Purpose Field */}
          <div className="oph-purpose-section">
            <label className="oph-purpose-label" htmlFor="oph-fu-purpose">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Purpose</span>
            </label>
            <div className="oph-textarea-wrapper">
              <textarea
                id="oph-fu-purpose"
                className="oph-purpose-textarea"
                rows={3}
                maxLength={500}
                placeholder="e.g. Review vision, check IOP, assess response to treatment..."
                value={followUpReason}
                disabled={isScheduled || isVisitCompleted}
                onChange={(e) => setFollowUpReason(e.target.value)}
              />
              <span className="oph-char-counter">{followUpReason.length}/500</span>
            </div>
          </div>
        </section>
      </div>

      {/* Patient Instruction (Optional) Full-Width Section */}
      <section className="oph-patient-instruction-section">
        <div className="oph-instruction-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="oph-instruction-title">Patient Instruction (Optional)</span>
        </div>

        <div className="oph-instruction-right">
          <div className="oph-textarea-wrapper">
            <textarea
              className="oph-instruction-textarea"
              rows={2}
              maxLength={500}
              placeholder="e.g. Bring previous glasses, avoid contact lenses, follow medication as advised..."
              value={followUpNotes}
              disabled={isScheduled || isVisitCompleted}
              onChange={(e) => setFollowUpNotes(e.target.value)}
            />
            <span className="oph-char-counter">{followUpNotes.length}/500</span>
          </div>
        </div>
      </section>

      {/* Footer Action Bar */}
      <div className="oph-followup-footer">
        <div className="oph-footer-autosave">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Changes will be saved automatically</span>
        </div>

        <div className="oph-footer-actions">
          <button
            type="button"
            className="oph-btn-save-draft"
            disabled={isVisitCompleted || isBusy}
            onClick={saveConsultationDraft}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>Save Draft</span>
          </button>

          {isScheduled ? (
            <span className="oph-badge oph-badge-green" style={{ padding: '8px 16px', fontSize: '0.84rem' }}>
              ✓ Follow-up Scheduled
            </span>
          ) : (
            <button
              type="button"
              className="oph-btn-complete-consultation"
              disabled={(!isVisitCompleted && completionBlocked) || isBusy || !followUpDate || !followUpDoctorId}
              onClick={isVisitCompleted ? scheduleFollowUp : completeConsultation}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="16 10 11 15 8 12" />
              </svg>
              <span>{isVisitCompleted ? 'Schedule Follow-up' : 'Complete Consultation'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
