import type { useEmergencyWorkspaceFeature } from '../../hooks/emergency/useEmergencyWorkspaceFeature';

export type EmergencyFeature = ReturnType<typeof useEmergencyWorkspaceFeature>;
export type EmergencyWorkspaceProps = {
  state: EmergencyFeature['state'];
  actions: EmergencyFeature['actions'];
  mutations: EmergencyFeature['mutations'];
};

export type WorkspaceTab =
  | 'Registration'
  | 'Triage'
  | 'Consultation'
  | 'Treatment'
  | 'Medication'
  | 'Lab Orders'
  | 'Imaging Orders'
  | 'Referral'
  | 'Notes'
  | 'Documents'
  | 'Disposition';
