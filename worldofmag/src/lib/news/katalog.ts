// 082: słowniki systemowej BIBLIOTEKI ŹRÓDEŁ RSS.
//
// Plik żyje w `src/lib/news/` (obok `sources.ts`, `rss.ts`, `sourceColor.ts`), a nie w module
// Wiadomości, bo ma DWÓCH konsumentów: moduł (przeglądarka biblioteki dla użytkownika) i panel
// administratora w `src/components/admin` (zarządzanie katalogiem). Przynależność pliku ustala
// lista jego konsumentów, nie nazwa (C-36).
//
// Żadnych enumów Prismy (C-12): kolumny są tekstem, a zawężenie robi typ TypeScriptu.

/** Rodzaj treści źródła. Wartość kolumny `NewsSourceCatalog.category`. */
export type NewsCatalogCategory =
  | "wiadomosci"
  | "biznes"
  | "sport"
  | "technologia"
  | "nauka"
  | "kultura"
  | "rozrywka"
  | "zdrowie"
  | "lokalne"
  | "opinie"
  | "inne";

/** Wynik ostatniego sprawdzenia kanału. Wartość kolumny `NewsSourceCatalog.checkStatus`. */
export type NewsCatalogCheckStatus = "unknown" | "ok" | "error";

export const NEWS_CATALOG_CATEGORIES: { key: NewsCatalogCategory; label: string }[] = [
  { key: "wiadomosci", label: "Wiadomości" },
  { key: "biznes", label: "Biznes i gospodarka" },
  { key: "sport", label: "Sport" },
  { key: "technologia", label: "Technologia" },
  { key: "nauka", label: "Nauka" },
  { key: "kultura", label: "Kultura" },
  { key: "rozrywka", label: "Rozrywka" },
  { key: "zdrowie", label: "Zdrowie" },
  { key: "lokalne", label: "Regionalne" },
  { key: "opinie", label: "Opinie i publicystyka" },
  { key: "inne", label: "Inne" },
];

/**
 * Kraje obecne w katalogu startowym. Lista jest **zamknięta i ręcznie utrzymywana**, a nie
 * wyliczana z bazy: selektor ma pokazywać polskie nazwy, a kolumna trzyma sam kod. Kraj spoza tej
 * listy (dodany przez administratora) wyświetli się jako goły kod — świadomie, bo pusty selektor
 * byłby gorszy niż nieprzetłumaczona pozycja.
 */
export const NEWS_CATALOG_COUNTRIES: { key: string; label: string }[] = [
  { key: "PL", label: "Polska" },
  { key: "US", label: "Stany Zjednoczone" },
  { key: "GB", label: "Wielka Brytania" },
  { key: "DE", label: "Niemcy" },
  { key: "FR", label: "Francja" },
  { key: "ES", label: "Hiszpania" },
  { key: "IT", label: "Włochy" },
  { key: "NL", label: "Holandia" },
  { key: "SE", label: "Szwecja" },
  { key: "NO", label: "Norwegia" },
  { key: "DK", label: "Dania" },
  { key: "FI", label: "Finlandia" },
  { key: "CZ", label: "Czechy" },
  { key: "SK", label: "Słowacja" },
  { key: "UA", label: "Ukraina" },
  { key: "LT", label: "Litwa" },
  { key: "AT", label: "Austria" },
  { key: "CH", label: "Szwajcaria" },
  { key: "BE", label: "Belgia" },
  { key: "IE", label: "Irlandia" },
  { key: "PT", label: "Portugalia" },
  { key: "CA", label: "Kanada" },
  { key: "AU", label: "Australia" },
  { key: "JP", label: "Japonia" },
  { key: "IN", label: "Indie" },
  { key: "BR", label: "Brazylia" },
  { key: "IL", label: "Izrael" },
  { key: "RU", label: "Rosja" },
  { key: "CN", label: "Chiny" },
  { key: "QA", label: "Katar" },
  { key: "", label: "Międzynarodowe" },
];

export const NEWS_CATALOG_LANGUAGES: { key: string; label: string }[] = [
  { key: "pl", label: "polski" },
  { key: "en", label: "angielski" },
  { key: "de", label: "niemiecki" },
  { key: "fr", label: "francuski" },
  { key: "es", label: "hiszpański" },
  { key: "it", label: "włoski" },
  { key: "nl", label: "niderlandzki" },
  { key: "sv", label: "szwedzki" },
  { key: "no", label: "norweski" },
  { key: "da", label: "duński" },
  { key: "fi", label: "fiński" },
  { key: "cs", label: "czeski" },
  { key: "sk", label: "słowacki" },
  { key: "uk", label: "ukraiński" },
  { key: "lt", label: "litewski" },
  { key: "pt", label: "portugalski" },
  { key: "ja", label: "japoński" },
  { key: "ru", label: "rosyjski" },
];

/** Etykieta kraju/języka albo sam kod, gdy nie znamy — nigdy pusty napis w miejscu wartości. */
export function etykietaKraju(kod: string): string {
  return NEWS_CATALOG_COUNTRIES.find((c) => c.key === kod)?.label ?? kod;
}

export function etykietaJezyka(kod: string): string {
  return NEWS_CATALOG_LANGUAGES.find((c) => c.key === kod)?.label ?? kod;
}

export function etykietaKategorii(kod: string): string {
  return NEWS_CATALOG_CATEGORIES.find((c) => c.key === kod)?.label ?? kod;
}
