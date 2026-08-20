export type AuthenticatedUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: 'active' | 'inactive' | 'locked';
  patientId: string | null;
};
