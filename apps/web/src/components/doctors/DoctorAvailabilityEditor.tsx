import type {
  ApiDoctorAvailabilityDay,
  DoctorResponse,
  SaveDoctorAvailabilityPayload,
} from '../../api/doctors';

export type WorkingBlockForm = { start_time: string; end_time: string };
export type AvailabilityDayForm = SaveDoctorAvailabilityPayload['availability'][number];

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
  slot_duration_minutes: 30,
});

export const createDefaultDoctorAvailability = (): AvailabilityDayForm[] =>
  doctorAvailabilityDayOrder.map((day) => {
    if (day === 'SATURDAY' || day === 'SUNDAY') return unavailableDay(day);
    return {
      day_of_week: day,
      is_available: true,
      working_blocks: [
        { start_time: '08:00', end_time: '12:30' },
        { start_time: '13:30', end_time: '17:00' },
      ],
      slot_duration_minutes: 30,
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
          })),
          slot_duration_minutes: value.slot_duration_minutes,
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
                        : [{ start_time: '09:00', end_time: '17:00' }]
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
              {day.working_blocks.map((block, index) => (
                <div className="doctor-working-block" key={`${day.day_of_week}-${index}`}>
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
              ))}
              <div className="doctor-block-actions">
                <label className="doc-field compact">
                  <span>Slot duration</span>
                  <select
                    disabled={disabled}
                    onChange={(event) =>
                      updateDay(day.day_of_week, { slot_duration_minutes: Number(event.target.value) })
                    }
                    value={day.slot_duration_minutes}
                  >
                    {[10, 15, 20, 30, 45, 60].map((duration) => (
                      <option key={duration} value={duration}>{duration} minutes</option>
                    ))}
                  </select>
                </label>
                <button
                  className="doc-btn"
                  disabled={disabled || day.working_blocks.length >= 8}
                  onClick={() =>
                    updateDay(day.day_of_week, {
                      working_blocks: [...day.working_blocks, { start_time: '17:00', end_time: '18:00' }],
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
