import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAppLocation } from '../../routing/navigation';
import { sidebarModules } from '../../data/ui-foundation';
import { MobileSidebarBackdrop } from './MobileSidebarBackdrop';
import { MobileSidebarDrawer } from './MobileSidebarDrawer';
import { TopHeader } from './TopHeader';

type DashboardLayoutProps = PropsWithChildren<{
  title?: string;
  breadcrumbs?: string[];
}>;

type ViewportMode = 'mobile' | 'tablet' | 'desktop';

function getViewportMode(): ViewportMode {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

/**
 * Derives the active sidebar module key and active href directly from the
 * current URL so every page gets correct highlighting without passing props.
 */
function useActiveSidebarState() {
  const { pathname } = useAppLocation();

  if (pathname === '/' || pathname === '/dashboard') {
    return { activeKey: 'dashboard', activeHref: '/dashboard' };
  }

  for (const module of sidebarModules) {
    for (const link of module.links) {
      if (pathname === link.href) {
        return { activeKey: module.key, activeHref: link.href };
      }
    }
  }

  // Partial match: derive module key from the first path segment pair
  for (const module of sidebarModules) {
    if (module.links.some((link) => pathname.startsWith(link.href + '/') || pathname === link.href)) {
      const matchedLink = module.links.find(
        (link) => pathname === link.href || pathname.startsWith(link.href + '/'),
      );
      return { activeKey: module.key, activeHref: matchedLink?.href ?? pathname };
    }
    const prefix = `/${module.key}`;
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      const matchedLink = module.links.find((link) => link.href === pathname);
      return { activeKey: module.key, activeHref: matchedLink?.href ?? pathname };
    }
  }

  return { activeKey: '', activeHref: pathname };
}

export function DashboardLayout({ title = 'HMS', breadcrumbs = ['Home', 'Dashboard'], children }: DashboardLayoutProps) {
  const initialViewportMode = useRef(getViewportMode());
  const [collapsed, setCollapsed] = useState(initialViewportMode.current === 'tablet');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeKey, activeHref } = useActiveSidebarState();

  useEffect(() => {
    let currentViewportMode = initialViewportMode.current;

    const handleResize = () => {
      const nextViewportMode = getViewportMode();
      if (nextViewportMode === currentViewportMode) return;

      currentViewportMode = nextViewportMode;
      if (nextViewportMode === 'tablet') {
        setCollapsed(true);
      } else if (nextViewportMode === 'desktop') {
        setCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = () => setCollapsed((current) => !current);

  return (
    <div className="dashboard-container">
      <MobileSidebarDrawer
        activeHref={activeHref}
        activeKey={activeKey}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        open={mobileOpen}
      />
      <MobileSidebarBackdrop open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-content">
        <TopHeader breadcrumbs={breadcrumbs} onOpenMobileSidebar={() => setMobileOpen(true)} title={title} />
        {children}
      </main>
    </div>
  );
}
