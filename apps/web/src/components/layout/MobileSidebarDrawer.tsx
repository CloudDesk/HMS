import { Sidebar } from './Sidebar';

type MobileSidebarDrawerProps = {
  activeKey?: string;
  activeHref?: string;
  collapsed: boolean;
  open: boolean;
  onToggleCollapsed: () => void;
};

export function MobileSidebarDrawer({ activeKey, activeHref, collapsed, open, onToggleCollapsed }: MobileSidebarDrawerProps) {
  return (
    <Sidebar
      activeHref={activeHref}
      activeKey={activeKey}
      collapsed={collapsed}
      mobileOpen={open}
      onToggleCollapsed={onToggleCollapsed}
    />
  );
}
