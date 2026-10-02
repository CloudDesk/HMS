import type { PatientPortalOverview } from '../../api/patient-portal';
import { date } from '../../utils/portal-invoice-pdf';

type PortalResultsTabProps = {
  data: PatientPortalOverview;
};

export function PortalResultsTab({ data }: PortalResultsTabProps) {
  return (
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
            <div className="portal-empty">
              <i className="ph ph-flask" />
              <strong>No verified lab results</strong>
              <span>Verified laboratory results will appear here.</span>
            </div>
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
            <div className="portal-empty">
              <i className="ph ph-scan" />
              <strong>No verified imaging reports</strong>
              <span>Verified imaging reports will appear here.</span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
