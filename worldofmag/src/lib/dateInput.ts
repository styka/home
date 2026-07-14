// Pomocniki do pól formularzy dat/godzin w strefie LOKALNEJ użytkownika.
//
// UWAGA (bug naprawiony 2026-07-02): NIE używać `new Date(x).toISOString().slice(0,16)`
// do zasilenia pola `datetime-local` — `toISOString()` daje UTC, więc pole pokazywało
// złą godzinę, a przy zapisie doklejanie "T12:00:00" tworzyło "…T14:30T12:00:00" =
// Invalid Date i zmiana terminu przepadała. Pole `datetime-local` operuje na czasie
// LOKALNYM — formatujemy i parsujemy lokalnie.

const pad = (n: number) => String(n).padStart(2, "0");

/** Instant → wartość pola `type="datetime-local"` (lokalne "YYYY-MM-DDTHH:mm"). */
export function toDateTimeLocalValue(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Instant → wartość pola `type="date"` (lokalne "YYYY-MM-DD"). */
export function toDateValue(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Wartość pola `datetime-local`/`date` → instant (Date) w strefie lokalnej, albo null
 * dla pustego wejścia. `new Date("YYYY-MM-DDTHH:mm")` parsuje jako LOKALNY czas; dla
 * pola tylko-dzień doklejamy lokalne południe (jak w TaskRow — instant jednoznacznie
 * należy do wybranego dnia w strefie usera, spójnie z widokiem „Dziś").
 */
export function parseDateInput(v: string, opts?: { dayOnly?: boolean }): Date | null {
  if (!v) return null;
  const iso = opts?.dayOnly ? `${v}T12:00:00` : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
