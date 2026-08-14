import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';

export function BranchSelector() {
  const { user } = useAuth();
  const branches = user?.branches ?? [];
  const isSuperAdmin = user?.roles.some((r) => r.code === 'SUPER_ADMIN') ?? false;
  const [selectedBranch, setSelectedBranch] = useState('');

  if (branches.length === 0 && isSuperAdmin) {
    return null;
  }

  useEffect(() => {
    const activeId = localStorage.getItem('activeBranchId');
    const validBranch = branches.some((b) => b.id === activeId)
      ? activeId!
      : (branches[0]?.id ?? '');
    setSelectedBranch(validBranch);
    if (validBranch) {
      localStorage.setItem('activeBranchId', validBranch);
    }
  }, [branches]);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    if (branchId) {
      localStorage.setItem('activeBranchId', branchId);
    } else {
      localStorage.removeItem('activeBranchId');
    }
  };

  return (
    <label className="header-dropdown">
      <i className="ph ph-buildings" aria-hidden="true" />
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        disabled={branches.length <= 1}
        onChange={(event) => handleBranchChange(event.target.value)}
        value={selectedBranch}
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
