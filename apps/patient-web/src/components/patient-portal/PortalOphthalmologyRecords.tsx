import type { PortalOphthalmologyPublication } from '../../api/ophthalmology-publications.schemas';

function Values({ value }: { value: unknown }) {
  if (value == null || value === '') return <span>Not recorded</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span>{String(value)}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((entry: unknown, index) => <li key={index}><Values value={entry} /></li>)}</ul> : <span>None in this approved record</span>;
  if (typeof value === 'object') return <dl>{Object.entries(value).filter(([key]) => !['kind', 'report_document_ids'].includes(key)).map(([key, entry]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd><Values value={entry} /></dd></div>)}</dl>;
  return <span>Unavailable</span>;
}
export function PortalOphthalmologyRecords({ publications }: { publications: PortalOphthalmologyPublication[] }) {
  return <section className="portal-section"><article className="portal-panel"><div className="portal-panel-head"><div><h2>Approved eye clinic records</h2><p>Records explicitly approved for patient viewing. Approval and publication are separate events.</p></div></div>
    {!publications.length && <p>No approved eye clinic records are available.</p>}
    {publications.map((record) => <details key={record.id}><summary>{record.source_type.replaceAll('_', ' ')} · clinical version {record.source_version} · published {new Date(record.published_at).toLocaleString()}</summary>
      {record.payload ? <Values value={record.payload} /> : <p>This approved record cannot be displayed in this view. Contact the hospital for the document.</p>}
      {record.payload?.kind === 'TEST_RESULT' && Boolean(record.payload.report_document_ids?.length) && <p>Selected report files are available through the hospital's authorized document workflow. A listed report is not a new clinical review.</p>}
    </details>)}
  </article></section>;
}
