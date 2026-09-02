import type { PatientPortalOverview } from '../../../api/patient-portal';
import { Empty } from '../Empty';
import { label, fullName } from '../../../utils/formatters';
import type { PortalTab } from '../../../hooks/usePatientPortal';

type OverviewTabProps = {
  data: PatientPortalOverview;
  patientAge: number;
  upcomingAppointments: PatientPortalOverview['appointments'];
  setTab: (tab: PortalTab) => void;
  setAppointmentScope: (scope: 'upcoming' | 'past') => void;
};

export function OverviewTab({
  data,
  patientAge,
  upcomingAppointments,
  setTab,
  setAppointmentScope,
}: OverviewTabProps) {
  const patient = data.patient;

  return (
    <>
      <section className="portal-welcome">
        <div>
          <p>
            {new Intl.DateTimeFormat('en', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </p>
          <h1>Good day, {patient.first_name}</h1>
          <span>
            Active Record: <strong>{fullName(patient)}</strong> ({patientAge}{' '}
            {patientAge === 1 ? 'yr' : 'yrs'}, {label(patient.gender)}) · MRN:{' '}
            {patient.patient_number}
          </span>
        </div>
        <div className="portal-privacy">
          <i className="ph ph-shield-check" />
          <span>
            <strong>Your health information is protected</strong>
            <small>Only verified records linked to your account are shown.</small>
          </span>
        </div>
      </section>

      <section className="portal-summary-grid">
        <article>
          <span className="portal-summary-icon blue">
            <i className="ph ph-calendar-check" />
          </span>
          <div>
            <small>Upcoming appointments</small>
            <strong>{data.summary.upcoming_appointments}</strong>
            <button onClick={() => setTab('appointments')} type="button">
              View schedule <i className="ph ph-arrow-right" />
            </button>
          </div>
        </article>
        <article>
          <span className="portal-summary-icon green">
            <i className="ph ph-flask" />
          </span>
          <div>
            <small>Verified lab results</small>
            <strong>{data.summary.verified_lab_results}</strong>
            <button onClick={() => setTab('results')} type="button">
              View results <i className="ph ph-arrow-right" />
            </button>
          </div>
        </article>
        <article>
          <span className="portal-summary-icon purple">
            <i className="ph ph-scan" />
          </span>
          <div>
            <small>Imaging reports</small>
            <strong>{data.summary.verified_imaging_reports}</strong>
            <button onClick={() => setTab('results')} type="button">
              View reports <i className="ph ph-arrow-right" />
            </button>
          </div>
        </article>
        <article>
          <span className="portal-summary-icon amber">
            <i className="ph ph-receipt" />
          </span>
          <div>
            <small>Outstanding invoices</small>
            <strong>{data.summary.outstanding_invoices}</strong>
            <button onClick={() => setTab('billing')} type="button">
              View billing <i className="ph ph-arrow-right" />
            </button>
          </div>
        </article>
      </section>

      <section className="portal-dashboard-grid">
        <article className="portal-panel portal-next">
          <header>
            <div>
              <p>Upcoming visits</p>
              <h2>Your upcoming appointments</h2>
            </div>
            <button onClick={() => setTab('appointments')} type="button">
              All appointments
            </button>
          </header>
          {upcomingAppointments.length > 0 ? (
            <div className="portal-appointment-list">
              {upcomingAppointments.slice(0, 3).map((appt) => (
                <div key={appt.id} className="portal-appointment-card">
                  <div className="portal-date-tile">
                    <strong>{new Date(appt.appointment_date).getDate()}</strong>
                    <span>
                      {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                        new Date(appt.appointment_date),
                      )}
                    </span>
                  </div>
                  <div className="portal-appointment-info">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.3rem',
                      }}
                    >
                      <span
                        className="portal-op-visit-badge"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '999px',
                          background: '#e0f2fe',
                          color: '#0284c7',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        <i className="ph ph-stethoscope" /> OP Visit
                      </span>
                      <span className={`portal-status ${appt.status.toLowerCase()}`}>
                        {label(appt.status)}
                      </span>
                    </div>
                    <h3>{appt.doctor_name}</h3>
                    <p>{appt.doctor_specialization}</p>
                    <div>
                      <span>
                        <i className="ph ph-clock" /> {appt.start_time}–{appt.end_time}
                      </span>
                      <span>
                        <i className="ph ph-stethoscope" /> {label(appt.visit_type)}
                      </span>
                      {appt.branch ? (
                        <span>
                          <i className="ph ph-map-pin" /> {appt.branch.name}
                          {appt.branch.city ? `, ${appt.branch.city}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {upcomingAppointments.length > 3 ? (
                <button
                  className="portal-overview-more-btn"
                  onClick={() => setTab('appointments')}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: 'var(--patient-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  +{upcomingAppointments.length - 3} more appointments · View full schedule →
                </button>
              ) : null}
            </div>
          ) : (
            <Empty
              icon="ph-calendar-x"
              title="No upcoming appointment"
              message="Your next scheduled visit will appear here."
            />
          )}
        </article>

        <article className="portal-panel portal-quick">
          <header>
            <div>
              <p>Quick access</p>
              <h2>Your health record</h2>
            </div>
          </header>
          <div className="portal-quick-grid">
            <button
              onClick={() => {
                setTab('appointments');
                setAppointmentScope('past');
              }}
              type="button"
            >
              <i className="ph ph-clock-counter-clockwise" />
              <span>
                <strong>Past & completed visits</strong>
                <small>View completed appointment history</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('results')} type="button">
              <i className="ph ph-flask" />
              <span>
                <strong>Test results</strong>
                <small>Verified laboratory records</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('medicines')} type="button">
              <i className="ph ph-prescription" />
              <span>
                <strong>Prescriptions</strong>
                <small>
                  {data.prescriptions.length
                    ? `${data.prescriptions.length} available`
                    : 'Doctor-issued medicines'}
                </small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('medicines')} type="button">
              <i className="ph ph-pill" />
              <span>
                <strong>Purchased medicines</strong>
                <small>
                  {data.purchased_medicines.length
                    ? `${data.purchased_medicines.length} medicine items`
                    : 'Pharmacy purchase history'}
                </small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('documents')} type="button">
              <i className="ph ph-files" />
              <span>
                <strong>Documents</strong>
                <small>Previous records and reports</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('billing')} type="button">
              <i className="ph ph-receipt" />
              <span>
                <strong>Bills & payments</strong>
                <small>Invoices and balances</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button onClick={() => setTab('profile')} type="button">
              <i className="ph ph-identification-card" />
              <span>
                <strong>Patient details</strong>
                <small>Contact and identity record</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
          </div>
        </article>
      </section>
    </>
  );
}
