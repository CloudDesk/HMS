import { fromZonedTime } from 'date-fns-tz';

export function isFutureFollowUpStart(date: string, time: string, timezone: string, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  return fromZonedTime(`${date}T${time}:00`, timezone).getTime() > now;
}
