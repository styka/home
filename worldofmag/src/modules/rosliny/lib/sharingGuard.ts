import { requireAccess as requireAccessPlatform } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import { idZasobowNadanychMi } from "@/platform/sharing/nadaneMi";
import type { ResourceRef } from "@/platform/sharing/types";
import resources from "../sharing";

/**
 * 113 — wejście modułu Rośliny do wspólnego sprawdzania dostępu.
 *
 * Ten sam wzorzec, co w Zadaniach (052) i Zwierzętach (060): moduł woła platformę z **własnym**
 * katalogiem (import względny — C-02/C-36), a nie przez korzeń kompozycji `@/lib/sharing`.
 * Sięgnięcie po korzeń odwróciłoby zależność (moduł → korzeń → wszystkie moduły) i wciągnęłoby
 * deklaracje całej aplikacji do grafu Roślin — błąd, który w 049 spowolnił kompilację każdej trasy
 * dwukrotnie.
 *
 * Własny katalog wystarcza, mimo że roślina MA rodzica: rodzicem jest przestrzeń roślinna, czyli
 * zasób tego samego modułu. Gdyby kiedyś rodzic znalazł się w innym module, będzie to znak, że
 * wołający należy do warstwy kompozycji — a nie że trzeba tu dokleić import korzenia.
 */
export async function requireRoslinyAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
): Promise<void> {
  const ctx = await getAccessContext(userId);
  await requireAccessPlatform(userId, ref, operation, resources, ctx);
}

/**
 * Identyfikatory PRZESTRZENI udostępnionych mi spoza moich własnych (AC-28).
 *
 * **Bez tego udostępnianie wpuszcza do pustego widoku** — najgorszy z możliwych wariantów, bo
 * wygląda jak awaria danych, a nie jak brak dostępu. Guard zna nadania, więc `getSpace` przechodzi
 * i widok się rysuje; listy szły jednak wyłącznie przez `ownedWhereAsync` (czyli „moje przestrzenie"),
 * więc obdarowana osoba nie widziała ani przestrzeni na liście, ani jednej rośliny w środku.
 *
 * Rośliny **nie mają** swojego wariantu tej funkcji i to jest celowe: dostęp do rośliny wynika
 * z dostępu do przestrzeni (`parent` w deklaracji), więc zakres list rozstrzyga się na przestrzeni.
 * Pytanie osobno o nadania roślin dałoby drugą regułę dziedziczenia — dokładnie to, czego C-17
 * zabrania.
 */
export async function idPrzestrzeniNadanychMi(userId: string): Promise<string[]> {
  const ctx = await getAccessContext(userId);
  return idZasobowNadanychMi(userId, "rosliny.space", ctx);
}

/**
 * Warunek zakresu dla list modułu: **moje przestrzenie ALBO przestrzenie mi udostępnione**.
 *
 * Zwraca kształt do wstawienia w `where` zapytania o `PlantSpace`. Dla tabel wiszących na
 * przestrzeni (rośliny, zadania, zdarzenia) wołający wstawia to pod `space: { is: … }`.
 */
export async function zakresPrzestrzeni(userId: string): Promise<Record<string, unknown>> {
  const { ownedOrAsync } = await import("@/platform/auth/serverUtils");
  const galezie = await ownedOrAsync(userId);
  const nadane = await idPrzestrzeniNadanychMi(userId);
  if (nadane.length > 0) galezie.push({ id: { in: nadane } });
  return { OR: galezie };
}

/**
 * Sprawdza, że wskazania podane PRZEZ KLIENTA należą do zakresu wołającego.
 *
 * **Po co, skoro klucz obcy i tak sprawdza istnienie wiersza.** Bo sprawdza istnienie, a nie
 * właściciela. Server Action jest wywoływalna z dowolnymi argumentami przez każde zalogowane konto,
 * więc `createPlant({ spaceId: <moja przestrzeń>, parentId: <cudza roślina> })` przechodziłoby: guard
 * pilnuje `spaceId`, a `parentId` szedł prosto do zapisu. Skutkiem był wyciek w obie strony —
 * atakujący czytał `parent.name` cudzej rośliny, ofiara widziała cudzą roślinę jako swoje potomstwo.
 * Wariant cięższy szedł przez zadanie opieki: zdarzenie z `plantId` ofiary wchodziło potem do
 * kontekstu jej diagnozy, razem z tekstem pod kontrolą atakującego.
 *
 * Rzuca ten sam komunikat co brak zasobu — istnienie cudzego rekordu też jest informacją.
 */
export async function sprawdzWskazania(
  userId: string,
  wskazania: { placeId?: string | null; speciesId?: string | null; plantId?: string | null; spaceId?: string | null },
): Promise<void> {
  const { prisma } = await import("@/platform/db/prisma");
  const zakres = await zakresPrzestrzeni(userId);

  if (wskazania.placeId) {
    const m = await prisma.plantPlace.findFirst({
      where: {
        id: wskazania.placeId,
        // Miejsce musi należeć do TEJ przestrzeni, a nie do dowolnej mojej: przypisanie rośliny do
        // grządki z innego ogrodu jest bez sensu, a przez `placeId` w zdarzeniach opieki mieszałoby
        // historię dwóch miejsc.
        ...(wskazania.spaceId ? { spaceId: wskazania.spaceId } : { space: { is: zakres } }),
      },
      select: { id: true },
    });
    if (!m) throw new Error("Miejsce nie istnieje");
  }

  if (wskazania.speciesId) {
    // Gatunek żyje w przestrzeni WŁASNOŚCIOWEJ, a nie roślinnej, więc pytamy zwykłym zakresem
    // własności — `zakresPrzestrzeni` mówi o czym innym.
    const { ownedWhereAsync } = await import("@/platform/auth/serverUtils");
    const g = await prisma.plantSpecies.findFirst({
      where: { id: wskazania.speciesId, ...(await ownedWhereAsync(userId)) },
      select: { id: true },
    });
    if (!g) throw new Error("Gatunek nie istnieje");
  }

  if (wskazania.plantId) {
    const r = await prisma.plant.findFirst({
      where: {
        id: wskazania.plantId,
        ...(wskazania.spaceId ? { spaceId: wskazania.spaceId } : { space: { is: zakres } }),
      },
      select: { id: true },
    });
    if (!r) throw new Error("Roślina nie istnieje");
  }
}
