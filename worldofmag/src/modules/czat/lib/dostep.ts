import { prisma } from "@/platform/db/prisma";

/**
 * 107 — GUARDY MODUŁU CZAT.
 *
 * Dostęp do rozmowy rozstrzyga **uczestnictwo**, a nie własność: rozmowa nie ma właściciela, ma
 * uczestników. Dlatego nie idziemy tu przez `platform/sharing` — tam mieszkają role
 * viewer/commenter/editor/manager, a w rozmowie albo się jest, albo nie ma się jej wcale widzieć.
 *
 * Guard jest w KAŻDEJ akcji, nie tylko w widoku. Interfejs nie pokazuje przycisku edycji przy
 * cudzej wiadomości, ale akcję da się wywołać wprost — i wtedy jedyną obroną jest to sprawdzenie
 * (AC-21, AC-24).
 */

/** Rzuca, gdy użytkownik nie jest uczestnikiem rozmowy. Zwraca jego wiersz uczestnictwa. */
export async function assertUczestnik(userId: string, rozmowaId: string) {
  const uczestnictwo = await prisma.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId: rozmowaId, userId } },
  });
  // Ten sam komunikat co dla rozmowy nieistniejącej — inaczej odpowiedź serwera mówiłaby, że
  // rozmowa o tym identyfikatorze istnieje, a to już jest informacja o cudzych danych.
  if (!uczestnictwo) throw new Error("Rozmowa nie istnieje");
  return uczestnictwo;
}

/** Rzuca, gdy wiadomość nie należy do użytkownika albo już jej nie ma. Zwraca ją. */
export async function assertAutor(userId: string, wiadomoscId: string) {
  const wiadomosc = await prisma.chatMessage.findUnique({ where: { id: wiadomoscId } });
  if (!wiadomosc || wiadomosc.deletedAt) throw new Error("Wiadomość nie istnieje");
  if (wiadomosc.autorId !== userId) throw new Error("To nie jest Twoja wiadomość");
  return wiadomosc;
}

/**
 * Rzuca, gdy z tą osobą nic mnie nie łączy.
 *
 * „Łączy” znaczy: **wspólny zespół** albo **nadanie dostępu do zasobu** w którąkolwiek stronę.
 * Bez tego warunku lista rozmówców byłaby katalogiem wszystkich kont w systemie, a możliwość
 * napisania do dowolnego konta to zupełnie inna decyzja produktowa niż czat dla domowników
 * (AC-15).
 */
export async function assertMozeRozmawiac(userId: string, drugiId: string): Promise<void> {
  if (userId === drugiId) throw new Error("Nie można rozmawiać z samym sobą");
  const powiazani = await idPowiazanychOsob(userId);
  if (!powiazani.has(drugiId)) throw new Error("Z tą osobą nic Cię nie łączy");
}

/**
 * Identyfikatory osób, z którymi użytkownika coś łączy.
 *
 * Wspólne zespoły czytamy przez przestrzenie (`WorkspaceMember`), bo to one są dziś nośnikiem
 * przynależności; nadania zasobów dokładają osoby spoza zespołu, którym coś udostępniłem albo
 * które udostępniły coś mnie.
 */
export async function idPowiazanychOsob(userId: string): Promise<Set<string>> {
  // paginacja: kompletny — zbiór wyznacza, z KIM wolno rozmawiać; ucięcie byłoby cichą odmową.
  const moje = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  const workspaceIds = moje.map((m) => m.workspaceId);

  // paginacja: kompletny — jw.
  const wspolnicy = workspaceIds.length
    ? await prisma.workspaceMember.findMany({
        where: { workspaceId: { in: workspaceIds }, userId: { not: userId } },
        select: { userId: true },
      })
    : [];

  // paginacja: kompletny — jw.
  const nadaneMi = await prisma.resourceGrant.findMany({
    where: { subjectType: "user", subjectId: userId },
    select: { createdById: true },
  });

  // paginacja: kompletny — jw.
  const nadanePrzezeMnie = await prisma.resourceGrant.findMany({
    where: { subjectType: "user", createdById: userId },
    select: { subjectId: true },
  });

  const out = new Set<string>();
  for (const w of wspolnicy) out.add(w.userId);
  for (const g of nadaneMi) if (g.createdById) out.add(g.createdById);
  for (const g of nadanePrzezeMnie) if (g.subjectId) out.add(g.subjectId);
  out.delete(userId);
  return out;
}
