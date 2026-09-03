import { useState } from 'react';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { EmergencyHeader } from '../components/emergency/EmergencyHeader';
import { EmergencyVitalsWidget } from '../components/emergency/EmergencyVitalsWidget';
import { EmergencyRegistrationSection } from '../components/emergency/EmergencyRegistrationSection';
import { EmergencyTriageSection } from '../components/emergency/EmergencyTriageSection';
import { EmergencyConsultationSection } from '../components/emergency/EmergencyConsultationSection';
import { EmergencyTreatmentSection } from '../components/emergency/EmergencyTreatmentSection';
import { EmergencyOrdersSection } from '../components/emergency/EmergencyOrdersSection';
import { EmergencyReferralSection } from '../components/emergency/EmergencyReferralSection';
import { EmergencyNotesDocumentsSection } from '../components/emergency/EmergencyNotesDocumentsSection';
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
] as const;

export function EmergencyWorkspacePage() {
  const { state, actions, mutations } = useEmergencyWorkspaceFeature();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Registration');
  const [linkPatientOpen, setLinkPatientOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assignDoctorOpen, setAssignDoctorOpen] = useState(false);

  const selected = state.selected;

  if (!selected) {
    return (
      <div className="emergency-page emergency-theme">
        <div className="doc-empty-state" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <i
            className="ph ph-first-aid"
            style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem', display: 'block' }}
          />
          <h3>No Emergency Case Selected</h3>
          <p>Please return to the emergency queue to select an active patient encounter.</p>
          <button
            className="btn-emergency-primary"
            onClick={actions.openQueue}
            style={{ marginTop: '1rem' }}
            type="button"
          >
            Open Emergency Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="emergency-page emergency-theme"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}
    >
      <EmergencyHeader
        onOpenLinkPatient={() => setLinkPatientOpen(true)}
        setActiveTab={setActiveTab}
        state={state}
      />

      {/* Main Split Screen */}
      <div className="emergency-workspace-layout emergency-workspace-layout--compact">
        {/* Left Column: Tabs & Clinical Forms */}
        <main className="emergency-tabs-container">
          {/* Tab Navigation */}
          <div
            className="segmented-control"
            style={{ width: '100%', overflowX: 'auto', marginBottom: '1rem' }}
          >
            {TABS.map((tab) => (
              <button
                className={activeTab === tab ? 'active' : ''}
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
              <EmergencyRegistrationSection setActiveTab={setActiveTab} state={state} />
            )}
            {activeTab === 'Triage' && (
              <EmergencyTriageSection
                mutations={mutations}
                setActiveTab={setActiveTab}
                state={state}
              />
            )}
            {activeTab === 'Consultation' && (
              <EmergencyConsultationSection
                mutations={mutations}
                setActiveTab={setActiveTab}
                state={state}
              />
            )}
            {activeTab === 'Treatment' && (
              <EmergencyTreatmentSection setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Medication' && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="PHARMACY"
                state={state}
              />
            )}
            {activeTab === 'Lab Orders' && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="LABORATORY"
                state={state}
              />
            )}
            {activeTab === 'Imaging Orders' && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="IMAGING"
                state={state}
              />
            )}
            {activeTab === 'Referral' && (
              <EmergencyReferralSection mutations={mutations} state={state} />
            )}
            {(activeTab === 'Notes' || activeTab === 'Documents') && (
              <EmergencyNotesDocumentsSection tab={activeTab} />
            )}
            {activeTab === 'Disposition' && (
              <EmergencyDispositionSection mutations={mutations} state={state} />
            )}
          </div>
        </main>

        {/* Right Column: Sticky Live Vital Signs Widget */}
        <EmergencyVitalsWidget state={state} />
      </div>

      {/* Modals */}
      <EmergencyModals
        actions={actions}
        assignDoctorOpen={assignDoctorOpen}
        linkPatientOpen={linkPatientOpen}
        mutations={mutations}
        priorityOpen={priorityOpen}
        setAssignDoctorOpen={setAssignDoctorOpen}
        setLinkPatientOpen={setLinkPatientOpen}
        setPriorityOpen={setPriorityOpen}
        state={state}
      />
    </div>
  );
}
