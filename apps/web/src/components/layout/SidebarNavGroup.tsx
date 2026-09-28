import { useState, useEffect } from 'react';
import type { SidebarModule } from '../../data/ui-foundation';
import { useAppLocation } from '../../routing/navigation';
import { NavLink } from './NavLink';

type SidebarNavGroupProps = {
  module: SidebarModule;
  activeKey: string;
  activeHref: string;
};

export function SidebarNavGroup({ module, activeKey, activeHref }: SidebarNavGroupProps) {
  const { pathname, search } = useAppLocation();
  const isActive = module.key === activeKey;
  const [expanded, setExpanded] = useState(isActive);

  // Auto-expand when the route changes and makes this module active
  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  const searchParams = new URLSearchParams(search);
  const currentSection = searchParams.get('section');
  const currentVisitId = searchParams.get('id');

  const singleLink = module.links.length === 1 && !module.forceGroup ? module.links[0] : undefined;
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
          const hasSubSections = Boolean(link.subSections && link.subSections.length > 0);
          const isLinkActive =
            (link.href === activeHref || (link.href === '/opd/queue' && (pathname === '/opd' || pathname === '/opd/'))) &&
            (!hasSubSections || !currentSection);
          const isSubGroupActive = link.href === activeHref || (hasSubSections && pathname === link.href);

          const linkHref = currentVisitId && (link.href === '/opd/prescription' || link.href === '/opd/referral')
            ? `${link.href}?id=${encodeURIComponent(currentVisitId)}`
            : link.href;

          return (
            <div key={link.href} className="sub-nav-wrapper">
              <NavLink
                className={`sub-nav-item${isLinkActive ? ' active' : ''}${hasSubSections ? ' has-subsections' : ''}`}
                href={linkHref}
              >
                <span>{link.label}</span>
                {hasSubSections && (
                  <i className="ph ph-caret-down subsection-indicator" aria-hidden="true" />
                )}
              </NavLink>
              {hasSubSections && isSubGroupActive && (
                <div className="sub-sub-nav">
                  {link.subSections!.map((sub) => {
                    const subHref = currentVisitId && sub.sectionKey
                      ? `/opd/consultation?id=${encodeURIComponent(currentVisitId)}&section=${encodeURIComponent(sub.sectionKey)}`
                      : sub.href;
                    const isSubActive = pathname === '/opd/consultation' && (
                      currentSection === sub.sectionKey ||
                      (!currentSection && sub.sectionKey === 'history')
                    );

                    return (
                      <NavLink
                        key={sub.sectionKey || sub.label}
                        className={`sub-sub-nav-item${isSubActive ? ' active' : ''}`}
                        href={subHref}
                      >
                        <i className="ph ph-circle sub-bullet" aria-hidden="true" />
                        <span>{sub.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
