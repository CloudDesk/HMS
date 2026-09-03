import { useState } from 'react';
import type { PatientPortalOverview } from '../../../api/patient-portal';
import { Empty } from '../Empty';
import { Pagination } from '../Pagination';
import { date } from '../../../utils/formatters';

type ResultsTabProps = {
  data: PatientPortalOverview;
};

const PAGE_SIZE = 5;

export function ResultsTab({ data }: ResultsTabProps) {
  const [labPage, setLabPage] = useState(1);
  const [imagingPage, setImagingPage] = useState(1);

  const paginatedLabResults = data.laboratory_results.slice(
    (labPage - 1) * PAGE_SIZE,
    labPage * PAGE_SIZE,
  );

  const paginatedImagingReports = data.imaging_reports.slice(
    (imagingPage - 1) * PAGE_SIZE,
    imagingPage * PAGE_SIZE,
  );

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
            <span className="portal-record-count">{data.laboratory_results.length}</span>
          </header>
          {data.laboratory_results.length ? (
            <>
              {paginatedLabResults.map((result) => (
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
              ))}
              <Pagination
                currentPage={labPage}
                onPageChange={setLabPage}
                pageSize={PAGE_SIZE}
                totalItems={data.laboratory_results.length}
              />
            </>
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
            <span className="portal-record-count">{data.imaging_reports.length}</span>
          </header>
          {data.imaging_reports.length ? (
            <>
              {paginatedImagingReports.map((report) => (
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
              ))}
              <Pagination
                currentPage={imagingPage}
                onPageChange={setImagingPage}
                pageSize={PAGE_SIZE}
                totalItems={data.imaging_reports.length}
              />
            </>
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
  );
}
