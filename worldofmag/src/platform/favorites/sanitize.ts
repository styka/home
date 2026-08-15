/**
 * 069 (zadanie 19, rozdz. 10.1) — OCZYSZCZANIE WYGLĄDU ZAPISANEGO WIDOKU.
 *
 * Wyprowadzone z `src/actions/favoriteViews.ts`. Reguła przekrojowa (ulubione widoki są zdolnością
 * powłoki, nie modułu), więc mieszka w `platform/favorites`.
 */

import { FAVORITE_COLORS, DEFAULT_FAVORITE_ICON } from "./favoriteViews";

/**
 * Kolor spoza palety motywu **odrzucamy** — do bazy nie ma prawa trafić hex (C-30).
 *
 * To nie jest obrona przed złym typem, tylko egzekwowanie skinowalności: zapisany hex przeżyłby
 * zmianę skórki i świeciłby obcym kolorem w motywie, dla którego go nie dobrano.
 */
export function sanitizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  return (FAVORITE_COLORS as readonly string[]).includes(color) ? color : null;
}

/** Emoji jako ikona; ucinamy do dwóch znaków, żeby nie wkleić tu całego zdania. */
export function sanitizeIcon(icon: string | null | undefined): string {
  const value = (icon ?? "").trim();
  if (!value) return DEFAULT_FAVORITE_ICON;
  return Array.from(value).slice(0, 2).join("");
}
