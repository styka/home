/**
 * 073 (zadanie 25, rozdz. 9.5) — PORTFEL REAGUJE NA ZAKOŃCZONE ZAKUPY.
 *
 * **Kierunek strzałki się odwrócił i to jest cały sens tej zmiany.** Dotąd Zakupy importowały
 * `bookAutoExpense` z kontraktu Portfela i wołały go w swojej akcji — moduł kupujący musiał wiedzieć,
 * że w systemie istnieje księgowość. Teraz Zakupy tylko ogłaszają, że lista została zamknięta, a
 * Portfel sam decyduje, czy go to obchodzi. Usunięcie z Portfela nie wymaga już dotknięcia Zakupów.
 *
 * **REGUŁA „tylko przestrzeń osobista" NALEŻY DO PORTFELA, nie do Zakupów.** Wcześniej siedziała
 * w `completeShopping` jako `list.ownerId === user.id` — czyli moduł zakupów pilnował zasady
 * księgowej („nie księgujemy cudzych zakupów na prywatne konto"). Tu jest na swoim miejscu, a
 * przy okazji znika kolejny odczyt `ownerId` (etap 4 zadania 11).
 *
 * **IDEMPOTENCJA — `naturalna`.** `bookAutoExpense` jest idempotentne po parze
 * `(sourceModule, sourceId)`, a `sourceId` to id listy — stabilne między ponowieniami tak samo jak
 * `event.id`. Drugie dostarczenie trafia w istniejący wpis i **aktualizuje go tą samą kwotą**, więc
 * saldo nie drgnie. Nie potrzeba tu klucza z `event.id`: naturalnym kluczem jest sama lista, której
 * nie da się zamknąć dwa razy na dwie różne kwoty bez ponownego zdarzenia — a to i tak byłoby
 * korektą, nie dubletem.
 */

import { prisma } from "@/platform/db/prisma";
import type { EventContribution, EventSubscriber, DomainEventRecord } from "@/platform/events/subscriber";
import { bookAutoExpense } from "./lib/autoExpense";

/** Ładunek `shopping.list.completed` w części, która obchodzi Portfel. */
type ZakupyZakonczone = {
  listId?: string;
  nazwa?: string;
  suma?: number;
  /** Czy użytkownik POPROSIŁ o księgowanie (haczyk w modalu „Zakończ zakupy"). */
  ksiegowac?: boolean;
};

const ksiegujZakupy: EventSubscriber = {
  id: "portfel.ksieguj-zakupy",
  on: ["shopping.list.completed"],
  async handle(event: DomainEventRecord): Promise<void> {
    const ladunek = event.payload as ZakupyZakonczone | null;

    // Auto-księgowanie zakupów jest jawną decyzją użytkownika w modalu, nie domyślnym zachowaniem.
    if (!ladunek?.ksiegowac || !ladunek.listId) return;
    const suma = ladunek.suma ?? 0;
    if (suma <= 0) return;
    if (!event.actorId) return;

    // Zdarzenie systemowe albo zakupy zespołowe — nie księgujemy na prywatne konto sprawcy.
    // Sprawdzenie idzie po przestrzeni, a nie po właścicielu listy, bo przestrzeń jest tym, co
    // zdarzenie niesie ze sobą — subskrybent nie musi dopytywać modułu zakupów o nic.
    const przestrzen = await prisma.workspace.findUnique({
      where: { id: event.workspaceId },
      select: { kind: true, personalUserId: true },
    });
    if (przestrzen?.kind !== "personal" || przestrzen.personalUserId !== event.actorId) return;

    await bookAutoExpense(event.actorId, {
      module: "shopping",
      sourceId: ladunek.listId,
      amount: suma,
      category: "zakupy",
      note: `Zakupy: ${ladunek.nazwa ?? "lista"}`,
      // Data ZDARZENIA, nie `new Date()` — inaczej ponowienie przesunęłoby wydatek na inny dzień
      // i „idempotentna" aktualizacja zmieniłaby dane.
      date: event.createdAt,
      force: true, // jawna decyzja użytkownika w modalu „Zakończ zakupy"
    });
  },
};

const wklad: EventContribution = { subscribers: [ksiegujZakupy] };

export default wklad;
