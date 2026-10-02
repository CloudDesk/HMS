import type { FormEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  PublicBranch,
  PublicDepartment,
  PublicDoctor,
  PublicList,
  PublicService,
} from '../../api/patient-portal';
import { navigate } from '../../routing/navigation';
import { departmentIcons, money, serviceIcon } from '../../utils/formatters';

export function SectionState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="hospital-section-state">
      <i className={`ph ${retry ? 'ph-warning-circle' : 'ph-spinner-gap'}`} />
      <span>{message}</span>
      {retry ? (
        <button onClick={retry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}

type CatalogueSectionsProps = {
  status: string;
  branchId: string;
  departmentId: string;
  departmentQuery: string;
  serviceQuery: string;
  querySearch: string;
  departmentPage: number;
  servicePage: number;
  doctorPage: number;
  departmentSearch: string;
  setDepartmentSearch: (val: string) => void;
  serviceSearch: string;
  setServiceSearch: (val: string) => void;
  doctorSearch: string;
  setDoctorSearch: (val: string) => void;
  branches: UseQueryResult<PublicList<PublicBranch>, Error>;
  departments: UseQueryResult<PublicList<PublicDepartment>, Error>;
  services: UseQueryResult<PublicList<PublicService>, Error>;
  doctors: UseQueryResult<PublicList<PublicDoctor>, Error>;
  departmentOptions: PublicDepartment[];
  setCatalogueQuery: (updates: Record<string, string | null>, section: string) => void;
  submitDepartmentSearch: (event: FormEvent) => void;
  submitServiceSearch: (event: FormEvent) => void;
  submitDoctorSearch: (event: FormEvent) => void;
  bookDoctor: (doctor: PublicDoctor) => void;
};

export function CatalogueSections({
  status,
  branchId,
  departmentId,
  departmentQuery,
  serviceQuery,
  querySearch,
  departmentPage,
  servicePage,
  doctorPage,
  departmentSearch,
  setDepartmentSearch,
  serviceSearch,
  setServiceSearch,
  doctorSearch,
  setDoctorSearch,
  branches,
  departments,
  services,
  doctors,
  departmentOptions,
  setCatalogueQuery,
  submitDepartmentSearch,
  submitServiceSearch,
  submitDoctorSearch,
  bookDoctor,
}: CatalogueSectionsProps) {
  return (
    <main>
      <section className="hospital-hero">
        <div className="hospital-hero-copy">
          <p className="hospital-eyebrow">
            <i className="ph ph-shield-check" /> Trusted hospital care, connected
          </p>
          <h1>Expert care for every stage of life.</h1>
          <p>
            Find the right department, choose a doctor, and book a convenient appointment using
            information maintained directly by our hospital team.
          </p>
          <div className="hospital-hero-actions">
            <button
              onClick={() =>
                document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })
              }
              type="button"
            >
              Find a doctor <i className="ph ph-arrow-right" />
            </button>
            <button
              onClick={() => navigate(status === 'authenticated' ? '/portal' : '/login')}
              type="button"
            >
              View my health record
            </button>
          </div>
          <div className="hospital-trust-row">
            <span>
              <i className="ph ph-calendar-check" />
              <b>Easy booking</b>
              <small>Choose a live available slot</small>
            </span>
            <span>
              <i className="ph ph-user-focus" />
              <b>Specialist teams</b>
              <small>Browse by department</small>
            </span>
            <span>
              <i className="ph ph-lock-key" />
              <b>Private portal</b>
              <small>Your records stay protected</small>
            </span>
          </div>
        </div>

        <aside className="hospital-care-card">
          <div className="hospital-care-card-icon">
            <i className="ph ph-calendar-plus" />
          </div>
          <p>Book an appointment</p>
          <h2>Start with a location</h2>
          <span>Select a branch, then choose the care area you need.</span>
          <label className="hospital-care-location">
            <i className="ph ph-map-pin" />
            <select
              aria-label="Choose a hospital location"
              onChange={(event) =>
                setCatalogueQuery(
                  {
                    branch_id: event.target.value || null,
                    department_id: null,
                    department_page: null,
                    doctor_page: null,
                  },
                  'departments',
                )
              }
              value={branchId}
            >
              <option value="">All hospital branches</option>
              {branches.data?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.city ? ` · ${branch.city}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="hospital-care-options">
            {departmentOptions.slice(0, 5).map((item, index) => (
              <button
                key={item.id}
                onClick={() =>
                  setCatalogueQuery({ department_id: item.id, doctor_page: null }, 'doctors')
                }
                type="button"
              >
                <i className={`ph ${departmentIcons[index % departmentIcons.length]}`} />
                <span>{item.name}</span>
                <i className="ph ph-caret-right" />
              </button>
            ))}
          </div>
          <button
            className="hospital-care-all"
            onClick={() => setCatalogueQuery({ department_page: null }, 'departments')}
            type="button"
          >
            View all departments
          </button>
        </aside>
      </section>

      <section className="hospital-facts" aria-label="Hospital information">
        <div>
          <i className="ph ph-clock-countdown" />
          <span>
            <strong>Convenient scheduling</strong>
            <small>Book from live doctor availability</small>
          </span>
        </div>
        <div>
          <i className="ph ph-buildings" />
          <span>
            <strong>Connected departments</strong>
            <small>One source of hospital information</small>
          </span>
        </div>
        <div>
          <i className="ph ph-first-aid-kit" />
          <span>
            <strong>Complete care</strong>
            <small>Consultation, laboratory and imaging</small>
          </span>
        </div>
      </section>

      <section className="hospital-section" id="departments">
        <header className="hospital-catalogue-header">
          <div>
            <p>Clinical departments</p>
            <h2>Care organised around your needs</h2>
            <span>Explore active departments and find the team best suited to your care.</span>
          </div>
          <div className="hospital-section-actions">
            <select
              aria-label="Filter departments by branch"
              className="hospital-filter-select"
              onChange={(event) =>
                setCatalogueQuery(
                  {
                    branch_id: event.target.value || null,
                    department_id: null,
                    department_page: null,
                    doctor_page: null,
                  },
                  'departments',
                )
              }
              value={branchId}
            >
              <option value="">All branches</option>
              {branches.data?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <form className="hospital-catalogue-search" onSubmit={submitDepartmentSearch}>
              <i className="ph ph-magnifying-glass" />
              <input
                aria-label="Search departments"
                onChange={(event) => setDepartmentSearch(event.target.value)}
                placeholder="Search departments"
                value={departmentSearch}
              />
              <button type="submit">Search</button>
            </form>
            <button
              className={departmentQuery || departmentId || branchId ? '' : 'active'}
              onClick={() => {
                setDepartmentSearch('');
                setCatalogueQuery(
                  {
                    branch_id: null,
                    department_q: null,
                    department_id: null,
                    department_page: null,
                    doctor_page: null,
                  },
                  'departments',
                );
              }}
              type="button"
            >
              Show all
            </button>
          </div>
        </header>
        {departments.isLoading ? (
          <SectionState message="Loading hospital departments…" />
        ) : departments.isError ? (
          <SectionState
            message="Departments could not be loaded."
            retry={() => void departments.refetch()}
          />
        ) : departments.data?.data.length ? (
          <>
            <div className="hospital-department-grid">
              {departments.data.data.map((item, index) => (
                <article
                  className={departmentId === item.id ? 'selected' : ''}
                  key={item.id}
                >
                  <span>
                    <i
                      className={`ph ${
                        departmentIcons[
                          ((departmentPage - 1) * 8 + index) % departmentIcons.length
                        ]
                      }`}
                    />
                  </span>
                  <div>
                    <small>{item.code}</small>
                    <h3>{item.name}</h3>
                    <p>{item.description || `Specialist care from the ${item.name} team.`}</p>
                    <button
                      onClick={() =>
                        setCatalogueQuery(
                          { department_id: item.id, doctor_page: null },
                          'doctors',
                        )
                      }
                      type="button"
                    >
                      View doctors <i className="ph ph-arrow-right" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hospital-pagination">
              <button
                disabled={departmentPage <= 1}
                onClick={() =>
                  setCatalogueQuery(
                    { department_page: String(departmentPage - 1) },
                    'departments',
                  )
                }
                type="button"
              >
                <i className="ph ph-arrow-left" /> Previous
              </button>
              <span>
                Page {departments.data.meta.page} of {departments.data.meta.totalPages}
              </span>
              <button
                disabled={departmentPage >= departments.data.meta.totalPages}
                onClick={() =>
                  setCatalogueQuery(
                    { department_page: String(departmentPage + 1) },
                    'departments',
                  )
                }
                type="button"
              >
                Next <i className="ph ph-arrow-right" />
              </button>
            </div>
          </>
        ) : (
          <SectionState message="No active clinical departments are currently published." />
        )}
      </section>

      <section className="hospital-section hospital-section-tinted" id="services">
        <header className="hospital-catalogue-header">
          <div>
            <p>Hospital services</p>
            <h2>Services available to patients</h2>
            <span>
              {departmentId
                ? 'Showing services for the selected department.'
                : 'Current services and standard prices maintained by the hospital.'}
            </span>
          </div>
          <div className="hospital-section-actions">
            <select
              aria-label="Filter services by branch"
              className="hospital-filter-select"
              onChange={(event) =>
                setCatalogueQuery(
                  { branch_id: event.target.value || null, department_id: null, service_page: null },
                  'services',
                )
              }
              value={branchId}
            >
              <option value="">All branches</option>
              {branches.data?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter services by department"
              className="hospital-filter-select"
              onChange={(event) =>
                setCatalogueQuery(
                  { department_id: event.target.value || null, service_page: null },
                  'services',
                )
              }
              value={departmentId}
            >
              <option value="">All departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <form className="hospital-catalogue-search" onSubmit={submitServiceSearch}>
              <i className="ph ph-magnifying-glass" />
              <input
                aria-label="Search services"
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Search services"
                value={serviceSearch}
              />
              <button type="submit">Search</button>
            </form>
            {serviceQuery || departmentId || branchId ? (
              <button
                onClick={() => {
                  setServiceSearch('');
                  setCatalogueQuery(
                    {
                      service_q: null,
                      department_id: null,
                      branch_id: null,
                      service_page: null,
                    },
                    'services',
                  );
                }}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </header>
        {services.isLoading ? (
          <SectionState message="Loading hospital services…" />
        ) : services.isError ? (
          <SectionState
            message="Services could not be loaded."
            retry={() => void services.refetch()}
          />
        ) : services.data?.data.length ? (
          <>
            <div className="hospital-service-grid">
              {services.data.data.map((item) => (
                <article key={item.id}>
                  <span>
                    <i className={`ph ${serviceIcon(item.service_type)}`} />
                  </span>
                  <div>
                    <small>{item.department.name}</small>
                    <h3>{item.name}</h3>
                    <p>{item.description || item.category || 'Hospital clinical service'}</p>
                  </div>
                  <strong>{money(item.standard_price)}</strong>
                </article>
              ))}
            </div>
            <div className="hospital-pagination">
              <button
                disabled={servicePage <= 1}
                onClick={() =>
                  setCatalogueQuery({ service_page: String(servicePage - 1) }, 'services')
                }
                type="button"
              >
                <i className="ph ph-arrow-left" /> Previous
              </button>
              <span>
                Page {services.data.meta.page} of {services.data.meta.totalPages}
              </span>
              <button
                disabled={servicePage >= services.data.meta.totalPages}
                onClick={() =>
                  setCatalogueQuery({ service_page: String(servicePage + 1) }, 'services')
                }
                type="button"
              >
                Next <i className="ph ph-arrow-right" />
              </button>
            </div>
          </>
        ) : (
          <SectionState message="No active services are available for this selection." />
        )}
      </section>

      <section className="hospital-section" id="doctors">
        <header className="hospital-doctors-header">
          <div>
            <p>Our medical team</p>
            <h2>Find a doctor or specialty</h2>
            <span>Search doctor names and specialties from the live HMS directory.</span>
          </div>
          <div className="hospital-section-actions">
            <select
              aria-label="Filter doctors by branch"
              className="hospital-filter-select"
              onChange={(event) =>
                setCatalogueQuery(
                  { branch_id: event.target.value || null, department_id: null, doctor_page: null },
                  'doctors',
                )
              }
              value={branchId}
            >
              <option value="">All branches</option>
              {branches.data?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter doctors by department"
              className="hospital-filter-select"
              onChange={(event) =>
                setCatalogueQuery(
                  { department_id: event.target.value || null, doctor_page: null },
                  'doctors',
                )
              }
              value={departmentId}
            >
              <option value="">All departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <form className="hospital-catalogue-search" onSubmit={submitDoctorSearch}>
              <i className="ph ph-magnifying-glass" />
              <input
                aria-label="Search doctors or specialties"
                onChange={(event) => setDoctorSearch(event.target.value)}
                placeholder="Doctor or specialty"
                value={doctorSearch}
              />
              <button type="submit">Search</button>
            </form>
            {querySearch || departmentId || branchId ? (
              <button
                onClick={() => {
                  setDoctorSearch('');
                  setCatalogueQuery(
                    { q: null, department_id: null, branch_id: null, doctor_page: null },
                    'doctors',
                  );
                }}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </header>
        {doctors.isLoading ? (
          <SectionState message="Loading doctors…" />
        ) : doctors.isError ? (
          <SectionState
            message="Doctors could not be loaded."
            retry={() => void doctors.refetch()}
          />
        ) : doctors.data?.data.length ? (
          <>
            <div className="hospital-doctor-grid">
              {doctors.data.data.map((doctor) => {
                const initials = doctor.display_name
                  .replace(/^Dr\.\s*/i, '')
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('');
                return (
                  <article key={doctor.id}>
                    <div className="hospital-doctor-avatar">{initials}</div>
                    <div className="hospital-doctor-main">
                      <small>{doctor.department.name}</small>
                      <h3>{doctor.display_name}</h3>
                      <p>{doctor.specialization}</p>
                      <dl>
                        <div>
                          <dt>
                            <i className="ph ph-certificate" /> Qualification
                          </dt>
                          <dd>{doctor.qualification || 'Hospital credentialed'}</dd>
                        </div>
                        <div>
                          <dt>
                            <i className="ph ph-map-pin" /> Location
                          </dt>
                          <dd>
                            {doctor.branch.name}
                            {doctor.branch.city ? `, ${doctor.branch.city}` : ''}
                          </dd>
                        </div>
                      </dl>
                      <div className="hospital-available-days">
                        {doctor.available_days.slice(0, 4).map((day) => (
                          <span key={day}>{day.slice(0, 3)}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => bookDoctor(doctor)} type="button">
                      Book appointment <i className="ph ph-calendar-plus" />
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="hospital-pagination">
              <button
                disabled={doctorPage <= 1}
                onClick={() =>
                  setCatalogueQuery({ doctor_page: String(doctorPage - 1) }, 'doctors')
                }
                type="button"
              >
                <i className="ph ph-arrow-left" /> Previous
              </button>
              <span>
                Page {doctors.data.meta.page} of {doctors.data.meta.totalPages}
              </span>
              <button
                disabled={doctorPage >= doctors.data.meta.totalPages}
                onClick={() =>
                  setCatalogueQuery({ doctor_page: String(doctorPage + 1) }, 'doctors')
                }
                type="button"
              >
                Next <i className="ph ph-arrow-right" />
              </button>
            </div>
          </>
        ) : (
          <SectionState message="No doctors match your current selection." />
        )}
      </section>

      <section
        className="hospital-section hospital-section-tinted hospital-locations"
        id="locations"
      >
        <header>
          <div>
            <p>Our locations</p>
            <h2>Care closer to you</h2>
            <span>Select a hospital branch to view its departments, services and doctors.</span>
          </div>
          <button
            className={branchId ? '' : 'active'}
            onClick={() =>
              setCatalogueQuery(
                {
                  branch_id: null,
                  department_id: null,
                  department_page: null,
                  doctor_page: null,
                },
                'locations',
              )
            }
            type="button"
          >
            All locations
          </button>
        </header>
        {branches.isLoading ? (
          <SectionState message="Loading hospital locations…" />
        ) : branches.isError ? (
          <SectionState
            message="Locations could not be loaded."
            retry={() => void branches.refetch()}
          />
        ) : (
          <div className="hospital-location-grid">
            {branches.data?.data.map((branch) => {
              const address = [
                branch.address,
                branch.city,
                branch.state,
                branch.country,
                branch.postal_code,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <article
                  className={branchId === branch.id ? 'selected' : ''}
                  key={branch.id}
                >
                  <span className="hospital-location-icon">
                    <i className="ph ph-map-pin" />
                  </span>
                  <div>
                    <small>{branch.code}</small>
                    <h3>{branch.name}</h3>
                    <p>{address || 'Contact the hospital for location details.'}</p>
                    <span className="hospital-location-hours">
                      <i className="ph ph-clock" /> Opening hours: contact this branch
                    </span>
                    {branch.phone ? (
                      <a href={`tel:${branch.phone}`}>
                        <i className="ph ph-phone" /> {branch.phone}
                      </a>
                    ) : null}
                    {branch.email ? (
                      <a href={`mailto:${branch.email}`}>
                        <i className="ph ph-envelope" /> {branch.email}
                      </a>
                    ) : null}
                  </div>
                  <div className="hospital-location-actions">
                    <button
                      onClick={() =>
                        setCatalogueQuery(
                          {
                            branch_id: branch.id,
                            department_id: null,
                            department_page: null,
                            doctor_page: null,
                          },
                          'departments',
                        )
                      }
                      type="button"
                    >
                      View departments
                    </button>
                    {address ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          address,
                        )}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Get directions <i className="ph ph-arrow-up-right" />
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="hospital-portal-cta">
        <div>
          <span>
            <i className="ph ph-heartbeat" />
          </span>
          <div>
            <p>HMS Patient Portal</p>
            <h2>Your appointments and verified records, in one secure place.</h2>
            <small>
              Sign in to book visits, review schedules, check verified results, and manage
              dependents.
            </small>
          </div>
        </div>
        <button
          onClick={() => navigate(status === 'authenticated' ? '/portal' : '/login')}
          type="button"
        >
          Open patient portal <i className="ph ph-arrow-right" />
        </button>
      </section>
    </main>
  );
}
