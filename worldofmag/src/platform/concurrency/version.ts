import { prisma } from "@/platform/db/prisma";
import { zanotujOperacje } from "@/platform/observability/metryki";

/**
 * 062 (zadanie 15) — ZAPIS Z WARUNKIEM NA WERSJI (rozdz. 8.5.1).
 *
 * Problem, który rozwiązuje, jest w diagnozie 5.1 jednym zdaniem: *„żaden model nie ma wersji,
 * więc ostatni zapis wygrywa po cichu"*. Dwie osoby edytujące ten sam rekord nie dostają dziś
 * żadnego sygnału — praca jednej z nich znika bez śladu w logach i bez powodu, żeby ktokolwiek
 * jej szukał. **Cicha utrata pracy jest najgorszym rodzajem błędu.**
 *
 * **Dlaczego `updateMany`, a nie `update`** — to jest sedno mechanizmu, nie szczegół.
 * `update` z warunkiem, który nie pasuje, **rzuca** i nie da się odróżnić „ktoś mnie ubiegł" od
 * „rekord nie istnieje". `updateMany` zwraca **liczbę** zmienionych wierszy, więc `count === 0`
 * plus osobne sprawdzenie istnienia daje dwa różne, prawdziwe komunikaty. Użytkownik, który
 * skasował zadanie w drugiej karcie, nie może dostać „ktoś zmienił to zadanie".
 */

/** Rekord zmieniony przez kogoś innego, odkąd go odczytałeś. */
export class ConflictError extends Error {
  readonly resourceType: string;
  readonly resourceId: string;
  /** Wersja, którą zastaliśmy w bazie — UI potrzebuje jej, żeby pokazać różnice (zadanie 16). */
  readonly currentVersion: number | null;

  constructor(resourceType: string, resourceId: string, currentVersion: number | null) {
    // Komunikat po polsku (C-32) i **zrozumiały bez kontekstu technicznego** — trafia do UI,
    // dopóki zadanie 16 nie dowiezie `ConflictDialog`.
    super("Ktoś zmienił ten element, zanim zapisałeś zmiany.");
    this.name = "ConflictError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.currentVersion = currentVersion;
  }
}

/** Rekord, którego już nie ma. Odróżnienie od konfliktu jest treścią mechanizmu (spec AC-3). */
export class MissingRecordError extends Error {
  constructor(resourceType: string) {
    super(`${resourceType} już nie istnieje.`);
    this.name = "MissingRecordError";
  }
}

/** Delegat Prismy zawężony do tego, czego ten helper naprawdę używa. */
interface WersjonowanyModel {
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  findUnique: (args: {
    where: { id: string };
    select: { version: true };
  }) => Promise<{ version: number } | null>;
}

/**
 * Zapis rekordu wersjonowanego.
 *
 * @param expectedVersion wersja odczytana przez wołającego. **`undefined` = zapis bez kontroli**
 *   — zachowanie sprzed 062, świadomie zachowane (spec AC-4): przełączenie wszystkich ścieżek
 *   zapisu naraz zmieniłoby zachowanie całej aplikacji w jednym kroku, a to jest dokładnie ta
 *   klasa zmian, której ta przebudowa unika.
 *
 * @throws {ConflictError} gdy rekord istnieje, ale ma inną wersję
 * @throws {MissingRecordError} gdy rekordu nie ma
 */
export async function updateWithVersion<T extends WersjonowanyModel>(
  model: T,
  resourceType: string,
  id: string,
  patch: Record<string, unknown>,
  expectedVersion?: number,
): Promise<void> {
  const where: Record<string, unknown> =
    expectedVersion === undefined ? { id } : { id, version: expectedVersion };

  const wynik = await model.updateMany({
    where,
    // Wersja rośnie WYŁĄCZNIE tędy. `increment` zamiast `expectedVersion + 1` — gdyby dwa zapisy
    // bez kontroli wersji przeszły równolegle, licznik i tak zostanie spójny.
    data: { ...patch, version: { increment: 1 } },
  });
  if (wynik.count > 0) return;

  // Zero zmienionych wierszy ma DWIE różne przyczyny i użytkownik musi dostać właściwą.
  const biezacy = await model.findUnique({ where: { id }, select: { version: true } });
  if (!biezacy) throw new MissingRecordError(resourceType);
  // 087 (zadanie 32): konflikt edycji jest METRYKĄ, nie tylko błędem. Rozdz. 11.7 stawia sprawę
  // wprost: rosnąca liczba konfliktów w JEDNYM module to sygnał, że akurat tam potrzebne jest
  // współredagowanie (rozdz. 8.6). Bez tego licznika decyzja o CRDT byłaby zgadywaniem.
  // Moduł wyprowadzamy z typu zasobu (`tasks.task` → `tasks`) — ta sama konwencja co w nadaniach.
  zanotujOperacje(resourceType.split(".")[0], resourceType, 0, "konflikt");
  throw new ConflictError(resourceType, id, biezacy.version);
}

/** Wersja rekordu — do odczytu przed edycją, żeby wołający miał co podać przy zapisie. */
export async function readVersion(
  model: { findUnique: (a: { where: { id: string }; select: { version: true } }) => Promise<{ version: number } | null> },
  id: string,
): Promise<number | null> {
  const r = await model.findUnique({ where: { id }, select: { version: true } });
  return r?.version ?? null;
}

/** Delegaty modeli objętych wersjonowaniem — jedno miejsce, z którego czyta bramka. */
export const WERSJONOWANE = {
  "tasks.task": () => prisma.task as unknown as WersjonowanyModel,
  "notes.note": () => prisma.note as unknown as WersjonowanyModel,
} as const;
