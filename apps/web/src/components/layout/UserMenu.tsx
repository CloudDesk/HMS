import { useAuth } from '../../auth/useAuth';
import { canAccessRoute } from '../../auth/access-control';
import { useActiveBranch } from '../../context/BranchContext';
import { navigate } from '../../routing/navigation';
import styles from './SidebarUtilities.module.css';

export function UserMenu({ onBranch, onSignOut, onNavigate }: { onBranch: () => void; onSignOut: () => void; onNavigate: () => void }) {
  const { user, status } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const name = user?.fullName || user?.username || 'User';
  const branches = user?.branches ?? [];
  const branch = branches.find((item) => item.id === activeBranchId) ?? branches[0];
  const showBranch = branches.length > 0 || !user?.roles.some((role) => role.code === 'SUPER_ADMIN');
  return <div className={styles.scrollBody}>
    <div className={styles.identity}>
      <span className={styles.avatar}>{name.split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}
        {status === 'authenticated' && <span className={styles.sessionDot} role="img" aria-label="Active session" />}
      </span>
      <div><strong>{name}</strong><span>{user?.roles.map((role) => role.name).join(', ') || 'No role assigned'}</span>{user?.email && <span>{user.email}</span>}</div>
    </div>
    {showBranch && <button className={styles.menuAction} type="button" onClick={onBranch}>
      <i className="ph ph-buildings" aria-hidden="true" /><span>{branch?.name ?? 'No assigned branch'}</span><i className="ph ph-caret-right" aria-hidden="true" />
    </button>}
    {canAccessRoute('/administration/settings', user?.permissions ?? [], user?.roles ?? []) &&
      <button className={styles.menuAction} type="button" onClick={() => { onNavigate(); navigate('/administration/settings'); }}>
        <i className="ph ph-gear" aria-hidden="true" /><span>System Settings</span>
      </button>}
    <div className={styles.signoutRow}><button className={styles.menuAction} type="button" onClick={onSignOut}>
      <i className="ph ph-sign-out" aria-hidden="true" /><span>Sign out</span>
    </button></div>
  </div>;
}
