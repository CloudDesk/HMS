import { useEffect, useMemo, useRef, useState } from 'react';

export type BranchOption = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
};

type BranchMultiSelectProps = {
  branches: BranchOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function BranchMultiSelect({
  branches,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = 'Select branches...',
}: BranchMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return branches;
    const q = searchTerm.toLowerCase();
    return branches.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q)
    );
  }, [branches, searchTerm]);

  const allSelected = branches.length > 0 && branches.every((b) => selectedIds.includes(b.id));

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (allSelected) {
      onChange([]);
    } else {
      onChange(branches.map((b) => b.id));
    }
  };

  const handleRemoveOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  const handleToggleItem = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="hms-multi-select" ref={containerRef}>
      <div
        className={`hms-multi-select-trigger${open ? ' active' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <div className="hms-multi-select-tags-wrap">
          {selectedIds.length === 0 ? (
            <span className="hms-multi-select-placeholder">
              <i className="ph ph-buildings" style={{ marginRight: '6px', color: '#94a3b8' }} />
              {placeholder}
            </span>
          ) : allSelected ? (
            <span className="hms-multi-select-tag all-tag">
              <i className="ph ph-buildings" />
              All Branches ({branches.length})
              <button
                aria-label="Clear all"
                className="hms-multi-select-tag-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) onChange([]);
                }}
                type="button"
              >
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </span>
          ) : (
            selectedIds.map((id) => {
              const b = branches.find((br) => br.id === id);
              if (!b) return null;
              return (
                <span className="hms-multi-select-tag" key={id}>
                  {b.name}
                  <button
                    aria-label={`Remove ${b.name}`}
                    className="hms-multi-select-tag-close"
                    onClick={(e) => handleRemoveOne(id, e)}
                    type="button"
                  >
                    <i className="ph ph-x" aria-hidden="true" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="hms-multi-select-icons">
          {selectedIds.length > 0 && !disabled && (
            <button
              aria-label="Clear all selections"
              className="hms-multi-select-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              title="Clear all"
              type="button"
            >
              <i className="ph ph-x-circle" />
            </button>
          )}
          <i
            className={`ph ph-caret-down hms-multi-select-chevron${open ? ' open' : ''}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {open && (
        <div className="hms-multi-select-dropdown">
          {branches.length > 4 && (
            <div className="hms-multi-select-search-box">
              <i className="ph ph-magnifying-glass" />
              <input
                autoFocus
                className="hms-multi-select-search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search branches..."
                type="text"
                value={searchTerm}
              />
              {searchTerm && (
                <button
                  className="hms-multi-select-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                  type="button"
                >
                  <i className="ph ph-x" />
                </button>
              )}
            </div>
          )}

          <div className="hms-multi-select-header-actions">
            <span className="hms-multi-select-count">
              {selectedIds.length} of {branches.length} selected
            </span>
            <div className="hms-multi-select-quick-links">
              <button
                className="hms-multi-select-link-btn"
                onClick={handleToggleAll}
                type="button"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              {selectedIds.length > 0 && !allSelected && (
                <button
                  className="hms-multi-select-link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="hms-multi-select-list">
            {filteredBranches.length === 0 ? (
              <div className="hms-multi-select-empty">No branches found</div>
            ) : (
              filteredBranches.map((b) => {
                const isSelected = selectedIds.includes(b.id);
                return (
                  <div
                    className={`hms-multi-select-item${isSelected ? ' selected' : ''}`}
                    key={b.id}
                    onClick={() => handleToggleItem(b.id)}
                  >
                    <div className={`hms-multi-select-checkbox${isSelected ? ' checked' : ''}`}>
                      {isSelected && <i className="ph ph-check" />}
                    </div>
                    <div className="hms-multi-select-item-content">
                      <span className="hms-multi-select-item-name">{b.name}</span>
                      {b.code && <span className="hms-multi-select-item-code">({b.code})</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
