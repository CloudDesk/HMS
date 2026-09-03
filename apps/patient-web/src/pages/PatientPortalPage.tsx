import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  patientPortalApi,
  type PatientPortalOverview,
  type PortalAppointment,
} from '../api/patient-portal';
import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { PortalPatientForm } from '../components/patient-portal/PortalPatientForm';
import { PortalAppointmentBooking } from '../components/patient-portal/PortalAppointmentBooking';
import { PortalAppointmentRescheduling } from '../components/patient-portal/PortalAppointmentRescheduling';
import { PortalPersonalInformationForm } from '../components/patient-portal/PortalPersonalInformationForm';
import { PortalDocuments } from '../components/patient-portal/PortalDocuments';
import { PortalOverviewTab } from '../components/patient-portal/PortalOverviewTab';
import { PortalAppointmentsTab } from '../components/patient-portal/PortalAppointmentsTab';
import { PortalResultsTab } from '../components/patient-portal/PortalResultsTab';
import { PortalMedicinesTab } from '../components/patient-portal/PortalMedicinesTab';
import { PortalBillingTab } from '../components/patient-portal/PortalBillingTab';
import { PortalProfileTab } from '../components/patient-portal/PortalProfileTab';
import { PortalInvoiceDetailModal } from '../components/patient-portal/PortalInvoiceDetailModal';
import { PortalPatientCardModal } from '../components/patient-portal/PortalPatientCardModal';
import { label } from '../utils/portal-invoice-pdf';
import { navigate, useAppLocation } from '../routing/navigation';

type PortalTab =
  | 'overview'
  | 'appointments'
  | 'results'
  | 'medicines'
  | 'documents'
  | 'billing'
  | 'profile';

const tabs: Array<{ key: PortalTab; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'ph-house' },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank' },
  { key: 'results', label: 'Reports & results', icon: 'ph-file-text' },
  { key: 'medicines', label: 'Prescriptions', icon: 'ph-prescription' },
  { key: 'documents', label: 'Documents', icon: 'ph-files' },
  { key: 'billing', label: 'Billing', icon: 'ph-receipt' },
  { key: 'profile', label: 'My profile', icon: 'ph-user-circle' },
];

const relationshipTag = (relationship: string) => {
  if (relationship === 'SELF') return 'Self';
  if (relationship === 'PARENT') return 'My child';
  if (relationship === 'LEGAL_GUARDIAN') return 'Dependent';
  return label(relationship);
};

const ageOnDate = (dateOfBirth: string) => {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
};

export function PatientPortalPage() {
  const { logout } = useAuth();
  const { search } = useAppLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PortalTab>('overview');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [addDependentOpen, setAddDependentOpen] = useState(false);
  const [addSelfOpen, setAddSelfOpen] = useState(false);
  const [editPersonalInformationOpen, setEditPersonalInformationOpen] = useState(false);
  const [patientCardOpen, setPatientCardOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<
    PatientPortalOverview['invoices'][number] | null
  >(null);
  const bookingParams = new URLSearchParams(search);
  const requestedDoctorId = bookingParams.get('book') ?? undefined;
  const requestedBranchId = bookingParams.get('branch') ?? undefined;
  const requestedDepartmentId = bookingParams.get('department') ?? undefined;
  const [bookingOpen, setBookingOpen] = useState(Boolean(requestedDoctorId));
  const [appointmentScope, setAppointmentScope] = useState<'upcoming' | 'past'>('upcoming');
  const [appointmentStatus, setAppointmentStatus] = useState<PortalAppointment['status'] | ''>('');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PortalAppointment | null>(
    null,
  );

  const contextQuery = useQuery({
    queryKey: ['patient-portal-context'],
    queryFn: patientPortalApi.context,
  });

  useEffect(() => {
    if (!selectedPatientId && contextQuery.data?.patients[0]) {
      setSelectedPatientId(contextQuery.data.patients[0].id);
    }
  }, [contextQuery.data, selectedPatientId]);

  const query = useQuery({
    queryKey: ['patient-portal-overview', selectedPatientId],
    queryFn: () => patientPortalApi.overview(selectedPatientId),
    enabled: Boolean(selectedPatientId),
  });

  const invoiceQuery = useQuery({
    queryKey: ['patient-portal-invoice', selectedPatientId, selectedInvoice?.id],
    queryFn: () => patientPortalApi.invoice(selectedPatientId, selectedInvoice!.id),
    enabled: Boolean(selectedPatientId && selectedInvoice?.id),
  });

  const appointmentsQuery = useQuery({
    queryKey: [
      'patient-portal-appointments',
      selectedPatientId,
      appointmentScope,
      appointmentStatus,
      appointmentPage,
    ],
    queryFn: () =>
      patientPortalApi.appointments({
        patientId: selectedPatientId,
        scope: appointmentScope,
        status: appointmentStatus || undefined,
        page: appointmentPage,
        limit: 10,
      }),
    enabled: Boolean(selectedPatientId && tab === 'appointments'),
  });

  useEffect(
    () => setAppointmentPage(1),
    [appointmentScope, appointmentStatus, selectedPatientId],
  );

  const patientSaved = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setAddDependentOpen(false);
    setAddSelfOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['patient-portal-context'] });
    await queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] });
  };

  const closeBooking = () => {
    setBookingOpen(false);
    if (requestedDoctorId) navigate('/portal', { replace: true });
  };

  const personalInformationSaved = async () => {
    setEditPersonalInformationOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['patient-portal-context'] }),
      queryClient.invalidateQueries({
        queryKey: ['patient-portal-overview', selectedPatientId],
      }),
    ]);
  };

  if (contextQuery.isLoading) {
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Loading your portal…</strong>
        <span>This may take a moment.</span>
      </main>
    );
  }

  if (contextQuery.isError || !contextQuery.data) {
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
                className={`ph ${portalContext.account.type === 'GUARDIAN' ? 'ph-users-three' : 'ph-user-circle-plus'}`}
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

  if (query.isLoading || !selectedPatientId) {
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Loading your health record…</strong>
        <span>This may take a moment.</span>
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="patient-portal-state patient-portal-state--error">
        <i className="ph ph-warning-circle" />
        <strong>We could not load your portal</strong>
        <span>Your information remains secure. Please try again.</span>
        <button onClick={() => void query.refetch()} type="button">
          Try again
        </button>
      </main>
    );
  }

  const data = query.data;
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTab('profile');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
            }}
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
          <PortalOverviewTab
            data={data}
            onNavigateTab={(targetTab, options) => {
              setTab(targetTab);
              if (options?.scope) {
                setAppointmentScope(options.scope);
                setAppointmentStatus('');
              }
            }}
          />
        ) : null}

        {tab === 'appointments' ? (
          <PortalAppointmentsTab
            appointmentsQuery={appointmentsQuery}
            appointmentScope={appointmentScope}
            setAppointmentScope={setAppointmentScope}
            appointmentStatus={appointmentStatus}
            setAppointmentStatus={setAppointmentStatus}
            appointmentPage={appointmentPage}
            setAppointmentPage={setAppointmentPage}
            onOpenBooking={() => setBookingOpen(true)}
            onReschedule={(appt) => setRescheduleAppointment(appt)}
          />
        ) : null}

        {tab === 'results' ? <PortalResultsTab data={data} /> : null}

        {tab === 'medicines' ? <PortalMedicinesTab data={data} /> : null}

        {tab === 'documents' ? <PortalDocuments patientId={selectedPatientId} /> : null}

        {tab === 'billing' ? (
          <PortalBillingTab
            invoices={data.invoices}
            onSelectInvoice={(inv) => setSelectedInvoice(inv)}
          />
        ) : null}

        {tab === 'profile' ? (
          <PortalProfileTab
            patient={patient}
            portalContext={portalContext}
            selectedPatientContext={selectedPatientContext}
            onViewPatientCard={() => setPatientCardOpen(true)}
            onNavigateToDocuments={() => setTab('documents')}
            onEditPersonalInformation={() => setEditPersonalInformationOpen(true)}
          />
        ) : null}
      </main>

      <PortalPatientCardModal
        open={patientCardOpen}
        onClose={() => setPatientCardOpen(false)}
        patient={patient}
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
          initialBranchId={requestedBranchId}
          initialDepartmentId={requestedDepartmentId}
          initialDoctorId={requestedDoctorId}
          onCancel={closeBooking}
          onBooked={() => {
            closeBooking();
            setTab('appointments');
          }}
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

      <PortalInvoiceDetailModal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        invoiceQuery={invoiceQuery}
      />
    </div>
  );
}
