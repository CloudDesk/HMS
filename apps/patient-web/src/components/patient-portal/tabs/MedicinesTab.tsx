import { useState } from 'react';
import type { PatientPortalOverview } from '../../../api/patient-portal';
import { Empty } from '../Empty';
import { Pagination } from '../Pagination';
import { Modal } from '../../ui/Modal';
import { date, label, money } from '../../../utils/formatters';

type MedicinesTabProps = {
  data: PatientPortalOverview;
};

const PAGE_SIZE = 5;

export function MedicinesTab({ data }: MedicinesTabProps) {
  const [activeSection, setActiveSection] = useState<'prescriptions' | 'purchases'>('prescriptions');
  const [prescriptionsPage, setPrescriptionsPage] = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [selectedPrescription, setSelectedPrescription] = useState<
    PatientPortalOverview['prescriptions'][number] | null
  >(null);

  const paginatedPrescriptions = data.prescriptions.slice(
    (prescriptionsPage - 1) * PAGE_SIZE,
    prescriptionsPage * PAGE_SIZE,
  );

  const paginatedPurchases = data.purchased_medicines.slice(
    (purchasesPage - 1) * PAGE_SIZE,
    purchasesPage * PAGE_SIZE,
  );

  return (
    <section className="portal-page-section">
      <header>
        <div>
          <p>Medication records</p>
          <h1>Prescriptions & medicines</h1>
          <span>
            Review doctor-issued clinical prescriptions and items recorded by the hospital pharmacy.
          </span>
        </div>
      </header>

      {/* Top Segment Switcher */}
      <div className="portal-appointment-toolbar" style={{ marginBottom: '1.25rem' }}>
        <div className="portal-appointment-tabs" role="tablist" aria-label="Medication sections">
          <button
            aria-selected={activeSection === 'prescriptions'}
            className={activeSection === 'prescriptions' ? 'active' : ''}
            onClick={() => setActiveSection('prescriptions')}
            role="tab"
            type="button"
          >
            <i className="ph ph-prescription" /> Prescriptions ({data.prescriptions.length})
          </button>
          <button
            aria-selected={activeSection === 'purchases'}
            className={activeSection === 'purchases' ? 'active' : ''}
            onClick={() => setActiveSection('purchases')}
            role="tab"
            type="button"
          >
            <i className="ph ph-pill" /> Pharmacy purchases ({data.purchased_medicines.length})
          </button>
        </div>
      </div>

      {activeSection === 'prescriptions' ? (
        <>
          <div className="portal-list-panel">
            {data.prescriptions.length ? (
              paginatedPrescriptions.map((prescription) => (
                <article
                  className="portal-list-row portal-prescription-list-row"
                  key={prescription.id}
                  onClick={() => setSelectedPrescription(prescription)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="portal-list-icon">
                    <i className="ph ph-prescription" />
                  </div>
                  <div className="portal-list-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0 }}>Dr. {prescription.doctor_name.replace(/^Dr\.?\s+/i, '')}</h3>
                      <span className={`portal-status ${prescription.status.toLowerCase()}`}>
                        {label(prescription.status)}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0', color: '#475569', fontSize: '0.78rem' }}>
                      <i className="ph ph-calendar-blank" /> Issued on {date(prescription.submitted_at)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {prescription.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#334155',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          <i className="ph ph-pill" style={{ color: '#0284c7', fontSize: '0.75rem' }} />
                          {item.medicine_name} {item.strength || ''}
                        </span>
                      ))}
                      {prescription.items.length > 3 ? (
                        <small style={{ color: '#64748b', fontSize: '0.7rem' }}>
                          +{prescription.items.length - 3} more
                        </small>
                      ) : null}
                    </div>
                  </div>
                  <div className="portal-list-end">
                    <button
                      className="portal-reschedule-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrescription(prescription);
                      }}
                      type="button"
                    >
                      <i className="ph ph-eye" /> View prescription
                    </button>
                    <small>{prescription.items.length} {prescription.items.length === 1 ? 'medicine' : 'medicines'}</small>
                  </div>
                </article>
              ))
            ) : (
              <Empty
                icon="ph-prescription"
                title="No prescriptions available"
                message="Doctor-issued prescriptions will appear here after your clinical consultation."
              />
            )}
          </div>
          <Pagination
            currentPage={prescriptionsPage}
            onPageChange={setPrescriptionsPage}
            pageSize={PAGE_SIZE}
            totalItems={data.prescriptions.length}
          />
        </>
      ) : (
        <>
          <div className="portal-list-panel">
            {data.purchased_medicines.length ? (
              paginatedPurchases.map((purchase) => (
                <article className="portal-list-row" key={purchase.id}>
                  <div className="portal-list-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <i className="ph ph-pill" />
                  </div>
                  <div className="portal-list-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0 }}>{purchase.medicine_name}</h3>
                      <span className={`portal-status ${purchase.payment_status.toLowerCase()}`}>
                        {label(purchase.payment_status)}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0', color: '#64748b', fontSize: '0.76rem' }}>
                      <i className="ph ph-receipt" /> {purchase.invoice_number} · <i className="ph ph-calendar" /> {date(purchase.purchased_at)}
                    </p>
                    <small style={{ color: '#475569' }}>
                      Quantity: <strong>{purchase.quantity}</strong> {purchase.branch ? ` · ${purchase.branch.name}` : ''}
                    </small>
                  </div>
                  <div className="portal-list-end">
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{money(purchase.total_amount)}</strong>
                  </div>
                </article>
              ))
            ) : (
              <Empty
                icon="ph-pill"
                title="No pharmacy purchases"
                message="Medicines dispensed and billed by the hospital pharmacy will appear here."
              />
            )}
          </div>
          <Pagination
            currentPage={purchasesPage}
            onPageChange={setPurchasesPage}
            pageSize={PAGE_SIZE}
            totalItems={data.purchased_medicines.length}
          />
        </>
      )}

      {/* Prescription Details Modal */}
      {selectedPrescription ? (
        <Modal
          icon="ph-prescription"
          onClose={() => setSelectedPrescription(null)}
          open={Boolean(selectedPrescription)}
          size="large"
          title={`Prescription - Dr. ${selectedPrescription.doctor_name.replace(/^Dr\.?\s+/i, '')}`}
        >
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Modal Header details */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '9px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '0.88rem', color: '#0f172a' }}>
                  Dr. {selectedPrescription.doctor_name.replace(/^Dr\.?\s+/i, '')}
                </strong>
                <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                  <i className="ph ph-calendar" /> Issued on {date(selectedPrescription.submitted_at)}
                </small>
              </div>
              <span className={`portal-status ${selectedPrescription.status.toLowerCase()}`}>
                {label(selectedPrescription.status)}
              </span>
            </div>

            {/* Prescribed Medicines Table */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '0.85rem' }}>
                Prescribed Medicines ({selectedPrescription.items.length})
              </h4>
              <div className="portal-prescription-table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="portal-prescription-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dosage & Route</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Qty</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPrescription.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.medicine_name}</strong>
                          {item.strength ? <small className="medicine-strength">{item.strength}</small> : null}
                        </td>
                        <td>{[item.dosage, item.route].filter(Boolean).join(' · ') || '—'}</td>
                        <td>{item.frequency || '—'}</td>
                        <td>{item.duration || '—'}</td>
                        <td>
                          <span className="medicine-qty-pill">{item.quantity ?? 1}</span>
                        </td>
                        <td>
                          <span className="medicine-instruction">{item.instructions || 'As directed by physician'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Patient Instructions & Follow Up Notes */}
            {selectedPrescription.patient_instructions || selectedPrescription.follow_up_date ? (
              <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.25rem' }}>
                {selectedPrescription.patient_instructions ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1e40af',
                      fontSize: '0.76rem',
                    }}
                  >
                    <i className="ph ph-info" style={{ fontSize: '1.1rem', marginTop: '1px', flex: 'none' }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '2px' }}>Doctor's Advice / Instructions</strong>
                      <span>{selectedPrescription.patient_instructions}</span>
                    </div>
                  </div>
                ) : null}

                {selectedPrescription.follow_up_date ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      fontSize: '0.75rem',
                    }}
                  >
                    <i className="ph ph-calendar-check" style={{ fontSize: '1.1rem', color: '#16a34a' }} />
                    <span>
                      Scheduled Follow-up Date: <strong>{date(selectedPrescription.follow_up_date)}</strong>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="portal-form-actions">
            <button onClick={() => setSelectedPrescription(null)} type="button">
              Close
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
