import type { PatientPortalOverview } from '../../api/patient-portal';
import { date, label, money } from '../../utils/portal-invoice-pdf';

type PortalMedicinesTabProps = {
  data: PatientPortalOverview;
};

export function PortalMedicinesTab({ data }: PortalMedicinesTabProps) {
  return (
    <section className="portal-page-section">
      <header>
        <div>
          <p>Medication records</p>
          <h1>Prescriptions & purchased medicines</h1>
          <span>
            Review medicines prescribed by your doctors and items recorded by the hospital pharmacy.
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
            <div className="portal-empty">
              <i className="ph ph-prescription" />
              <strong>No prescriptions available</strong>
              <span>Submitted prescriptions from your doctors will appear here.</span>
            </div>
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
            <div className="portal-empty">
              <i className="ph ph-pill" />
              <strong>No pharmacy purchases</strong>
              <span>Medicines billed by the hospital pharmacy will appear here.</span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
