import { useState } from 'react';
import type {
  ApiDoctorAvailabilityDay,
  DoctorResponse,
  SaveDoctorAvailabilityPayload,
} from '../../api/doctors';

export type WorkingBlockForm = { start_time: string; end_time: string; slot_duration_minutes: number };
export type AvailabilityDayForm = SaveDoctorAvailabilityPayload['availability'][number];

const toMinutes = (time: string) => {
  if (!time) return 0;
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const doctorAvailabilityDayOrder: ApiDoctorAvailabilityDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const unavailableDay = (day: ApiDoctorAvailabilityDay): AvailabilityDayForm => ({
  day_of_week: day,
  is_available: false,
  working_blocks: [],
});

export const createDefaultDoctorAvailability = (): AvailabilityDayForm[] =>
  doctorAvailabilityDayOrder.map((day) => {
    if (day === 'SATURDAY' || day === 'SUNDAY') return unavailableDay(day);
    return {
      day_of_week: day,
      is_available: true,
      working_blocks: [
        { start_time: '08:00', end_time: '12:30', slot_duration_minutes: 30 },
        { start_time: '13:30', end_time: '17:00', slot_duration_minutes: 30 },
      ],
    };
  });

export const doctorAvailabilityToForm = (doctor: DoctorResponse): AvailabilityDayForm[] =>
  doctorAvailabilityDayOrder.map((day) => {
    const value = doctor.availability.find((item) => item.day_of_week === day);
    return value
      ? {
          day_of_week: value.day_of_week,
          is_available: value.is_available,
          working_blocks: value.working_blocks.map((block) => ({
            start_time: block.start_time,
            end_time: block.end_time,
            slot_duration_minutes: block.slot_duration_minutes || 30,
          })),
        }
      : unavailableDay(day);
  });

type DoctorAvailabilityEditorProps = {
  disabled?: boolean;
  value: AvailabilityDayForm[];
  onChange: (value: AvailabilityDayForm[]) => void;
};

export function DoctorAvailabilityEditor({
  disabled = false,
  value,
  onChange,
}: DoctorAvailabilityEditorProps) {
  const [selectedDay, setSelectedDay] = useState<ApiDoctorAvailabilityDay>('MONDAY');

  const activeDayForm = value.find((item) => item.day_of_week === selectedDay) ?? {
    day_of_week: selectedDay,
    is_available: false,
    working_blocks: [],
  };

  const totalDayMaxPatients = activeDayForm.working_blocks.reduce((sum, block) => {
    const startMins = toMinutes(block.start_time);
    const endMins = toMinutes(block.end_time);
    const durationMins = Math.max(0, endMins - startMins);
    const slotMins = block.slot_duration_minutes || 30;
    return sum + Math.floor(durationMins / slotMins);
  }, 0);

  const updateDay = (day: ApiDoctorAvailabilityDay, update: Partial<AvailabilityDayForm>) => {
    onChange(value.map((item) => (item.day_of_week === day ? { ...item, ...update } : item)));
  };

  const updateBlock = (
    day: ApiDoctorAvailabilityDay,
    index: number,
    update: Partial<WorkingBlockForm>,
  ) => {
    onChange(
      value.map((item) =>
        item.day_of_week === day
          ? {
              ...item,
              working_blocks: item.working_blocks.map((block, blockIndex) =>
                blockIndex === index ? { ...block, ...update } : block,
              ),
            }
          : item,
      ),
    );
  };

  const copyToAllWeekdays = (sourceDay: ApiDoctorAvailabilityDay) => {
    const source = value.find((item) => item.day_of_week === sourceDay);
    if (!source) return;
    const weekdays: ApiDoctorAvailabilityDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    onChange(
      value.map((item) => {
        if (weekdays.includes(item.day_of_week)) {
          return {
            ...item,
            is_available: source.is_available,
            working_blocks: source.working_blocks.map((b) => ({ ...b })),
          };
        }
        return item;
      }),
    );
  };

  return (
    <div className="doctor-availability-container">
      {/* Weekday Selector Strip */}
      <div className="doctor-weekday-nav">
        {doctorAvailabilityDayOrder.map((dayName) => {
          const dayData = value.find((d) => d.day_of_week === dayName);
          const isAvailable = dayData?.is_available ?? false;
          const blockCount = dayData?.working_blocks.length ?? 0;
          const dayMaxPts =
            dayData?.working_blocks.reduce((sum, b) => {
              const sm = toMinutes(b.start_time);
              const em = toMinutes(b.end_time);
              const dm = Math.max(0, em - sm);
              const slm = b.slot_duration_minutes || 30;
              return sum + Math.floor(dm / slm);
            }, 0) ?? 0;
          const isSelected = dayName === selectedDay;

          return (
            <button
              className={`doctor-weekday-pill${isSelected ? ' selected' : ''}${isAvailable ? ' available' : ' off'}`}
              key={dayName}
              onClick={() => setSelectedDay(dayName)}
              type="button"
            >
              <span className="weekday-name">{dayName.slice(0, 3)}</span>
              <span className="weekday-status">
                {isAvailable ? `${dayMaxPts} max pts (${blockCount}b)` : 'Off'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Day Detail Card */}
      <article className={`doctor-day-card detail-card${activeDayForm.is_available ? ' active' : ''}`}>
        <header className="doctor-day-card-header">
          <div className="doctor-day-header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h4>{activeDayForm.day_of_week}</h4>
              {activeDayForm.is_available ? (
                <span className="doctor-day-max-pts-pill">
                  <i className="ph ph-users-three" /> Total Max Patients: <strong>{totalDayMaxPatients}</strong>
                </span>
              ) : null}
            </div>
            <span className="doctor-day-subtitle">
              {activeDayForm.is_available
                ? `${activeDayForm.working_blocks.length} working block${activeDayForm.working_blocks.length === 1 ? '' : 's'} configured · Max patients auto-adjusts based on slot duration`
                : 'Doctor is off duty on this day'}
            </span>
          </div>

          <div className="doctor-day-header-right">
            {activeDayForm.is_available &&
              ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(activeDayForm.day_of_week) && (
                <button
                  className="doc-btn-sm"
                  disabled={disabled}
                  onClick={() => copyToAllWeekdays(activeDayForm.day_of_week)}
                  title="Copy these hours to Mon, Tue, Wed, Thu, Fri"
                  type="button"
                >
                  <i className="ph ph-copy" /> Apply to Mon–Fri
                </button>
              )}

            <label className="doctor-switch" title={activeDayForm.is_available ? 'Set off-duty' : 'Set on-duty'}>
              <input
                checked={activeDayForm.is_available}
                disabled={disabled}
                onChange={(event) =>
                  updateDay(activeDayForm.day_of_week, {
                    is_available: event.target.checked,
                    working_blocks: event.target.checked
                      ? activeDayForm.working_blocks.length > 0
                        ? activeDayForm.working_blocks
                        : [{ start_time: '08:00', end_time: '12:30', slot_duration_minutes: 30 }]
                      : [],
                  })
                }
                type="checkbox"
              />
              <span />
            </label>
          </div>
        </header>

        {activeDayForm.is_available ? (
          <div className="doctor-working-blocks">
            {activeDayForm.working_blocks.map((block, index) => {
              const startMins = toMinutes(block.start_time);
              const endMins = toMinutes(block.end_time);
              const durationMins = Math.max(0, endMins - startMins);
              const slotMins = block.slot_duration_minutes || 30;
              const fullSlots = Math.floor(durationMins / slotMins);
              const remainderMins = durationMins % slotMins;
              const cutoffTime = toTime(startMins + fullSlots * slotMins);

              return (
                <div className="doctor-working-block-wrap" key={`${activeDayForm.day_of_week}-${index}`}>
                  <div className="doctor-working-block">
                    <label className="doc-field">
                      <span>From</span>
                      <input
                        disabled={disabled}
                        onChange={(event) =>
                          updateBlock(activeDayForm.day_of_week, index, { start_time: event.target.value })
                        }
                        type="time"
                        value={block.start_time}
                      />
                    </label>
                    <label className="doc-field">
                      <span>To</span>
                      <input
                        disabled={disabled}
                        onChange={(event) =>
                          updateBlock(activeDayForm.day_of_week, index, { end_time: event.target.value })
                        }
                        type="time"
                        value={block.end_time}
                      />
                    </label>

                    <label className="doc-field">
                      <span>Slot Duration</span>
                      <select
                        disabled={disabled}
                        onChange={(event) =>
                          updateBlock(activeDayForm.day_of_week, index, {
                            slot_duration_minutes: Number(event.target.value),
                          })
                        }
                        value={block.slot_duration_minutes}
                      >
                        {[10, 15, 20, 30, 45, 60].map((duration) => (
                          <option key={duration} value={duration}>
                            {duration} min
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="doc-field">
                      <label htmlFor={`block-max-pts-${activeDayForm.day_of_week}-${index}`}>
                        Max Patients (Auto)
                      </label>
                      <div className="doctor-max-pts-badge" id={`block-max-pts-${activeDayForm.day_of_week}-${index}`}>
                        <i className="ph ph-users" />
                        <span>{fullSlots} {fullSlots === 1 ? 'Patient' : 'Patients'}</span>
                      </div>
                    </div>

                    <button
                      aria-label={`Remove ${activeDayForm.day_of_week.toLowerCase()} working block`}
                      className="doc-action danger"
                      disabled={disabled || activeDayForm.working_blocks.length === 1}
                      onClick={() =>
                        updateDay(activeDayForm.day_of_week, {
                          working_blocks: activeDayForm.working_blocks.filter((_, blockIndex) => blockIndex !== index),
                        })
                      }
                      title="Remove block"
                      type="button"
                    >
                      <i className="ph ph-trash" aria-hidden="true" />
                    </button>
                  </div>
                  {remainderMins > 0 ? (
                    <div className="doctor-slot-hint warning">
                      <i className="ph ph-info" aria-hidden="true" />
                      <span>
                        <strong>Discarding incomplete slot ({remainderMins}m)</strong>: {fullSlots} patients ({slotMins}m per slot) accommodated. Remaining {cutoffTime} – {block.end_time} is excluded.
                      </span>
                    </div>
                  ) : (
                    <div className="doctor-slot-hint success">
                      <i className="ph ph-check-circle" aria-hidden="true" />
                      <span>
                        Capacity: {fullSlots} appointment slots ({slotMins} min each) generated for {block.start_time} – {block.end_time}.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="doctor-block-actions">
              <button
                className="doc-btn"
                disabled={disabled || activeDayForm.working_blocks.length >= 8}
                onClick={() =>
                  updateDay(activeDayForm.day_of_week, {
                    working_blocks: [
                      ...activeDayForm.working_blocks,
                      { start_time: '13:30', end_time: '17:00', slot_duration_minutes: 30 },
                    ],
                  })
                }
                type="button"
              >
                <i className="ph ph-plus" aria-hidden="true" /> Add Working Block
              </button>
            </div>
          </div>
        ) : (
          <div className="um-state-cell" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <i className="ph ph-moon" style={{ fontSize: '1.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }} />
            <span>Doctor is marked off-duty on <strong>{activeDayForm.day_of_week}</strong>. Toggle switch above to configure working hours.</span>
          </div>
        )}
      </article>
    </div>
  );
}
