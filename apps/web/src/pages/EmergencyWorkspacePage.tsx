import { useState } from 'react';
import { toast } from 'sonner';
import { navigate } from '../routing/navigation';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { EmergencyHeader } from '../components/emergency/EmergencyHeader';
import { EmergencyVitalsWidget } from '../components/emergency/EmergencyVitalsWidget';
import { EmergencyRegistrationSection } from '../components/emergency/EmergencyRegistrationSection';
import { EmergencyTriageSection } from '../components/emergency/EmergencyTriageSection';
import { EmergencyConsultationSection } from '../components/emergency/EmergencyConsultationSection';
import { EmergencyTreatmentSection } from '../components/emergency/EmergencyTreatmentSection';
import { EmergencyOrdersSection } from '../components/emergency/EmergencyOrdersSection';
import { EmergencyDispositionSection } from '../components/emergency/EmergencyDispositionSection';
import { EmergencyModals } from '../components/emergency/EmergencyModals';
import type { WorkspaceTab } from '../components/emergency/types';

const TABS: readonly WorkspaceTab[] = [
  'Registration',
  'Triage',
  'Consultation',
  'Treatment',
  'Medication',
  'Lab Orders',
  'Imaging Orders',
  'Referral',
  'Notes',
  'Documents',
  'Disposition',
];

export function EmergencyWorkspacePage() {
  const feature = useEmergencyWorkspaceFeature();
  const { state, actions, mutations } = feature;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Registration');
  const [linkPatientOpen, setLinkPatientOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const selected = state.selected || state.encounters[0] || null;

  if (state.detailQuery.isLoading && !selected) {
    return (
      <div className="emergency-page emergency-theme" style={{ padding: '4rem', textAlign: 'center' }}>
        <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', fontSize: '2rem', color: '#dc2626' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading emergency workspace...</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="emergency-page emergency-theme" style={{ padding: '4rem', textAlign: 'center' }}>
        <i className="ph ph-first-aid" style={{ fontSize: '3rem', color: '#94a3b8' }} />
        <h3 style={{ margin: '1rem 0 0.5rem', color: '#0f172a' }}>No Emergency Patient Selected</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Select an active patient from the emergency queue to open their clinical workspace.</p>
        <button className="btn-emergency-primary" onClick={() => navigate('/emergency/queue')} type="button">
          Open Emergency Queue
        </button>
      </div>
    );
  }

  return (
    <div className="emergency-page emergency-theme">
      <EmergencyHeader
        state={state}
        setActiveTab={setActiveTab}
        onOpenLinkPatient={() => setLinkPatientOpen(true)}
      />

      <div className="emergency-workspace-layout">
        <main className="emergency-workspace-main">
          <div className="emergency-tabs">
            {TABS.map((tab) => (
              <button
                className={`emergency-tab ${activeTab === tab ? 'active' : ''}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="emergency-tab-content">
            {activeTab === 'Registration' && (
              <EmergencyRegistrationSection state={state} setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Triage' && (
              <EmergencyTriageSection state={state} mutations={mutations} setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Consultation' && (
              <EmergencyConsultationSection state={state} mutations={mutations} setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Treatment' && (
              <EmergencyTreatmentSection setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Medication' && (
              <EmergencyOrdersSection state={state} mutations={mutations} orderType="PHARMACY" />
            )}
            {activeTab === 'Lab Orders' && (
              <EmergencyOrdersSection state={state} mutations={mutations} orderType="LABORATORY" />
            )}
            {activeTab === 'Imaging Orders' && (
              <EmergencyOrdersSection state={state} mutations={mutations} orderType="IMAGING" />
            )}
            {['Referral', 'Notes', 'Documents'].includes(activeTab) && (
              <section className="emergency-form-section">
                <div className="emergency-form-head">
                  <div>
                    <h3>{activeTab} Management</h3>
                    <p>Clinical coordination and patient documentation</p>
                  </div>
                </div>
                <div className="doc-field">
                  <label>Clinical Documentation Notes</label>
                  <textarea defaultValue="Patient stabilized in ER. Continuous telemetry running." rows={6} />
                </div>
                <div className="emergency-form-actions" style={{ marginTop: '1.5rem' }}>
                  <span className="emergency-autosave">
                    <i className="ph ph-check-circle" /> Auto-save enabled
                  </span>
                  <div>
                    <button className="btn-emergency-primary" onClick={() => toast.success(`${activeTab} updated.`)} type="button">
                      Save {activeTab}
                    </button>
                  </div>
                </div>
              </section>
            )}
            {activeTab === 'Disposition' && (
              <EmergencyDispositionSection state={state} mutations={mutations} />
            )}
          </div>
        </main>

        <EmergencyVitalsWidget state={state} />
      </div>

      <div className="emergency-floating-actions">
        <div className={`emergency-fab-menu ${fabOpen ? 'open' : ''}`}>
          <button className="emergency-fab" onClick={() => { setActiveTab('Lab Orders'); setFabOpen(false); }} type="button">
            <i className="ph ph-flask" /> STAT Labs
          </button>
          <button className="emergency-fab" onClick={() => { toast.info('Calling specialist on duty...'); setFabOpen(false); }} type="button">
            <i className="ph ph-phone-call" /> Call Specialist
          </button>
          <button className="emergency-fab" onClick={() => { setActiveTab('Disposition'); setFabOpen(false); }} type="button">
            <i className="ph ph-bed" /> Admit / Disposition
          </button>
        </div>
        <button className="emergency-fab primary" onClick={() => setFabOpen(!fabOpen)} type="button">
          <i className={fabOpen ? 'ph ph-x' : 'ph ph-lightning'} />
        </button>
      </div>

      <EmergencyModals
        state={state}
        actions={actions}
        mutations={mutations}
        linkPatientOpen={linkPatientOpen}
        setLinkPatientOpen={setLinkPatientOpen}
        priorityOpen={priorityOpen}
        setPriorityOpen={setPriorityOpen}
      />
    </div>
  );
}
