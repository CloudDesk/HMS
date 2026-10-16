import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AppointmentConsultationIntake,
  hasAppointmentConsultationIntake,
} from './AppointmentConsultationIntake';

describe('AppointmentConsultationIntake', () => {
  it('renders only the patient-supplied fields that contain values', () => {
    const intake = {
      chief_complaint: 'Persistent tooth pain',
      history_present_illness: 'Started three days ago',
      past_history: null,
      family_history: '',
      allergies: 'Penicillin',
    };

    const html = renderToStaticMarkup(<AppointmentConsultationIntake intake={intake} />);

    expect(html).toContain('Patient supplied');
    expect(html).toContain('Persistent tooth pain');
    expect(html).toContain('Started three days ago');
    expect(html).toContain('Penicillin');
    expect(html).not.toContain('Past medical history');
    expect(hasAppointmentConsultationIntake(intake)).toBe(true);
  });

  it('renders nothing when the form was not completed', () => {
    expect(renderToStaticMarkup(<AppointmentConsultationIntake intake={null} />)).toBe('');
    expect(hasAppointmentConsultationIntake({ chief_complaint: '   ' })).toBe(false);
  });
});
