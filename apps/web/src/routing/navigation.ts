import { useEffect, useState } from 'react';

const navigationEvent = 'hms:navigation';
const beforeNavigationEvent = 'hms:before-navigation';

export function useUnsavedNavigation(dirty: boolean, leavesDraft: (target: URL) => boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeNavigation = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      if (leavesDraft(new URL(event.detail, window.location.origin)) && !window.confirm('Discard unsaved changes?')) event.preventDefault();
    };
    const navigation: unknown = Reflect.get(window, 'navigation');
    const beforeTraversal = (event: Event) => {
      if (!event.cancelable || Reflect.get(event, 'navigationType') !== 'traverse') return;
      const destination: unknown = Reflect.get(event, 'destination');
      const url: unknown = destination && typeof destination === 'object' ? Reflect.get(destination, 'url') : undefined;
      if (typeof url !== 'string') return;
      const target = new URL(url, window.location.origin);
      if (!isPublicRoute(target.pathname) && leavesDraft(target) && !window.confirm('Discard unsaved changes?')) event.preventDefault();
    };
    window.addEventListener(beforeNavigationEvent, beforeNavigation);
    if (navigation instanceof EventTarget) navigation.addEventListener('navigate', beforeTraversal);
    return () => { window.removeEventListener(beforeNavigationEvent, beforeNavigation); if (navigation instanceof EventTarget) navigation.removeEventListener('navigate', beforeTraversal); };
  }, [dirty, leavesDraft]);
}

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
  // Optional guards are registered only by active editors. Session-expiry redirects remain available.
  if (!isPublicRoute(new URL(to, window.location.origin).pathname) && !window.dispatchEvent(new CustomEvent(beforeNavigationEvent, { cancelable: true, detail: to }))) return;

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
