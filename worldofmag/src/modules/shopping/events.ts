/**
 * 071 (zadanie 22) — REAKCJE ZAKUPÓW NA ZDARZENIA DOMENOWE.
 *
 * Pierwszy prawdziwy subskrybent w Omnii (C-35: mechanizm dowozimy razem z konsumentem).
 */

import { notifyUser } from "@/lib/notify";
import { categorize } from "./lib/categorize";
import type { StanZmienionyPayload } from "@/modules/magazynowanie/contract";
import { prisma } from "@/platform/db/prisma";
import type { EventContribution, EventSubscriber, DomainEventRecord } from "@/platform/events/subscriber";

/**
 * Zakupy zakończone → **pozostali** członkowie przestrzeni dostają powiadomienie.
 *
 * To jest pierwsze użycie pola `actorId`, o które chodzi w rozdz. 9.4.1: przy zasobie
 * współdzielonym „kto to zrobił" jest pytaniem, które padnie. Sprawca **nie** dostaje
 * powiadomienia o własnym kliknięciu, a w przestrzeni osobistej nie ma nikogo innego — więc
 * użytkownik pracujący sam nie zobaczy żadnej zmiany.
 *
 * **IDEMPOTENCJA — `klucz-unikalny`.** `notifyUser` robi `upsert` po `@@unique([userId, dedupeKey])`,
 * a klucz wyprowadzamy z **`event.id`**, który jest stabilny między ponowieniami (powstaje przy
 * zapisie zdarzenia, nie przy publikacji). Drugie dostarczenie tego samego zdarzenia trafia w ten
 * sam wiersz i nic nie zmienia — a dostarczenie jest „co najmniej raz" (rozdz. 9.4.4), więc drugie
 * dostarczenie **nastąpi**.
 */
const zakupyZakonczone: EventSubscriber = {
  id: "shopping.powiadom-o-zakonczeniu",
  on: ["shopping.list.completed"],
  async handle(event: DomainEventRecord): Promise<void> {
    const ladunek = event.payload as { nazwa?: string; suma?: number } | null;

    const czlonkowie = await prisma.workspaceMember.findMany({
      where: { workspaceId: event.workspaceId, NOT: { userId: event.actorId ?? "" } },
      select: { userId: true },
      // Ograniczenie wymuszone zapadką paginacji z 068 — i słusznie: bez niego liczba zapisów
      // do `Notification` rośnie z liczbą członków przestrzeni, a subskrybent trzyma w tym czasie
      // blokady wierszy transakcji obiegu. Sto powiadomień to sensowny sufit dla jednej reakcji.
      take: 100,
    });
    if (czlonkowie.length === 0) return;

    const kto = event.actorId
      ? (await prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } }))?.name
      : null;
    const nazwa = ladunek?.nazwa ?? "listę zakupów";

    for (const c of czlonkowie) {
      await notifyUser({
        userId: c.userId,
        module: "shopping",
        title: kto ? `${kto} zakończył zakupy` : "Zakupy zakończone",
        body: `Zamknięto „${nazwa}".`,
        href: "/shopping",
        // Klucz z ID ZDARZENIA — stąd bierze się idempotencja przy ponowieniu.
        dedupeKey: `zdarzenie-${event.id}`,
      });
    }
  },
};

/**
 * 080 (zadanie 25, rozdz. 9.5) — BRAK W MAGAZYNIE → POZYCJA NA LIŚCIE ZAKUPÓW.
 *
 * Druga para reakcji międzymodułowej i pierwsza, w której **odbiorca decyduje o regule**, a nie
 * tylko o skutku. Magazyn ogłasza każdą zmianę stanu i podaje minimum; to Zakupy rozstrzygają, że
 * interesuje je spadek PONIŻEJ minimum i że brak ląduje na liście oznaczonej flagą
 * `autoReplenish`. Magazyn nie wie o istnieniu żadnej listy — a wcześniej wiedział: to on wołał
 * `addLowStockToShoppingList(listId)`.
 *
 * **Bez oznaczonej listy nie dzieje się NIC** — to jest decyzja właściciela, nie awaria. Automat
 * bez wskazanego celu musiałby zgadywać, na którą z list dopisać brak.
 *
 * **IDEMPOTENCJA — `naturalna`.** Reakcja jest „upewnij się, że brak jest na liście", a nie
 * „dopisz brak". Klucz naturalny to (lista, nazwa, status `NEEDED`): dopóki pozycja czeka na
 * kupienie, drugie dostarczenie tego samego zdarzenia — i każdy kolejny spadek tej samej pozycji —
 * trafia w istniejący wiersz i nic nie zmienia. To pokrywa OBIE rzeczy naraz: ponowienie
 * z rozdz. 9.4.4 i wymaganie właściciela („ta sama pozycja nie dubluje się przy kolejnych
 * spadkach"). Klucz z `event.id` byłby tu WĘŻSZY niż trzeba — chroniłby przed ponowieniem, ale nie
 * przed trzema spadkami tej samej pozycji w ciągu dnia.
 */
const uzupelnijBraki: EventSubscriber = {
  id: "shopping.uzupelnij-braki",
  on: ["magazynowanie.stan.zmieniony"],
  async handle(event: DomainEventRecord): Promise<void> {
    // `Partial`, bo `payload` przychodzi z bazy jako `unknown` — typ mówi, czego SIĘ SPODZIEWAMY,
    // a nie co na pewno przyszło. Zdarzenie sprzed zmiany ładunku nie ma nowych pól i ma po prostu
    // nic nie zrobić, zamiast wywalić subskrybenta.
    const ladunek = event.payload as Partial<StanZmienionyPayload> | null;
    const nazwa = ladunek?.nazwa?.trim();
    const minimum = ladunek?.minimum ?? null;
    if (!nazwa || minimum == null) return;

    const stanPo = ladunek?.stanPo ?? 0;
    if (stanPo >= minimum) return;

    // Lista oznaczona w TEJ przestrzeni. `findFirst` wystarcza, bo częściowy indeks unikalny
    // z migracji 0246 gwarantuje, że jest najwyżej jedna.
    const lista = await prisma.shoppingList.findFirst({
      where: { workspaceId: event.workspaceId, autoReplenish: true, archived: false },
      select: { id: true },
    });
    if (!lista) return;

    // Klucz naturalny idempotencji — patrz nagłówek. `mode: "insensitive"`, bo „Mleko" i „mleko"
    // to dla użytkownika ta sama pozycja, a automat nie ma prawa go o tym pouczać.
    const juzCzeka = await prisma.item.findFirst({
      where: { listId: lista.id, status: "NEEDED", name: { equals: nazwa, mode: "insensitive" } },
      select: { id: true },
    });
    if (juzCzeka) return;

    // Ile brakuje do minimum. Ta sama arytmetyka co w ręcznym `addLowStockToShoppingList` —
    // celowo, bo przycisk „dociągnij teraz" zostaje i obie drogi mają dawać to samo.
    const brakuje = Math.max(minimum - stanPo, minimum);

    await prisma.item.create({
      data: {
        listId: lista.id,
        name: nazwa,
        quantity: brakuje,
        unit: ladunek?.jednostka ?? null,
        category: ladunek?.kategoria ?? categorize(nazwa),
      },
    });
  },
};

const wklad: EventContribution = { subscribers: [zakupyZakonczone, uzupelnijBraki] };

export default wklad;
