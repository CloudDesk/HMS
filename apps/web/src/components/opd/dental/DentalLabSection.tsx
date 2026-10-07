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
    <section className={styles.labContainer} aria-label="Dental laboratory">
      <div className={styles.labHeader}>
        <div className={styles.labTitleGroup}>
          <h3 className={styles.labTitle}>
            <i className="ph ph-flask" /> Dental Laboratory Investigations
          </h3>
        </div>
        <div className={styles.labActionRow}>
          <button
            type="button"
            className={styles.btnRefreshAction}
            disabled={order.isFetching || feature.saving}
            onClick={() => {
              void order.refetch();
            }}
            title="Refresh laboratory requests"
          >
            <i className={`ph ph-arrows-clockwise ${order.isFetching ? styles.spinIcon : ''}`} /> Refresh
          </button>
          {feature.canAdd && (
            <button
              type="button"
              className={styles.btnAddLabAction}
              onClick={() => feature.openRequest()}
              disabled={feature.saving}
              title="Add laboratory investigation"
            >
              + Add Lab Investigation
            </button>
          )}
        </div>
      </div>
      {order.isLoading && <p role="status" style={{ color: '#64748b', fontSize: '0.8125rem' }}>Loading laboratory requests…</p>}
      {order.isError && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem' }}>
          {getOpdErrorMessage(order.error)}{' '}
          <button type="button" className={styles.tableAction} onClick={() => { void order.refetch(); }}>
            Retry
          </button>
        </p>
      )}
      {order.isSuccess && items.length === 0 && (
        <div className={styles.labEmpty}>
          <i className="ph ph-flask" />
          No laboratory requests for this visit.
        </div>
      )}
      {items.length > 0 && (
        <ul className={styles.labList}>
          {items.map((item, idx) => (
            <li key={item.id ?? `${item.service_id}-${idx}`} className={styles.labListItem}>
              <strong>{item.investigation_name}</strong>
              <span className={styles.labItemCategory}>{item.category || 'Laboratory'}</span>
              <span className={styles.contextBadge}>{order.data?.status.replaceAll('_', ' ')}</span>
            </li>
          ))}
        </ul>
      )}
      {order.data?.status === 'DRAFT' && (
        <p className={styles.labDraftNote}>Saved draft. Laboratory receives the request after consultation completion and submission.</p>
      )}
      {input.consultationCompleted && input.canEdit && order.data?.status === 'DRAFT' && (
        <button
          type="button"
          className={styles.btnSubmitLab}
          disabled={feature.saving}
          onClick={() => {
            void feature.submitRequest();
          }}
        >
          Submit laboratory request
        </button>
      )}
      {feature.saveError && !feature.open && <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{feature.saveError}</p>}
      {feature.resultAvailable && (
        <button
          type="button"
          className={styles.btnViewResults}
          onClick={() => feature.setResultOpen(!feature.resultOpen)}
        >
          <i className={feature.resultOpen ? 'ph ph-eye-slash' : 'ph ph-eye'} />
          {feature.resultOpen ? 'Hide laboratory results' : 'View laboratory results'}
        </button>
      )}
      {feature.resultOpen && feature.resultAvailable && (
        <div className={styles.imagingReport} aria-label="Laboratory result">
          <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '0.9rem', fontWeight: 600 }}>Visit Laboratory Results</h4>
          <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.8125rem' }}>
            {result.data?.verified_at ? 'Verified results' : 'Results entered — awaiting verification'}
          </p>
          {result.isLoading && <p role="status">Loading laboratory results…</p>}
          {result.isError && (
            <p role="alert">
              {getOpdErrorMessage(result.error)}{' '}
              <button type="button" onClick={() => { void result.refetch(); }}>Retry results</button>
            </p>
          )}
          {result.data && (
            <>
              {result.data.remarks && (
                <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <strong style={{ fontSize: '0.8125rem', color: '#475569' }}>Remarks:</strong>{' '}
                  <span style={{ fontSize: '0.8125rem', color: '#0f172a' }}>{result.data.remarks}</span>
                </div>
              )}
              {result.data.result_items && result.data.result_items.length > 0 && (
                <div className={styles.ordersTableWrap}>
                  <table className={styles.ordersTable}>
                    <thead>
                      <tr>
                        <th>Test / Parameter</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Reference Range</th>
                        <th>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.result_items.map((res, idx) => (
                        <tr key={idx}>
                          <td><strong>{res.service_name}</strong></td>
                          <td style={{ fontWeight: 600 }}>{res.value}</td>
                          <td>{res.unit || '—'}</td>
                          <td>{res.reference_range || '—'}</td>
                          <td>{res.comments || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
