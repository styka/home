import { addDays, startOfWeek, endOfWeek, format, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";

export const POLISH_WEEKDAY_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatWeekRange(date: Date): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  return `${format(start, "d MMM", { locale: pl })} – ${format(end, "d MMM yyyy", { locale: pl })}`;
}

export function formatDayShort(date: Date): string {
  return `${POLISH_WEEKDAY_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()}`;
}

export function formatDayLong(date: Date): string {
  return format(date, "EEEE, d MMMM", { locale: pl });
}

export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
