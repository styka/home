// 042: Ulubione widoki — logika współdzielona przez serwer i klienta.
//
// Ten plik jest CZYSTO OBLICZENIOWY (bez Prismy, bez `next/headers`), bo importują go zarówno
// Server Actions, jak i komponenty `"use client"` (gwiazdka w pasku, przełącznik, karty pulpitu).
// Dołożenie tu czegokolwiek, co dotyka bazy, wciągnęłoby Prismę do paczki przeglądarki.

/** Maksymalna liczba ulubionych na użytkownika — proste zabezpieczenie przed „śmietnikiem". */
export const MAX_FAVORITE_VIEWS = 30;

/** Górny limit długości zapisywanego adresu (ochrona przed wklejeniem gigantycznego query). */
const MAX_PATH_LENGTH = 512;

/** Górny limit długości nazwy nadanej przez użytkownika. */
export const MAX_FAVORITE_LABEL_LENGTH = 60;

/**
 * Kolor akcentu ulubionego. Wyłącznie tokeny motywu — skórka może nadpisać każdą zmienną,
 * więc hex złamałby skinowalność (C-30).
 */
export const FAVORITE_COLORS = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-purple)",
] as const;

export type FavoriteColor = (typeof FAVORITE_COLORS)[number];

export const DEFAULT_FAVORITE_ICON = "⭐";

export interface FavoriteViewDTO {
  id: string;
  label: string;
  path: string;
  icon: string;
  color: string | null;
  order: number;
}

/**
 * Sprowadza adres podany przez przeglądarkę do bezpiecznej, wewnętrznej ścieżki.
 * Zwraca `null`, gdy adresu nie wolno zapisać.
 *
 * Dlaczego to jest istotne, a nie kosmetyczne: zapisany adres jest później używany do nawigacji.
 * Gdyby dało się zapisać `//zly.example` albo `javascript:…`, ulubione stałyby się wektorem
 * otwartego przekierowania — użytkownik klika „swoją" zakładkę i wychodzi poza aplikację.
 * Dlatego normalizacja ma być wołana ZAWSZE przy zapisie, a nie tylko w interfejsie.
 */
export function normalizeFavoritePath(raw: string): string | null {
  if (typeof raw !== "string") return null;

  let value = raw.trim();
  if (!value) return null;

  // Schemat (`javascript:`, `data:`, `https:`) — dwukropek przed pierwszym ukośnikiem.
  const firstSlash = value.indexOf("/");
  const firstColon = value.indexOf(":");
  if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) return null;

  // Fragment `#…` nie ma znaczenia dla nawigacji po stronie serwera — ucinamy.
  const hashAt = value.indexOf("#");
  if (hashAt !== -1) value = value.slice(0, hashAt);

  if (!value.startsWith("/")) return null;

  // `//host` to adres protokołowo-względny (wychodzi poza aplikację), `/\host` to jego
  // wariant, który część przeglądarek traktuje tak samo. Oba odrzucamy.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // Znaki sterujące nie mają prawa znaleźć się w adresie.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  if (value.length > MAX_PATH_LENGTH) return null;

  // "/tasks/" i "/tasks" to ten sam widok — bez tego powstałyby dwa wpisy na to samo miejsce.
  if (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);

  return value;
}

/** Przycina nazwę do limitu; pusta nazwa → `null` (wywołujący podstawi nazwę ze ścieżki). */
export function normalizeFavoriteLabel(raw: string): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  return value.slice(0, MAX_FAVORITE_LABEL_LENGTH);
}

/** Odcina query, zostawiając samą ścieżkę — `permissionForPath` operuje na ścieżce. */
export function pathnameOf(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}

/**
 * Zostawia tylko te ulubione, do których użytkownik NADAL ma uprawnienie (AC-8).
 *
 * Wpisy bez dostępu są *ukrywane*, a nie kasowane — uprawnienie może wrócić i wtedy zakładka
 * ma nadal działać. Ta funkcja musi być używana w KAŻDYM miejscu renderowania ulubionych
 * (karty pulpitu, pasek boczny, przełącznik, skróty klawiszowe), inaczej ulubione stałyby się
 * obejściem RBAC.
 *
 * 046: `isLocked` przychodzi PARAMETREM (zwykle `isPathLocked` z `@/lib/pathPermissions`), zamiast
 * być tu zaimportowane. Powód jest ustrojowy: po przeniesieniu modułów pełna wiedza o tym, która
 * ścieżka jakiego uprawnienia wymaga, mieszka w korzeniu kompozycji, a platformie nie wolno
 * importować modułów. Parametr jest **wymagany** — gdyby był opcjonalny z domyślnym wariantem
 * „historycznym", zapomniane przekazanie dawałoby cichy przeciek RBAC zamiast błędu kompilacji.
 */
export function filterAccessibleFavorites<T extends { path: string }>(
  views: T[],
  permissions: string[],
  isLocked: (permissions: string[], path: string) => boolean
): T[] {
  return views.filter((v) => !isLocked(permissions, pathnameOf(v.path)));
}

/**
 * Proponuje nazwę zakładki na podstawie adresu — punkt startowy, który użytkownik może zmienić.
 * Świadomie prosta: bierze ostatni czytelny segment ścieżki, a identyfikatory (cuid) pomija,
 * bo „cmpq1l67f000gyt0v" nie jest nazwą, którą ktokolwiek rozpozna na liście.
 */
export function suggestFavoriteLabel(path: string, moduleLabel?: string): string {
  const segments = pathnameOf(path).split("/").filter(Boolean);
  const readable = segments.filter((s) => !/^c[a-z0-9]{20,}$/i.test(s) && !/^\d+$/.test(s));
  const last = readable[readable.length - 1];

  if (moduleLabel && (!last || readable.length <= 1)) return moduleLabel;
  if (!last) return moduleLabel ?? "Strona główna";

  const pretty = decodeURIComponent(last).replace(/-/g, " ");
  const titled = pretty.charAt(0).toUpperCase() + pretty.slice(1);
  return moduleLabel && moduleLabel !== titled ? `${moduleLabel} — ${titled}` : titled;
}
