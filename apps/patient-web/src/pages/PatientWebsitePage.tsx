import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FocusEvent, type FormEvent } from 'react';
import { patientPortalApi, type PublicDoctor } from '../api/patient-portal';
import { useAuth } from '../auth/useAuth';
import { appConfig } from '../config';
import { navigate, useAppLocation } from '../routing/navigation';

const money = (value: number) => new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
}).format(value);

const serviceIcon = (type: string) => type === 'LAB_TEST' ? 'ph-flask' : type === 'IMAGING_SERVICE' ? 'ph-scan' : 'ph-stethoscope';
const departmentIcons = ['ph-heartbeat', 'ph-tooth', 'ph-baby', 'ph-brain', 'ph-eye', 'ph-bone', 'ph-first-aid', 'ph-test-tube'];
const publicQueryRecovery = {
  retry: 5,
  retryDelay: (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000),
  refetchOnMount: 'always' as const,
  refetchOnReconnect: true,
  refetchOnWindowFocus: true,
};
type HeaderMenu = 'departments' | 'services' | 'doctors' | null;

function SectionState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="hospital-section-state"><i className={`ph ${retry ? 'ph-warning-circle' : 'ph-spinner-gap'}`} /><span>{message}</span>{retry ? <button onClick={retry} type="button">Try again</button> : null}</div>;
}

export function PatientWebsitePage() {
  const { status, user } = useAuth();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const branchId = params.get('branch_id') ?? '';
  const departmentId = params.get('department_id') ?? '';
  const departmentQuery = params.get('department_q') ?? '';
  const serviceQuery = params.get('service_q') ?? '';
  const requestedDepartmentPage = Number(params.get('department_page') ?? '1');
  const departmentPage = Number.isInteger(requestedDepartmentPage) && requestedDepartmentPage > 0 ? requestedDepartmentPage : 1;
  const requestedServicePage = Number(params.get('service_page') ?? '1');
  const servicePage = Number.isInteger(requestedServicePage) && requestedServicePage > 0 ? requestedServicePage : 1;
  const requestedDoctorPage = Number(params.get('doctor_page') ?? '1');
  const doctorPage = Number.isInteger(requestedDoctorPage) && requestedDoctorPage > 0 ? requestedDoctorPage : 1;
  const [departmentSearch, setDepartmentSearch] = useState(departmentQuery);
  const [serviceSearch, setServiceSearch] = useState(serviceQuery);
  const [doctorSearch, setDoctorSearch] = useState(params.get('q') ?? '');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [openHeaderMenu, setOpenHeaderMenu] = useState<HeaderMenu>(null);
  const querySearch = params.get('q') ?? '';

  const branches = useQuery({ queryKey: ['public-branches'], queryFn: () => patientPortalApi.publicBranches({ limit: 24 }), ...publicQueryRecovery });
  useEffect(() => {
    const timer = window.setTimeout(() => setGlobalQuery(globalSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [globalSearch]);

  const departments = useQuery({ queryKey: ['public-departments', branchId, departmentQuery, departmentPage], queryFn: () => patientPortalApi.publicDepartments({ limit: 8, page: departmentPage, branchId: branchId || undefined, search: departmentQuery || undefined }), ...publicQueryRecovery });
  const headerDepartments = useQuery({ queryKey: ['public-departments-header', branchId], queryFn: () => patientPortalApi.publicDepartments({ limit: 12, branchId: branchId || undefined }), ...publicQueryRecovery });
  const services = useQuery({ queryKey: ['public-services', branchId, departmentId, serviceQuery, servicePage], queryFn: () => patientPortalApi.publicServices({ limit: 8, page: servicePage, branchId: branchId || undefined, departmentId: departmentId || undefined, search: serviceQuery || undefined }), ...publicQueryRecovery });
  const doctors = useQuery({ queryKey: ['public-doctors', branchId, departmentId, querySearch, doctorPage], queryFn: () => patientPortalApi.publicDoctors({ limit: 6, page: doctorPage, branchId: branchId || undefined, departmentId: departmentId || undefined, search: querySearch || undefined }), ...publicQueryRecovery });
  const headerServices = useQuery({ queryKey: ['public-services-header', branchId], queryFn: () => patientPortalApi.publicServices({ limit: 12, branchId: branchId || undefined }), ...publicQueryRecovery });
  const headerDoctors = useQuery({ queryKey: ['public-doctors-header', branchId], queryFn: () => patientPortalApi.publicDoctors({ limit: 12, branchId: branchId || undefined }), ...publicQueryRecovery });
  const globalDepartments = useQuery({ queryKey: ['public-departments-global', branchId, globalQuery], queryFn: () => patientPortalApi.publicDepartments({ limit: 5, branchId: branchId || undefined, search: globalQuery }), enabled: globalQuery.length >= 2, ...publicQueryRecovery });
  const globalServices = useQuery({ queryKey: ['public-services-global', branchId, globalQuery], queryFn: () => patientPortalApi.publicServices({ limit: 5, branchId: branchId || undefined, search: globalQuery }), enabled: globalQuery.length >= 2, ...publicQueryRecovery });
  const globalDoctors = useQuery({ queryKey: ['public-doctors-global', branchId, globalQuery], queryFn: () => patientPortalApi.publicDoctors({ limit: 5, branchId: branchId || undefined, search: globalQuery }), enabled: globalQuery.length >= 2, ...publicQueryRecovery });
  const portalContext = useQuery({
    queryKey: ['patient-portal-context'],
    queryFn: () => patientPortalApi.context(),
    enabled: status === 'authenticated',
    retry: false,
  });
  const linkedPatientName = portalContext.data?.patients[0]?.full_name;
  const isPatientAccount = user?.roles.some((role) => role.code === 'PATIENT');
  const signedInLabel = linkedPatientName ?? (isPatientAccount ? user?.fullName : null) ?? 'Patient portal';
  const globalResultCount = (globalDepartments.data?.data.length ?? 0) + (globalServices.data?.data.length ?? 0) + (globalDoctors.data?.data.length ?? 0);
  const globalSearchLoading = globalDepartments.isFetching || globalServices.isFetching || globalDoctors.isFetching;

  const headerMenuProps = (menu: Exclude<HeaderMenu, null>) => ({
    className: `hospital-nav-item${openHeaderMenu === menu ? ' open' : ''}`,
    onMouseEnter: () => setOpenHeaderMenu(menu),
    onMouseLeave: () => setOpenHeaderMenu((current) => current === menu ? null : current),
    onFocus: () => setOpenHeaderMenu(menu),
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOpenHeaderMenu((current) => current === menu ? null : current);
      }
    },
  });

  const setCatalogueQuery = (updates: Record<string, string | null>, section: string) => {
    const next = new URLSearchParams(search);
    if ('branch_id' in updates || 'department_id' in updates) next.delete('service_page');
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    navigate(`/?${next.toString()}`);
    window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const goHome = () => {
    navigate('/');
    setOpenHeaderMenu(null);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const submitDoctorSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery({ q: doctorSearch.trim() || null, doctor_page: null }, 'doctors');
  };

  const submitDepartmentSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery({ department_q: departmentSearch.trim() || null, department_page: null }, 'departments');
  };

  const submitServiceSearch = (event: FormEvent) => {
    event.preventDefault();
    setCatalogueQuery({ service_q: serviceSearch.trim() || null, service_page: null }, 'services');
  };

  const closeGlobalSearch = () => {
    setGlobalSearch('');
    setGlobalQuery('');
    setGlobalSearchOpen(false);
  };

  const bookDoctor = (doctor: PublicDoctor) => {
    const destination = `/portal?book=${encodeURIComponent(doctor.id)}&branch=${encodeURIComponent(doctor.branch.id)}&department=${encodeURIComponent(doctor.department.id)}`;
    const isPortalUser = Boolean(user?.patientId || user?.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'));
    navigate(status === 'authenticated' && isPortalUser ? destination : `/login?return=${encodeURIComponent(destination)}`);
  };

  return <div className="hospital-site">
    <header className="hospital-header">
      <button className="hospital-logo" onClick={goHome} type="button"><span><i className="ph ph-heartbeat" /></span><div><strong>HMS</strong><small>Healthcare that listens</small></div></button>
      <nav aria-label="Main navigation">
        <div {...headerMenuProps('departments')}>
          <button aria-haspopup="menu" className="hospital-nav-trigger" onClick={() => document.getElementById('departments')?.scrollIntoView({ behavior: 'smooth' })} type="button">Departments <i className="ph ph-caret-down" /></button>
          <div aria-label="Departments" className="hospital-nav-dropdown" role="menu">
            <div className="hospital-nav-dropdown__heading"><span>Clinical departments</span><small>{headerDepartments.data?.meta.total ?? 0} available</small></div>
            <div className="hospital-nav-dropdown__list">
              {headerDepartments.isLoading ? <div className="hospital-nav-dropdown__state">Loading departments…</div> : headerDepartments.data?.data.map((item, index) => <button key={item.id} onClick={() => { setDepartmentSearch(item.name); setCatalogueQuery({ department_q: item.name, department_id: item.id, department_page: null, doctor_page: null }, 'departments'); }} role="menuitem" type="button"><i className={`ph ${departmentIcons[index % departmentIcons.length]}`} /><span><strong>{item.name}</strong><small>{item.branch.name}</small></span><i className="ph ph-arrow-right" /></button>)}
            </div>
            <button className="hospital-nav-dropdown__all" onClick={() => { setDepartmentSearch(''); setCatalogueQuery({ department_q: null, department_id: null, department_page: null, doctor_page: null }, 'departments'); }} type="button">View all departments</button>
          </div>
        </div>
        <div {...headerMenuProps('services')}>
          <button aria-haspopup="menu" className="hospital-nav-trigger" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} type="button">Services <i className="ph ph-caret-down" /></button>
          <div aria-label="Services" className="hospital-nav-dropdown" role="menu">
            <div className="hospital-nav-dropdown__heading"><span>Hospital services</span><small>{headerServices.data?.meta.total ?? 0} available</small></div>
            <div className="hospital-nav-dropdown__list">
              {headerServices.isLoading ? <div className="hospital-nav-dropdown__state">Loading services…</div> : headerServices.data?.data.map((item) => <button key={item.id} onClick={() => { setServiceSearch(item.name); setCatalogueQuery({ service_q: item.name, service_page: null }, 'services'); }} role="menuitem" type="button"><i className={`ph ${serviceIcon(item.service_type)}`} /><span><strong>{item.name}</strong><small>{item.department.name}</small></span><i className="ph ph-arrow-right" /></button>)}
            </div>
            <button className="hospital-nav-dropdown__all" onClick={() => { setServiceSearch(''); setCatalogueQuery({ service_q: null, department_id: null, service_page: null }, 'services'); }} type="button">View all services</button>
          </div>
        </div>
        <div {...headerMenuProps('doctors')}>
          <button aria-haspopup="menu" className="hospital-nav-trigger" onClick={() => document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })} type="button">Doctors <i className="ph ph-caret-down" /></button>
          <div aria-label="Doctors" className="hospital-nav-dropdown" role="menu">
            <div className="hospital-nav-dropdown__heading"><span>Our doctors</span><small>{headerDoctors.data?.meta.total ?? 0} available</small></div>
            <div className="hospital-nav-dropdown__list">
              {headerDoctors.isLoading ? <div className="hospital-nav-dropdown__state">Loading doctors…</div> : headerDoctors.data?.data.map((doctor) => <button key={doctor.id} onClick={() => { setDoctorSearch(doctor.display_name); setCatalogueQuery({ q: doctor.display_name, department_id: null, doctor_page: null }, 'doctors'); }} role="menuitem" type="button"><i className="ph ph-user-focus" /><span><strong>{doctor.display_name}</strong><small>{doctor.department.name}</small></span><i className="ph ph-arrow-right" /></button>)}
            </div>
            <button className="hospital-nav-dropdown__all" onClick={() => setCatalogueQuery({ q: null, department_id: null, doctor_page: null }, 'doctors')} type="button">View all doctors</button>
          </div>
        </div>
        <a href="#contact">Contact</a>
      </nav>
      <div className="hospital-global-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGlobalSearchOpen(false); }} onFocus={() => setGlobalSearchOpen(true)}>
        <form onSubmit={(event) => event.preventDefault()} role="search"><i className="ph ph-magnifying-glass" /><input aria-label="Search departments, services, doctors and specialties" onChange={(event) => { setGlobalSearch(event.target.value); setGlobalSearchOpen(true); }} placeholder="Search hospital" value={globalSearch} />{globalSearch ? <button aria-label="Clear global search" onClick={closeGlobalSearch} type="button"><i className="ph ph-x" /></button> : null}</form>
        {globalSearchOpen && globalQuery.length >= 2 ? <div className="hospital-global-results"><div className="hospital-global-results__heading"><strong>Search results</strong>{globalSearchLoading ? <span><i className="ph ph-spinner-gap" /> Searching…</span> : <span>{globalResultCount} found</span>}</div>{globalDepartments.data?.data.length ? <section><h3>Departments</h3>{globalDepartments.data.data.map((item) => <button key={item.id} onClick={() => { setDepartmentSearch(item.name); closeGlobalSearch(); setCatalogueQuery({ department_q: item.name, department_page: null }, 'departments'); }} type="button"><i className="ph ph-buildings" /><span><strong>{item.name}</strong><small>{item.branch.name}</small></span><i className="ph ph-arrow-right" /></button>)}</section> : null}{globalServices.data?.data.length ? <section><h3>Services</h3>{globalServices.data.data.map((item) => <button key={item.id} onClick={() => { setServiceSearch(item.name); closeGlobalSearch(); setCatalogueQuery({ service_q: item.name, service_page: null }, 'services'); }} type="button"><i className={`ph ${serviceIcon(item.service_type)}`} /><span><strong>{item.name}</strong><small>{item.department.name}</small></span><i className="ph ph-arrow-right" /></button>)}</section> : null}{globalDoctors.data?.data.length ? <section><h3>Doctors & specialties</h3>{globalDoctors.data.data.map((doctor) => <button key={doctor.id} onClick={() => { setDoctorSearch(doctor.display_name); closeGlobalSearch(); setCatalogueQuery({ q: doctor.display_name, doctor_page: null }, 'doctors'); }} type="button"><i className="ph ph-user-focus" /><span><strong>{doctor.display_name}</strong><small>{doctor.specialization} · {doctor.department.name}</small></span><i className="ph ph-arrow-right" /></button>)}</section> : null}{!globalSearchLoading && globalResultCount === 0 ? <div className="hospital-global-results__empty">No departments, services, doctors or specialties matched.</div> : null}</div> : null}
      </div>
      <div className="hospital-header-actions"><label className="hospital-branch-select"><i className="ph ph-map-pin" /><span>Location</span><select aria-label="Select hospital branch" onChange={(event) => setCatalogueQuery({ branch_id: event.target.value || null, department_id: null, department_page: null, doctor_page: null }, 'departments')} value={branchId}><option value="">All branches</option>{branches.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>{appConfig.staffWebUrl ? <button className="hospital-staff-link" onClick={() => window.location.assign(appConfig.staffWebUrl)} type="button">Staff login</button> : null}<button className="hospital-signin" onClick={() => navigate(status === 'authenticated' ? '/portal' : '/login')} title={status === 'authenticated' ? `Open ${signedInLabel}'s patient record` : 'Patient sign in'} type="button"><i className="ph ph-user-circle" /> {status === 'authenticated' ? signedInLabel : 'Patient sign in'}</button></div>
    </header>

    <main>
      <section className="hospital-hero">
        <div className="hospital-hero-copy"><p className="hospital-eyebrow"><i className="ph ph-shield-check" /> Trusted hospital care, connected</p><h1>Expert care for every stage of life.</h1><p>Find the right department, choose a doctor, and book a convenient appointment using information maintained directly by our hospital team.</p><div className="hospital-hero-actions"><button onClick={() => document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })} type="button">Find a doctor <i className="ph ph-arrow-right" /></button><button onClick={() => navigate('/login')} type="button">View my health record</button></div><div className="hospital-trust-row"><span><i className="ph ph-calendar-check" /><b>Easy booking</b><small>Choose a live available slot</small></span><span><i className="ph ph-user-focus" /><b>Specialist teams</b><small>Browse by department</small></span><span><i className="ph ph-lock-key" /><b>Private portal</b><small>Your records stay protected</small></span></div></div>
        <aside className="hospital-care-card"><div className="hospital-care-card-icon"><i className="ph ph-calendar-plus" /></div><p>Book an appointment</p><h2>Start with a location</h2><span>Select a branch, then choose the care area you need.</span><label className="hospital-care-location"><i className="ph ph-map-pin" /><select aria-label="Choose a hospital location" onChange={(event) => setCatalogueQuery({ branch_id: event.target.value || null, department_id: null, department_page: null, doctor_page: null }, 'departments')} value={branchId}><option value="">All hospital branches</option>{branches.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.city ? ` · ${branch.city}` : ''}</option>)}</select></label><div className="hospital-care-options">{headerDepartments.data?.data.slice(0, 5).map((item, index) => <button key={item.id} onClick={() => setCatalogueQuery({ department_id: item.id, doctor_page: null }, 'doctors')} type="button"><i className={`ph ${departmentIcons[index % departmentIcons.length]}`} /><span>{item.name}<small>{item.branch.name}</small></span><i className="ph ph-caret-right" /></button>)}</div><button className="hospital-care-all" onClick={() => setCatalogueQuery({ department_page: null }, 'departments')} type="button">View all departments</button></aside>
      </section>

      <section className="hospital-facts" aria-label="Hospital information"><div><i className="ph ph-clock-countdown" /><span><strong>Convenient scheduling</strong><small>Book from live doctor availability</small></span></div><div><i className="ph ph-buildings" /><span><strong>Connected departments</strong><small>One source of hospital information</small></span></div><div><i className="ph ph-first-aid-kit" /><span><strong>Complete care</strong><small>Consultation, laboratory and imaging</small></span></div></section>

      <section className="hospital-section" id="departments"><header className="hospital-catalogue-header"><div><p>Clinical departments</p><h2>Care organised around your needs</h2><span>Explore active departments and find the team best suited to your care.</span></div><div className="hospital-section-actions"><form className="hospital-catalogue-search" onSubmit={submitDepartmentSearch}><i className="ph ph-magnifying-glass" /><input aria-label="Search departments" onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Search departments" value={departmentSearch} /><button type="submit">Search</button></form><button className={departmentQuery || departmentId ? '' : 'active'} onClick={() => { setDepartmentSearch(''); setCatalogueQuery({ department_q: null, department_id: null, department_page: null, doctor_page: null }, 'departments'); }} type="button">Show all</button></div></header>
        {departments.isLoading ? <SectionState message="Loading hospital departments…" /> : departments.isError ? <SectionState message="Departments could not be loaded." retry={() => void departments.refetch()} /> : departments.data?.data.length ? <><div className="hospital-department-grid">{departments.data.data.map((item, index) => <article className={departmentId === item.id ? 'selected' : ''} key={item.id}><span><i className={`ph ${departmentIcons[((departmentPage - 1) * 8 + index) % departmentIcons.length]}`} /></span><div><small>{item.code}</small><h3>{item.name}</h3><p>{item.description || `Specialist care from the ${item.name} team.`}</p><button onClick={() => setCatalogueQuery({ department_id: item.id, doctor_page: null }, 'doctors')} type="button">View doctors <i className="ph ph-arrow-right" /></button></div></article>)}</div><div className="hospital-pagination"><button disabled={departmentPage <= 1} onClick={() => setCatalogueQuery({ department_page: String(departmentPage - 1) }, 'departments')} type="button"><i className="ph ph-arrow-left" /> Previous</button><span>Page {departments.data.meta.page} of {departments.data.meta.totalPages}</span><button disabled={departmentPage >= departments.data.meta.totalPages} onClick={() => setCatalogueQuery({ department_page: String(departmentPage + 1) }, 'departments')} type="button">Next <i className="ph ph-arrow-right" /></button></div></> : <SectionState message="No active clinical departments are currently published." />}
      </section>

      <section className="hospital-section hospital-section-tinted" id="services"><header className="hospital-catalogue-header"><div><p>Hospital services</p><h2>Services available to patients</h2><span>{departmentId ? `Showing services for the selected department.` : 'Current services and standard prices maintained by the hospital.'}</span></div><div className="hospital-section-actions"><form className="hospital-catalogue-search" onSubmit={submitServiceSearch}><i className="ph ph-magnifying-glass" /><input aria-label="Search services" onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services" value={serviceSearch} /><button type="submit">Search</button></form>{serviceQuery ? <button onClick={() => { setServiceSearch(''); setCatalogueQuery({ service_q: null, service_page: null }, 'services'); }} type="button">Clear</button> : null}</div></header>
        {services.isLoading ? <SectionState message="Loading hospital services…" /> : services.isError ? <SectionState message="Services could not be loaded." retry={() => void services.refetch()} /> : services.data?.data.length ? <><div className="hospital-service-grid">{services.data.data.map((item) => <article key={item.id}><span><i className={`ph ${serviceIcon(item.service_type)}`} /></span><div><small>{item.department.name}</small><h3>{item.name}</h3><p>{item.description || item.category || 'Hospital clinical service'}</p></div><strong>{money(item.standard_price)}</strong></article>)}</div><div className="hospital-pagination"><button disabled={servicePage <= 1} onClick={() => setCatalogueQuery({ service_page: String(servicePage - 1) }, 'services')} type="button"><i className="ph ph-arrow-left" /> Previous</button><span>Page {services.data.meta.page} of {services.data.meta.totalPages}</span><button disabled={servicePage >= services.data.meta.totalPages} onClick={() => setCatalogueQuery({ service_page: String(servicePage + 1) }, 'services')} type="button">Next <i className="ph ph-arrow-right" /></button></div></> : <SectionState message="No active services are available for this department." />}
      </section>

      <section className="hospital-section" id="doctors"><header className="hospital-doctors-header"><div><p>Our medical team</p><h2>Find a doctor or specialty</h2><span>Search doctor names and specialties from the live HMS directory.</span></div><form onSubmit={submitDoctorSearch}><i className="ph ph-magnifying-glass" /><input aria-label="Search doctors or specialties" onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Doctor or specialty" value={doctorSearch} /><button type="submit">Search</button></form></header>
        {doctors.isLoading ? <SectionState message="Loading doctors…" /> : doctors.isError ? <SectionState message="Doctors could not be loaded." retry={() => void doctors.refetch()} /> : doctors.data?.data.length ? <><div className="hospital-doctor-grid">{doctors.data.data.map((doctor) => { const initials = doctor.display_name.replace(/^Dr\.\s*/i, '').split(/\s+/).slice(0, 2).map((part) => part[0]).join(''); return <article key={doctor.id}><div className="hospital-doctor-avatar">{initials}</div><div className="hospital-doctor-main"><small>{doctor.department.name}</small><h3>{doctor.display_name}</h3><p>{doctor.specialization}</p><dl><div><dt><i className="ph ph-certificate" /> Qualification</dt><dd>{doctor.qualification || 'Hospital credentialed'}</dd></div><div><dt><i className="ph ph-map-pin" /> Location</dt><dd>{doctor.branch.name}{doctor.branch.city ? `, ${doctor.branch.city}` : ''}</dd></div></dl><div className="hospital-available-days">{doctor.available_days.slice(0, 4).map((day) => <span key={day}>{day.slice(0, 3)}</span>)}</div></div><button onClick={() => bookDoctor(doctor)} type="button">Book appointment <i className="ph ph-calendar-plus" /></button></article>; })}</div><div className="hospital-pagination"><button disabled={doctorPage <= 1} onClick={() => setCatalogueQuery({ doctor_page: String(doctorPage - 1) }, 'doctors')} type="button"><i className="ph ph-arrow-left" /> Previous</button><span>Page {doctors.data.meta.page} of {doctors.data.meta.totalPages}</span><button disabled={doctorPage >= doctors.data.meta.totalPages} onClick={() => setCatalogueQuery({ doctor_page: String(doctorPage + 1) }, 'doctors')} type="button">Next <i className="ph ph-arrow-right" /></button></div></> : <SectionState message="No doctors match your current selection." />}
      </section>

      <section className="hospital-section hospital-section-tinted hospital-locations" id="locations"><header><div><p>Our locations</p><h2>Care closer to you</h2><span>Select a hospital branch to view its departments, services and doctors.</span></div><button className={branchId ? '' : 'active'} onClick={() => setCatalogueQuery({ branch_id: null, department_id: null, department_page: null, doctor_page: null }, 'locations')} type="button">All locations</button></header>
        {branches.isLoading ? <SectionState message="Loading hospital locations…" /> : branches.isError ? <SectionState message="Locations could not be loaded." retry={() => void branches.refetch()} /> : <div className="hospital-location-grid">{branches.data?.data.map((branch) => { const address = [branch.address, branch.city, branch.state, branch.country, branch.postal_code].filter(Boolean).join(', '); return <article className={branchId === branch.id ? 'selected' : ''} key={branch.id}><span className="hospital-location-icon"><i className="ph ph-map-pin" /></span><div><small>{branch.code}</small><h3>{branch.name}</h3><p>{address || 'Contact the hospital for location details.'}</p><span className="hospital-location-hours"><i className="ph ph-clock" /> Opening hours: contact this branch</span>{branch.phone ? <a href={`tel:${branch.phone}`}><i className="ph ph-phone" /> {branch.phone}</a> : null}{branch.email ? <a href={`mailto:${branch.email}`}><i className="ph ph-envelope" /> {branch.email}</a> : null}</div><div className="hospital-location-actions"><button onClick={() => setCatalogueQuery({ branch_id: branch.id, department_id: null, department_page: null, doctor_page: null }, 'departments')} type="button">View departments</button>{address ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} rel="noreferrer" target="_blank">Get directions <i className="ph ph-arrow-up-right" /></a> : null}</div></article>; })}</div>}
      </section>

      <section className="hospital-portal-cta"><div><span><i className="ph ph-heartbeat" /></span><div><p>HMS Patient Portal</p><h2>Your appointments and verified records, in one secure place.</h2><small>Sign in to book visits, review schedules, check verified results, and manage dependents.</small></div></div><button onClick={() => navigate(status === 'authenticated' ? '/portal' : '/login')} type="button">Open patient portal <i className="ph ph-arrow-right" /></button></section>
    </main>

    <footer id="contact"><div className="hospital-footer-brand"><span><i className="ph ph-heartbeat" /></span><div><strong>HMS Healthcare</strong><small>Professional care. Clear communication. Connected records.</small></div></div><div><strong>Patient access</strong><button onClick={() => navigate('/login')} type="button">Patient sign in</button><button onClick={() => navigate('/signup')} type="button">Create an account</button></div><div><strong>Hospital</strong><a href="#locations">Locations</a><a href="#departments">Departments</a><a href="#services">Services</a><a href="#doctors">Doctors</a></div><div><strong>Need assistance?</strong><span>Contact the hospital reception desk for booking or portal support.</span></div><p>© {new Date().getFullYear()} HMS Healthcare. Patient information is handled securely.</p></footer>
  </div>;
}
