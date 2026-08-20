import { NavLink } from './NavLink';
import { BranchSelector } from './BranchSelector';
import { UserMenu } from './UserMenu';

type TopHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  onOpenMobileSidebar: () => void;
};

export function TopHeader({ title, breadcrumbs = ['Home', title], onOpenMobileSidebar }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onOpenMobileSidebar} type="button" aria-label="Open navigation">
          <i className="ph ph-list" aria-hidden="true" />
        </button>
        <div className="header-title-area">
          <h1>{title}</h1>
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;

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
        </div>
      </div>

      <div className="header-right">
        <BranchSelector />
        {/* <NotificationsMenu /> */}
        <UserMenu />
      </div>
    </header>
  );
}
