import { useState, useEffect } from 'react';
import type { SidebarModule } from '../../data/ui-foundation';
import { NavLink } from './NavLink';

type SidebarNavGroupProps = {
  module: SidebarModule;
  activeKey: string;
  activeHref: string;
};

export function SidebarNavGroup({ module, activeKey, activeHref }: SidebarNavGroupProps) {
  const isActive = module.key === activeKey;
  const [expanded, setExpanded] = useState(isActive);

  // Auto-expand when the route changes and makes this module active
  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  return (
    <div className={`nav-group${expanded ? ' expanded' : ''}`} data-sidebar-module={module.key}>
      <button
        className={`nav-item${isActive ? ' active' : ''}`}
        onClick={() => setExpanded((current) => !current)}
        type="button"
        aria-expanded={expanded}
      >
        <i className={`ph ${module.icon}`} aria-hidden="true" />
        <span>{module.label}</span>
        <i className="ph ph-caret-down dropdown-icon" aria-hidden="true" />
      </button>
      <div className="sub-nav">
        {module.links.map((link) => (
          <NavLink
            className={`sub-nav-item${link.href === activeHref ? ' active' : ''}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
