import { useDentalLabFeature, type DentalLabFeatureInput } from '../../../hooks/opd/useDentalLabFeature';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { isDentalLabService } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import styles from './DentalClinicalOrders.module.css';
import { Modal } from '../../ui/Modal';

export function DentalLabSection(input: DentalLabFeatureInput) {
  const feature = useDentalLabFeature(input);
  const formatCurrency = useCurrencyFormatter();
  const { order, form, catalogue, result } = feature;
  if (!feature.canView) return <section className={styles.imagingPanel}>You do not have permission to view laboratory requests.</section>;
  const items = order.data?.items ?? [];
  const selectedServiceId = form.watch('serviceId');
  const rawServices = catalogue.data?.data ?? [];
  const dentalLabServices = rawServices.filter(isDentalLabService);

  return (
    <section className={styles.imagingPanel} aria-label="Dental laboratory">
      <div className={styles.imagingHeader}>
        <div>
          <h3>Dental laboratory investigations</h3>
          <p>Laboratory tests ordered for this visit.</p>
        </div>
        <div className={styles.imagingActions}>
          <button type="button" disabled={order.isFetching || feature.saving} onClick={() => { void order.refetch(); }}>
            Refresh status
          </button>
          {feature.canAdd && (
            <button type="button" className={styles.btnAddAction} onClick={() => feature.openRequest()}>
              + Add Lab Investigation
            </button>
          )}
        </div>
      </div>
      {order.isLoading && <p role="status">Loading laboratory requests…</p>}
      {order.isError && (
        <p role="alert">
          {getOpdErrorMessage(order.error)} <button type="button" onClick={() => { void order.refetch(); }}>Retry</button>
        </p>
      )}
      {order.isSuccess && items.length === 0 && <p>No laboratory requests for this visit.</p>}
      <ul className={styles.imagingList}>
        {items.map((item, idx) => (
          <li key={item.id ?? `${item.service_id}-${idx}`}>
            <strong>{item.investigation_name}</strong>
            <span>{item.category || 'Laboratory'}</span>
            <span className={styles.contextBadge}>{order.data?.status.replaceAll('_', ' ')}</span>
          </li>
        ))}
      </ul>
      {order.data?.status === 'DRAFT' && (
        <p>Saved draft. Laboratory receives the request after consultation completion and submission.</p>
      )}
      {input.consultationCompleted && input.canEdit && order.data?.status === 'DRAFT' && (
        <button type="button" disabled={feature.saving} onClick={() => { void feature.submitRequest(); }}>
          Submit laboratory request
        </button>
      )}
      {feature.saveError && !feature.open && <p role="alert">{feature.saveError}</p>}
      {feature.resultAvailable && (
        <button type="button" onClick={() => feature.setResultOpen(!feature.resultOpen)}>
          {feature.resultOpen ? 'Hide laboratory results' : 'View laboratory results'}
        </button>
      )}
      {feature.resultOpen && feature.resultAvailable && (
        <div className={styles.imagingReport} aria-label="Laboratory result">
          <h4>Visit laboratory results</h4>
          <p>Results entered for the visit laboratory order.</p>
          {result.isLoading && <p role="status">Loading laboratory results…</p>}
          {result.isError && (
            <p role="alert">
              {getOpdErrorMessage(result.error)}{' '}
              <button type="button" onClick={() => { void result.refetch(); }}>Retry results</button>
            </p>
          )}
          {result.data && (
            <>
              <p>{result.data.verified_at ? 'Verified results' : 'Results entered — awaiting verification'}</p>
              {result.data.remarks && (
                <>
                  <h4>Remarks</h4>
                  <p>{result.data.remarks}</p>
                </>
              )}
              {result.data.result_items && result.data.result_items.length > 0 && (
                <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Test / Parameter</th>
                      <th style={{ padding: '6px' }}>Value</th>
                      <th style={{ padding: '6px' }}>Unit</th>
                      <th style={{ padding: '6px' }}>Reference Range</th>
                      <th style={{ padding: '6px' }}>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.result_items.map((res, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px' }}>{res.service_name}</td>
                        <td style={{ padding: '6px', fontWeight: 600 }}>{res.value}</td>
                        <td style={{ padding: '6px' }}>{res.unit || '-'}</td>
                        <td style={{ padding: '6px' }}>{res.reference_range || '-'}</td>
                        <td style={{ padding: '6px' }}>{res.comments || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
      {feature.open && (
        <Modal
          open
          title="Add Lab Investigation"
          className={`${styles.imagingPanel} ${styles.imagingDialog}`}
          onClose={() => { if (!feature.saving) feature.setOpen(false); }}
          footer={
            <div className={styles.dialogFooterActions}>
              <button type="button" disabled={feature.saving} onClick={() => feature.setOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                form="dental-lab-form"
                disabled={feature.saving || !feature.canAdd || catalogue.isFetching || !selectedServiceId}
              >
                {feature.saving ? 'Saving…' : 'Add Lab Investigation'}
              </button>
            </div>
          }
        >
          <form id="dental-lab-form" className={styles.dialogForm} onSubmit={(event) => { void feature.saveRequest(event); }}>
            <div className={styles.toothContextCard}>
              <span>Selected Context:</span>
              <strong>Visit-Level Laboratory Investigation</strong>
            </div>

            <label>
              Search catalogue
              <input
                type="search"
                placeholder="Search dental laboratory services..."
                value={feature.searchTerm}
                onChange={(event) => feature.changeSearch(event.target.value)}
              />
            </label>
            {catalogue.isLoading && <p role="status">Loading laboratory services…</p>}
            {catalogue.isError && (
              <p role="alert">
                {getOpdErrorMessage(catalogue.error)}{' '}
                <button type="button" onClick={() => { void catalogue.refetch(); }}>Retry catalogue</button>
              </p>
            )}

            <label>
              Select Dental Laboratory Service <span className={styles.required}>*</span>
            </label>
            {catalogue.isSuccess && dentalLabServices.length === 0 && (
              <div className={styles.emptyServiceState}>
                <p>No active dental laboratory services match this search.</p>
              </div>
            )}

            {dentalLabServices.length > 0 && (
              <div className={styles.serviceCardList} role="radiogroup" aria-label="Dental laboratory services">
                {dentalLabServices.map((service) => (
                  <label
                    key={service.id}
                    className={`${styles.serviceCard} ${selectedServiceId === service.id ? styles.serviceCardSelected : ''}`}
                  >
                    <input
                      type="radio"
                      value={service.id}
                      {...form.register('serviceId')}
                      disabled={feature.saving || catalogue.isFetching}
                    />
                    <div className={styles.serviceCardInfo}>
                      <strong>{service.name}</strong>
                      <span className={styles.serviceCardCategory}>{service.category || 'Laboratory'}</span>
                    </div>
                    <span className={styles.serviceCardPrice}>{formatCurrency(service.standard_price)}</span>
                  </label>
                ))}
              </div>
            )}
            {form.formState.errors.serviceId && <p role="alert">{form.formState.errors.serviceId.message}</p>}

            <label>
              Specimen type
              <select {...form.register('specimenType')} disabled={feature.saving}>
                <option value="Blood">Blood</option>
                <option value="Saliva">Saliva</option>
                <option value="Swab">Swab / Tissue</option>
                <option value="Urine">Urine</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {feature.saveError && (
              <p role="alert">
                {feature.saveError}{' '}
                <button type="button" onClick={() => { void order.refetch(); }}>Refresh order</button>
              </p>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
