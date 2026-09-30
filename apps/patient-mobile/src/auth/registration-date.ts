import { formatToDateString } from '../appointments/date-utils';

// Self-registration is for age 15 and over; younger patients use guardian registration.
export function latestSelfRegistrationDob(today = new Date()): string {
  const latest = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate(), 12);
  if (latest.getMonth() !== today.getMonth()) latest.setDate(0);
  return formatToDateString(latest);
}
