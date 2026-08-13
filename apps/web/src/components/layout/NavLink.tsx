import { navigate } from '../../routing/navigation';

type NavLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

/**
 * SPA-aware link. Intercepts clicks, calls the custom navigate() function
 * (history.pushState + hms:navigation event) instead of letting the browser
 * perform a full-page reload. Falls back to normal anchor behaviour for
 * modifier keys (Ctrl/Cmd/Shift) so "open in new tab" still works.
 */
export function NavLink({ href, className, children, onClick }: NavLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let browser handle modified clicks normally
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    e.preventDefault();
    onClick?.();
    navigate(href);
  };

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
