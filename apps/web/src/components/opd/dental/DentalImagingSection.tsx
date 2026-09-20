import { useState } from 'react';
import { useDentalImagingFeature, type DentalImagingFeatureInput } from '../../../hooks/opd/useDentalImagingFeature';
import { getOpdErrorMessage } from '../../../pages/opd-utils';
import { PERMANENT_QUADRANTS, PRIMARY_QUADRANTS, isDentalImagingService, getToothName } from '../../../pages/dental-utils';
import { useCurrencyFormatter } from '../../../api/useSettings';
import { imagingApi, type ImagingAttachment } from '../../../api/imaging';
import styles from './DentalClinicalOrders.module.css';
import { Modal } from '../../ui/Modal';
import { DentalImageViewerModal } from './DentalImageViewerModal';

type Props = DentalImagingFeatureInput & { selectedTooth: number | null };

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getResultAvailability = (status?: string | null) => {
  if (status && ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(status)) {
    return { label: status === 'VERIFIED' ? 'Verified Report' : 'Report Available', available: true };
  }
  if (status === 'IN_PROGRESS') return { label: 'In Progress', available: false };
  if (status === 'RECEIVED') return { label: 'Received', available: false };
  if (status === 'SUBMITTED') return { label: 'Submitted', available: false };
  return { label: 'Draft', available: false };
};

export function DentalImagingSection({ selectedTooth, ...input }: Props) {
  const [viewerAttachment, setViewerAttachment] = useState<ImagingAttachment | null>(null);
  const feature = useDentalImagingFeature(input);
  const formatCurrency = useCurrencyFormatter();
  const { order, form, catalogue, report } = feature;
  if (!feature.canView) return <section className={styles.imagingPanel}>You do not have permission to view imaging requests.</section>;
  const items = (order.data?.items ?? []).filter((item) => selectedTooth === null || item.tooth_number === selectedTooth || item.tooth_number == null);
  const selectedServiceId = form.watch('serviceId');
  const selectedToothVal = form.watch('tooth');
  const rawServices = catalogue.data?.data ?? [];
  const dentalImagingServices = rawServices.filter(isDentalImagingService);
  const currentResultInfo = getResultAvailability(order.data?.status);
  const otherEpisodeOrders = feature.episodeOrders.filter((epOrder) => epOrder.id !== order.data?.id);

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
      <span className={`${styles.resultBadge} ${currentResultInfo.available ? styles.resultAvailable : styles.resultPending}`}>{currentResultInfo.label}</span>
      {order.data?.clinical_notes && (
        <span style={{ width: '100%', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
          Indication: {order.data.clinical_notes}
        </span>
      )}
    </li>)}</ul>
    {otherEpisodeOrders.length > 0 && (
      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
        <h4 style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.4rem' }}>Other Episode Imaging Orders</h4>
        <ul className={styles.imagingList}>
          {otherEpisodeOrders.flatMap((epOrder) =>
            epOrder.items.map((item, idx) => {
              const epResult = getResultAvailability(epOrder.status);
              return (
                <li key={`${epOrder.id}-${item.id ?? idx}`}>
                  <strong>{item.investigation_name}</strong>
                  <span>{item.tooth_number ? `Tooth #${item.tooth_number}` : 'General / Full Mouth'}</span>
                  <span className={styles.contextBadge}>{epOrder.status.replaceAll('_', ' ')}</span>
                  <span className={`${styles.resultBadge} ${epResult.available ? styles.resultAvailable : styles.resultPending}`}>{epResult.label}</span>
                  {epOrder.clinical_notes && (
                    <span style={{ width: '100%', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                      Indication: {epOrder.clinical_notes}
                    </span>
                  )}
                  {epResult.available && (
                    <button type="button" onClick={() => feature.openOrderReport(epOrder.id)}>
                      View Image
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    )}
    {order.data?.status === 'DRAFT' && <p>Saved draft. Radiology receives the request after consultation completion and submission.</p>}
    {input.consultationCompleted && input.canEdit && order.data?.status === 'DRAFT' && <button type="button" disabled={feature.saving} onClick={() => { void feature.submitRequest(); }}>Submit imaging request</button>}
    {feature.saveError && !feature.open && <p role="alert">{feature.saveError}</p>}
    {feature.reportAvailable && <button type="button" onClick={() => { if (feature.reportOpen) { feature.setReportOpen(false); } else { feature.openOrderReport(order.data?.id); } }}>{feature.reportOpen ? 'Hide report' : 'View report'}</button>}
    {feature.reportOpen && (
      <div className={styles.imagingReport} aria-label="Imaging report">
        <h4>Visit imaging report</h4><p>This report covers the original visit imaging order.</p>
        {report.isLoading && <p role="status">Loading report…</p>}
        {report.isError && <p role="alert">{getOpdErrorMessage(report.error)} <button type="button" onClick={() => { void report.refetch(); }}>Retry report</button></p>}
        {report.data && (
          <>
            <p>{report.data.verified_at ? 'Verified report' : 'Report entered — awaiting verification'}</p>
            <h4>Findings</h4>
            <p>{report.data.findings}</p>
            <h4>Impression</h4>
            <p>{report.data.impression}</p>
            {report.data.recommendations && <><h4>Recommendations</h4><p>{report.data.recommendations}</p></>}
            {report.data.attachments && report.data.attachments.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <h4>Attached Images &amp; Files ({report.data.attachments.length})</h4>
                <ul className={styles.attachmentList}>
                  {report.data.attachments.map((att) => (
                    <li key={att.id} className={styles.attachmentItem}>
                      <div className={styles.attachmentInfo}>
                        <strong>{att.file_name}</strong>
                        <span className={styles.attachmentMeta}>
                          {att.mime_type} {att.file_size_bytes ? `• ${formatFileSize(att.file_size_bytes)}` : ''}
                        </span>
                      </div>
                      <div className={styles.attachmentActions}>
                        {feature.canView && (
                          <button
                            type="button"
                            className={styles.viewImageBtn}
                            onClick={() => setViewerAttachment(att)}
                            aria-label={`View image ${att.file_name}`}
                          >
                            View Image
                          </button>
                        )}
                        <a
                          href={imagingApi.getAttachmentDownloadUrl(report.data!.order_id, att.id)}
                          className={styles.downloadBtn}
                          target="_blank"
                          rel="noreferrer"
                          download={att.file_name}
                        >
                          Download
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    )}
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

          <label>Clinical Indication / Reason (optional)
            <input
              type="text"
              placeholder="e.g. Suspected deep pulp involvement"
              {...form.register('clinicalNotes')}
              disabled={feature.saving}
            />
          </label>

          {feature.saveError && <p role="alert">{feature.saveError} <button type="button" onClick={() => { void order.refetch(); }}>Refresh order</button></p>}
        </form>
    </Modal>}

    <DentalImageViewerModal
      open={Boolean(viewerAttachment)}
      onClose={() => setViewerAttachment(null)}
      attachment={viewerAttachment}
      attachments={report.data?.attachments ?? []}
      orderId={report.data?.order_id ?? ''}
      investigationName={order.data?.items?.[0]?.investigation_name ?? 'Dental Imaging'}
      toothNumber={order.data?.items?.[0]?.tooth_number ?? selectedTooth}
      canDownload={feature.canView}
      onSelectAttachment={(att) => setViewerAttachment(att)}
    />
  </section>;
}
