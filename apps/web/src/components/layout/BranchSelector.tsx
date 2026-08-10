import { useState } from 'react';
import { mockBranches } from '../../data/ui-foundation';

export function BranchSelector() {
  const [selectedBranch, setSelectedBranch] = useState(mockBranches[0]);

  return (
    <label className="header-dropdown">
      <i className="ph ph-buildings" aria-hidden="true" />
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        onChange={(event) => setSelectedBranch(event.target.value)}
        value={selectedBranch}
      >
        {mockBranches.map((branch) => (
          <option key={branch}>{branch}</option>
        ))}
      </select>
    </label>
  );
}
