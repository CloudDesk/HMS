import { useAuth } from '../../auth/useAuth';
import { useActiveBranch } from '../../context/BranchContext';
import styles from './SidebarUtilities.module.css';

export function BranchSelector({ onSelected }: { onSelected: () => void }) {
  const { user } = useAuth();
  const { activeBranchId, setActiveBranchId } = useActiveBranch();
  const branches = user?.branches ?? [];
  return <div className={styles.scrollBody}>
    <p className={styles.muted}>Select your active branch.</p>
    {branches.length === 0 && <p>No assigned branch</p>}
    <div role="group" aria-label="Switch Branch">
      {branches.map((branch) => <button key={branch.id} type="button" className={styles.menuAction}
        aria-pressed={branch.id === activeBranchId} disabled={branches.length <= 1}
        onClick={() => { setActiveBranchId(branch.id); onSelected(); }}>
        <i className="ph ph-buildings" aria-hidden="true" /><span>{branch.name}</span>
        {branch.id === activeBranchId && <i className="ph ph-check" aria-hidden="true" />}
      </button>)}
    </div>
  </div>;
}
