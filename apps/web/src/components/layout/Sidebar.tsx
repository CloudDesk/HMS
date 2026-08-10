import { useEffect } from 'react';
import { sidebarModules } from '../../data/ui-foundation';
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
  useEffect(() => {
    console.log('Sidebar mounted');
  }, []);

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-header">
        <i className="ph ph-hospital brand-icon" aria-hidden="true" />
        <div className="logo-text">
          <h2>HMS</h2>
          <p>Enterprise</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="HMS modules">
        <NavLink
          className={activeKey === 'dashboard' ? 'nav-item active' : 'nav-item'}
          href="/dashboard"
        >
          <i className="ph ph-squares-four" aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>

        {sidebarModules.map((module) => (
          <SidebarNavGroup
            activeHref={activeHref}
            activeKey={activeKey}
            key={module.key}
            module={module}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="collapse-btn" onClick={onToggleCollapsed} type="button">
          <i className={`ph ${collapsed ? 'ph-sidebar-simple' : 'ph-sidebar'}`} aria-hidden="true" />
          <span>{collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
        </button>
      </div>
    </aside>
  );
}
