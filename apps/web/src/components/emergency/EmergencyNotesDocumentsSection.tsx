import { toast } from 'sonner';

export type EmergencyNotesDocumentsSectionProps = {
  tab: 'Notes' | 'Documents';
};

export function EmergencyNotesDocumentsSection({ tab }: EmergencyNotesDocumentsSectionProps) {
  return (
    <section
      className="emergency-form-section"
      style={{
        background: '#fff',
        borderRadius: '10px',
        padding: '18px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
          {tab} Management
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
          Emergency documentation and patient medical records
        </p>
      </div>
      <div className="adm-field">
        <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Documentation Notes</label>
        <textarea placeholder="Record clinical handover observations..." rows={5} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button
          className="btn-emergency-primary"
          onClick={() => toast.success(`${tab} updated.`)}
          type="button"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save {tab}
        </button>
      </div>
    </section>
  );
}
