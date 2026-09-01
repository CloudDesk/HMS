import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useAuth } from '../auth/useAuth';

const ACTIVE_BRANCH_STORAGE_KEY = 'activeBranchId';

type BranchContextValue = {
  activeBranchId: string;
  setActiveBranchId: (branchId: string) => void;
};

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export function BranchProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userBranches = useMemo(() => user?.branches ?? [], [user?.branches]);

  const [activeBranchId, setActiveBranchState] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY) ?? '';
  });

  const setActiveBranchId = useCallback((branchId: string) => {
    setActiveBranchState(branchId);
    if (branchId) {
      localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
    } else {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    }
  }, []);

  // Validate or synchronize default branch when user branch assignments change or initial load occurs
  useEffect(() => {
    if (userBranches.length === 0) {
      if (activeBranchId !== '') {
        setActiveBranchId('');
      }
      return;
    }

    const isCurrentValid = userBranches.some((b) => b.id === activeBranchId);
    if (!isCurrentValid) {
      const defaultBranchId = userBranches[0]?.id ?? '';
      setActiveBranchId(defaultBranchId);
    }
  }, [userBranches, activeBranchId, setActiveBranchId]);

  // Listen for storage events for cross-tab branch synchronization
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_BRANCH_STORAGE_KEY) {
        const newBranchId = event.newValue ?? '';
        if (newBranchId !== activeBranchId) {
          const isValid = userBranches.length === 0 || userBranches.some((b) => b.id === newBranchId);
          if (isValid) {
            setActiveBranchState(newBranchId);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeBranchId, userBranches]);

  const value = useMemo<BranchContextValue>(
    () => ({
      activeBranchId,
      setActiveBranchId,
    }),
    [activeBranchId, setActiveBranchId],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useActiveBranch(): BranchContextValue {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useActiveBranch must be used within a BranchProvider');
  }
  return context;
}
