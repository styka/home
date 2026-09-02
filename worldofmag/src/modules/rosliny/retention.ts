import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "@/platform/retention";

/**
 * 113 — retencja danych modułu Rośliny.
 *
 * **Jedna polityka, i jedno świadome WYŁĄCZENIE, które jest tu ważniejsze od niej.**
 *
 * Kasujemy zdjęcia z dziennika roślin ZAKOŃCZONYCH (sprzedanych, zebranych, martwych,
 * zarchiwizowanych) — to one zajmują miejsce, a po zakończeniu bytu nikt do nich nie wraca.
 * Kasujemy TREŚĆ zdjęcia, nie wpis: wpis niesie datę i notatkę, czyli historię, z której liczy się
 * płodozmian i statystyka przeżywalności. Skasowanie wiersza zabrałoby daną, a nie plik.
 *
 * **Ewidencja zabiegów (`PlantCareEvent` z polami ŚOR) NIE PODLEGA retencji i nie podlegać nie
 * może.** To jest dokumentacja o wymogu ustawowym: profesjonalny użytkownik środków ochrony roślin
 * ma obowiązek prowadzić ewidencję i doprowadzić ją do formy elektronicznej do 31 stycznia roku
 * następującego po roku zastosowania, a kontrola weryfikuje jej kompletność. Automat, który po
 * roku wyczyściłby te wiersze, byłby narzędziem do niszczenia dokumentacji — dlatego nie ma tu
 * polityki, która by ich dotykała, i dopisanie jej wymaga świadomej decyzji, a nie „porządków".
 */
export const RETENCJA_ROSLIN: PolitykaRetencji[] = [
  {
    klucz: "rosliny_zdjecia_zakonczonych",
    etykieta: "Zdjęcia z dziennika roślin zakończonych (Rośliny)",
    domyslneDni: 365,
    minimumDni: 90,
    uzasadnienie:
      "Zdjęcia rośliny sprzedanej, zebranej albo martwej zajmują miejsce, a nikt do nich nie wraca. Kasujemy sam ODNOŚNIK do zdjęcia — wpis z datą i notatką zostaje, bo to on jest historią miejsca i podstawą statystyki przeżywalności. Ewidencja zabiegów jest z retencji WYŁĄCZONA: to dokumentacja o wymogu ustawowym.",
    usun: async (starszeNiz) =>
      (
        await prisma.plantJournalEntry.updateMany({
          where: {
            occurredAt: { lt: starszeNiz },
            photoUrl: { not: null },
            plant: { is: { status: { in: ["SOLD", "HARVESTED", "DEAD", "ARCHIVED"] } } },
          },
          data: { photoUrl: null },
        })
      ).count,
  },
];
