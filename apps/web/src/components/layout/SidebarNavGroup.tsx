import { useState, useEffect } from 'react';
import type { SidebarModule } from '../../data/ui-foundation';
import { NavLink } from './NavLink';

type SidebarNavGroupProps = {
  module: SidebarModule;
  activeKey: string;
  activeHref: string;
};

function getSubNavIcon(href: string, label: string): string {
  const lower = (label + ' ' + href).toLowerCase();
  if (lower.includes('dashboard')) return 'ph-squares-four';
  if (lower.includes('history')) return 'ph-clock-counter-clockwise';
  if (lower.includes('roles') || lower.includes('permission') || lower.includes('scheme')) return 'ph-shield-check';
  if (lower.includes('department')) return 'ph-buildings';
  if (lower.includes('branch')) return 'ph-tree-structure';
  if (lower.includes('payer')) return 'ph-buildings';
  if (lower.includes('policy') || lower.includes('policies')) return 'ph-file-text';
  if (lower.includes('benefit')) return 'ph-sliders';
  if (lower.includes('sha-mapping') || lower.includes('mapping')) return 'ph-git-fork';
  if (lower.includes('service')) return 'ph-clipboard-text';
  if (lower.includes('medicine')) return 'ph-pill';
  if (lower.includes('member')) return 'ph-users';
  if (lower.includes('directory')) return 'ph-user';
  if (lower.includes('schedule')) return 'ph-calendar';
  if (lower.includes('availability')) return 'ph-clock';
  if (lower.includes('consent')) return 'ph-file-text';
  if (lower.includes('document')) return 'ph-files';
  if (lower.includes('calendar')) return 'ph-calendar-blank';
  if (lower.includes('queue')) return 'ph-users';
  if (lower.includes('consultation')) return 'ph-chats-circle';
  if (lower.includes('book')) return 'ph-calendar-plus';
  if (lower.includes('referral')) return 'ph-arrow-square-out';
  if (lower.includes('bed')) return 'ph-bed';
  if (lower.includes('ward')) return 'ph-door';
  if (lower.includes('admission')) return 'ph-user-plus';
  if (lower.includes('workspace') && lower.includes('emergency')) return 'ph-activity';
  if (lower.includes('workspace') && lower.includes('billing')) return 'ph-receipt';
  if (lower.includes('workspace')) return 'ph-clipboard-text';
  if (lower.includes('invoice')) return 'ph-receipt';
  if (lower.includes('payment')) return 'ph-credit-card';
  if (lower.includes('dispense')) return 'ph-pill';
  if (lower.includes('inventory')) return 'ph-package';
  if (lower.includes('request')) return 'ph-flask';
  if (lower.includes('result')) return 'ph-clipboard-text';
  if (lower.includes('order')) return 'ph-scan';
  if (lower.includes('patient')) return 'ph-users';
  if (lower.includes('user')) return 'ph-users';
  if (lower.includes('setting')) return 'ph-gear';
  if (lower.includes('report')) return 'ph-chart-bar';
  return 'ph-file-text';
}

export function SidebarNavGroup({ module, activeKey, activeHref }: SidebarNavGroupProps) {
  const isActive = module.key === activeKey;
  const [expanded, setExpanded] = useState(isActive);

  // Auto-expand when the route changes and makes this module active
  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  const singleLink = module.links.length === 1 ? module.links[0] : undefined;
  if (singleLink) {
    const isLinkActive = singleLink.href === activeHref || isActive;
    return (
      <NavLink
        className={`nav-item${isLinkActive ? ' active' : ''}`}
        href={singleLink.href}
        data-sidebar-module={module.key}
      >
        <i className={`ph ${module.icon}`} aria-hidden="true" />
        <span>{module.label}</span>
      </NavLink>
    );
  }

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
        {module.links.map((link) => {
          const isChildActive = link.href === activeHref;
          const icon = link.icon || getSubNavIcon(link.href, link.label);
          return (
            <NavLink
              className={`sub-nav-item${isChildActive ? ' active' : ''}`}
              href={link.href}
              key={link.href}
            >
              {isChildActive ? (
                <span className="sub-nav-dot" aria-hidden="true" />
              ) : (
                <i className={`ph ${icon} sub-nav-icon`} aria-hidden="true" />
              )}
              <span className="sub-nav-label">{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
