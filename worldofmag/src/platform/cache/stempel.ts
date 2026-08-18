import { prisma } from "@/platform/db/prisma";

/**
 * 085 (zadanie 29, Faza 5) — STEMPEL PRZESTRZENI: klucz cache'u, który unieważnia się sam.
 *
 * Rozdz. 11.5 opisuje cache agregatów z unieważnianiem **zdarzeniem** („dowolne zdarzenie
 * z przestrzeni użytkownika") i dodaje, że jest możliwy dopiero po Fazie 4 — bo wcześniej nie było
 * czym unieważniać. Zdarzenia są (070–073), ale kanał wypychania ma jedno ograniczenie, którego
 * nie da się obejść w tym wdrożeniu: **`revalidateTag` unieważnia cache TEJ instancji**. Przy
 * dwóch instancjach `web` mutacja obsłużona przez pierwszą zostawiłaby drugą ze starym agregatem —
 * objaw „u niektórych nie odświeża się pulpit", ten sam, przed którym ostrzega rozdz. 11.9.
 *
 * Dlatego unieważnianie jest **wciągnięte do klucza**, a nie wypychane do cache'u. Stempel to
 * „ostatnie zdarzenie w moich przestrzeniach": zmienia się przy każdej mutacji, która ogłosiła
 * zdarzenie, więc stary wpis przestaje być adresowalny **we wszystkich instancjach naraz**.
 * Nikt nie musi nikogo powiadamiać.
 *
 * **Czego stempel nie widzi.** Mutacja, która NIE ogłasza zdarzenia (a takich jest dziś większość —
 * producentów zdarzeń jest kilku), nie ruszy stempla. Dlatego cache trzymany na stemplu ma zawsze
 * KRÓTKI czas życia jako siatkę — dokładnie tak, jak `DataFreshness` zachowało pięciominutowe
 * odpytywanie awaryjne mimo działającego strumienia (072/zadanie 24). Cache bez tej siatki
 * pokazywałby nieaktualne dane do następnego zdarzenia, czyli potencjalnie godzinami.
 */

/** Sekundy życia agregatu, gdy stempel się nie zmienił. Siatka na mutacje bez zdarzenia. */
export const TTL_AGREGATU_SEK = 60;

/**
 * Zwraca krótki tekst zmieniający się przy każdym nowym zdarzeniu w podanych przestrzeniach.
 *
 * Jedno zapytanie agregujące po indeksie `[workspaceId, createdAt]`. Bierzemy **znacznik ostatniego
 * zdarzenia i ich liczbę**, a nie sam znacznik: dwa zdarzenia zapisane w tej samej milisekundzie
 * (a `createdAt` ma dokładność milisekundy) dałyby ten sam stempel, więc drugie byłoby niewidoczne.
 */
export async function stempelPrzestrzeni(workspaceIds: string[]): Promise<string> {
  if (workspaceIds.length === 0) return "pusto";
  const agg = await prisma.domainEvent.aggregate({
    where: { workspaceId: { in: workspaceIds } },
    _max: { createdAt: true },
    _count: { _all: true },
  });
  return `${agg._max.createdAt?.getTime() ?? 0}-${agg._count._all}`;
}
