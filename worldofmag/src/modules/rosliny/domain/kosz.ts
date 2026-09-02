/**
 * 113 — ODCZYT MIGAWKI KOSZA DLA MODUŁU ROŚLINY.
 *
 * **Dlaczego to jest reguła, a nie przepisanie pól.** Migawka to `JSON` — struktura bez typu,
 * zapisana w chwili usunięcia, czasem przez starszą wersję kodu. Każde pole wymaga tu decyzji:
 * czego brak wolno uzupełnić wartością domyślną (liczność, jednostka, status), a czego nie
 * (przestrzeń, identyfikator — bez nich rekord nie ma gdzie wrócić). Zła domyślna nie wywala
 * przywracania: cicho zmienia dane, które użytkownik uważa za odzyskane w całości.
 *
 * Reguła mieszka poza plikiem akcji, bo plik z `"use server"` nie eksportuje funkcji
 * synchronicznych — zawarta w nim byłaby niesprawdzalna (zapadka `check:domain`).
 */

/** Data z migawki. `JSON.stringify` zapisuje `Date` jako tekst, więc wraca tekstem, nie datą. */
export function dataZMigawki(v: unknown): Date | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Wiersz rośliny gotowy do zapisu, złożony z migawki. */
export interface WierszRosliny {
  id: string;
  workspaceId: string;
  spaceId: string;
  placeId: string | null;
  speciesId: string | null;
  name: string;
  customSpecies: string | null;
  quantity: number;
  quantityUnit: string;
  stage: string | null;
  status: string;
  statusReason: string | null;
  statusAt: Date | null;
  sownAt: Date | null;
  acquiredAt: Date | null;
  notes: string | null;
  photoUrl: string | null;
}

/**
 * Składa wiersz rośliny z migawki.
 *
 * `placeId` przychodzi PARAMETREM, a nie z migawki: miejsce wraca tylko wtedy, gdy wróciła też
 * przestrzeń razem z nim, więc o tym, czy odwołanie jest wciąż prawdziwe, wie wywołujący, a nie
 * migawka. Wstawienie tu `p.placeId` przywróciłoby roślinę wskazującą na miejsce, którego nie ma —
 * i zapis odbiłby się od klucza obcego w połowie przywracania.
 *
 * **Daty życia rośliny są odtwarzane, a nie zerowane.** `sownAt`/`acquiredAt` to jedyne źródło
 * sezonu w regule płodozmianu, a `statusAt` mówi, kiedy roślina przestała żyć — roślina wracająca
 * bez nich wygląda na posadzoną dzisiaj i psuje ostrzeżenia dla całego miejsca.
 */
export function wierszRoslinyZMigawki(
  p: Record<string, unknown>,
  placeId: string | null,
): WierszRosliny {
  if (typeof p.id !== "string" || typeof p.workspaceId !== "string" || typeof p.spaceId !== "string") {
    throw new Error("Uszkodzona migawka rośliny");
  }
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    spaceId: p.spaceId,
    placeId,
    speciesId: (p.speciesId as string | null) ?? null,
    name: (p.name as string) ?? "",
    customSpecies: (p.customSpecies as string | null) ?? null,
    // Liczność i jednostka mają sens tylko dodatnie: zero roślin nie jest rośliną, a pusta
    // jednostka rozsypałaby etykietę „3 " w każdym widoku.
    quantity: typeof p.quantity === "number" && p.quantity > 0 ? p.quantity : 1,
    quantityUnit: (p.quantityUnit as string) || "szt",
    stage: (p.stage as string | null) ?? null,
    status: (p.status as string) || "ACTIVE",
    statusReason: (p.statusReason as string | null) ?? null,
    statusAt: dataZMigawki(p.statusAt),
    sownAt: dataZMigawki(p.sownAt),
    acquiredAt: dataZMigawki(p.acquiredAt),
    notes: (p.notes as string | null) ?? null,
    photoUrl: (p.photoUrl as string | null) ?? null,
  };
}
