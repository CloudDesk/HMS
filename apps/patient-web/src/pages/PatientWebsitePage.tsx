import { navigate } from '../routing/navigation';
import { useHospitalCatalogue } from '../hooks/useHospitalCatalogue';
import { HospitalHeader } from '../components/website/HospitalHeader';
import { CatalogueSections } from '../components/website/CatalogueSections';

export function PatientWebsitePage() {
  const catalogue = useHospitalCatalogue();

  return (
    <div className="hospital-site">
      <HospitalHeader
        bookDoctor={catalogue.bookDoctor}
        closeGlobalSearch={catalogue.closeGlobalSearch}
        globalDepartments={catalogue.globalDepartments}
        globalDoctors={catalogue.globalDoctors}
        globalQuery={catalogue.globalQuery}
        globalResultCount={catalogue.globalResultCount}
        globalSearch={catalogue.globalSearch}
        globalSearchLoading={catalogue.globalSearchLoading}
        globalSearchOpen={catalogue.globalSearchOpen}
        globalServices={catalogue.globalServices}
        goHome={catalogue.goHome}
        headerDepartmentCount={catalogue.headerDepartmentCount}
        headerDepartmentItems={catalogue.headerDepartmentItems}
        headerDoctors={catalogue.headerDoctors}
        headerServices={catalogue.headerServices}
        openHeaderMenu={catalogue.openHeaderMenu}
        setCatalogueQuery={catalogue.setCatalogueQuery}
        setDepartmentSearch={catalogue.setDepartmentSearch}
        setDoctorSearch={catalogue.setDoctorSearch}
        setGlobalQuery={catalogue.setGlobalQuery}
        setGlobalSearch={catalogue.setGlobalSearch}
        setGlobalSearchOpen={catalogue.setGlobalSearchOpen}
        setOpenHeaderMenu={catalogue.setOpenHeaderMenu}
        setServiceSearch={catalogue.setServiceSearch}
        signedInLabel={catalogue.signedInLabel}
        status={catalogue.status}
      />

      <CatalogueSections
        bookDoctor={catalogue.bookDoctor}
        branchId={catalogue.branchId}
        branches={catalogue.branches}
        departmentId={catalogue.departmentId}
        departmentOptions={catalogue.departmentOptions}
        departmentPage={catalogue.departmentPage}
        departmentQuery={catalogue.departmentQuery}
        departmentSearch={catalogue.departmentSearch}
        departments={catalogue.departments}
        doctorPage={catalogue.doctorPage}
        doctorSearch={catalogue.doctorSearch}
        doctors={catalogue.doctors}
        querySearch={catalogue.querySearch}
        servicePage={catalogue.servicePage}
        serviceQuery={catalogue.serviceQuery}
        serviceSearch={catalogue.serviceSearch}
        services={catalogue.services}
        setCatalogueQuery={catalogue.setCatalogueQuery}
        setDepartmentSearch={catalogue.setDepartmentSearch}
        setDoctorSearch={catalogue.setDoctorSearch}
        setServiceSearch={catalogue.setServiceSearch}
        status={catalogue.status}
        submitDepartmentSearch={catalogue.submitDepartmentSearch}
        submitDoctorSearch={catalogue.submitDoctorSearch}
        submitServiceSearch={catalogue.submitServiceSearch}
      />

      <footer id="contact">
        <div className="hospital-footer-brand">
          <span>
            <i className="ph ph-heartbeat" />
          </span>
          <div>
            <strong>HMS Healthcare</strong>
            <small>Professional care. Clear communication. Connected records.</small>
          </div>
        </div>
        <div>
          <strong>Patient access</strong>
          <button
            onClick={() => navigate(catalogue.status === 'authenticated' ? '/portal' : '/login')}
            type="button"
          >
            {catalogue.status === 'authenticated' ? 'Patient portal' : 'Sign in / Sign up'}
          </button>
          <button onClick={() => navigate('/signup')} type="button">
            Create an account
          </button>
        </div>
        <div>
          <strong>Hospital</strong>
          <a href="#locations">Locations</a>
          <a href="#departments">Departments</a>
          <a href="#services">Services</a>
          <a href="#doctors">Doctors</a>
        </div>
        <div>
          <strong>Need assistance?</strong>
          <span>Contact the hospital reception desk for booking or portal support.</span>
        </div>
        <p>
          © {new Date().getFullYear()} HMS Healthcare. Patient information is handled securely.
        </p>
      </footer>
    </div>
  );
}
