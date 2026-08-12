import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';

export function BranchSelector() {
  const { user } = useAuth();
  const branches = user?.branches ?? [];
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    setSelectedBranch((current) =>
      branches.some((branch) => branch.id === current)
        ? current
        : (branches[0]?.id ?? ''),
    );
  }, [branches]);

  return (
    <label className="header-dropdown">
      <i className="ph ph-buildings" aria-hidden="true" />
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        disabled={branches.length <= 1}
        onChange={(event) => setSelectedBranch(event.target.value)}
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
