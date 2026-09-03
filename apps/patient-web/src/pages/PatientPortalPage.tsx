import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { PortalPatientForm } from '../components/patient-portal/PortalPatientForm';
import { PortalAppointmentBooking } from '../components/patient-portal/PortalAppointmentBooking';
import { PortalAppointmentRescheduling } from '../components/patient-portal/PortalAppointmentRescheduling';
import { PortalPersonalInformationForm } from '../components/patient-portal/PortalPersonalInformationForm';
import { PortalDocuments } from '../components/patient-portal/PortalDocuments';
import { tabs, usePatientPortal } from '../hooks/usePatientPortal';
import { ageOnDate, label, relationshipTag } from '../utils/formatters';
import { OverviewTab } from '../components/patient-portal/tabs/OverviewTab';
import { AppointmentsTab } from '../components/patient-portal/tabs/AppointmentsTab';
import { ResultsTab } from '../components/patient-portal/tabs/ResultsTab';
import { MedicinesTab } from '../components/patient-portal/tabs/MedicinesTab';
import { BillingTab } from '../components/patient-portal/tabs/BillingTab';
import { ProfileTab } from '../components/patient-portal/tabs/ProfileTab';
import { PatientCardModal } from '../components/patient-portal/modals/PatientCardModal';
import { InvoiceDetailModal } from '../components/patient-portal/modals/InvoiceDetailModal';

export function PatientPortalPage() {
  const { logout } = useAuth();
  const {
    tab,
    setTab,
    selectedPatientId,
    setSelectedPatientId,
    contextQuery,
    overviewQuery,
    invoiceQuery,
    appointmentsQuery,
    appointmentScope,
    setAppointmentScope,
    appointmentStatus,
    setAppointmentStatus,
    appointmentPage,
    setAppointmentPage,
    addDependentOpen,
    setAddDependentOpen,
    addSelfOpen,
    setAddSelfOpen,
    editPersonalInformationOpen,
    setEditPersonalInformationOpen,
    patientCardOpen,
    setPatientCardOpen,
    selectedInvoice,
    setSelectedInvoice,
    bookingOpen,
    setBookingOpen,
    closeBooking,
    requestedDoctorId,
    requestedBranchId,
    requestedDepartmentId,
    rescheduleAppointment,
    setRescheduleAppointment,
    patientSaved,
    personalInformationSaved,
  } = usePatientPortal();

  if (contextQuery.isLoading) {
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Loading your portal…</strong>
        <span>This may take a moment.</span>
      </main>
    );

  if (contextQuery.isError || !contextQuery.data)
    return (
      <main className="patient-portal-state patient-portal-state--error">
        <i className="ph ph-warning-circle" />
        <strong>We could not load your portal</strong>
        <span>Your information remains secure. Please try again.</span>
        <button onClick={() => void contextQuery.refetch()} type="button">
          Try again
        </button>
      </main>
    );
  }

  const portalContext = contextQuery.data;

  if (portalContext.patients.length === 0) {
    const accountInitials = portalContext.account.full_name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    return (
      <div className="patient-portal">
        <header className="patient-portal-header portal-onboarding-header">
          <div className="patient-portal-brand">
            <span>
              <i className="ph ph-heartbeat" />
            </span>
            <div>
              <strong>HMS</strong>
              <small>Patient Portal</small>
            </div>
          </div>
          <div />
          <div className="patient-portal-account">
            <div className="patient-avatar">{accountInitials}</div>
            <div>
              <strong>{portalContext.account.full_name}</strong>
              <small>
                {portalContext.account.type === 'GUARDIAN'
                  ? 'Parent / Guardian'
                  : 'Patient account'}
              </small>
            </div>
            <button aria-label="Sign out" onClick={() => void logout()} type="button">
              <i className="ph ph-sign-out" />
            </button>
          </div>
        </header>
        <main className="patient-portal-main portal-onboarding">
          <div className="portal-onboarding-intro">
            <span>
              <i
                className={`ph ${
                  portalContext.account.type === 'GUARDIAN'
                    ? 'ph-users-three'
                    : 'ph-user-circle-plus'
                }`}
              />
            </span>
            <div>
              <p>
                {portalContext.account.type === 'GUARDIAN'
                  ? 'Dependent registration'
                  : 'Patient profile'}
              </p>
              <h1>
                {portalContext.account.type === 'GUARDIAN'
                  ? 'Add your first dependent'
                  : 'Complete your patient information'}
              </h1>
              <small>
                {portalContext.account.type === 'GUARDIAN'
                  ? 'Enter the child or dependent’s information. Your guardian relationship will be linked to their patient record.'
                  : 'We need a few medical identity details before opening your patient dashboard.'}
              </small>
            </div>
          </div>
          <section className="portal-onboarding-card">
            <PortalPatientForm
              defaultFullName={portalContext.account.full_name}
              mode={portalContext.account.type === 'GUARDIAN' ? 'DEPENDENT' : 'SELF'}
              onSaved={(patientId) => void patientSaved(patientId)}
            />
          </section>
        </main>
      </div>
    );
  }

  if (overviewQuery.isLoading || !selectedPatientId)
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Loading your health record…</strong>
        <span>This may take a moment.</span>
      </main>
    );

  if (overviewQuery.isError || !overviewQuery.data)
    return (
      <main className="patient-portal-state patient-portal-state--error">
        <i className="ph ph-warning-circle" />
        <strong>We could not load your portal</strong>
        <span>Your information remains secure. Please try again.</span>
        <button onClick={() => void overviewQuery.refetch()} type="button">
          Try again
        </button>
      </main>
    );
  }

  const data = overviewQuery.data;
  const hasSelfProfile = portalContext.patients.some((item) => item.relationship === 'SELF');
  const patient = data.patient;
  const initials = `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase();
  const selectedPatientContext = portalContext.patients.find(
    (item) => item.id === selectedPatientId,
  );
  const patientAge = ageOnDate(patient.date_of_birth);
  const isMinor = patientAge < 15;
  const guardianProfile = portalContext.account.guardian_profile;
  const showGuardianDetails = Boolean(
    isMinor && selectedPatientContext && selectedPatientContext.relationship !== 'SELF',
  );
  const patientPhoneDisplay =
    showGuardianDetails && patient.phone === portalContext.account.phone
      ? 'Managed through guardian'
      : patient.phone || 'Not recorded';

  return (
    <div className="patient-portal">
      <header className="patient-portal-header">
        <button
          className="patient-portal-brand"
          onClick={() => setTab('overview')}
          type="button"
        >
          <span>
            <i className="ph ph-heartbeat" />
          </span>
          <div>
            <strong>HMS</strong>
            <small>Patient Portal</small>
          </div>
        </button>
        <nav aria-label="Patient portal" className="patient-portal-nav">
          {tabs.map((item) => (
            <button
              className={tab === item.key ? 'active' : ''}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              <i className={`ph ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="patient-portal-account">
          <div
            className="patient-portal-profile-trigger"
            onClick={() => setTab('profile')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTab('profile');
              }
            }}
            role="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
            }}
            tabIndex={0}
          >
            <div className="patient-avatar">{initials}</div>
            <div style={{ display: 'grid', maxWidth: '180px' }}>
              <strong
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {patient.first_name} {patient.last_name}
              </strong>
              <small style={{ color: '#64748b', fontSize: '0.66rem', lineHeight: '1.25' }}>
                {patientAge} {patientAge === 1 ? 'yr' : 'yrs'}, {label(patient.gender)}
              </small>
              <small style={{ color: '#94a3b8', fontSize: '0.62rem', lineHeight: '1.25' }}>
                {patient.patient_number}
              </small>
              {portalContext.account.type === 'GUARDIAN' && selectedPatientContext ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginTop: '0.2rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    background: 'var(--patient-blue-soft)',
                    color: 'var(--patient-primary)',
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  <i className="ph ph-eye" style={{ fontSize: '0.7rem', flex: 'none' }} />
                  {selectedPatientContext.full_name} ·{' '}
                  {relationshipTag(selectedPatientContext.relationship)}
                </span>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => void logout()}
            title="Sign out"
            type="button"
          >
            <i className="ph ph-sign-out" />
          </button>
        </div>
      </header>

      <main className="patient-portal-main">
        {portalContext.account.type === 'GUARDIAN' ? (
          <section className="portal-dependent-toolbar">
            <label htmlFor="portal-dependent">
              <span>Viewing patient</span>
              <select
                id="portal-dependent"
                onChange={(event) => {
                  setSelectedPatientId(event.target.value);
                  setTab('overview');
                }}
                value={selectedPatientId}
              >
                {portalContext.patients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} · {relationshipTag(item.relationship)}
                  </option>
                ))}
              </select>
            </label>
            <div className="portal-dependent-actions">
              {!hasSelfProfile ? (
                <button
                  className="secondary"
                  onClick={() => setAddSelfOpen(true)}
                  type="button"
                >
                  <i className="ph ph-user-circle-plus" /> Add myself as a patient
                </button>
              ) : null}
              <button onClick={() => setAddDependentOpen(true)} type="button">
                <i className="ph ph-user-plus" /> Add dependent
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'overview' ? (
          <OverviewTab
            data={data}
            patientAge={patientAge}
            setAppointmentScope={setAppointmentScope}
            setTab={setTab}
            upcomingAppointments={upcomingAppointments}
          />
        ) : null}

        {tab === 'appointments' ? (
          <AppointmentsTab
            appointmentPage={appointmentPage}
            appointmentScope={appointmentScope}
            appointmentStatus={appointmentStatus}
            appointmentsQuery={appointmentsQuery}
            setAppointmentPage={setAppointmentPage}
            setAppointmentScope={setAppointmentScope}
            setAppointmentStatus={setAppointmentStatus}
            setBookingOpen={setBookingOpen}
            setRescheduleAppointment={setRescheduleAppointment}
          />
        ) : null}

        {tab === 'results' ? <ResultsTab data={data} /> : null}

        {tab === 'medicines' ? <MedicinesTab data={data} /> : null}

        {tab === 'documents' ? <PortalDocuments patientId={selectedPatientId} /> : null}

        {tab === 'billing' ? (
          <BillingTab data={data} setSelectedInvoice={setSelectedInvoice} />
        ) : null}

        {tab === 'profile' ? (
          <ProfileTab
            data={data}
            initials={initials}
            patientAge={patientAge}
            portalContext={portalContext}
            selectedPatientContext={selectedPatientContext}
            setEditPersonalInformationOpen={setEditPersonalInformationOpen}
            setPatientCardOpen={setPatientCardOpen}
            setTab={setTab}
          />
        ) : null}
      </main>

      <PatientCardModal
        initials={initials}
        onClose={() => setPatientCardOpen(false)}
        open={patientCardOpen}
        patient={patient}
        patientAge={patientAge}
        patientPhoneDisplay={patientPhoneDisplay}
      />

      <Modal
        icon="ph-pencil-simple"
        onClose={() => setEditPersonalInformationOpen(false)}
        open={editPersonalInformationOpen}
        size="large"
        title={
          showGuardianDetails
            ? 'Edit child and guardian information'
            : 'Edit personal information'
        }
      >
        <PortalPersonalInformationForm
          guardian={
            showGuardianDetails && guardianProfile
              ? {
                  full_name: portalContext.account.full_name,
                  email: portalContext.account.email,
                  phone: portalContext.account.phone,
                  relationship:
                    selectedPatientContext?.relationship === 'LEGAL_GUARDIAN'
                      ? 'LEGAL_GUARDIAN'
                      : 'PARENT',
                  address: guardianProfile.address,
                  identification: guardianProfile.identification,
                  legal_consent_accepted: guardianProfile.legal_consent_accepted,
                }
              : undefined
          }
          onCancel={() => setEditPersonalInformationOpen(false)}
          onSaved={() => void personalInformationSaved()}
          patient={patient}
          preferredBranchId={selectedPatientContext?.preferred_branch?.id ?? ''}
        />
      </Modal>

      <Modal
        icon="ph-user-plus"
        onClose={() => setAddDependentOpen(false)}
        open={addDependentOpen}
        size="large"
        title="Add a dependent patient"
      >
        <PortalPatientForm
          mode="DEPENDENT"
          onCancel={() => setAddDependentOpen(false)}
          onSaved={(patientId) => void patientSaved(patientId)}
        />
      </Modal>

      <Modal
        icon="ph-user-circle-plus"
        onClose={() => setAddSelfOpen(false)}
        open={addSelfOpen}
        size="large"
        title="Add myself as a patient"
      >
        <PortalPatientForm
          defaultFullName={portalContext.account.full_name}
          mode="SELF"
          onCancel={() => setAddSelfOpen(false)}
          onSaved={(patientId) => void patientSaved(patientId)}
        />
      </Modal>

      <Modal
        icon="ph-calendar-plus"
        onClose={closeBooking}
        open={bookingOpen}
        size="large"
        title="Book an appointment"
      >
        <PortalAppointmentBooking
          context={portalContext}
          initialPatientId={selectedPatientId}
          initialBranchId={requestedBranchId}
          initialDepartmentId={requestedDepartmentId}
          initialDoctorId={requestedDoctorId}
          onBooked={() => {
            closeBooking();
            setTab('appointments');
          }}
          onCancel={closeBooking}
        />
      </Modal>

      <Modal
        icon="ph-calendar-dots"
        onClose={() => setRescheduleAppointment(null)}
        open={Boolean(rescheduleAppointment)}
        size="large"
        title="Reschedule appointment"
      >
        {rescheduleAppointment ? (
          <PortalAppointmentRescheduling
            appointment={rescheduleAppointment}
            onCancel={() => setRescheduleAppointment(null)}
            onSaved={() => {
              setRescheduleAppointment(null);
              setAppointmentScope('upcoming');
              setAppointmentStatus('');
              setAppointmentPage(1);
            }}
          />
        ) : null}
      </Modal>

      <InvoiceDetailModal
        invoiceQuery={invoiceQuery}
        onClose={() => setSelectedInvoice(null)}
        selectedInvoice={selectedInvoice}
      />

      <nav className="patient-portal-mobile-nav" aria-label="Mobile patient portal">
        {tabs.slice(0, 4).map((item) => (
          <button
            className={tab === item.key ? 'active' : ''}
            key={item.key}
            onClick={() => setTab(item.key)}
            type="button"
          >
            <i className={`ph ${item.icon}`} />
            <span>{item.key === 'results' ? 'Results' : item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
