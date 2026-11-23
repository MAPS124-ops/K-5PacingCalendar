import { NonSchoolDay } from '../types/pacing';

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatSlashDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export function formatLongDate(iso: string): string {
  const dt = parseISODate(iso);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortWeekday(iso: string): { weekday: string; monthDay: string } {
  const dt = parseISODate(iso);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    monthDay: dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
  };
}

export function addDaysISO(iso: string, delta: number): string {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

export function isWeekendISO(iso: string): boolean {
  const day = parseISODate(iso).getDay();
  return day === 0 || day === 6;
}

export function isSchoolDayISO(iso: string, nonSchoolDays: NonSchoolDay[]): boolean {
  if (isWeekendISO(iso)) return false;
  return !nonSchoolDays.some((d) => d.date === iso);
}

export function stepSchoolDayISO(
  iso: string,
  direction: 1 | -1,
  nonSchoolDays: NonSchoolDay[] = [],
  skipWeekends = true
): string {
  let current = addDaysISO(iso, direction);
  if (!skipWeekends) return current;
  let guard = 0;
  while (guard < 60 && !isSchoolDayISO(current, nonSchoolDays)) {
    current = addDaysISO(current, direction);
    guard++;
  }
  return current;
}

export function addSchoolDaysISO(
  iso: string,
  schoolDaysDelta: number,
  nonSchoolDays: NonSchoolDay[]
): string {
  if (schoolDaysDelta === 0) return iso;
  const dir: 1 | -1 = schoolDaysDelta > 0 ? 1 : -1;
  let remaining = Math.abs(schoolDaysDelta);
  let current = iso;
  let guard = 0;
  while (remaining > 0 && guard < 365) {
    current = addDaysISO(current, dir);
    if (isSchoolDayISO(current, nonSchoolDays)) {
      remaining--;
    }
    guard++;
  }
  return current;
}

export function getMondayOfWeekISO(iso: string): string {
  const dt = parseISODate(iso);
  const day = dt.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toISODate(dt);
}

export function getWeekDatesMonToFri(iso: string): string[] {
  const monday = getMondayOfWeekISO(iso);
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(monday, offset));
}

export function getMonthGridDates(year: number, monthIndex0: number): (string | null)[] {
  const first = new Date(year, monthIndex0, 1, 12, 0, 0);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(year, monthIndex0, day, 12, 0, 0)));
  }
  return cells;
}
