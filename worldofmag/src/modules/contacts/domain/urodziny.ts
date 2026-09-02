/**
 * 114 — reguła daty urodzin kontaktu.
 *
 * W warstwie domenowej (nie w pliku `"use server"`), bo to decyzja dziedzinowa z walidacją,
 * którą trzeba móc zaimportować do testu (`check:domain`).
 */

/** "YYYY-MM-DD" → Date (północ UTC) albo null; złe wejście = błąd, nie cisza. */
export function parseBirthday(v: string | null | undefined): Date | null {
  if (v === null || v === undefined || !v.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) throw new Error("Data urodzin w formacie RRRR-MM-DD");
  const d = new Date(`${v.trim()}T00:00:00Z`);
  if (isNaN(d.getTime())) throw new Error("Nieprawidłowa data urodzin");
  return d;
}
