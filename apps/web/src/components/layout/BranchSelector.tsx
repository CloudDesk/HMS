import { useEffect, useState } from 'react';
import { branchesApi, type BranchResponse } from '../../api/branches';

export function BranchSelector() {
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadBranches = async () => {
      try {
        const firstPage = await branchesApi.list({
          limit: 100,
          page: 1,
          sortBy: 'name',
          sortOrder: 'asc',
          status: 'ACTIVE',
        });
        const remainingPages = await Promise.all(
          Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
            branchesApi.list({
              limit: 100,
              page: index + 2,
              sortBy: 'name',
              sortOrder: 'asc',
              status: 'ACTIVE',
            }),
          ),
        );
        const availableBranches = [firstPage, ...remainingPages].flatMap((response) => response.data);

        if (active) {
          setBranches(availableBranches);
          setSelectedBranch((current) =>
            availableBranches.some((branch) => branch.id === current)
              ? current
              : (availableBranches[0]?.id ?? ''),
          );
        }
      } catch {
        if (active) {
          setBranches([]);
          setSelectedBranch('');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadBranches();

    return () => {
      active = false;
    };
  }, []);

  return (
    <label className="header-dropdown">
      <i className="ph ph-buildings" aria-hidden="true" />
      <span className="sr-only">Branch</span>
      <select
        aria-label="Branch"
        onChange={(event) => setSelectedBranch(event.target.value)}
        value={selectedBranch}
      >
        {branches.length === 0 && (
          <option value="">{loading ? 'Loading branches...' : 'No branches available'}</option>
        )}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </label>
  );
}
