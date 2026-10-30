import { confirmAction } from '../ui/confirm-action';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOphthalmologyPublicationFeature, type PublicationScope, type OphthalmologyPublicationFeature } from '../../hooks/ophthalmology/useOphthalmologyPublicationFeature';
import type { PublicationSource, OphthalmologyPublication } from '../../api/ophthalmology-publications';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { queueTime } from '../../hooks/ophthalmology/queue-actions';
import { Modal } from '../ui/Modal';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
const reasonSchema = z.object({ reason: z.string().trim().min(1).max(2000) });
function WithdrawPublication({ row: latest, feature: f }: { row: OphthalmologyPublication; feature: OphthalmologyPublicationFeature }) {
  const [row] = useState(latest); const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: '' } });
  const committed = useOphthalmologyDraftGuard(isDirty, ['visit_id', 'publication_source', 'publication_version', 'publication_page', 'withdraw_publication_id']);
  const stale = row.version !== latest.version || latest.status !== 'APPROVED_FOR_PORTAL';
  return <form onSubmit={handleSubmit(async (body) => { if (!f.canWithdraw || stale || f.busy || isSubmitting || !await confirmAction(`Withdraw publication version ${row.version} from patient viewing? The source clinical record remains preserved.`)) return; const saved = await f.withdraw(row, { expected_version: row.version, expected_status: 'APPROVED_FOR_PORTAL', reason: body.reason }); if (saved) { committed(); f.setQuery({ withdraw_publication_id: null }); } })}>
    <EditorErrors errors={errors} />{stale && <p role="alert">Publication changed; your reason is retained. Review the latest record before retrying.</p>}<fieldset className="oph-fieldset" disabled={!f.canWithdraw || stale || f.busy || isSubmitting}><label className="doc-field"><span>Withdrawal reason <span className="oph-required">*</span></span><textarea {...register('reason')} maxLength={2000} /></label><button className="doc-btn" type="submit">Withdraw exact publication version</button></fieldset><button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={() => f.setQuery({ withdraw_publication_id: null })}>Cancel withdrawal</button>
  </form>;
}
export function OphthalmologyPublicationTools({ scope, source, sourceApproved }: { scope: PublicationScope; source: PublicationSource; sourceApproved: boolean }) {
  const f = useOphthalmologyPublicationFeature(scope, source, sourceApproved); const key = useRef({ token: crypto.randomUUID(), baseline: '' });
  if (!f.canView) return null;
  return <section className="doc-card"><h4>Patient publication</h4><p>{source.source_type.replaceAll('_', ' ')} · clinical version {source.source_version}. Upload, test completion and doctor approval do not automatically publish this record.</p>
    <button className="doc-btn" type="button" onClick={() => { key.current = { token: crypto.randomUUID(), baseline: '' }; f.setQuery({ publication_source: source.source_id, publication_version: String(source.source_version), publication_page: '1', withdraw_publication_id: null }); }}>Open publication status and history</button>
    {f.open && <Modal className="oph-workspace" size="large" open title="Publication status and history" onClose={() => { if (!f.busy) f.setQuery({ publication_source: null, withdraw_publication_id: null }); }} footer={<button className="doc-btn" type="button" disabled={f.busy} onClick={() => f.setQuery({ publication_source: null, withdraw_publication_id: null })}>Close</button>}>
      <p>Exact source clinical version {source.source_version}. Only explicitly approved publications are visible to patients.</p><button className="doc-btn" type="button" disabled={f.busy || f.list.isFetching} onClick={f.refresh}>Refresh publication state</button>
      {f.sourceChanged && <p role="alert">The source clinical version changed. Close and reopen publication status to review the new version before taking action.</p>}{f.invalid && <p role="alert">Select a valid publication page.</p>}{f.scopeError && <p role="alert">Publication metadata does not match this patient encounter; actions are disabled.</p>}{f.list.isLoading && <p role="status">Loading publication history…</p>}{f.list.isError && <p role="alert">Publication history could not be refreshed. Cached information may be stale; actions are disabled.</p>}
      {f.fresh && f.page === 1 && <p>Current publication state: {f.current?.status ?? 'INTERNAL — no publication recorded for this version'}</p>}
      {!sourceApproved && <p>This source is not a current approved/reviewed version. Publication is unavailable.</p>}
      <button className="doc-btn primary" type="button" disabled={!f.canPublish || f.busy} onClick={async () => { if (await confirmAction('Approve this exact reviewed/final source version for patient viewing? Only the approved patient-facing fields and selected reports are published.')) { const baseline = `${source.source_version}:${f.current?.id ?? 'INTERNAL'}:${f.current?.version ?? ''}:${f.current?.status ?? ''}`; if (key.current.baseline !== baseline) key.current = { token: crypto.randomUUID(), baseline }; await f.publish(source, key.current.token); } }}>Publish exact clinical version</button>
      {f.records.map((row) => <section className="doc-card" key={row.id}><h4>{row.status} · publication version {row.version}</h4><p>Published {queueTime(row.published_at)} · actor {row.published_by} · source clinical version {row.source_version}</p>{row.withdrawn_at && <p>Withdrawn {queueTime(row.withdrawn_at)} · actor {row.withdrawn_by} · reason {row.withdrawal_reason}</p>}{f.canWithdraw && row.status === 'APPROVED_FOR_PORTAL' && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => f.setQuery({ withdraw_publication_id: row.id })}>Withdraw publication</button>}{f.selected?.id === row.id && <WithdrawPublication key={row.id} row={row} feature={f} />}</section>)}
      <div className="oph-toolbar"><button className="doc-btn" type="button" disabled={f.page <= 1 || f.busy || f.list.isFetching} onClick={() => f.setQuery({ publication_page: String(f.page - 1), withdraw_publication_id: null })}>Previous publications</button><span>Page {f.page}</span><button className="doc-btn" type="button" disabled={f.page >= (f.list.data?.meta.totalPages ?? 0) || f.busy || f.list.isFetching} onClick={() => f.setQuery({ publication_page: String(f.page + 1), withdraw_publication_id: null })}>Next publications</button></div>
      {f.error && <p role="alert" className="form-error-banner">{f.error} Refresh current history before retrying an interrupted response.</p>}
    </Modal>}
  </section>;
}
