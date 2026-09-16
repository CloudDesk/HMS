import { useDentalImagingFeature, type DentalImagingFeatureInput } from '../../../hooks/opd/useDentalImagingFeature';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { PERMANENT_QUADRANTS, PRIMARY_QUADRANTS, isDentalImagingService, getToothName } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import styles from './DentalClinicalOrders.module.css';
import { Modal } from '../../ui/Modal';

type Props = DentalImagingFeatureInput & { selectedTooth: number | null };

export function DentalImagingSection({ selectedTooth, ...input }: Props) {
  const feature = useDentalImagingFeature(input);
  const formatCurrency = useCurrencyFormatter();
  const { order, form, catalogue, report } = feature;
  if (!feature.canView) return <section className={styles.imagingPanel}>You do not have permission to view imaging requests.</section>;
  const items = (order.data?.items ?? []).filter((item) => selectedTooth === null || item.tooth_number === selectedTooth || item.tooth_number == null);
  const selectedServiceId = form.watch('serviceId');
  const selectedToothVal = form.watch('tooth');
  const rawServices = catalogue.data?.data ?? [];
  const dentalImagingServices = rawServices.filter(isDentalImagingService);

  return <section className={styles.imagingPanel} aria-label="Dental imaging">
    <div className={styles.imagingHeader}>
      <div><h3>{selectedTooth ? `Imaging · Tooth #${selectedTooth}` : 'Dental imaging'}</h3><p>Tooth-specific and full-mouth investigations for this visit.</p></div>
      <div className={styles.imagingActions}>
        <button type="button" disabled={order.isFetching || feature.saving} onClick={() => { void order.refetch(); }}>Refresh status</button>
        {feature.canAdd && <button type="button" className={styles.btnAddAction} onClick={() => feature.openRequest(selectedTooth)}>+ Add X-Ray / Scan</button>}
      </div>
    </div>
    {order.isLoading && <p role="status">Loading imaging requests…</p>}
    {order.isError && <p role="alert">{getOpdErrorMessage(order.error)} <button type="button" onClick={() => { void order.refetch(); }}>Retry</button></p>}
    {order.isSuccess && items.length === 0 && <p>No imaging requests {selectedTooth ? `for Tooth #${selectedTooth} or full mouth` : 'for this visit'}.</p>}
    <ul className={styles.imagingList}>{items.map((item, idx) => <li key={item.id ?? `${item.service_id}-${item.tooth_number ?? 'gen'}-${idx}`}>
      <strong>{item.investigation_name}</strong>
      <span>{item.tooth_number ? `Tooth #${item.tooth_number}` : 'General / Full Mouth'}</span>
      <span className={styles.contextBadge}>{order.data?.status.replaceAll('_', ' ')}</span>
    </li>)}</ul>
    {order.data?.status === 'DRAFT' && <p>Saved draft. Radiology receives the request after consultation completion and submission.</p>}
    {input.consultationCompleted && input.canEdit && order.data?.status === 'DRAFT' && <button type="button" disabled={feature.saving} onClick={() => { void feature.submitRequest(); }}>Submit imaging request</button>}
    {feature.saveError && !feature.open && <p role="alert">{feature.saveError}</p>}
    {feature.reportAvailable && <button type="button" onClick={() => feature.setReportOpen(!feature.reportOpen)}>{feature.reportOpen ? 'Hide report' : 'View report'}</button>}
    {feature.reportOpen && feature.reportAvailable && <div className={styles.imagingReport} aria-label="Imaging report">
      <h4>Visit imaging report</h4><p>This report covers the original visit imaging order.</p>
      {report.isLoading && <p role="status">Loading report…</p>}
      {report.isError && <p role="alert">{getOpdErrorMessage(report.error)} <button type="button" onClick={() => { void report.refetch(); }}>Retry report</button></p>}
      {report.data && <><p>{report.data.verified_at ? 'Verified report' : 'Report entered — awaiting verification'}</p><h4>Findings</h4><p>{report.data.findings}</p><h4>Impression</h4><p>{report.data.impression}</p>{report.data.recommendations && <><h4>Recommendations</h4><p>{report.data.recommendations}</p></>}</>}
    </div>}
    {feature.open && <Modal
        open
        title="Add X-Ray / Scan"
        className={`${styles.imagingPanel} ${styles.imagingDialog}`}
        onClose={() => { if (!feature.saving) feature.setOpen(false); }}
        footer={
          <div className={styles.dialogFooterActions}>
            <button type="button" disabled={feature.saving} onClick={() => feature.setOpen(false)}>Cancel</button>
            <button
              type="submit"
              form="dental-imaging-form"
              disabled={feature.saving || !feature.canAdd || catalogue.isFetching || !selectedServiceId}
            >
              {feature.saving ? 'Saving…' : 'Add X-Ray / Scan'}
            </button>
          </div>
        }
      >
        <form id="dental-imaging-form" className={styles.dialogForm} onSubmit={(event) => { void feature.saveRequest(event); }}>
          <div className={styles.toothContextCard}>
            <span>Selected Context:</span>
            <strong>
              {selectedToothVal ? `Tooth #${selectedToothVal} (${getToothName(Number(selectedToothVal))})` : 'General / Full Mouth Imaging'}
            </strong>
          </div>

          <label>Search catalogue<input type="search" placeholder="Search dental imaging..." value={feature.searchTerm} onChange={(event) => feature.changeSearch(event.target.value)} /></label>
          {catalogue.isLoading && <p role="status">Loading imaging services…</p>}
          {catalogue.isError && <p role="alert">{getOpdErrorMessage(catalogue.error)} <button type="button" onClick={() => { void catalogue.refetch(); }}>Retry catalogue</button></p>}
          
          <label>Select Dental Imaging Service <span className={styles.required}>*</span></label>
          {catalogue.isSuccess && dentalImagingServices.length === 0 && (
            <div className={styles.emptyServiceState}>
              <p>No active dental imaging services match this search.</p>
            </div>
          )}

          {dentalImagingServices.length > 0 && (
            <div className={styles.serviceCardList} role="radiogroup" aria-label="Dental imaging services">
              {dentalImagingServices.map((service) => (
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
                    <span className={styles.serviceCardCategory}>{service.category || 'Dental Imaging'}</span>
                  </div>
                  <span className={styles.serviceCardPrice}>{formatCurrency(service.standard_price)}</span>
                </label>
              ))}
            </div>
          )}
          {form.formState.errors.serviceId && <p role="alert">{form.formState.errors.serviceId.message}</p>}

          <label>Tooth (optional)
            <select {...form.register('tooth')} disabled={feature.saving}>
              <option value="">General / Full Mouth</option>
              {[...Object.values(PERMANENT_QUADRANTS).flat(), ...Object.values(PRIMARY_QUADRANTS).flat()].map((tooth) => (
                <option key={tooth} value={tooth}>Tooth #{tooth} - {getToothName(tooth)}</option>
              ))}
            </select>
          </label>
          {form.formState.errors.tooth && <p role="alert">{form.formState.errors.tooth.message}</p>}

          {feature.saveError && <p role="alert">{feature.saveError} <button type="button" onClick={() => { void order.refetch(); }}>Refresh order</button></p>}
        </form>
    </Modal>}
  </section>;
}
