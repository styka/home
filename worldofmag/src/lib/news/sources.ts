// Domyślne źródła wiadomości seedowane per użytkownik przy pierwszym wejściu.
// Świadomie dobrany rozrzut światopoglądowy (centrum / lewica / prawica), wszystkie
// z oficjalnymi feedami RSS. Adresy są edytowalne w UI — gdyby portal zmienił feed,
// użytkownik poprawia go bez zmian w kodzie.

export type Leaning = "left" | "center" | "right";

export interface DefaultSource {
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  leaning: Leaning;
  sortOrder: number;
}

export const DEFAULT_SOURCES: DefaultSource[] = [
  {
    key: "onet",
    name: "Onet Wiadomości",
    rssUrl: "https://wiadomosci.onet.pl/.feed",
    homepageUrl: "https://wiadomosci.onet.pl",
    leaning: "center",
    sortOrder: 0,
  },
  {
    key: "okopress",
    name: "OKO.press",
    rssUrl: "https://oko.press/feed",
    homepageUrl: "https://oko.press",
    leaning: "left",
    sortOrder: 1,
  },
  {
    key: "niezalezna",
    name: "Niezależna",
    rssUrl: "https://niezalezna.pl/rss",
    homepageUrl: "https://niezalezna.pl",
    leaning: "right",
    sortOrder: 2,
  },
];

export const LEANING_META: Record<Leaning, { label: string; color: string }> = {
  left: { label: "Lewica", color: "var(--accent-red)" },
  center: { label: "Centrum", color: "var(--accent-blue)" },
  right: { label: "Prawica", color: "var(--accent-purple)" },
};
