import type { CalendarEvent } from "@/lib/calendar";

/** RFC 5545 escaping wartości tekstowej (backslash, ;, , i nowe linie). */
export function escapeICalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ISO "2026-06-23T14:00:00.000Z" → UTC kompaktowy "20260623T140000Z". */
export function toICalUtc(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}(?=Z$)/, "");
}

/** Dzień "2026-06-23" → "20260623" (dla zdarzeń całodniowych VALUE=DATE). */
export function toICalDate(isoDay: string): string {
  return isoDay.replace(/-/g, "");
}

/**
 * Z-150: buduje treść feedu iCalendar (.ics) z agregatu kalendarza Omnia.
 * Funkcja CZYSTA — `dtstamp` (ISO) wstrzykiwany przez wołającego (route podaje
 * bieżący czas), dzięki czemu jest testowalna deterministycznie.
 * Zdarzenia z godziną (`at`) → punkt w czasie (UTC); bez godziny → całodniowe.
 */
export function buildICalendar(events: CalendarEvent[], opts: { name?: string; dtstamp: string }): string {
  const stamp = toICalUtc(opts.dtstamp);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldOfMag//Omnia Kalendarz//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(opts.name ?? "Omnia")}`,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@worldofmag`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.at) {
      lines.push(`DTSTART:${toICalUtc(e.at)}`);
      lines.push("DURATION:PT30M");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${toICalDate(e.date)}`);
    }
    lines.push(`SUMMARY:${escapeICalText(e.title)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545: linie rozdzielone CRLF, plik kończy się CRLF.
  return lines.join("\r\n") + "\r\n";
}
