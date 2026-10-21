import type { PortalOphthalmologyPublication } from '../../api/ophthalmology-publications.schemas';

function Values({ value }: { value: unknown }) {
  if (value == null || value === '') return <span>Not recorded</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span>{String(value)}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((entry: unknown, index) => <li key={index}><Values value={entry} /></li>)}</ul> : <span>None in this approved record</span>;
  if (typeof value === 'object') return <dl>{Object.entries(value).filter(([key]) => !['kind', 'report_document_ids'].includes(key)).map(([key, entry]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd><Values value={entry} /></dd></div>)}</dl>;
  return <span>Unavailable</span>;
}

function OpticalPrescriptionView({ record }: { record: NonNullable<Extract<PortalOphthalmologyPublication['payload'], { kind: 'OPTICAL_PRESCRIPTION' }>> }) {
  return (
    <div style={{ marginTop: '12px', padding: '16px', border: '1px solid var(--portal-border, #e2e8f0)', borderRadius: '8px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Spectacle & Optical Prescription</h3>
          <small style={{ color: '#64748b' }}>Type: {record.prescription_type ?? 'Standard'} · Lens: {record.lens_type ?? 'Single Vision'} ({record.material ?? 'Standard'})</small>
        </div>
        <button type="button" className="portal-btn" onClick={() => window.print()} style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
          Print Spectacle Slip
        </button>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '8px' }}>Eye</th>
              <th style={{ padding: '8px' }}>Sphere (SPH)</th>
              <th style={{ padding: '8px' }}>Cylinder (CYL)</th>
              <th style={{ padding: '8px' }}>Axis</th>
              <th style={{ padding: '8px' }}>Addition (ADD)</th>
              <th style={{ padding: '8px' }}>Prism</th>
            </tr>
          </thead>
          <tbody>
            {(['OD', 'OS'] as const).map((eye) => {
              const eyePower = record.power?.[eye];
              return (
                <tr key={eye} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}</td>
                  <td style={{ padding: '8px' }}>{eyePower?.sphere != null ? (eyePower.sphere > 0 ? `+${eyePower.sphere.toFixed(2)}` : eyePower.sphere.toFixed(2)) : '—'}</td>
                  <td style={{ padding: '8px' }}>{eyePower?.cylinder != null ? (eyePower.cylinder > 0 ? `+${eyePower.cylinder.toFixed(2)}` : eyePower.cylinder.toFixed(2)) : '—'}</td>
                  <td style={{ padding: '8px' }}>{eyePower?.axis != null ? `${eyePower.axis}°` : '—'}</td>
                  <td style={{ padding: '8px' }}>{eyePower?.addition != null ? (eyePower.addition > 0 ? `+${eyePower.addition.toFixed(2)}` : eyePower.addition.toFixed(2)) : '—'}</td>
                  <td style={{ padding: '8px' }}>{eyePower?.prism != null ? `${eyePower.prism} ${eyePower.prism_base ?? ''}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.875rem' }}>
        <div>
          <strong>Pupillary Distance (PD):</strong>{' '}
          {record.pupillary_distance?.format === 'BINOCULAR'
            ? `${record.pupillary_distance.binocular} mm (Binocular)`
            : record.pupillary_distance
            ? `OD: ${record.pupillary_distance.OD ?? '—'} mm, OS: ${record.pupillary_distance.OS ?? '—'} mm`
            : 'Not specified'}
        </div>
        {record.coating_codes && record.coating_codes.length > 0 && (
          <div>
            <strong>Coatings:</strong> {record.coating_codes.join(', ')}
          </div>
        )}
        {record.valid_until && (
          <div>
            <strong>Valid Until:</strong> {new Date(record.valid_until).toLocaleDateString()}
          </div>
        )}
      </div>

      {record.usage_instructions && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.875rem' }}>
          <strong>Usage Instructions:</strong> {record.usage_instructions}
        </div>
      )}
    </div>
  );
}

function ConsultationSummaryView({ record }: { record: NonNullable<Extract<PortalOphthalmologyPublication['payload'], { kind: 'CONSULTATION_SUMMARY' }>> }) {
  return (
    <div style={{ marginTop: '12px', padding: '16px', border: '1px solid var(--portal-border, #e2e8f0)', borderRadius: '8px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Doctor Consultation Summary</h3>
          <small style={{ color: '#64748b' }}>Approved: {record.approved_at ? new Date(record.approved_at).toLocaleString() : 'Yes'}</small>
        </div>
        <button type="button" className="portal-btn" onClick={() => window.print()} style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
          Print Summary
        </button>
      </div>

      {record.diagnoses && record.diagnoses.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Diagnoses</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {record.diagnoses.map((d, i) => (
              <li key={i}>
                <strong>{d.display ?? d.code}</strong> {d.laterality ? `(${d.laterality})` : ''} — {d.status ?? 'Diagnosed'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {record.clinical_review?.clinical_summary && (
        <div style={{ marginBottom: '14px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Clinical Assessment & Summary</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>{record.clinical_review.clinical_summary}</p>
        </div>
      )}

      {record.clinical_review?.treatment_plans && record.clinical_review.treatment_plans.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Treatment Plans</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {record.clinical_review.treatment_plans.map((tp, i) => (
              <li key={i}>
                <strong>{tp.category}:</strong> {tp.treatment} {tp.priority ? `(${tp.priority} priority)` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {record.clinical_review?.patient_instructions && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '6px', borderLeft: '4px solid #22c55e' }}>
          <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: '#166534' }}>Patient Advice & Care Instructions</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#14532d' }}>{record.clinical_review.patient_instructions}</p>
        </div>
      )}

      {record.medication_prescriptions && record.medication_prescriptions.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Prescribed Eye Medications</h4>
          {record.medication_prescriptions.map((rx, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              {rx.items?.map((med, medIdx) => (
                <div key={medIdx} style={{ fontSize: '0.875rem', padding: '4px 0' }}>
                  • <strong>{med.medicine_name}</strong> {med.strength} — {med.dosage} ({med.frequency}, for {med.duration}). {med.instructions ? `Note: ${med.instructions}` : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {record.follow_ups && record.follow_ups.length > 0 && (
        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', fontSize: '0.875rem' }}>
          <strong>Next Follow-up:</strong> {record.follow_ups.map((f, i) => <span key={i}>{f.date ? new Date(f.date).toLocaleDateString() : 'Scheduled'} with {f.doctor_name || 'Doctor'}</span>)}
        </div>
      )}
    </div>
  );
}

export function PortalOphthalmologyRecords({ publications }: { publications: PortalOphthalmologyPublication[] }) {
  return (
    <section className="portal-section">
      <article className="portal-panel">
        <div className="portal-panel-head">
          <div>
            <h2>Approved eye clinic records</h2>
            <p>Records explicitly approved for patient viewing. Approval and publication are separate events.</p>
          </div>
        </div>
        {!publications.length && <p>No approved eye clinic records are available.</p>}
        {publications.map((record) => (
          <details key={record.id} style={{ marginBottom: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              {record.source_type.replaceAll('_', ' ')} · clinical version {record.source_version} · published {new Date(record.published_at).toLocaleString()}
            </summary>
            {record.payload?.kind === 'OPTICAL_PRESCRIPTION' ? (
              <OpticalPrescriptionView record={record.payload} />
            ) : record.payload?.kind === 'CONSULTATION_SUMMARY' ? (
              <ConsultationSummaryView record={record.payload} />
            ) : record.payload ? (
              <Values value={record.payload} />
            ) : (
              <p>This approved record cannot be displayed in this view. Contact the hospital for the document.</p>
            )}
            {record.payload?.kind === 'TEST_RESULT' && Boolean(record.payload.report_document_ids?.length) && (
              <p>Selected report files are available through the hospital's authorized document workflow. A listed report is not a new clinical review.</p>
            )}
          </details>
        ))}
      </article>
    </section>
  );
}
