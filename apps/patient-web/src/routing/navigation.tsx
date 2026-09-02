import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

const eventName = 'hms-patient:navigation';

export type AppLocation = {
  pathname: string;
  search: string;
};

const getLocation = (): AppLocation => ({
  pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
  search: typeof window !== 'undefined' ? window.location.search : '',
});

export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (typeof window === 'undefined') return;
  if (`${window.location.pathname}${window.location.search}` === to) return;
  if (options.replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }
  window.dispatchEvent(new Event(eventName));
};

export const useAppLocation = (): AppLocation => {
  const [location, setLocation] = useState<AppLocation>(getLocation);

  useEffect(() => {
    const handleLocationChange = () => {
      setLocation(getLocation());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener(eventName, handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener(eventName, handleLocationChange);
    };
  }, []);

  return location;
};

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (
          !e.defaultPrevented &&
          e.button === 0 &&
          !e.metaKey &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.shiftKey
        ) {
          e.preventDefault();
          onClick?.(e);
          navigate(to, { replace });
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export interface NavLinkProps extends LinkProps {
  activeClassName?: string;
}

export function NavLink({
  to,
  activeClassName = 'active',
  className = '',
  children,
  ...rest
}: NavLinkProps) {
  const location = useAppLocation();
  const isActive =
    location.pathname === to || `${location.pathname}${location.search}` === to;
  const combinedClassName = `${className} ${isActive ? activeClassName : ''}`.trim();

  return (
    <Link to={to} className={combinedClassName} {...rest}>
      {children}
    </Link>
  );
}
