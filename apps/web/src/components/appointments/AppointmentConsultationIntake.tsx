import type { AppointmentConsultationIntake as AppointmentConsultationIntakeData } from '../../api/appointments';

type Props = {
  intake?: AppointmentConsultationIntakeData | null;
};

const fields: Array<{ key: keyof AppointmentConsultationIntakeData; label: string }> = [
  { key: 'chief_complaint', label: 'Chief complaint' },
  { key: 'history_present_illness', label: 'History of present illness' },
  { key: 'past_history', label: 'Past medical history' },
  { key: 'family_history', label: 'Family history' },
  { key: 'allergies', label: 'Allergies / sensitivities' },
];

export const hasAppointmentConsultationIntake = (intake?: AppointmentConsultationIntakeData | null) =>
  fields.some(({ key }) => Boolean(intake?.[key]?.trim()));

export function AppointmentConsultationIntake({ intake }: Props) {
  const visibleFields = fields.filter(({ key }) => Boolean(intake?.[key]?.trim()));
  if (visibleFields.length === 0) return null;

  return (
    <section className="appointment-intake" aria-label="Patient-supplied basic consultation form">
      <div className="appointment-intake-header">
        <span className="appointment-intake-icon"><i className="ph ph-clipboard-text" aria-hidden="true" /></span>
        <div>
          <h4>Basic consultation form</h4>
          <p>Submitted by the patient while booking this appointment.</p>
        </div>
        <span className="appointment-intake-source">Patient supplied</span>
      </div>
      <dl className="appointment-intake-grid">
        {visibleFields.map(({ key, label }) => (
          <div className={key === 'chief_complaint' || key === 'history_present_illness' ? 'wide' : ''} key={key}>
            <dt>{label}</dt>
            <dd>{intake?.[key]?.trim()}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
