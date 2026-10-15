import { BranchSelector } from './BranchSelector';

type TopHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  onOpenMobileSidebar: () => void;
};

export function TopHeader({ title, onOpenMobileSidebar }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onOpenMobileSidebar} type="button" aria-label="Open navigation">
          <i className="ph ph-list" aria-hidden="true" />
        </button>
        <div className="header-title-area">
          <h1>{title}</h1>
        </div>
      </div>

      <div className="header-right">
        <BranchSelector />
      </div>
    </header>
  );
}
