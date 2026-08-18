import { prisma } from "@/platform/db/prisma";
import { brakujaceWzgledemNadan } from "@/platform/sharing/lustroOdczyt";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 052 (Faza 2, zadanie 10) — DEKLARACJA ZASOBÓW MODUŁU ZADANIA (rozdz. 8.4).
 *
 * Moduł mówi tylko dwie rzeczy: jakie ma typy zasobów i **co jego operacje znaczą** w skali
 * czterech ról platformy. **Nie definiuje własnych ról** i nie pisze reguły dziedziczenia —
 * podaje rodzica, a resztę robi `platform/sharing`.
 *
 * Odwzorowanie dzisiejszych ról projektu: `OWNER`/`ADMIN` → `manager`, `MEMBER` → `editor`,
 * właściciel projektu (`ownerId`) → `manager`.
 */

/**
 * **WŁASNOŚĆ ZESPOŁOWA NIE JEST TU MAPOWANA — i to jest decyzja, nie przeoczenie.**
 *
 * `TaskProject` ma kolumnę `ownerTeamId`, ale ani dzisiejszy guard zapisu (`assertProjectAccess`),
 * ani ścieżka odczytu asystenta (`accessibleProjectIds`) jej nie czytają: obie patrzą wyłącznie na
 * `ownerId` i `TaskProjectMember`. Punkt odniesienia z 052/T-1 to potwierdził — projekt należący
 * do zespołu jest dziś niedostępny **dla nikogo**, łącznie z właścicielem zespołu.
 *
 * Uznanie tu własności zespołowej „bo tak jest logiczniej" byłoby **poszerzeniem uprawnień ukrytym
 * w przebudowie uprawnień** — czyli dokładnie tą zmianą, której w takim przebiegu nie da się
 * odróżnić od błędu. Zachowujemy stan faktyczny; rozbieżność jest zgłoszona osobno jako rzecz
 * do decyzji właściciela.
 */
export const resources: ResourceCatalog = {
  "tasks.project": {
    label: "Projekt zadań",
    operations: {
      "project.read": "viewer",
      "task.create": "editor",
      "task.edit": "editor",
      "task.delete": "editor",
      "project.rename": "manager",
      "project.delete": "manager",
      "project.share": "manager",
    },
    children: ["tasks.task"],
    // 053: projekt należący do zespołu przestaje być martwy. Do 052 kolumna `ownerTeamId` nie
    // dawała NIKOMU niczego — także właścicielowi zespołu — więc taki projekt był widoczny
    // i bezużyteczny. Stopniowanie: członek pracuje w projekcie, właściciel/admin nim zarządza.
    teamOwnership: { member: "editor", admin: "manager" },
    resolve: async (id) => {
      const p = await prisma.taskProject.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!p) return null;
      // 079 (etap 4): własność wyraża WYŁĄCZNIE przestrzeń. Para `ownerId`/`ownerTeamId` znikła
      // z tabeli, a to, czego broniła jako droga awaryjna (właściciel bez wiersza członkostwa
      // w swojej przestrzeni), przeniosło się do `getAccessContext`: przestrzeń osobistą czyta
      // się po `Workspace.personalUserId`, a nie po członkostwie.
      return { workspaceId: p.workspaceId };
    },
    extraGrants: async (id) => {
      const czlonkowie = await prisma.taskProjectMember.findMany({
        where: { projectId: id },
        select: { userId: true, role: true },
      });
      // 093 (zadanie 12, etap 2): źródłem prawdy są NADANIA — z tabeli członkostwa dokładamy tylko
      // to, czego w nadaniach brakuje, i zgłaszamy każdy taki brak metryką (patrz `lustroOdczyt.ts`).
      return brakujaceWzgledemNadan(
        "tasks.project",
        id,
        czlonkowie.map((m) => ({
          userId: m.userId,
          role: m.role === "MEMBER" ? ("editor" as const) : ("manager" as const),
        })),
      );
    },
  },

  "tasks.task": {
    label: "Zadanie",
    operations: {
      "task.read": "viewer",
      "task.edit": "editor",
      "task.delete": "editor",
    },
    resolve: async (id) => {
      const t = await prisma.task.findUnique({
        where: { id },
        select: { projectId: true, createdById: true },
      });
      if (!t) return null;
      // Zadanie W PROJEKCIE nie ma własnego właściciela — o dostępie decyduje WYŁĄCZNIE projekt.
      // To nie jest uproszczenie: dzisiejszy `assertTaskAccess` przy `projectId` w ogóle nie patrzy
      // na twórcę ani przypisanego. Gdyby tu ustawić `ownerId: createdById`, twórca zachowałby
      // dostęp po wypisaniu z projektu — czyli dostałby więcej niż dziś.
      if (t.projectId) {
        return { parent: { type: "tasks.project", id: t.projectId } };
      }
      // 079: `Task` nie ma i nie będzie mieć kolumny przestrzeni — jego własność jest
      // WYPROWADZONA. To ostatnie miejsce, w którym `facts.ownerId` niesie prawdziwą informację;
      // wszędzie indziej własność wyraża `workspaceId`.
      return { ownerId: t.createdById };
    },
    extraGrants: async (id) => {
      // Osoba PRZYPISANA do zadania bez projektu — dostęp, którego nie wyraża ani własność, ani
      // nadanie. Dla zadania w projekcie nie ma zastosowania (decyduje projekt), więc nie dokładamy
      // go tam, żeby nie poszerzyć dostępu.
      const t = await prisma.task.findUnique({
        where: { id },
        select: { projectId: true, assigneeId: true },
      });
      if (!t || t.projectId || !t.assigneeId) return [];
      return [{ userId: t.assigneeId, role: "editor" as const }];
    },
  },
};

export default resources;
