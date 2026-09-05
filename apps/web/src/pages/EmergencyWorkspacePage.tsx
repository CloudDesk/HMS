import { useEffect, useMemo, useState } from 'react';
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
  const selected = state.selected;

  const isDoctor =
    state.capabilities.editConsultation ||
    state.capabilities.createOrders ||
    state.capabilities.discharge ||
    state.capabilities.admit;

  const isNurse = state.capabilities.assessTriage && !isDoctor;
  const isReceptionist =
    (state.capabilities.register || state.capabilities.linkPatient) &&
    !isNurse &&
    !isDoctor;

  const permittedTabs = useMemo<WorkspaceTab[]>(() => {
    if (isReceptionist) {
      const list: WorkspaceTab[] = ['Registration'];
      if (state.capabilities.viewDocuments || state.capabilities.viewEncounters) {
        list.push('Documents');
      }
      return list;
    }

    if (isNurse) {
      const list: WorkspaceTab[] = ['Triage'];
      if (state.capabilities.viewEncounters || state.capabilities.register) {
        list.push('Registration');
      }
      if (state.capabilities.viewConsultation) {
        list.push('Consultation');
      }
      if (state.capabilities.viewOrders) {
        list.push('Medication', 'Lab Orders', 'Imaging Orders');
      }
      list.push('Notes');
      if (state.capabilities.viewDocuments || state.capabilities.viewEncounters) {
        list.push('Documents');
      }
      if (state.capabilities.viewDisposition) {
        list.push('Disposition');
      }
      return list;
    }

    if (isDoctor) {
      const list: WorkspaceTab[] = [
        'Consultation',
        'Treatment',
        'Medication',
        'Lab Orders',
        'Imaging Orders',
      ];
      if (state.capabilities.editConsultation || state.capabilities.viewReferral) {
        list.push('Referral');
      }
      if (state.capabilities.viewEncounters || state.capabilities.register) {
        list.push('Registration');
      }
      if (state.capabilities.viewTriage || state.capabilities.assessTriage) {
        list.push('Triage');
      }
      list.push('Notes');
      if (state.capabilities.viewDocuments || state.capabilities.viewEncounters) {
        list.push('Documents');
      }
      list.push('Disposition');
      return list;
    }

    // Default fallback based on capabilities
    return TABS.filter((tab) => {
      if (tab === 'Registration') return state.capabilities.viewEncounters || state.capabilities.register;
      if (tab === 'Triage') return state.capabilities.viewTriage || state.capabilities.assessTriage;
      if (tab === 'Consultation') return state.capabilities.viewConsultation || state.capabilities.editConsultation;
      if (tab === 'Treatment') return state.capabilities.createOrders || state.capabilities.editConsultation;
      if (tab === 'Medication' || tab === 'Lab Orders' || tab === 'Imaging Orders') {
        return state.capabilities.viewOrders || state.capabilities.createOrders;
      }
      if (tab === 'Referral') return state.capabilities.editConsultation || state.capabilities.viewReferral;
      if (tab === 'Notes') return state.capabilities.viewConsultation || state.capabilities.assessTriage;
      if (tab === 'Documents') return state.capabilities.viewDocuments || state.capabilities.viewEncounters;
      if (tab === 'Disposition') {
        return (
          state.capabilities.viewDisposition ||
          state.capabilities.discharge ||
          state.capabilities.admit ||
          state.capabilities.transfer ||
          state.capabilities.markLeft
        );
      }
      return false;
    });
  }, [isReceptionist, isNurse, isDoctor, state.capabilities]);

  const defaultTab = useMemo<WorkspaceTab>(() => {
    if (isDoctor) return 'Consultation';
    if (isNurse) return 'Triage';
    if (isReceptionist) return 'Registration';
    return permittedTabs[0] || 'Registration';
  }, [isDoctor, isNurse, isReceptionist, permittedTabs]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [linkPatientOpen, setLinkPatientOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assignDoctorOpen, setAssignDoctorOpen] = useState(false);

  useEffect(() => {
    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [permittedTabs, activeTab, defaultTab]);

  const getTabBadgeType = (tab: WorkspaceTab): 'active' | 'context' | null => {
    if (isReceptionist) {
      if (tab === 'Registration') return 'active';
      return null;
    }
    if (isNurse) {
      if (tab === 'Triage') return 'active';
      if (
        tab === 'Registration' ||
        tab === 'Consultation' ||
        tab === 'Medication' ||
        tab === 'Lab Orders' ||
        tab === 'Imaging Orders' ||
        tab === 'Disposition'
      ) {
        return 'context';
      }
      return null;
    }
    if (isDoctor) {
      if (
        tab === 'Consultation' ||
        tab === 'Treatment' ||
        tab === 'Medication' ||
        tab === 'Lab Orders' ||
        tab === 'Imaging Orders' ||
        tab === 'Referral' ||
        tab === 'Disposition'
      ) {
        return 'active';
      }
      if (tab === 'Registration' || tab === 'Triage') {
        return 'context';
      }
      return null;
    }
    return null;
  };

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

  const showTriage = state.capabilities.viewTriage || state.capabilities.assessTriage;
  const showConsultation = state.capabilities.viewConsultation || state.capabilities.editConsultation;
  const showTreatment = state.capabilities.createOrders || state.capabilities.editConsultation;
  const showOrders = state.capabilities.viewOrders || state.capabilities.createOrders;
  const showReferral = state.capabilities.editConsultation || state.capabilities.viewReferral;
  const showNotes = state.capabilities.viewConsultation || state.capabilities.assessTriage;
  const showDocuments = state.capabilities.viewDocuments || state.capabilities.viewEncounters;
  const showDisposition =
    state.capabilities.viewDisposition ||
    state.capabilities.discharge ||
    state.capabilities.admit ||
    state.capabilities.transfer ||
    state.capabilities.markLeft;

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
            {permittedTabs.map((tab) => {
              const badgeType = getTabBadgeType(tab);
              return (
                <button
                  className={activeTab === tab ? 'active' : ''}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                  {badgeType === 'active' && (
                    <span className="emergency-tab-pill-badge emergency-tab-pill-badge--active">Active</span>
                  )}
                  {badgeType === 'context' && (
                    <span className="emergency-tab-pill-badge emergency-tab-pill-badge--context">Context</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="emergency-tab-content">
            {activeTab === 'Registration' && (
              <EmergencyRegistrationSection setActiveTab={setActiveTab} state={state} />
            )}
            {activeTab === 'Triage' && showTriage && (
              <EmergencyTriageSection
                mutations={mutations}
                setActiveTab={setActiveTab}
                state={state}
              />
            )}
            {activeTab === 'Consultation' && showConsultation && (
              <EmergencyConsultationSection
                mutations={mutations}
                setActiveTab={setActiveTab}
                state={state}
              />
            )}
            {activeTab === 'Treatment' && showTreatment && (
              <EmergencyTreatmentSection setActiveTab={setActiveTab} />
            )}
            {activeTab === 'Medication' && showOrders && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="PHARMACY"
                state={state}
              />
            )}
            {activeTab === 'Lab Orders' && showOrders && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="LABORATORY"
                state={state}
              />
            )}
            {activeTab === 'Imaging Orders' && showOrders && (
              <EmergencyOrdersSection
                mutations={mutations}
                orderType="IMAGING"
                state={state}
              />
            )}
            {activeTab === 'Referral' && showReferral && (
              <EmergencyReferralSection mutations={mutations} state={state} />
            )}
            {activeTab === 'Notes' && showNotes && (
              <EmergencyNotesDocumentsSection tab="Notes" />
            )}
            {activeTab === 'Documents' && showDocuments && (
              <EmergencyNotesDocumentsSection tab="Documents" />
            )}
            {activeTab === 'Disposition' && showDisposition && (
              <EmergencyDispositionSection mutations={mutations} state={state} />
            )}
          </div>
        </main>

        {/* Right Column: Sticky Live Vital Signs Widget */}
        {(state.capabilities.viewTriage || state.capabilities.assessTriage) && (
          <EmergencyVitalsWidget state={state} />
        )}
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
