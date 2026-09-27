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
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = parseFromDateString(dateStr);
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
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function getQuickDateOptions(todayStr: string) {
  const today = parseFromDateString(todayStr);
  const options: { label: string; date: string }[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatToDateString(d);
    let label = '';
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
