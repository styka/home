import { prisma } from "@/platform/db/prisma";
import { workspaceRoleFromTeamRole, type WorkspaceMemberRole } from "./types";

/**
 * Faza 2 przebudowy, zadanie 9 — LUSTRO PRZESTRZENI.
 *
 * Przez okres przejściowy `Team`/`TeamMember` pozostają **źródłem prawdy**, a przestrzenie są ich
 * lustrem. Kierunek jest jednostronny i to jest świadome: odwrócenie go oznaczałoby przełączenie
 * odczytów, czyli zadanie 11.
 *
 * **Uzgadnianie JEST detektorem rozjazdu.** Każda funkcja zwraca liczbę wprowadzonych zmian, więc
 * „druga próba zwróciła zero" jest jednocześnie dowodem idempotencji i dowodem, że lustro się nie
 * rozjechało. Osobne API „sprawdź, czy jest rozjazd" byłoby drugą interpretacją tej samej reguły —
 * a dwie interpretacje rozjeżdżają się dokładnie tak, jak dwa źródła prawdy.
 *
 * **Bez guardów dostępu — celowo.** Te funkcje wołają akcje, które uprawnienie już sprawdziły
 * (`requireTeamRole`), oraz zdarzenie tworzenia konta, gdzie sesji **jeszcze nie ma**. Guard
 * w środku byłby albo martwy, albo blokowałby zakładanie konta. Odpowiedzialność za dostęp zostaje
 * w wołającym — tak samo jak w `platform/trash`.
 */

export interface WynikUzgodnienia {
  utworzone: number;
  zaktualizowane: number;
  usuniete: number;
}

const PUSTY: WynikUzgodnienia = { utworzone: 0, zaktualizowane: 0, usuniete: 0 };

function suma(...w: WynikUzgodnienia[]): WynikUzgodnienia {
  return w.reduce(
    (a, b) => ({
      utworzone: a.utworzone + b.utworzone,
      zaktualizowane: a.zaktualizowane + b.zaktualizowane,
      usuniete: a.usuniete + b.usuniete,
    }),
    PUSTY,
  );
}

/** Przestrzeń osobista użytkownika. Idempotentne — wołane przy każdym zakładaniu konta. */
export async function ensurePersonalWorkspace(userId: string): Promise<WynikUzgodnienia> {
  const istnieje = await prisma.workspace.findUnique({
    where: { personalUserId: userId },
    select: { id: true, members: { where: { userId }, select: { role: true } } },
  });

  if (!istnieje) {
    await prisma.workspace.create({
      data: {
        kind: "personal",
        name: "Moja przestrzeń",
        personalUserId: userId,
        members: { create: { userId, role: "owner" } },
      },
    });
    return { ...PUSTY, utworzone: 1 };
  }

  // Przestrzeń jest, ale bez wiersza właściciela albo z inną rolą — to jest rozjazd i naprawiamy go.
  const rola = istnieje.members[0]?.role;
  if (rola === "owner") return PUSTY;
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: istnieje.id, userId } },
    create: { workspaceId: istnieje.id, userId, role: "owner" },
    update: { role: "owner" },
  });
  return { ...PUSTY, zaktualizowane: 1 };
}

/**
 * Przestrzeń zespołu: istnienie, nazwa i skład.
 *
 * **Właściciel zespołu dochodzi osobno, po członkach.** `Team.ownerId` jest niezależny od tabeli
 * `TeamMember` — nic nie wymusza, żeby właściciel miał tam wiersz. Odwzorowanie „po członkach"
 * wygląda na kompletne i po cichu gubi właściciela; ten sam błąd czyhał w SQL-u backfillu.
 */
export async function syncTeamWorkspace(teamId: string): Promise<WynikUzgodnienia> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
      members: { select: { userId: true, role: true } },
    },
  });
  // Zespołu nie ma — przestrzeń zniknęła razem z nim kaskadą klucza obcego, nie ma czego robić.
  if (!team) return PUSTY;

  let utworzone = 0;
  let zaktualizowane = 0;

  let workspace = await prisma.workspace.findUnique({
    where: { teamId },
    select: { id: true, name: true },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { kind: "team", name: team.name, teamId, createdAt: team.createdAt },
      select: { id: true, name: true },
    });
    utworzone += 1;
  } else if (workspace.name !== team.name) {
    await prisma.workspace.update({ where: { id: workspace.id }, data: { name: team.name } });
    zaktualizowane += 1;
  }

  // Docelowy skład: członkowie z mapowaniem ról, a na wierzchu właściciel.
  const docelowe = new Map<string, WorkspaceMemberRole>();
  for (const m of team.members) docelowe.set(m.userId, workspaceRoleFromTeamRole(m.role));
  docelowe.set(team.ownerId, "owner");

  const obecne = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    select: { userId: true, role: true },
  });
  const obecneMapa = new Map(obecne.map((m) => [m.userId, m.role]));

  for (const [userId, role] of Array.from(docelowe.entries())) {
    const teraz = obecneMapa.get(userId);
    if (teraz === role) continue;
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      create: { workspaceId: workspace.id, userId, role },
      update: { role },
    });
    if (teraz === undefined) utworzone += 1;
    else zaktualizowane += 1;
  }

  const doUsuniecia = obecne.filter((m) => !docelowe.has(m.userId)).map((m) => m.userId);
  if (doUsuniecia.length > 0) {
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: workspace.id, userId: { in: doUsuniecia } },
    });
  }

  return { utworzone, zaktualizowane, usuniete: doUsuniecia.length };
}

/**
 * Uzgadnia wskazany zakres (albo wszystko) i **zwraca liczbę zmian**.
 *
 * Zero zmian = lustro jest spójne ze źródłem. To jest jedyny detektor rozjazdu w systemie i jedyny
 * sposób jego naprawy — świadomie ta sama funkcja.
 */
export async function reconcileWorkspaces(zakres?: {
  userIds?: string[];
  teamIds?: string[];
}): Promise<WynikUzgodnienia> {
  const userIds =
    zakres?.userIds ?? (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
  const teamIds =
    zakres?.teamIds ?? (await prisma.team.findMany({ select: { id: true } })).map((t) => t.id);

  const wyniki: WynikUzgodnienia[] = [];
  for (const userId of userIds) wyniki.push(await ensurePersonalWorkspace(userId));
  for (const teamId of teamIds) wyniki.push(await syncTeamWorkspace(teamId));
  return suma(...wyniki);
}
