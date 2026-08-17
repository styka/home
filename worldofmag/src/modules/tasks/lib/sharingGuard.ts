import { requireAccess as requireAccessPlatform } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import type { ResourceRef } from "@/platform/sharing/types";
import { prisma } from "@/platform/db/prisma";
import resources from "../sharing";

/**
 * 052 — wejście modułu Zadania do wspólnego sprawdzania dostępu.
 *
 * **Dlaczego moduł NIE woła `@/lib/sharing`.** Tamto jest korzeniem kompozycji — zna wszystkie
 * moduły. Sięgnięcie po niego z wnętrza modułu odwróciłoby zależność (moduł → korzeń → wszystkie
 * moduły) i wciągnęłoby deklaracje zasobów całej aplikacji do grafu Zadań. To jest dokładnie ten
 * błąd, który w 049 spowolnił kompilację każdej trasy dwukrotnie.
 *
 * Moduł podaje więc **własny** katalog (import względny — C-02/C-36). Wystarcza, bo cały łańcuch
 * dziedziczenia Zadań (`tasks.task` → `tasks.project`) mieści się w tym module.
 *
 * **Granica tego rozwiązania, nazwana zawczasu:** gdy pojawi się zasób, którego rodzic mieszka
 * w INNYM module, ten wariant przestanie wystarczać — i będzie to znak, że wołający należy do
 * warstwy kompozycji, a nie że trzeba tu dokleić import korzenia.
 */
export async function requireTaskModuleAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
): Promise<void> {
  const ctx = await getAccessContext(userId);
  await requireAccessPlatform(userId, ref, operation, resources, ctx);
}

/**
 * Identyfikatory projektów, w których użytkownik może działać — **zakres list**.
 *
 * Sprawdzanie pojedynczego zasobu i zawężanie listy to dwie różne operacje, ale muszą wynikać
 * z **tej samej reguły**; trzymamy je więc obok siebie. Gdyby zakres list mieszkał w warstwie AI
 * (jak przed 052), rozjechałby się z `requireAccess` przy pierwszej zmianie reguły — i objawiłoby
 * się to listą pokazującą coś, czego nie wolno otworzyć.
 */
export async function accessibleProjectIds(userId: string): Promise<string[]> {
  // 053: projekty zespołu MUSZĄ tu być, odkąd członek zespołu może w nich pracować. Inaczej lista
  // i sprawdzanie dostępu rozjeżdżają się w najgorszą stronę: użytkownik ma prawo działać
  // w projekcie, którego nie widzi — a asystent twierdzi, że taki projekt nie istnieje.
  //
  // 056: gałąź zespołowa idzie po PRZESTRZENIACH, nie po `ctx.teamIds`. Rozstrzyganie dostępu
  // czyta od tego przebiegu `workspaceId`, więc lista licząca zespoły z `TeamMember` pomijałaby
  // dokładnie ten przypadek, który 056 naprawia: **właściciela zespołu bez wiersza członkostwa**.
  // Byłaby to ta sama asymetria, którą opisuje akapit wyżej, tylko dla innej osoby.
  //
  // Bierzemy wyłącznie przestrzenie, w których moja rola cokolwiek daje — `guest` nie dostaje
  // dostępu w `rolaZWlasnosci`, więc nie może dostać wiersza na liście. Lista ma być tym samym
  // zbiorem, co dostęp, a nie jego nadzbiorem.
  const ctx = await getAccessContext(userId);
  const przestrzenie = Object.entries(ctx.workspaceRoles)
    .filter(([, rola]) => rola !== "guest")
    .map(([id]) => id);
  const projekty = await prisma.taskProject.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        ...(przestrzenie.length > 0 ? [{ workspaceId: { in: przestrzenie } }] : []),
        // 075: gałąź awaryjna dla SIEROT (rekord bez przestrzeni) ZNIKŁA — zgodnie z zapowiedzią
        // z 056. Etap 4 zaostrzył `TaskProject.workspaceId` do NOT NULL, więc warunek
        // `workspaceId: null` dopasowywał odtąd pusty zbiór: martwy kod, który TypeScript zaczął
        // zresztą odrzucać. Uwaga: bliźniacza gałąź w `rolaZWlasnosci` (platform/sharing/access.ts)
        // ZOSTAJE — tam obsługuje cztery tabele słownikowe, w których `workspaceId` jest nadal
        // nullowalne z rozmysłem (rekord systemowy nie należy do żadnej przestrzeni).
      ],
    },
    select: { id: true },
  });
  return projekty.map((p) => p.id);
}
