import { getAccessibleSidebarModules } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { NavLink } from './NavLink';
import { SidebarNavGroup } from './SidebarNavGroup';

type SidebarProps = {
  activeKey?: string;
  activeHref?: string;
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({
  activeKey = '',
  activeHref = '',
  collapsed,
  mobileOpen = false,
  onToggleCollapsed,
}: SidebarProps) {
  const { user } = useAuth();
  const accessibleModules = getAccessibleSidebarModules(user?.permissions ?? [], user?.roles ?? []);

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-header">
        <i className="ph ph-hospital brand-icon" aria-hidden="true" />
        <div className="logo-text">
          <h2>HMS</h2>
          <p>Enterprise</p>
        </div>
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-toggle-btn"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          type="button"
        >
          <i className={`ph ${collapsed ? 'ph-caret-right' : 'ph-caret-left'}`} aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="HMS modules">
        <NavLink
          className={activeKey === 'dashboard' ? 'nav-item active' : 'nav-item'}
          href="/dashboard"
        >
          <i className="ph ph-squares-four" aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>

        {accessibleModules.map((module) => (
          <SidebarNavGroup
            activeHref={activeHref}
            activeKey={activeKey}
            key={module.key}
            module={module}
          />
        ))}
      </nav>
    </aside>
  );
}
