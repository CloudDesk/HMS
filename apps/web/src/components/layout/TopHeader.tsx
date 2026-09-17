import { NavLink } from './NavLink';

type TopHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  onOpenMobileSidebar: () => void;
};

/**
 * @deprecated The global top header has been decommissioned across the entire application shell.
 * Global application controls (Branch, Notifications, User profile, Sign out) are consolidated in the
 * compact sidebar footer, and pages render their own contextual titles to eliminate wasted vertical space.
 */
export function TopHeader({ title, breadcrumbs, onOpenMobileSidebar }: TopHeaderProps) {
  const effectiveBreadcrumbs = breadcrumbs ?? ['Home', title];

  return (
    <header className="top-header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onOpenMobileSidebar} type="button" aria-label="Open navigation">
          <i className="ph ph-list" aria-hidden="true" />
        </button>
        <div className="header-title-area">
          <h1>{title}</h1>
          {effectiveBreadcrumbs.length > 0 && (
            <div className="breadcrumbs">
              {effectiveBreadcrumbs.map((crumb, index) => {
                const isLast = index === effectiveBreadcrumbs.length - 1;

                return (
                  <span className={isLast ? 'current' : undefined} key={`${crumb}-${index}`}>
                    {index > 0 ? <i className="ph ph-caret-right" aria-hidden="true" /> : null}
                    {isLast ? (
                      <span>{crumb}</span>
                    ) : (
                      <NavLink href="/dashboard">{crumb}</NavLink>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="header-right" />
    </header>
  );
}
