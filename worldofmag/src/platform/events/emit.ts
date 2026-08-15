/**
 * 070 (zadanie 21, rozdz. 9.4) — EMISJA ZDARZENIA DOMENOWEGO.
 *
 * **Warunek poprawności całego mechanizmu** (rozdz. 9.4.2): zdarzenie zapisuje się w **tej samej
 * transakcji co mutacja**. Zapis poza transakcją to najczęstszy błąd przy wdrażaniu outboxu —
 * przy awarii pomiędzy jednym a drugim stan i zdarzenia się rozjeżdżają i **nikt się o tym nie
 * dowie**: nie ma błędu, nie ma logu, jest tylko reakcja, która nigdy nie nastąpiła.
 *
 * DLATEGO SYGNATURA WYMAGA KLIENTA TRANSAKCYJNEGO, a nie prosi o niego w komentarzu.
 */

import type { Prisma } from "@prisma/client";
import type { DomainEventType, DomainEventModule } from "./types";

/**
 * Klient transakcyjny Prismy — jedyne, czym wolno emitować.
 *
 * **`$transaction?: never` nie jest ozdobą, tylko całą siłą tego typu.** Samo
 * `Prisma.TransactionClient` to `PrismaClient` **pomniejszony** o kilka metod, a w typowaniu
 * strukturalnym obiekt z **nadmiarem** pól jest przypisywalny do typu, który ma ich mniej — więc
 * `emitDomainEvent(prisma, …)` przeszłoby przez kompilator bez mrugnięcia. Zakaz „przyjmuj tylko
 * węższe" nie działa, bo szersze **spełnia** węższe.
 *
 * Dopisanie `$transaction?: never` odwraca warunek: pełny klient **ma** tę metodę (funkcja nie jest
 * przypisywalna do `never`), więc odpada; prawdziwy `tx` jej **nie ma**, więc pasuje dalej.
 * Sprawdzone sondą w obie strony, nie założone.
 */
export type TransactionClient = Prisma.TransactionClient & { $transaction?: never };

export interface DomainEventInput {
  /** Przestrzeń, do której należy zdarzenie. Strumień jest strumieniem przestrzeni (rozdz. 11.1). */
  workspaceId: string;
  module: DomainEventModule;
  type: DomainEventType;
  /** KTO wywołał — przy zasobie współdzielonym to pytanie padnie (rozdz. 9.4.1). */
  actorId: string | null;
  payload: Prisma.InputJsonValue;
}

/**
 * Zapisuje zdarzenie w podanej transakcji.
 *
 * Nie zwraca nic i **nie łapie błędów**: gdyby zapis zdarzenia padł, transakcja ma się wycofać
 * razem z mutacją. To dokładnie ta własność, którą sprawdza test wycofania — cichy `catch`
 * zamieniłby cały mechanizm w atrapę.
 */
export async function emitDomainEvent(tx: TransactionClient, event: DomainEventInput): Promise<void> {
  await tx.domainEvent.create({
    data: {
      workspaceId: event.workspaceId,
      module: event.module,
      type: event.type,
      actorId: event.actorId,
      payload: event.payload,
    },
  });
}

/**
 * Przestrzeń, do której należy zdarzenie — albo `null`, gdy nie da się jej ustalić.
 *
 * **Bierzemy przestrzeń ZASOBU, nie autora.** To nie jest szczegół: strumień zdarzeń jest
 * strumieniem przestrzeni (rozdz. 11.1), więc zdarzenie o zasobie **zespołowym** musi trafić do
 * przestrzeni zespołu. Gdyby brało przestrzeń osobistą tego, kto kliknął, zmiana na wspólnej liście
 * wylądowałaby w prywatnym strumieniu autora i **współpracownicy by jej nie zobaczyli** — czyli
 * dokładnie odwrotnie niż wymaga tego rozdz. 9.4.1 („kto to zrobił" ma sens tylko przy współdzieleniu).
 *
 * Przestrzeń osobista autora jest **zachowaniem awaryjnym** dla zasobu bez przestrzeni — sieroty
 * po backfillu z migracji 0227. Konto bez przestrzeni osobistej jest przy tym realne (ta sytuacja
 * wywróciła tabelę prawdy w 056), więc wynik nadal bywa `null`.
 *
 * **`null` oznacza POMINIĘCIE zdarzenia, nigdy błąd mutacji.** Zdarzenie jest dodatkiem do operacji,
 * nie jej warunkiem: wywrócenie zakupów dlatego, że nie dało się zapisać zdarzenia, którego na razie
 * nikt nie czyta, byłoby regresją w zamian za nic.
 *
 * Rozstrzygnięcie mieszka w JEDNYM miejscu, żeby dało się je zmienić jedną zmianą (wzorzec z 057).
 * Przy zadaniu 22 trzeba je zrewidować: gdy zdarzenia zaczną napędzać funkcje, ciche pominięcie
 * stanie się cichą utratą funkcji.
 */
export async function workspaceIdDlaZdarzenia(
  zasobWorkspaceId: string | null | undefined,
  userId: string
): Promise<string | null> {
  if (zasobWorkspaceId) return zasobWorkspaceId;
  const { getAccessContext } = await import("@/platform/sharing/cache");
  const ctx = await getAccessContext(userId);
  return ctx.personalWorkspaceId;
}
