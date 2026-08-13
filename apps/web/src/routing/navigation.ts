import { useEffect, useState } from 'react';

const navigationEvent = 'hms:navigation';

export type AppLocation = {
  pathname: string;
  search: string;
};

const getLocation = (): AppLocation => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (window.location.pathname + window.location.search === to) {
    return;
  }

  if (options.replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }

  window.dispatchEvent(new Event(navigationEvent));
};

export const isPublicRoute = (pathname: string) =>
  pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';

export const useAppLocation = () => {
  const [location, setLocation] = useState(getLocation);

  useEffect(() => {
    const handleLocationChange = () => {
      setLocation(getLocation());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener(navigationEvent, handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener(navigationEvent, handleLocationChange);
    };
  }, []);

  return location;
};
