import { useEffect, useState } from 'react';

const navigationEvent = 'hms:navigation';
const beforeNavigationEvent = 'hms:before-navigation';
const replayNavigation = new WeakMap<Event, () => void>();
let approvedTarget: string | null = null;
let discardPending = false;

function isApproved(target: URL) {
  if (approvedTarget !== target.href) return false;
  queueMicrotask(() => { if (approvedTarget === target.href) approvedTarget = null; });
  return true;
}

async function confirmDeparture(target: URL, confirmDiscard: () => Promise<boolean>, proceed: () => void) {
  if (discardPending) return;
  discardPending = true;
  const original = window.location.href;
  try {
    if (await confirmDiscard() && window.location.href === original) {
      approvedTarget = target.href;
      proceed();
      window.setTimeout(() => { if (approvedTarget === target.href) approvedTarget = null; }, 5000);
    }
  } finally { discardPending = false; }
}

export function useUnsavedNavigation(dirty: boolean, leavesDraft: (target: URL) => boolean, confirmDiscard?: () => Promise<boolean>) {
  useEffect(() => {
    if (!dirty) return;
    const beforeNavigation = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      const target = new URL(event.detail, window.location.origin);
      if (isApproved(target) || !leavesDraft(target)) return;
      if (confirmDiscard) {
        event.preventDefault();
        void confirmDeparture(target, confirmDiscard, replayNavigation.get(event) ?? (() => navigate(target.pathname + target.search)));
      } else if (!window.confirm('Discard unsaved changes?')) event.preventDefault();
    };
    const navigation: unknown = Reflect.get(window, 'navigation');
    const beforeTraversal = (event: Event) => {
      if (!event.cancelable || Reflect.get(event, 'navigationType') !== 'traverse') return;
      const destination: unknown = Reflect.get(event, 'destination');
      const url: unknown = destination && typeof destination === 'object' ? Reflect.get(destination, 'url') : undefined;
      if (typeof url !== 'string') return;
      const target = new URL(url, window.location.origin);
      if (isPublicRoute(target.pathname) || isApproved(target) || !leavesDraft(target)) return;
      if (confirmDiscard && target.origin === window.location.origin) {
        event.preventDefault();
        const entry: unknown = navigation && typeof navigation === 'object' ? Reflect.get(navigation, 'currentEntry') : undefined;
        const currentIndex: unknown = entry && typeof entry === 'object' ? Reflect.get(entry, 'index') : undefined;
        const targetIndex: unknown = destination && typeof destination === 'object' ? Reflect.get(destination, 'index') : undefined;
        void confirmDeparture(target, confirmDiscard, () => {
          if (typeof currentIndex === 'number' && typeof targetIndex === 'number' && currentIndex !== targetIndex) window.history.go(targetIndex - currentIndex);
          else navigate(target.pathname + target.search, { replace: true });
        });
      } else if (!window.confirm('Discard unsaved changes?')) event.preventDefault();
    };
    window.addEventListener(beforeNavigationEvent, beforeNavigation);
    if (navigation instanceof EventTarget) navigation.addEventListener('navigate', beforeTraversal);
    return () => { window.removeEventListener(beforeNavigationEvent, beforeNavigation); if (navigation instanceof EventTarget) navigation.removeEventListener('navigate', beforeTraversal); };
  }, [dirty, leavesDraft, confirmDiscard]);
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
  const event = new CustomEvent(beforeNavigationEvent, { cancelable: true, detail: to });
  replayNavigation.set(event, () => navigate(to, options));
  if (!isPublicRoute(new URL(to, window.location.origin).pathname) && !window.dispatchEvent(event)) return;

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
