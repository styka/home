import { prisma } from "@/platform/db/prisma";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { createList } from "../actions/lists";

/**
 * 049: „znajdź listę zakupów albo ją utwórz" — logika **Zakupów**, nie asystenta.
 *
 * Mieszkała we wspólnym pliku egzekutorów AI (`lib/ai/executors/shared.ts`) i była jedynym
 * powodem, dla którego ten plik importował kontrakt Zakupów. Po regule przynależności
 * (lista konsumentów, nie nazwa katalogu) miejsce jest tutaj: rozstrzyganie, która lista jest
 * „tą właściwą" i co zrobić, gdy użytkownik nie ma żadnej, to decyzja modułu Zakupy.
 *
 * Konsumenci spoza modułu (egzekutory Kuchni i Magazynowania) sięgają po to przez kontrakt —
 * i dobrze, bo dzięki temu widać, że oba moduły zależą od Zakupów. Kuchnia już zależy
 * (`assertListAccess`), więc to nie jest nowe sprzężenie, tylko ujawnione.
 */
export async function resolveOrCreateList(
  userId: string,
  opts: { listId?: string; listName?: string; activeListId?: string },
): Promise<{ id: string; name: string }> {
  const teamIds = await getUserTeamIds(userId);
  const ownerOr = teamIds.length > 0 ? [{ ownerId: userId }, { ownerTeamId: { in: teamIds } }] : [{ ownerId: userId }];

  let list =
    (opts.listId && (await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.listId } }))) || null;
  if (!list && opts.listName) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, name: { contains: opts.listName, mode: "insensitive" } } });
  }
  if (!list && opts.activeListId) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr, id: opts.activeListId } });
  }
  if (!list) {
    list = await prisma.shoppingList.findFirst({ where: { OR: ownerOr }, orderBy: { createdAt: "asc" } });
  }
  if (!list) {
    const created = await createList("Zakupy");
    return { id: created.id, name: created.name };
  }
  return { id: list.id, name: list.name };
}
