import type { PropsWithChildren, ReactNode } from 'react';

type FilterToolbarProps = PropsWithChildren<{
  search?: ReactNode;
  actions?: ReactNode;
}>;

export function FilterToolbar({ search, actions, children }: FilterToolbarProps) {
  return (
    <div className="filter-toolbar">
      <div className="filter-toolbar__primary">
        {search}
        {actions ? <div className="filter-toolbar__actions">{actions}</div> : null}
      </div>
      {children ? <div className="filter-toolbar__filters">{children}</div> : null}
    </div>
  );
}
