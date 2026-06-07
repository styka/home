// Typy i stałe modułu Kalendarz (warstwa spinająca daty wszystkich modułów).
// Wydzielone z akcji serwerowej, bo plik "use server" eksportuje tylko funkcje.

export type CalendarModule = "tasks" | "kitchen" | "health" | "flota" | "pets" | "languages";

export type CalendarEvent = {
  id: string;
  module: CalendarModule;
  title: string;
  // Dzień zdarzenia jako "YYYY-MM-DD" (lokalny) — stabilny klucz dla siatki.
  date: string;
  // Pełny znacznik czasu ISO (gdy zdarzenie ma godzinę), inaczej null.
  at: string | null;
  href: string;
  accent: string;
};

export const MODULE_META: Record<CalendarModule, { label: string; accent: string }> = {
  tasks: { label: "Zadania", accent: "var(--accent-green)" },
  kitchen: { label: "Kuchnia", accent: "var(--accent-orange)" },
  health: { label: "Zdrowie", accent: "var(--accent-red)" },
  flota: { label: "Flota", accent: "var(--accent-blue)" },
  pets: { label: "Zwierzęta", accent: "var(--accent-orange)" },
  languages: { label: "Języki", accent: "var(--accent-purple)" },
};

/** "YYYY-MM-DD" w czasie lokalnym dla podanej daty. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Zakres [start, end) miesiąca zawierającego podaną datę. */
export function monthRange(year: number, month0: number): { start: Date; end: Date } {
  return { start: new Date(year, month0, 1), end: new Date(year, month0 + 1, 1) };
}
