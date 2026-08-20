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
  max_patients_per_slot: 1,
});

export const createDefaultDoctorAvailability = (): AvailabilityDayForm[] =>
  doctorAvailabilityDayOrder.map((day) => {
    if (day === 'SATURDAY' || day === 'SUNDAY') return unavailableDay(day);
    return {
      day_of_week: day,
      is_available: true,
      working_blocks: [
        { start_time: '08:00', end_time: '12:30', slot_duration_minutes: 30, max_patients_per_slot: 1 },
        { start_time: '13:30', end_time: '17:00', slot_duration_minutes: 30, max_patients_per_slot: 1 },
      ],
      max_patients_per_slot: 1,
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
            max_patients_per_slot: (block as any).max_patients_per_slot ?? value.max_patients_per_slot ?? 1,
          })),
          max_patients_per_slot: value.max_patients_per_slot ?? 1,
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

  return (
    <div className="doctor-availability-grid">
      {value.map((day) => (
        <article className={`doctor-day-card${day.is_available ? ' active' : ''}`} key={day.day_of_week}>
          <header>
            <div>
              <strong>{day.day_of_week}</strong>
              <span>{day.working_blocks.length} working block{day.working_blocks.length === 1 ? '' : 's'}</span>
            </div>
            <label className="doctor-switch">
              <input
                checked={day.is_available}
                disabled={disabled}
                onChange={(event) =>
                  updateDay(day.day_of_week, {
                    is_available: event.target.checked,
                    working_blocks: event.target.checked
                      ? day.working_blocks.length > 0
                        ? day.working_blocks
                        : [{ start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, max_patients_per_slot: 1 }]
                      : [],
                  })
                }
                type="checkbox"
              />
              <span />
            </label>
          </header>

          {day.is_available ? (
            <div className="doctor-working-blocks">
              {day.working_blocks.map((block, index) => {
                const startMins = toMinutes(block.start_time);
                const endMins = toMinutes(block.end_time);
                const durationMins = Math.max(0, endMins - startMins);
                const slotMins = block.slot_duration_minutes || 30;
                const fullSlots = Math.floor(durationMins / slotMins);
                const remainderMins = durationMins % slotMins;
                const cutoffTime = toTime(startMins + fullSlots * slotMins);

                return (
                  <div key={`${day.day_of_week}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div className="doctor-working-block">
                      <label className="doc-field">
                        <span>From</span>
                        <input
                          disabled={disabled}
                          onChange={(event) => updateBlock(day.day_of_week, index, { start_time: event.target.value })}
                          type="time"
                          value={block.start_time}
                        />
                      </label>
                      <label className="doc-field">
                        <span>To</span>
                        <input
                          disabled={disabled}
                          onChange={(event) => updateBlock(day.day_of_week, index, { end_time: event.target.value })}
                          type="time"
                          value={block.end_time}
                        />
                      </label>
                      <label className="doc-field">
                        <span>Max Patients</span>
                        <input
                          disabled={disabled}
                          max={100}
                          min={1}
                          onChange={(event) => {
                            const totalPatients = Math.max(1, Number(event.target.value) || 1);
                            const perSlot = Math.max(1, Math.ceil(totalPatients / Math.max(1, fullSlots)));
                            updateBlock(day.day_of_week, index, { max_patients_per_slot: perSlot });
                          }}
                          style={{ width: '70px', textAlign: 'center' }}
                          type="number"
                          value={(block.max_patients_per_slot ?? day.max_patients_per_slot ?? 1) * Math.max(1, fullSlots)}
                        />
                      </label>
                      <label className="doc-field">
                        <span>Duration (min)</span>
                        <select
                          disabled={disabled}
                          onChange={(event) =>
                            updateBlock(day.day_of_week, index, { slot_duration_minutes: Number(event.target.value) })
                          }
                          style={{ width: '85px' }}
                          value={block.slot_duration_minutes}
                        >
                          {[10, 15, 20, 30, 45, 60].map((duration) => (
                            <option key={duration} value={duration}>{duration}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        aria-label={`Remove ${day.day_of_week.toLowerCase()} working block`}
                        className="doc-action danger"
                        disabled={disabled || day.working_blocks.length === 1}
                        onClick={() =>
                          updateDay(day.day_of_week, {
                            working_blocks: day.working_blocks.filter((_, blockIndex) => blockIndex !== index),
                          })
                        }
                        type="button"
                      >
                        <i className="ph ph-trash" aria-hidden="true" />
                      </button>
                    </div>
                    {remainderMins > 0 ? (
                      <div style={{ fontSize: '0.73rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.3rem', paddingLeft: '0.2rem' }}>
                        <i className="ph ph-info" aria-hidden="true" />
                        <span>
                          <strong>Discarding incomplete slot ({remainderMins} mins)</strong>: {fullSlots} slots ({slotMins}m each) generated. Remaining {cutoffTime} - {block.end_time} is ignored.
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.73rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem', paddingLeft: '0.2rem' }}>
                        <i className="ph ph-check-circle" aria-hidden="true" />
                        <span>
                          {fullSlots} complete {slotMins}-min slots generated ({block.start_time} - {block.end_time}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="doctor-block-actions">
                <button
                  className="doc-btn"
                  disabled={disabled || day.working_blocks.length >= 8}
                  onClick={() =>
                    updateDay(day.day_of_week, {
                      working_blocks: [...day.working_blocks, { start_time: '17:00', end_time: '18:00', slot_duration_minutes: 30, max_patients_per_slot: 1 }],
                    })
                  }
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" /> Add Block
                </button>
              </div>
            </div>
          ) : (
            <div className="um-state-cell">Not available for appointments</div>
          )}
        </article>
      ))}
    </div>
  );
}
