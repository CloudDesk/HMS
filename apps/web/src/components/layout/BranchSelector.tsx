import { useAuth } from '../../auth/useAuth';
import { useActiveBranch } from '../../context/BranchContext';

export function BranchSelector() {
  const { user } = useAuth();
  const branches = user?.branches ?? [];
  const isSuperAdmin = user?.roles.some((r) => r.code === 'SUPER_ADMIN') ?? false;
  const { activeBranchId, setActiveBranchId } = useActiveBranch();

  if (branches.length === 0 && isSuperAdmin) {
    return null;
  }

  return (
    <label className="header-dropdown">
      <i className="ph ph-buildings" aria-hidden="true" />
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        disabled={branches.length <= 1}
        onChange={(event) => setActiveBranchId(event.target.value)}
        value={activeBranchId}
      >
        {branches.length === 0 && (
          <option value="">No assigned branch</option>
        )}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </label>
  );
}
