import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "@/platform/retention";

/**
 * 102 — retencja danych modułu YouTube.
 *
 * Kasujemy **transkrypcje filmów odrzuconych**, a nie same filmy. Rozróżnienie jest celowe:
 * transkrypcja bywa na kilkadziesiąt tysięcy znaków i to ona zajmuje miejsce, a wiersz filmu jest
 * potrzebny dalej — bez niego odświeżenie zobaczyłoby ten film jako NOWY i wróciłby na listę,
 * mimo że użytkownik świadomie go odrzucił. Kasowanie wiersza zamiast treści przywracałoby więc
 * dokładnie to, co użytkownik odrzucił.
 */
export const RETENCJA_YOUTUBE: PolitykaRetencji[] = [
  {
    klucz: "youtube_transkrypcje_odrzuconych",
    etykieta: "Transkrypcje odrzuconych filmów (YouTube)",
    domyslneDni: 30,
    minimumDni: 7,
    uzasadnienie:
      "Transkrypcja odrzuconego filmu nie jest już nikomu potrzebna, a bywa na dziesiątki tysięcy znaków. Sam wiersz filmu ZOSTAJE — bez niego odświeżenie uznałoby go za nowy i przywróciło na listę.",
    usun: async (starszeNiz) =>
      (
        await prisma.youtubeVideo.updateMany({
          where: { stan: "odrzucony", updatedAt: { lt: starszeNiz }, transkrypcja: { not: null } },
          data: { transkrypcja: null, transkrypcjaStan: "niedostepna" },
        })
      ).count,
  },
];
