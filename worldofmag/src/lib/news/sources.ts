// Domyślne źródła wiadomości seedowane per użytkownik przy pierwszym wejściu.
// Świadomie dobrany rozrzut światopoglądowy, wszystkie z oficjalnymi feedami RSS. Adresy są
// edytowalne w UI — gdyby portal zmienił feed, użytkownik poprawia go bez zmian w kodzie.
//
// 040: `leaning` (left|center|right) ustąpił dowolnemu opisowi. Opisy poniżej są te same, które
// migracja 0219 nadaje istniejącym źródłom — nowy użytkownik dostaje więc dokładnie to samo co
// zmigrowany. Kolor liczy z nich `sourceColor` (`lib/news/sourceColor.ts`).

export interface DefaultSource {
  key: string;
  name: string;
  rssUrl: string;
  homepageUrl: string;
  descriptor: string;
  sortOrder: number;
}

export const DEFAULT_SOURCES: DefaultSource[] = [
  {
    key: "onet",
    name: "Onet Wiadomości",
    rssUrl: "https://wiadomosci.onet.pl/.feed",
    homepageUrl: "https://wiadomosci.onet.pl",
    descriptor: "Centrum",
    sortOrder: 0,
  },
  {
    key: "okopress",
    name: "OKO.press",
    rssUrl: "https://oko.press/feed",
    homepageUrl: "https://oko.press",
    descriptor: "Lewica",
    sortOrder: 1,
  },
  {
    key: "niezalezna",
    name: "Niezależna",
    rssUrl: "https://niezalezna.pl/rss",
    homepageUrl: "https://niezalezna.pl",
    descriptor: "Prawica",
    sortOrder: 2,
  },
];
