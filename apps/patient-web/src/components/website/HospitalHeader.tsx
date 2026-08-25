import type { FocusEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  PublicDepartment,
  PublicDoctor,
  PublicList,
  PublicService,
} from '../../api/patient-portal';
import { appConfig } from '../../config';
import { navigate } from '../../routing/navigation';
import { departmentIcons, money, serviceIcon } from '../../utils/formatters';
import type { HeaderMenu } from '../../hooks/useHospitalCatalogue';

type HospitalHeaderProps = {
  status: string;
  signedInLabel: string;
  openHeaderMenu: HeaderMenu;
  setOpenHeaderMenu: React.Dispatch<React.SetStateAction<HeaderMenu>>;
  headerDepartmentCount: number;
  headerDepartmentItems: PublicDepartment[];
  headerServices: UseQueryResult<PublicList<PublicService>, Error>;
  headerDoctors: UseQueryResult<PublicList<PublicDoctor>, Error>;
  globalSearch: string;
  setGlobalSearch: (val: string) => void;
  globalQuery: string;
  setGlobalQuery: (val: string) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  globalSearchLoading: boolean;
  globalResultCount: number;
  globalDepartments: UseQueryResult<PublicList<PublicDepartment>, Error>;
  globalServices: UseQueryResult<PublicList<PublicService>, Error>;
  globalDoctors: UseQueryResult<PublicList<PublicDoctor>, Error>;
  goHome: () => void;
  setDepartmentSearch: (val: string) => void;
  setServiceSearch: (val: string) => void;
  setDoctorSearch: (val: string) => void;
  setCatalogueQuery: (updates: Record<string, string | null>, section: string) => void;
  bookDoctor: (doctor: PublicDoctor) => void;
  closeGlobalSearch: () => void;
};

export function HospitalHeader({
  status,
  signedInLabel,
  openHeaderMenu,
  setOpenHeaderMenu,
  headerDepartmentCount,
  headerDepartmentItems,
  headerServices,
  headerDoctors,
  globalSearch,
  setGlobalSearch,
  globalQuery,
  setGlobalQuery,
  globalSearchOpen,
  setGlobalSearchOpen,
  globalSearchLoading,
  globalResultCount,
  globalDepartments,
  globalServices,
  globalDoctors,
  goHome,
  setDepartmentSearch,
  setServiceSearch,
  setDoctorSearch,
  setCatalogueQuery,
  bookDoctor,
  closeGlobalSearch,
}: HospitalHeaderProps) {
  const headerMenuProps = (menu: Exclude<HeaderMenu, null>) => ({
    className: `hospital-nav-item${openHeaderMenu === menu ? ' open' : ''}`,
    onMouseEnter: () => setOpenHeaderMenu(menu),
    onMouseLeave: () => setOpenHeaderMenu((current) => (current === menu ? null : current)),
    onFocus: () => setOpenHeaderMenu(menu),
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOpenHeaderMenu((current) => (current === menu ? null : current));
      }
    },
  });

  return (
    <header className="hospital-header">
      <button className="hospital-logo" onClick={goHome} type="button">
        <span>
          <i className="ph ph-heartbeat" />
        </span>
        <div>
          <strong>HMS</strong>
          <small>Healthcare that listens</small>
        </div>
      </button>

      <nav aria-label="Hospital public menu">
        <div {...headerMenuProps('departments')}>
          <button
            className="hospital-nav-trigger"
            onClick={() => {
              setOpenHeaderMenu((current) => (current === 'departments' ? null : 'departments'));
              document.getElementById('departments')?.scrollIntoView({ behavior: 'smooth' });
            }}
            type="button"
          >
            Departments <i className="ph ph-caret-down" />
          </button>
          <div className="hospital-nav-dropdown">
            <div className="hospital-nav-dropdown__heading">
              <span>Clinical departments</span>
              <small>{headerDepartmentCount} available</small>
            </div>
            <div className="hospital-nav-dropdown__list">
              {headerDepartmentItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenHeaderMenu(null);
                    setCatalogueQuery({ department_id: item.id, doctor_page: null }, 'doctors');
                  }}
                  type="button"
                >
                  <i className={`ph ${departmentIcons[index % departmentIcons.length]}`} />
                  <span>
                    <strong>{item.name}</strong>
                  </span>
                  <i className="ph ph-arrow-right" />
                </button>
              ))}
            </div>
            <button
              className="hospital-nav-dropdown__all"
              onClick={() => {
                setOpenHeaderMenu(null);
                setDepartmentSearch('');
                setCatalogueQuery(
                  {
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
              View all departments
            </button>
          </div>
        </div>

        <div {...headerMenuProps('services')}>
          <button
            className="hospital-nav-trigger"
            onClick={() => {
              setOpenHeaderMenu((current) => (current === 'services' ? null : 'services'));
              document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
            }}
            type="button"
          >
            Services <i className="ph ph-caret-down" />
          </button>
          <div className="hospital-nav-dropdown">
            <div className="hospital-nav-dropdown__heading">
              <span>Hospital services</span>
              <small>{headerServices.data?.meta.total ?? 0} published</small>
            </div>
            <div className="hospital-nav-dropdown__list">
              {headerServices.data?.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenHeaderMenu(null);
                    setServiceSearch(item.name);
                    setCatalogueQuery({ service_q: item.name, service_page: null }, 'services');
                  }}
                  type="button"
                >
                  <i className={`ph ${serviceIcon(item.service_type)}`} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{money(item.standard_price)}</small>
                  </span>
                  <i className="ph ph-arrow-right" />
                </button>
              ))}
            </div>
            <button
              className="hospital-nav-dropdown__all"
              onClick={() => {
                setOpenHeaderMenu(null);
                setServiceSearch('');
                setCatalogueQuery(
                  { service_q: null, department_id: null, service_page: null },
                  'services',
                );
              }}
              type="button"
            >
              View all services
            </button>
          </div>
        </div>

        <div {...headerMenuProps('doctors')}>
          <button
            className="hospital-nav-trigger"
            onClick={() => {
              setOpenHeaderMenu((current) => (current === 'doctors' ? null : 'doctors'));
              document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' });
            }}
            type="button"
          >
            Doctors <i className="ph ph-caret-down" />
          </button>
          <div className="hospital-nav-dropdown">
            <div className="hospital-nav-dropdown__heading">
              <span>Medical team</span>
              <small>{headerDoctors.data?.meta.total ?? 0} doctors</small>
            </div>
            <div className="hospital-nav-dropdown__list">
              {headerDoctors.data?.data.map((doctor) => (
                <button
                  key={doctor.id}
                  onClick={() => {
                    setOpenHeaderMenu(null);
                    bookDoctor(doctor);
                  }}
                  type="button"
                >
                  <i className="ph ph-user-focus" />
                  <span>
                    <strong>{doctor.display_name}</strong>
                    <small>{doctor.specialization}</small>
                  </span>
                  <i className="ph ph-arrow-right" />
                </button>
              ))}
            </div>
            <button
              className="hospital-nav-dropdown__all"
              onClick={() => {
                setOpenHeaderMenu(null);
                setCatalogueQuery({ q: null, department_id: null, doctor_page: null }, 'doctors');
              }}
              type="button"
            >
              View all doctors
            </button>
          </div>
        </div>

        <a href="#contact">Contact</a>
      </nav>

      <div className="hospital-global-search">
        <div className="hospital-global-search__input">
          <i className="ph ph-magnifying-glass" />
          <input
            aria-label="Search hospital services, departments and doctors"
            onChange={(event) => {
              setGlobalSearch(event.target.value);
              setGlobalSearchOpen(true);
            }}
            onFocus={() => setGlobalSearchOpen(true)}
            placeholder="Search"
            value={globalSearch}
          />
          {globalSearch ? (
            <button
              aria-label="Clear search"
              onClick={() => {
                setGlobalSearch('');
                setGlobalQuery('');
                setGlobalSearchOpen(false);
              }}
              type="button"
            >
              <i className="ph ph-x" />
            </button>
          ) : null}
        </div>

        {globalSearchOpen && globalQuery.length >= 2 ? (
          <div className="hospital-global-results">
            <div className="hospital-global-results__heading">
              <strong>Search results</strong>
              {globalSearchLoading ? (
                <span>
                  <i className="ph ph-spinner-gap" /> Searching…
                </span>
              ) : (
                <span>{globalResultCount} found</span>
              )}
            </div>

            {globalDepartments.data?.data.length ? (
              <section>
                <h3>Departments</h3>
                {globalDepartments.data.data.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setDepartmentSearch(item.name);
                      closeGlobalSearch();
                      setCatalogueQuery(
                        { department_q: item.name, department_page: null },
                        'departments',
                      );
                    }}
                    type="button"
                  >
                    <i className="ph ph-buildings" />
                    <span>
                      <strong>{item.name}</strong>
                    </span>
                    <i className="ph ph-arrow-right" />
                  </button>
                ))}
              </section>
            ) : null}

            {globalServices.data?.data.length ? (
              <section>
                <h3>Services</h3>
                {globalServices.data.data.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setServiceSearch(item.name);
                      closeGlobalSearch();
                      setCatalogueQuery(
                        { service_q: item.name, service_page: null },
                        'services',
                      );
                    }}
                    type="button"
                  >
                    <i className={`ph ${serviceIcon(item.service_type)}`} />
                    <span>
                      <strong>{item.name}</strong>
                    </span>
                    <i className="ph ph-arrow-right" />
                  </button>
                ))}
              </section>
            ) : null}

            {globalDoctors.data?.data.length ? (
              <section>
                <h3>Doctors & specialties</h3>
                {globalDoctors.data.data.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => {
                      setDoctorSearch(doctor.display_name);
                      closeGlobalSearch();
                      setCatalogueQuery(
                        { q: doctor.display_name, doctor_page: null },
                        'doctors',
                      );
                    }}
                    type="button"
                  >
                    <i className="ph ph-user-focus" />
                    <span>
                      <strong>{doctor.display_name}</strong>
                      <small>{doctor.specialization}</small>
                    </span>
                    <i className="ph ph-arrow-right" />
                  </button>
                ))}
              </section>
            ) : null}

            {!globalSearchLoading && globalResultCount === 0 ? (
              <div className="hospital-global-results__empty">
                No departments, services, doctors or specialties matched.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="hospital-header-actions">
        {appConfig.staffWebUrl ? (
          <button
            className="hospital-staff-link"
            onClick={() => window.location.assign(appConfig.staffWebUrl)}
            type="button"
          >
            Staff login
          </button>
        ) : null}
        <button
          className="hospital-signin"
          onClick={() => navigate(status === 'authenticated' ? '/portal' : '/login')}
          title={
            status === 'authenticated'
              ? `Open ${signedInLabel}'s patient record`
              : 'Sign in / Sign up'
          }
          type="button"
        >
          <i className="ph ph-user-circle" />{' '}
          {status === 'authenticated' ? signedInLabel : 'Sign in / Sign up'}
        </button>
      </div>
    </header>
  );
}
