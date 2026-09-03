export function DoctorAvailabilityChecker({
  watchedStart,
  selectedDoctorId,
  durationMinutes = 60,
  departmentName = 'Department',
  doctors = [],
  alternatives = [],
  recommendedSlots = [],
  isLoading = false,
  onSelectDoctor,
  onSelectSlot,
}: {
  watchedStart?: string;
  selectedDoctorId?: string;
  durationMinutes?: number;
  departmentName?: string;
  doctors: Array<{ id: string; display_name: string }>;
  alternatives: Array<{ doctor_id: string; doctor_name: string }>;
  recommendedSlots?: Array<{ start_time: string; end_time: string; label: string; formatted: string }>;
  isLoading: boolean;
  onSelectDoctor: (doctorId: string) => void;
  onSelectSlot?: (timeStr: string) => void;
}) {
  if (!watchedStart) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '0.8rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <i className="ph ph-calendar-blank" style={{ fontSize: '1.1rem', color: '#94a3b8' }} />
        <span>
          Select a start date &amp; time above to verify doctor shift availability, clinic schedules, and theater capacity.
        </span>
      </div>
    );
  }

  const startDate = new Date(watchedStart);
  const isValidDate = !isNaN(startDate.getTime());
  if (!isValidDate) return null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedDateStr = watchedStart.slice(0, 10);
  const isDateInPast = selectedDateStr < todayStr;
  const isTodayDate = selectedDateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isPastTime =
    isDateInPast ||
    (isTodayDate && startDate.getHours() * 60 + startDate.getMinutes() < currentMinutes - 2);

  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const formattedDate = startDate.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedStartTime = startDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedEndTime = endDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const isSelectedAvailable =
    selectedDoctorId && !isPastTime
      ? alternatives.some((a) => a.doctor_id === selectedDoctorId)
      : false;
  const otherAlternatives = alternatives.filter((a) => a.doctor_id !== selectedDoctorId);

  // Filter out any recommended slot that is prior to the selected start time or in the past
  const selectedMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const minRequiredMinutes = isTodayDate
    ? Math.max(selectedMinutes, currentMinutes)
    : selectedMinutes;

  const validRecommendedSlots = isDateInPast
    ? []
    : recommendedSlots.filter((slot) => {
        const parts = slot.start_time.split(':').map(Number);
        const slotMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
        return slotMinutes >= minRequiredMinutes;
      });

  const fallbackSlots = isDateInPast
    ? []
    : recommendedSlots.filter((slot) => {
        if (!isTodayDate) return true;
        const parts = slot.start_time.split(':').map(Number);
        const slotMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
        return slotMinutes > currentMinutes;
      });

  const slotsToDisplay =
    validRecommendedSlots.length > 0 ? validRecommendedSlots : fallbackSlots;

  return (
    <div
      style={{
        background: isLoading
          ? '#f8fafc'
          : selectedDoctor
            ? isSelectedAvailable
              ? '#f0fdf4'
              : '#fef2f2'
            : '#f0f9ff',
        border: `1px solid ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#86efac' : '#fca5a5') : '#bae6fd'}`,
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          borderBottom: `1px solid ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#dcfce7' : '#fee2e2') : '#e0f2fe'}`,
          paddingBottom: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          <i className="ph ph-clock" style={{ color: '#0284c7' }} />
          <span>Scheduled Window:</span>
          <span style={{ color: '#0f172a' }}>
            {formattedDate} · {formattedStartTime} – {formattedEndTime}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '2px 8px',
            color: '#475569',
            fontWeight: 600,
          }}
        >
          {durationMinutes} mins duration
        </span>
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            color: '#64748b',
            padding: '4px 0',
          }}
        >
          <i className="ph ph-spinner ph-spin" style={{ color: '#0284c7' }} />
          <span>Checking doctor shifts, leave records, and clinic appointment overlaps...</span>
        </div>
      ) : isPastTime ? (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#b91c1c',
              marginBottom: '4px',
            }}
          >
            <i className="ph-fill ph-warning-circle" style={{ fontSize: '1.05rem', color: '#dc2626' }} />
            <span>Selected Date &amp; Time is in the Past</span>
          </div>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#991b1b' }}>
            Procedures cannot be scheduled or recommended for past dates or elapsed time slots. Please select a future date and time.
          </p>
        </div>
      ) : selectedDoctor ? (
        isSelectedAvailable ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#15803d',
                marginBottom: '4px',
              }}
            >
              <i className="ph-fill ph-check-circle" style={{ fontSize: '1.05rem', color: '#16a34a' }} />
              <span>{selectedDoctor.display_name} is Available &amp; Confirmed</span>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#166534' }}>
              Doctor is on duty with zero overlapping OPD clinic appointments or surgery bookings for this entire interval.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '6px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <i className="ph ph-calendar-check" /> Shift On-Duty
              </div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <i className="ph ph-user-check" /> No Active Leave
              </div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <i className="ph ph-check" /> 0 Clinic Clashes
              </div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <i className="ph ph-hospital" /> Theater Ready
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#b91c1c',
                marginBottom: '4px',
              }}
            >
              <i className="ph-fill ph-warning-circle" style={{ fontSize: '1.05rem', color: '#dc2626' }} />
              <span>{selectedDoctor.display_name} is UNAVAILABLE for this Slot</span>
            </div>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#991b1b' }}>
              This doctor is outside their configured working shift, on approved leave, or has an overlapping OPD appointment / surgery during this interval.
            </p>
            {otherAlternatives.length > 0 ? (
              <div style={{ marginTop: '6px' }}>
                <span
                  style={{
                    fontSize: '0.73rem',
                    fontWeight: 600,
                    color: '#7f1d1d',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Available alternative surgeons in {departmentName}:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {otherAlternatives.map((alt) => (
                    <button
                      key={alt.doctor_id}
                      type="button"
                      onClick={() => onSelectDoctor(alt.doctor_id)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.74rem',
                        color: '#991b1b',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="ph ph-user-plus" /> Switch to {alt.doctor_name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.73rem', color: '#991b1b', fontStyle: 'italic' }}>
                No other surgeons in {departmentName} are available for this specific slot. Please select a different date or time.
              </div>
            )}
          </div>
        )
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#0369a1',
              marginBottom: '4px',
            }}
          >
            <i className="ph ph-users" />
            <span>Surgeon Availability in {departmentName}:</span>
          </div>
          {alternatives.length > 0 ? (
            <div>
              <span
                style={{
                  fontSize: '0.74rem',
                  color: '#0284c7',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                {alternatives.length} surgeon{alternatives.length > 1 ? 's are' : ' is'} free for this interval. Click to assign:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {alternatives.map((alt) => (
                  <button
                    key={alt.doctor_id}
                    type="button"
                    onClick={() => onSelectDoctor(alt.doctor_id)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #7dd3fc',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.74rem',
                      color: '#0369a1',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className="ph ph-check" /> {alt.doctor_name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
              No doctors in {departmentName} have available shifts for this interval. Please try another time slot.
            </span>
          )}
        </div>
      )}

      {/* Recommended Available Free Slots */}
      {slotsToDisplay && slotsToDisplay.length > 0 ? (
        <div
          style={{
            marginTop: '4px',
            paddingTop: '8px',
            borderTop: `1px dashed ${isLoading ? '#e2e8f0' : selectedDoctor ? (isSelectedAvailable ? '#bbf7d0' : '#fca5a5') : '#bae6fd'}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            <i className="ph ph-sparkle" style={{ color: '#0284c7', fontSize: '0.9rem' }} />
            <span>
              Recommended Available Slots on {formattedDate}
              {validRecommendedSlots.length > 0 && selectedMinutes > 0
                ? ` (from ${formattedStartTime} onwards)`
                : ''}
              :
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {slotsToDisplay.map((slot) => (
              <button
                key={slot.start_time}
                type="button"
                onClick={() => onSelectSlot?.(slot.start_time)}
                title={`Click to schedule for ${slot.formatted}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid #7dd3fc',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.74rem',
                  color: '#0369a1',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <i className="ph ph-clock" /> {slot.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
