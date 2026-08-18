import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "@/platform/retention";

/**
 * 083 (zadanie 30): retencja danych Wiadomości.
 *
 * `NewsArticle` to wspólna PULA artykułów (039) — materiał wejściowy do klasyfikacji i streszczeń,
 * pobierany przy każdym odświeżeniu modułu. Rozdz. 11.6 daje jej 30 dni: po tym czasie artykuł nie
 * jest już nikomu pokazywany (świeżość liczy się w godzinach), a wpisy linii czasu
 * (`NewsTimelineEntry`) są osobnymi rekordami i **nie** znikają razem z nim.
 */
export const RETENCJA_WIADOMOSCI: PolitykaRetencji[] = [
  {
    klucz: "news_articles",
    etykieta: "Pula artykułów (Wiadomości)",
    domyslneDni: 30,
    minimumDni: 7,
    uzasadnienie:
      "Materiał wejściowy do klasyfikacji i streszczeń; świeżość liczy się w godzinach. Linia czasu to osobne rekordy i zostaje.",
    usun: async (starszeNiz) =>
      (await prisma.newsArticle.deleteMany({ where: { fetchedAt: { lt: starszeNiz } } })).count,
  },
];
