import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "@/platform/retention";

/**
 * 083 (zadanie 30): retencja danych Zakupów.
 *
 * `ItemHistory` to podpowiedzi zakupowe — pamięć „co ta osoba zwykle kupuje". Rozdz. 11.6 daje jej
 * 12 miesięcy: wpis nietknięty od roku nie podpowiada już niczego trafnego, a rośnie z każdą nową
 * nazwą produktu. Liczy się `updatedAt`, nie data utworzenia: pozycja kupowana co tydzień od pięciu
 * lat ma zostać.
 */
export const RETENCJA_ZAKUPOW: PolitykaRetencji[] = [
  {
    klucz: "item_history",
    etykieta: "Podpowiedzi zakupowe (historia pozycji)",
    domyslneDni: 365,
    minimumDni: 30,
    uzasadnienie:
      "Wpis nietknięty od roku nie podpowiada już niczego trafnego. Liczy się data ostatniego użycia, więc pozycje kupowane regularnie zostają.",
    usun: async (starszeNiz) =>
      (await prisma.itemHistory.deleteMany({ where: { updatedAt: { lt: starszeNiz } } })).count,
  },
];
