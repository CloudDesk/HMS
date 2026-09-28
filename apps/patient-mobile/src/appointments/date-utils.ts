export function formatToDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseFromDateString(str: string): Date {
  const parts = str.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(year, month, day, 12, 0, 0); // Noon prevents any daylight savings shift
}

export function formatHumanReadableDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !match[1] || !match[2] || !match[3]) return dateStr;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIdx, day, 12, 0, 0); // Noon prevents any daylight savings shift
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${days[d.getDay()]}, ${months[monthIdx]} ${day}, ${year}`;
}

export function formatAppointmentDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '-';
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (match && match[1] && match[2] && match[3]) {
    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const month = months[monthIndex];
    if (month && !isNaN(day)) {
      return `${day} ${month} ${year}`;
    }
  }
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    if (month && !isNaN(day) && !isNaN(year)) {
      return `${day} ${month} ${year}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function getQuickDateOptions(todayStr: string) {
  const today = parseFromDateString(todayStr);
  const options: { label: string; date: string }[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatToDateString(d);
    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      label = `${days[d.getDay()]} ${d.getDate()}`;
    }
    options.push({ label, date: dateStr });
  }

  return options;
}

export function isSlotExpired(
  appointmentDate: string,
  startTime: string,
  now: Date = new Date()
): boolean {
  if (!appointmentDate || !startTime) return false;
  const match = appointmentDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !match[1] || !match[2] || !match[3]) return false;

  const aptYear = parseInt(match[1], 10);
  const aptMonth = parseInt(match[2], 10) - 1;
  const aptDay = parseInt(match[3], 10);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const aptDateVal = aptYear * 10000 + (aptMonth + 1) * 100 + aptDay;
  const todayDateVal = currentYear * 10000 + (currentMonth + 1) * 100 + currentDay;

  if (aptDateVal < todayDateVal) return true;
  if (aptDateVal > todayDateVal) return false;

  const timeMatch = startTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!timeMatch || !timeMatch[1] || !timeMatch[2]) return false;

  const slotHours = parseInt(timeMatch[1], 10);
  const slotMinutes = parseInt(timeMatch[2], 10);
  const slotMinutesTotal = slotHours * 60 + slotMinutes;

  const nowMinutesTotal = now.getHours() * 60 + now.getMinutes();

  return slotMinutesTotal <= nowMinutesTotal;
}

export function isSlotSelectable(
  slot: { available?: boolean; is_available?: boolean; start_time: string },
  appointmentDate: string,
  now: Date = new Date()
): boolean {
  const isBackendAvailable = slot.available !== false && slot.is_available !== false;
  if (!isBackendAvailable) return false;
  if (isSlotExpired(appointmentDate, slot.start_time, now)) return false;
  return true;
}

export function getSlotStatusLabel(
  slot: { available?: boolean; is_available?: boolean; start_time: string; reason?: string },
  appointmentDate: string,
  now: Date = new Date()
): { label: string; isSelectable: boolean; isExpired: boolean } {
  const expired = isSlotExpired(appointmentDate, slot.start_time, now);
  if (expired) {
    return { label: 'Passed', isSelectable: false, isExpired: true };
  }
  const isBackendAvailable = slot.available !== false && slot.is_available !== false;
  if (!isBackendAvailable) {
    return { label: slot.reason || 'Booked', isSelectable: false, isExpired: false };
  }
  return { label: 'Open', isSelectable: true, isExpired: false };
}
