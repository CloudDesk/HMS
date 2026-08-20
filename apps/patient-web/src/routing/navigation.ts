import { useEffect, useState } from 'react';
const eventName = 'hms-patient:navigation';
export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (`${location.pathname}${location.search}` === to) return;
  if (options.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new Event(eventName));
};
export const useAppLocation = () => { const read = () => ({ pathname: location.pathname, search: location.search }); const [value, setValue] = useState(read); useEffect(() => { const update = () => setValue(read()); addEventListener('popstate', update); addEventListener(eventName, update); return () => { removeEventListener('popstate', update); removeEventListener(eventName, update); }; }, []); return value; };
