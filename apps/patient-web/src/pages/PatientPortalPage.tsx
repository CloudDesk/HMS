import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  patientPortalApi,
  type PatientPortalOverview,
  type PortalAppointment,
  type PortalInvoiceDetails,
} from '../api/patient-portal';
import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { PortalPatientForm } from '../components/patient-portal/PortalPatientForm';
import { PortalAppointmentBooking } from '../components/patient-portal/PortalAppointmentBooking';
import { PortalAppointmentRescheduling } from '../components/patient-portal/PortalAppointmentRescheduling';
import { PortalPersonalInformationForm } from '../components/patient-portal/PortalPersonalInformationForm';
import { PortalDocuments } from '../components/patient-portal/PortalDocuments';
import { navigate, useAppLocation } from '../routing/navigation';

type PortalTab =
  'overview' | 'appointments' | 'results' | 'medicines' | 'documents' | 'billing' | 'profile';
const tabs: Array<{ key: PortalTab; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'ph-house' },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank' },
  { key: 'results', label: 'Reports & results', icon: 'ph-file-text' },
  { key: 'medicines', label: 'Prescriptions', icon: 'ph-prescription' },
  { key: 'documents', label: 'Documents', icon: 'ph-files' },
  { key: 'billing', label: 'Billing', icon: 'ph-receipt' },
  { key: 'profile', label: 'My profile', icon: 'ph-user-circle' },
];

const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
const money = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value);
const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const fullName = (patient: { first_name: string; middle_name: string | null; last_name: string }) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');
const relationshipTag = (relationship: string) => {
  if (relationship === 'SELF') return 'Self';
  if (relationship === 'PARENT') return 'My child';
  if (relationship === 'LEGAL_GUARDIAN') return 'Under my care';
  return label(relationship);
};
const ageOnDate = (value: string) => {
  const birthDate = new Date(value);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) years -= 1;
  return Math.max(0, years);
};

const downloadInvoicePdf = async (invoice: PortalInvoiceDetails) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const amount = (value: number) => `KES ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value)}`;
  const patientAddress = invoice.patient
    ? Object.values(invoice.patient.address).filter(Boolean).join(', ')
    : '';
  const branchAddress = invoice.branch
    ? [invoice.branch.address, invoice.branch.city, invoice.branch.state, invoice.branch.country, invoice.branch.postal_code]
        .filter(Boolean)
        .join(', ')
    : '';
  let y = 18;
  const ensureSpace = (height: number) => {
    if (y + height <= 282) return;
    pdf.addPage();
    y = 18;
  };

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  pdf.text('HMS', 16, y);
  pdf.setFontSize(14);
  pdf.text('OFFICIAL HOSPITAL INVOICE', 194, y, { align: 'right' });
  y += 8;
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.8);
  pdf.line(16, y, 194, y);
  y += 9;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.branch?.name || 'HMS Hospital', 16, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Invoice: ${invoice.invoice_number}`, 194, y, { align: 'right' });
  y += 5;
  if (branchAddress) pdf.text(pdf.splitTextToSize(branchAddress, 85), 16, y);
  pdf.text(`Issued: ${date(invoice.invoice_date)}`, 194, y, { align: 'right' });
  y += branchAddress ? 12 : 7;

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(16, y, 178, 25, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('BILL TO', 20, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.text(invoice.patient?.name || 'Patient', 20, y + 12);
  pdf.text(`MRN: ${invoice.patient?.patient_number || '-'}`, 20, y + 18);
  if (patientAddress) pdf.text(pdf.splitTextToSize(patientAddress, 80), 105, y + 12);
  y += 34;

  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIPTION', 18, y);
  pdf.text('QTY', 130, y, { align: 'right' });
  pdf.text('UNIT RATE', 160, y, { align: 'right' });
  pdf.text('AMOUNT', 192, y, { align: 'right' });
  y += 3;
  pdf.setLineWidth(0.2);
  pdf.line(16, y, 194, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  invoice.items.forEach((item) => {
    const description = pdf.splitTextToSize(item.service_name, 92) as string[];
    const rowHeight = Math.max(7, description.length * 5);
    ensureSpace(rowHeight + 3);
    pdf.text(description, 18, y);
    pdf.text(String(item.quantity), 130, y, { align: 'right' });
    pdf.text(amount(item.unit_price), 160, y, { align: 'right' });
    pdf.text(amount(item.line_total), 192, y, { align: 'right' });
    y += rowHeight;
  });
  if (!invoice.items.length) {
    pdf.text('No billed service lines recorded.', 18, y);
    y += 8;
  }
  ensureSpace(50);
  pdf.line(110, y, 194, y);
  y += 7;
  const totalLine = (labelText: string, value: number, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.text(labelText, 140, y, { align: 'right' });
    pdf.text(amount(value), 192, y, { align: 'right' });
    y += 6;
  };
  totalLine('Subtotal', invoice.subtotal);
  totalLine('Discount', invoice.discount_amount);
  totalLine('Tax', invoice.tax_amount);
  totalLine('Invoice total', invoice.total_amount, true);
  totalLine('Amount paid', invoice.paid_amount);
  totalLine('Balance due', invoice.balance_amount, true);

  if (invoice.payments.length) {
    ensureSpace(18 + invoice.payments.length * 7);
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text('PAYMENT HISTORY', 16, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    invoice.payments.forEach((payment) => {
      pdf.text(`${date(payment.payment_date)}  ${payment.payment_number}  ${label(payment.payment_method)}`, 18, y);
      pdf.text(amount(payment.amount), 192, y, { align: 'right' });
      y += 7;
    });
  }
  ensureSpace(18);
  y += 7;
  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.balance_amount > 0 ? `AMOUNT DUE: ${amount(invoice.balance_amount)}` : 'PAID IN FULL', 194, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('This invoice was generated from the HMS hospital billing record.', 16, 290);
  pdf.save(`${invoice.invoice_number}.pdf`);
};

function Empty({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="portal-empty">
      <i className={`ph ${icon}`} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

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
  const [selectedInvoice, setSelectedInvoice] = useState<PatientPortalOverview['invoices'][number] | null>(null);
  const bookingParams = new URLSearchParams(search);
  const requestedDoctorId = bookingParams.get('book') ?? undefined;
  const requestedBranchId = bookingParams.get('branch') ?? undefined;
  const requestedDepartmentId = bookingParams.get('department') ?? undefined;
  const [bookingOpen, setBookingOpen] = useState(Boolean(requestedDoctorId));
  const [appointmentScope, setAppointmentScope] = useState<'upcoming' | 'past'>('upcoming');
  const [appointmentStatus, setAppointmentStatus] = useState<PortalAppointment['status'] | ''>('');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PortalAppointment | null>(null);
  const contextQuery = useQuery({
    queryKey: ['patient-portal-context'],
    queryFn: patientPortalApi.context,
  });
  useEffect(() => {
    if (!selectedPatientId && contextQuery.data?.patients[0])
      setSelectedPatientId(contextQuery.data.patients[0].id);
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
    queryKey: ['patient-portal-appointments', selectedPatientId, appointmentScope, appointmentStatus, appointmentPage],
    queryFn: () => patientPortalApi.appointments({
      patientId: selectedPatientId,
      scope: appointmentScope,
      status: appointmentStatus || undefined,
      page: appointmentPage,
      limit: 10,
    }),
    enabled: Boolean(selectedPatientId && tab === 'appointments'),
  });

  useEffect(() => setAppointmentPage(1), [appointmentScope, appointmentStatus, selectedPatientId]);

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
      queryClient.invalidateQueries({ queryKey: ['patient-portal-overview', selectedPatientId] }),
    ]);
  };

  if (contextQuery.isLoading)
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
              mode={portalContext.account.type === 'GUARDIAN' ? 'DEPENDENT' : 'SELF'}
              onSaved={(patientId) => void patientSaved(patientId)}
            />
          </section>
        </main>
      </div>
    );
  }

  if (query.isLoading || !selectedPatientId)
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Loading your health record…</strong>
        <span>This may take a moment.</span>
      </main>
    );
  if (query.isError || !query.data)
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

  const data = query.data;
  const hasSelfProfile = portalContext.patients.some((item) => item.relationship === 'SELF');
  const patient = data.patient;
  const nextAppointment = [...data.appointments]
    .filter(
      (item) =>
        new Date(item.appointment_date).getTime() >= new Date().setHours(0, 0, 0, 0) &&
        !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(item.status),
    )
    .sort(
      (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime(),
    )[0];
  const initials = `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`.toUpperCase();
  const selectedPatientContext = portalContext.patients.find(
    (item) => item.id === selectedPatientId,
  );
  const patientAddress = [
    patient.address.line1,
    patient.address.city,
    patient.address.state,
    patient.address.country,
    patient.address.postalCode ?? patient.address.postal_code,
  ]
    .filter(Boolean)
    .join(', ');
  const emergencyContact = patient.emergency_contact;
  const patientAge = ageOnDate(patient.date_of_birth);
  const isMinor = patientAge < 18;
  const guardianProfile = portalContext.account.guardian_profile;
  const guardianAddress = guardianProfile
    ? [
        guardianProfile.address.line1,
        guardianProfile.address.city,
        guardianProfile.address.state,
        guardianProfile.address.country,
        guardianProfile.address.postalCode ?? guardianProfile.address.postal_code,
      ].filter(Boolean).join(', ')
    : '';
  const showGuardianDetails = Boolean(
    isMinor && selectedPatientContext && selectedPatientContext.relationship !== 'SELF',
  );
  const patientEmailDisplay = showGuardianDetails && patient.email === portalContext.account.email
    ? 'Managed through guardian'
    : patient.email || 'Not recorded';
  const patientPhoneDisplay = showGuardianDetails && patient.phone === portalContext.account.phone
    ? 'Managed through guardian'
    : patient.phone || 'Not recorded';
  const billingTotals = data.invoices.reduce(
    (totals, invoice) => ({
      billed: totals.billed + invoice.total_amount,
      paid: totals.paid + invoice.paid_amount,
      due: totals.due + invoice.balance_amount,
    }),
    { billed: 0, paid: 0, due: 0 },
  );

  return (
    <div className="patient-portal">
      <header className="patient-portal-header">
        <button className="patient-portal-brand" onClick={() => setTab('overview')} type="button">
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
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('profile'); } }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
            }}
          >
            <div className="patient-avatar">{initials}</div>
            <div style={{ display: 'grid', maxWidth: '160px' }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {patient.first_name} {patient.last_name}
              </strong>
              <small>{patient.patient_number}</small>
              {portalContext.account.type === 'GUARDIAN' && selectedPatientContext ? (
                <span style={{
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
                }}>
                  <i className="ph ph-eye" style={{ fontSize: '0.7rem', flex: 'none' }} />
                  {selectedPatientContext.full_name} · {relationshipTag(selectedPatientContext.relationship)}
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
                <button className="secondary" onClick={() => setAddSelfOpen(true)} type="button">
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
                <span>Here is a clear view of your care and recent records.</span>
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
                    <p>Next appointment</p>
                    <h2>Your upcoming visit</h2>
                  </div>
                  <button onClick={() => setTab('appointments')} type="button">
                    All appointments
                  </button>
                </header>
                {nextAppointment ? (
                  <div className="portal-appointment-card">
                    <div className="portal-date-tile">
                      <strong>{new Date(nextAppointment.appointment_date).getDate()}</strong>
                      <span>
                        {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                          new Date(nextAppointment.appointment_date),
                        )}
                      </span>
                    </div>
                    <div className="portal-appointment-info">
                      <span className={`portal-status ${nextAppointment.status.toLowerCase()}`}>
                        {label(nextAppointment.status)}
                      </span>
                      <h3>{nextAppointment.doctor_name}</h3>
                      <p>{nextAppointment.doctor_specialization}</p>
                      <div>
                        <span>
                          <i className="ph ph-clock" /> {nextAppointment.start_time}–
                          {nextAppointment.end_time}
                        </span>
                        <span>
                          <i className="ph ph-stethoscope" /> {label(nextAppointment.visit_type)}
                        </span>
                        {nextAppointment.branch ? (
                          <span>
                            <i className="ph ph-map-pin" /> {nextAppointment.branch.name}
                            {nextAppointment.branch.city ? `, ${nextAppointment.branch.city}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>
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
        ) : null}

        {tab === 'appointments' ? (
          <section className="portal-page-section portal-appointments-page">
            <header>
              <div>
                <p>My care schedule</p>
                <h1>Appointments</h1>
                <span>Review upcoming visits and your complete appointment history.</span>
              </div>
              <button
                className="portal-book-action"
                onClick={() => setBookingOpen(true)}
                type="button"
              >
                <i className="ph ph-calendar-plus" /> Book appointment
              </button>
            </header>
            <div className="portal-appointment-toolbar">
              <div className="portal-appointment-tabs" role="tablist" aria-label="Appointment period">
                <button aria-selected={appointmentScope === 'upcoming'} className={appointmentScope === 'upcoming' ? 'active' : ''} onClick={() => { setAppointmentScope('upcoming'); setAppointmentStatus(''); }} role="tab" type="button"><i className="ph ph-calendar-check" /> Upcoming</button>
                <button aria-selected={appointmentScope === 'past'} className={appointmentScope === 'past' ? 'active' : ''} onClick={() => { setAppointmentScope('past'); setAppointmentStatus(''); }} role="tab" type="button"><i className="ph ph-clock-counter-clockwise" /> Past & history</button>
              </div>
              <div className="portal-appointment-status-filter">
                <span>Status</span>
                <select
                  onChange={(event) => setAppointmentStatus(event.target.value as PortalAppointment['status'] | '')}
                  value={appointmentStatus}
                >
                  <option value="">All statuses</option>
                  {(appointmentScope === 'upcoming'
                    ? ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN']
                    : ['COMPLETED', 'NO_SHOW', 'SKIPPED', 'RESCHEDULED', 'CANCELLED']
                  ).map((status) => (
                    <option key={status} value={status}>{label(status)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="portal-list-panel">
              {appointmentsQuery.isLoading ? <div className="portal-empty"><div className="portal-spinner" /><strong>Loading appointments…</strong></div> : appointmentsQuery.isError ? <div className="portal-empty"><i className="ph ph-warning-circle" /><strong>Appointments could not be loaded</strong><button onClick={() => void appointmentsQuery.refetch()} type="button">Try again</button></div> : appointmentsQuery.data?.data.length ? (
                appointmentsQuery.data.data.map((item) => (
                  <article className="portal-list-row" key={item.id}>
                    <div className="portal-list-icon">
                      <i className="ph ph-calendar-blank" />
                    </div>
                    <div className="portal-list-main">
                      <div>
                        <h3>{item.doctor_name}</h3>
                        <span>{item.doctor_specialization}</span>
                      </div>
                      <p>
                        <i className="ph ph-calendar" /> {date(item.appointment_date)} &nbsp;{' '}
                        <i className="ph ph-clock" /> {item.start_time}–{item.end_time}
                      </p>
                      {item.branch ? (
                        <small>
                          <i className="ph ph-map-pin" /> {item.branch.name}
                          {item.branch.address
                            ? ` · ${item.branch.address}`
                            : item.branch.city
                              ? ` · ${item.branch.city}`
                              : ''}
                        </small>
                      ) : null}
                      <small>{item.reason || label(item.visit_type)}</small>
                    </div>
                    <div className="portal-list-end">
                      <span className={`portal-status ${item.status.toLowerCase()}`}>
                        {label(item.status)}
                      </span>
                      <small>{item.appointment_number}</small>
                      {['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(item.status) ? <button className="portal-reschedule-action" onClick={() => setRescheduleAppointment(item)} type="button"><i className="ph ph-calendar-dots" /> Reschedule</button> : null}
                      {item.status === 'RESCHEDULED' && item.rescheduled_to_id ? <span className="portal-history-note"><i className="ph ph-arrow-bend-down-right" /> Replaced by a new appointment</span> : null}
                    </div>
                  </article>
                ))
              ) : (
                <Empty
                  icon="ph-calendar-x"
                  title={appointmentScope === 'upcoming' ? 'No upcoming appointments' : 'No appointment history'}
                  message={appointmentScope === 'upcoming' ? 'Use Book appointment to choose a doctor and live available time.' : 'Completed, missed and rescheduled appointments will appear here.'}
                />
              )}
            </div>
            {appointmentsQuery.data && appointmentsQuery.data.meta.totalPages > 1 ? <nav className="portal-appointment-pagination" aria-label="Appointment pages"><button disabled={appointmentPage <= 1} onClick={() => setAppointmentPage((page) => page - 1)} type="button"><i className="ph ph-caret-left" /> Previous</button><span>Page {appointmentsQuery.data.meta.page} of {appointmentsQuery.data.meta.totalPages}</span><button disabled={appointmentPage >= appointmentsQuery.data.meta.totalPages} onClick={() => setAppointmentPage((page) => page + 1)} type="button">Next <i className="ph ph-caret-right" /></button></nav> : null}
          </section>
        ) : null}

        {tab === 'results' ? (
          <section className="portal-page-section">
            <header>
              <div>
                <p>Verified clinical records</p>
                <h1>Reports & results</h1>
                <span>Only reports verified by your care team are displayed.</span>
              </div>
            </header>
            <div className="portal-results-grid">
              <article className="portal-panel">
                <header>
                  <div>
                    <p>Laboratory</p>
                    <h2>Test results</h2>
                  </div>
                </header>
                {data.laboratory_results.length ? (
                  data.laboratory_results.map((result) => (
                    <div className="portal-result" key={result.id}>
                      <div>
                        <i className="ph ph-flask" />
                        <span>
                          <strong>
                            {result.result_items.map((item) => item.serviceName).join(', ') ||
                              'Laboratory result'}
                          </strong>
                          <small>Verified {date(result.verified_at)}</small>
                        </span>
                      </div>
                      {result.result_items.map((item, index) => (
                        <dl key={`${result.id}-${index}`}>
                          <dt>{item.serviceName}</dt>
                          <dd>
                            {item.value}
                            {item.unit ? ` ${item.unit}` : ''}
                          </dd>
                        </dl>
                      ))}
                      {result.remarks ? <p>{result.remarks}</p> : null}
                    </div>
                  ))
                ) : (
                  <Empty
                    icon="ph-flask"
                    title="No verified lab results"
                    message="Verified laboratory results will appear here."
                  />
                )}
              </article>
              <article className="portal-panel">
                <header>
                  <div>
                    <p>Imaging</p>
                    <h2>Reports</h2>
                  </div>
                </header>
                {data.imaging_reports.length ? (
                  data.imaging_reports.map((report) => (
                    <div className="portal-result" key={report.id}>
                      <div>
                        <i className="ph ph-scan" />
                        <span>
                          <strong>Imaging report</strong>
                          <small>Verified {date(report.verified_at)}</small>
                        </span>
                      </div>
                      <dl>
                        <dt>Impression</dt>
                        <dd>{report.impression}</dd>
                      </dl>
                      {report.recommendations ? (
                        <p>
                          <strong>Recommendation:</strong> {report.recommendations}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <Empty
                    icon="ph-scan"
                    title="No verified imaging reports"
                    message="Verified imaging reports will appear here."
                  />
                )}
              </article>
            </div>
          </section>
        ) : null}

        {tab === 'medicines' ? (
          <section className="portal-page-section">
            <header>
              <div>
                <p>Medication records</p>
                <h1>Prescriptions & purchased medicines</h1>
                <span>
                  Review medicines prescribed by your doctors and items recorded by the hospital
                  pharmacy.
                </span>
              </div>
            </header>
            <div className="portal-results-grid portal-medications-grid">
              <article className="portal-panel">
                <header>
                  <div>
                    <p>Clinical record</p>
                    <h2>Prescriptions</h2>
                  </div>
                  <span className="portal-record-count">{data.prescriptions.length}</span>
                </header>
                {data.prescriptions.length ? (
                  data.prescriptions.map((prescription) => (
                    <div className="portal-result portal-prescription" key={prescription.id}>
                      <div>
                        <i className="ph ph-prescription" />
                        <span>
                          <strong>Dr. {prescription.doctor_name.replace(/^Dr\.?\s+/i, '')}</strong>
                          <small>
                            Issued {date(prescription.submitted_at)} · {label(prescription.status)}
                          </small>
                        </span>
                      </div>
                      <div className="portal-medication-items">
                        {prescription.items.map((item) => (
                          <div className="portal-medication-item" key={item.id}>
                            <div>
                              <strong>
                                {item.medicine_name}
                                {item.strength ? ` ${item.strength}` : ''}
                              </strong>
                              {item.quantity ? <span>Qty {item.quantity}</span> : null}
                            </div>
                            <p>
                              {[item.dosage, item.route, item.frequency, item.duration]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {item.instructions ? <small>{item.instructions}</small> : null}
                          </div>
                        ))}
                      </div>
                      {prescription.patient_instructions ? (
                        <p>
                          <strong>Instructions:</strong> {prescription.patient_instructions}
                        </p>
                      ) : null}
                      {prescription.follow_up_date ? (
                        <p>
                          <strong>Follow-up:</strong> {date(prescription.follow_up_date)}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <Empty
                    icon="ph-prescription"
                    title="No prescriptions available"
                    message="Submitted prescriptions from your doctors will appear here."
                  />
                )}
              </article>
              <article className="portal-panel">
                <header>
                  <div>
                    <p>Hospital pharmacy</p>
                    <h2>Purchased medicines</h2>
                  </div>
                  <span className="portal-record-count">{data.purchased_medicines.length}</span>
                </header>
                {data.purchased_medicines.length ? (
                  data.purchased_medicines.map((purchase) => (
                    <div className="portal-result portal-purchase" key={purchase.id}>
                      <div>
                        <i className="ph ph-pill" />
                        <span>
                          <strong>{purchase.medicine_name}</strong>
                          <small>
                            {date(purchase.purchased_at)} · {purchase.invoice_number}
                          </small>
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Quantity</dt>
                          <dd>{purchase.quantity}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>{money(purchase.total_amount)}</dd>
                        </div>
                      </dl>
                      <p>
                        <span className={`portal-status ${purchase.payment_status.toLowerCase()}`}>
                          {label(purchase.payment_status)}
                        </span>
                        {purchase.branch
                          ? ` · ${purchase.branch.name}${purchase.branch.city ? `, ${purchase.branch.city}` : ''}`
                          : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon="ph-pill"
                    title="No pharmacy purchases"
                    message="Medicines billed by the hospital pharmacy will appear here."
                  />
                )}
              </article>
            </div>
          </section>
        ) : null}

        {tab === 'documents' ? <PortalDocuments patientId={selectedPatientId} /> : null}

        {tab === 'billing' ? (
          <section className="portal-page-section portal-billing-page">
            <header>
              <div>
                <p>Financial records</p>
                <h1>Billing</h1>
                <span>See what was billed, what has been paid, and whether anything remains due.</span>
              </div>
            </header>
            {data.invoices.length ? (
              <>
                <div className="portal-billing-summary">
                  <article><i className="ph ph-receipt" /><span>Total billed</span><strong>{money(billingTotals.billed)}</strong></article>
                  <article><i className="ph ph-check-circle" /><span>Total paid</span><strong>{money(billingTotals.paid)}</strong></article>
                  <article className={billingTotals.due > 0 ? 'has-balance' : 'settled'}>
                    <i className={`ph ${billingTotals.due > 0 ? 'ph-warning-circle' : 'ph-shield-check'}`} />
                    <span>{billingTotals.due > 0 ? 'Amount due' : 'Account status'}</span>
                    <strong>{billingTotals.due > 0 ? money(billingTotals.due) : 'Paid in full'}</strong>
                  </article>
                </div>
                <div className="portal-billing-list">
                  {data.invoices.map((item) => {
                    const isPaid = item.balance_amount <= 0 || item.status === 'PAID';
                    const progress = item.total_amount > 0
                      ? Math.min(100, Math.round((item.paid_amount / item.total_amount) * 100))
                      : 100;
                    return (
                      <article className="portal-billing-card" key={item.id}>
                        <div className="portal-billing-card-head">
                          <div className="portal-list-icon"><i className="ph ph-receipt" /></div>
                          <div><h2>{item.invoice_number}</h2><span>Issued {date(item.invoice_date)}</span></div>
                          <span className={`portal-status ${item.status.toLowerCase()}`}>{label(item.status)}</span>
                        </div>
                        <div className="portal-billing-amounts">
                          <div><span>Invoice total</span><strong>{money(item.total_amount)}</strong></div>
                          <div><span>Amount paid</span><strong>{money(item.paid_amount)}</strong></div>
                          <div className={isPaid ? 'paid' : 'due'}>
                            <span>{isPaid ? 'Payment status' : 'Amount due'}</span>
                            <strong>{isPaid ? 'Paid in full' : money(item.balance_amount)}</strong>
                          </div>
                        </div>
                        <div className="portal-payment-progress" aria-label={`${progress}% paid`}><span style={{ width: `${progress}%` }} /></div>
                        <footer>
                          <small>{isPaid ? 'No payment is currently required.' : `${money(item.balance_amount)} remains outstanding.`}</small>
                          <button onClick={() => setSelectedInvoice(item)} type="button">View invoice <i className="ph ph-arrow-right" /></button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="portal-list-panel">
                <Empty icon="ph-receipt" title="No issued invoices" message="Hospital invoices will appear here after they are issued." />
              </div>
            )}
          </section>
        ) : null}

        {tab === 'profile' ? (
          <section className="portal-page-section">
            <header>
              <div>
                <p>Patient identity</p>
                <h1>My profile</h1>
                <span>
                  Review and maintain personal, contact, address and emergency information.
                </span>
              </div>
              <div className="portal-section-actions">
                <button
                  className="portal-book-action secondary"
                  onClick={() => setPatientCardOpen(true)}
                  type="button"
                >
                  <i className="ph ph-identification-card" /> View patient card
                </button>
                <button
                  className="portal-book-action secondary"
                  onClick={() => setTab('documents')}
                  type="button"
                >
                  <i className="ph ph-upload-simple" /> Upload previous record
                </button>
                <button
                  className="portal-book-action"
                  onClick={() => setEditPersonalInformationOpen(true)}
                  type="button"
                >
                  <i className="ph ph-pencil-simple" /> Edit personal information
                </button>
              </div>
            </header>
            <article className="portal-profile-card">
              <div className="portal-profile-head">
                <div className="patient-avatar large">{initials}</div>
                <div>
                  <h2>{fullName(patient)}</h2>
                  <span>{patient.patient_number}</span>
                </div>
                <span className="portal-status confirmed">Active patient</span>
              </div>
              <div className="portal-profile-grid">
                <div>
                  <small>Date of birth</small>
                  <strong>{date(patient.date_of_birth)}</strong>
                </div>
                <div>
                  <small>Gender</small>
                  <strong>{label(patient.gender)}</strong>
                </div>
                <div>
                  <small>Blood group</small>
                  <strong>{patient.blood_group || 'Not recorded'}</strong>
                </div>
                <div>
                  <small>Email</small>
                  <strong>{patientEmailDisplay}</strong>
                </div>
                <div>
                  <small>Phone</small>
                  <strong>{patientPhoneDisplay}</strong>
                </div>
                <div>
                  <small>Preferred branch</small>
                  <strong>
                    {selectedPatientContext?.preferred_branch?.name || 'Not recorded'}
                  </strong>
                </div>
                <div>
                  <small>Address</small>
                  <strong>{patientAddress || 'Not recorded'}</strong>
                </div>
                <div>
                  <small>Emergency contact</small>
                  <strong>
                    {emergencyContact?.name
                      ? `${emergencyContact.name}${emergencyContact.relationship ? ` · ${emergencyContact.relationship}` : ''}`
                      : 'Not recorded'}
                  </strong>
                </div>
                <div>
                  <small>Emergency phone</small>
                  <strong>{emergencyContact?.phone || 'Not recorded'}</strong>
                </div>
              </div>
              <div className="portal-profile-note">
                <i className="ph ph-info" />
                <span>
                  Changes are saved to this patient’s HMS record and recorded in the audit history.
                </span>
              </div>
            </article>
            {showGuardianDetails ? (
              <article className="portal-guardian-card">
                <header>
                  <span><i className="ph ph-users-three" /></span>
                  <div>
                    <p>Responsible adult</p>
                    <h2>Parent / guardian details</h2>
                    <small>These details belong to the adult managing this child’s care.</small>
                  </div>
                  <span className="portal-relationship-badge">
                    {label(selectedPatientContext?.relationship || guardianProfile?.relationship || 'PARENT')}
                  </span>
                </header>
                <div className="portal-guardian-grid">
                  <div><small>Full name</small><strong>{portalContext.account.full_name}</strong></div>
                  <div><small>Mobile number</small><strong>{portalContext.account.phone || 'Not recorded'}</strong></div>
                  <div><small>Email</small><strong>{portalContext.account.email || 'Not recorded'}</strong></div>
                  <div><small>Address</small><strong>{guardianAddress || 'Not recorded'}</strong></div>
                  <div>
                    <small>Identification</small>
                    <strong>
                      {guardianProfile?.identification.type || guardianProfile?.identification.number
                        ? [guardianProfile.identification.type, guardianProfile.identification.number].filter(Boolean).join(' · ')
                        : 'Not recorded'}
                    </strong>
                  </div>
                  <div>
                    <small>Guardian consent</small>
                    <strong className={guardianProfile?.legal_consent_accepted ? 'guardian-consent-verified' : ''}>
                      {guardianProfile?.legal_consent_accepted ? 'Confirmed' : 'Not recorded'}
                    </strong>
                  </div>
                </div>
                <footer>
                  <i className="ph ph-shield-check" />
                  Guardian contact information is stored separately and is not treated as the child’s own contact information.
                </footer>
              </article>
            ) : null}
          </section>
        ) : null}
      </main>
      <Modal
        icon="ph-identification-card"
        onClose={() => setPatientCardOpen(false)}
        open={patientCardOpen}
        title="Patient ID Card"
      >
        <div className="portal-patient-card-modal">
          <div className="portal-patient-id-card">
            <div className="portal-id-card-head">
              <div className="portal-id-card-brand"><span>H</span><div><strong>HMS Enterprise</strong><small>Hospital Management System</small></div></div>
              <span className="portal-id-card-type">Patient ID</span>
              <div className="portal-id-card-person">
                <div>{initials}</div>
                <span><strong>{fullName(patient)}</strong><small>{patient.patient_number}</small></span>
              </div>
            </div>
            <div className="portal-id-card-body">
              <div className="portal-id-card-grid">
                <div><small>Date of birth</small><strong>{date(patient.date_of_birth)}</strong></div>
                <div><small>Age / gender</small><strong>{patientAge} yrs · {label(patient.gender)}</strong></div>
                <div><small>Phone</small><strong>{patientPhoneDisplay}</strong></div>
                <div><small>Status</small><strong className="active">{label(patient.status)}</strong></div>
                <div><small>Registered</small><strong>{date(patient.created_at)}</strong></div>
                <div><small>Blood group</small><strong>{patient.blood_group || 'Not recorded'}</strong></div>
              </div>
              <div className="portal-id-card-barcode">
                <div><span>{[24,18,28,14,22,28,16,24,12,28,20,16,28,18,24,28,14,20,28,16,24,12,28,18,24,16,28,22].map((height, index) => <i key={index} style={{ height, width: index % 3 === 0 ? 3 : 1.5 }} />)}</span><small>{patient.patient_number}</small></div>
                <div><small>Valid for</small><strong>All departments</strong></div>
              </div>
            </div>
            <footer><span>This card is non-transferable</span><span>Generated: {date(new Date().toISOString())}</span></footer>
          </div>
          <div className="portal-patient-card-actions">
            <button onClick={() => setPatientCardOpen(false)} type="button">Close</button>
            <button className="primary" onClick={() => window.print()} type="button"><i className="ph ph-printer" /> Print card</button>
          </div>
        </div>
      </Modal>
      <Modal
        icon="ph-pencil-simple"
        onClose={() => setEditPersonalInformationOpen(false)}
        open={editPersonalInformationOpen}
        size="large"
        title={showGuardianDetails ? 'Edit child and guardian information' : 'Edit personal information'}
      >
        <PortalPersonalInformationForm
          guardian={showGuardianDetails && guardianProfile ? {
            full_name: portalContext.account.full_name,
            email: portalContext.account.email,
            phone: portalContext.account.phone,
            relationship: selectedPatientContext?.relationship === 'LEGAL_GUARDIAN' ? 'LEGAL_GUARDIAN' : 'PARENT',
            address: guardianProfile.address,
            identification: guardianProfile.identification,
            legal_consent_accepted: guardianProfile.legal_consent_accepted,
          } : undefined}
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
        {rescheduleAppointment ? <PortalAppointmentRescheduling appointment={rescheduleAppointment} onCancel={() => setRescheduleAppointment(null)} onSaved={() => { setRescheduleAppointment(null); setAppointmentScope('upcoming'); setAppointmentStatus(''); setAppointmentPage(1); }} /> : null}
      </Modal>
      <Modal
        icon="ph-receipt"
        onClose={() => setSelectedInvoice(null)}
        open={Boolean(selectedInvoice)}
        size="large"
        title="Invoice details"
      >
        {invoiceQuery.isLoading ? (
          <div className="portal-empty"><div className="portal-spinner" /><strong>Loading hospital invoice…</strong></div>
        ) : invoiceQuery.isError ? (
          <div className="portal-empty">
            <i className="ph ph-warning-circle" />
            <strong>Invoice details could not be loaded</strong>
            <button onClick={() => void invoiceQuery.refetch()} type="button">Try again</button>
          </div>
        ) : invoiceQuery.data ? (
          <div className="portal-invoice-details">
            <header>
              <div>
                <small>{invoiceQuery.data.branch?.name || 'HMS Hospital'}</small>
                <h2>{invoiceQuery.data.invoice_number}</h2>
                <span>Issued {date(invoiceQuery.data.invoice_date)} · {invoiceQuery.data.patient?.patient_number || '-'}</span>
              </div>
              <span className={`portal-status ${invoiceQuery.data.status.toLowerCase()}`}>
                {label(invoiceQuery.data.status)}
              </span>
            </header>
            <div className="portal-invoice-patient">
              <i className="ph ph-user-circle" />
              <div><small>Patient</small><strong>{invoiceQuery.data.patient?.name || 'Patient'}</strong></div>
              <div><small>Contact</small><strong>{invoiceQuery.data.patient?.phone || invoiceQuery.data.patient?.email || 'Not recorded'}</strong></div>
            </div>
            <div className="portal-invoice-table-wrap">
              <table className="portal-invoice-table">
                <thead><tr><th>Service or item</th><th>Type</th><th>Qty</th><th>Unit rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {invoiceQuery.data.items.length ? invoiceQuery.data.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.service_name}</strong></td>
                      <td>{label(item.service_type)}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price)}</td>
                      <td><strong>{money(item.line_total)}</strong></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No billed service lines recorded.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="portal-invoice-financials">
              <dl>
                <div><dt>Subtotal</dt><dd>{money(invoiceQuery.data.subtotal)}</dd></div>
                <div><dt>Discount</dt><dd>{money(invoiceQuery.data.discount_amount)}</dd></div>
                <div><dt>Tax</dt><dd>{money(invoiceQuery.data.tax_amount)}</dd></div>
                <div><dt>Invoice total</dt><dd>{money(invoiceQuery.data.total_amount)}</dd></div>
                <div><dt>Amount paid</dt><dd>{money(invoiceQuery.data.paid_amount)}</dd></div>
                <div className={invoiceQuery.data.balance_amount > 0 ? 'due' : 'paid'}>
                  <dt>{invoiceQuery.data.balance_amount > 0 ? 'Amount due' : 'Payment status'}</dt>
                  <dd>{invoiceQuery.data.balance_amount > 0 ? money(invoiceQuery.data.balance_amount) : 'Paid in full'}</dd>
                </div>
              </dl>
            </div>
            {invoiceQuery.data.payments.length ? (
              <div className="portal-invoice-payments">
                <h3>Payment history</h3>
                {invoiceQuery.data.payments.map((payment) => (
                  <div key={payment.id}>
                    <span><strong>{payment.payment_number}</strong><small>{date(payment.payment_date)} · {label(payment.payment_method)}</small></span>
                    <strong>{money(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className={`portal-invoice-message ${invoiceQuery.data.balance_amount > 0 ? 'due' : 'paid'}`}>
              <i className={`ph ${invoiceQuery.data.balance_amount > 0 ? 'ph-warning-circle' : 'ph-check-circle'}`} />
              <span>
                {invoiceQuery.data.balance_amount > 0
                  ? `${money(invoiceQuery.data.balance_amount)} remains to be paid for this invoice.`
                  : 'This invoice is fully paid. No payment is currently required.'}
              </span>
            </div>
            <div className="portal-invoice-actions">
              <button onClick={() => setSelectedInvoice(null)} type="button">Close</button>
              <button className="portal-invoice-download" onClick={() => void downloadInvoicePdf(invoiceQuery.data)} type="button">
                <i className="ph ph-download-simple" /> Download PDF
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
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
