import { prisma } from "@/platform/db/prisma";
import { resourceRoleFromLegacy } from "@/platform/workspaces/types";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 060 (Faza 2, zadanie 13 — moduł 2 z 19) — DEKLARACJA ZASOBÓW MODUŁU ZWIERZĘTA (rozdz. 8.4).
 *
 * Drugi moduł po pilocie z 052. Wybrany, bo jako jedyny poza Zadaniami **ma już udostępnianie**
 * (`PetShare`), więc deklaracja od razu ma co wyrażać, zamiast być zapisem na zapas.
 *
 * Moduł mówi dwie rzeczy: jakie ma typy zasobów i **co jego operacje znaczą** w skali czterech ról
 * platformy. Nie definiuje własnych ról i nie pisze reguły dziedziczenia.
 */
export const resources: ResourceCatalog = {
  "pets.pet": {
    label: "Zwierzę",
    operations: {
      // Dzisiejszy guard ma tylko dwa poziomy: `assertPetAccess(id, user)` i `… , true`
      // dla edycji. Odwzorowanie musi być **tak samo płytkie** — dokładanie tu operacji
      // `pet.delete: manager` byłoby zaostrzeniem reguły, której nikt nie zamawiał.
      "pet.read": "viewer",
      "pet.edit": "editor",
    },

    /**
     * **Członek zespołu-właściciela dostaje `manager`, nie `editor`** — i to jest odwzorowanie
     * STANU FAKTYCZNEGO, nie tego, co wydaje się logiczne.
     *
     * Dzisiejszy `assertPetAccess` przy `ownerTeamId` wraca **bez sprawdzania `needEdit`**:
     * członek zespołu może wszystko, co właściciel. Odwzorowanie „na logikę" (`member: "editor"`)
     * **zabrałoby uprawnienia**, których nikt nie kazał zabierać — a przy dwóch dzisiejszych
     * operacjach różnicy i tak by nie było widać, więc wyszłaby dopiero przy trzeciej.
     * Tabela prawdy pilnuje tego osobnym wierszem.
     */
    teamOwnership: { member: "manager", admin: "manager" },

    resolve: async (id) => {
      // 079 (etap 4): własność wyraża wyłącznie przestrzeń — kolumny `ownerId`/`ownerTeamId`
      // zniknęły z tabeli.
      const p = await prisma.pet.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!p) return null;
      return { workspaceId: p.workspaceId };
    },

    /**
     * `PetShare` — dostęp, którego nie wyraża ani własność, ani (jeszcze) nadanie. Zadanie 12
     * przeniesie te wiersze na `ResourceGrant` i wtedy to pole zniknie; do tego czasu deklaracja
     * musi je czytać, inaczej przełączenie guardu **odebrałoby** działające udostępnianie.
     *
     * Udostępnienie ZESPOŁOWI rozwijamy tu na jego członków, bo `extraGrants` mówi językiem
     * „userId → rola". Po migracji na nadania zrobi to `subjectType: "workspace"` i rozwijanie
     * zniknie razem z tą funkcją.
     */
    extraGrants: async (id) => {
      const shares = await prisma.petShare.findMany({
        where: { petId: id },
        select: { userId: true, teamId: true, role: true },
      });
      const wynik: { userId: string; role: "viewer" | "commenter" | "editor" | "manager" }[] = [];
      for (const s of shares) {
        const rola = resourceRoleFromLegacy(s.role);
        if (!rola) continue;
        if (s.userId) {
          wynik.push({ userId: s.userId, role: rola });
        } else if (s.teamId) {
          const czlonkowie = await prisma.teamMember.findMany({
            where: { teamId: s.teamId },
            select: { userId: true },
          });
          for (const c of czlonkowie) wynik.push({ userId: c.userId, role: rola });
        }
      }
      return wynik;
    },
  },
};

export default resources;
