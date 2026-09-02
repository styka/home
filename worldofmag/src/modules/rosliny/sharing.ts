import { prisma } from "@/platform/db/prisma";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 113 — DEKLARACJA ZASOBÓW MODUŁU ROŚLINY.
 *
 * Moduł mówi dwie rzeczy: **jakie ma typy zasobów** i **co jego operacje znaczą** w skali czterech
 * ról platformy. Nie definiuje własnych ról i **nie pisze własnej reguły dziedziczenia** (C-17).
 *
 * **Dlaczego dwa typy, a nie jeden.** Przestrzeń jest tym, co użytkownik realnie udostępnia
 * („mój ogród widzi żona", „opiekun podlewa kwiaty przez tydzień" — patrz `badania.md`, poziom 8:
 * to jest cała treść, jaką z poziomu „społeczność" da się w Omnii zrealizować, i realizujemy ją
 * mechaniką, która już istnieje). Roślina jest osobnym typem **wyłącznie po to, żeby mieć rodzica**:
 * dzięki `parent` platforma sama wyprowadza dostęp do rośliny z dostępu do przestrzeni. Gdyby
 * roślina nie była zasobem, guard rośliny musiałby sam sięgać do przestrzeni — czyli moduł pisałby
 * własną regułę dziedziczenia, czego C-17 zakazuje wprost.
 *
 * **Odwzorowanie ról jest PŁYTKIE i to jest zgodność ze stanem faktycznym, nie uproszczenie.**
 * Guard modułu ma dwa poziomy (`read` i `edit`), więc deklaracja ma dwie operacje. Dołożenie tu
 * `plant.delete: manager` byłoby zaostrzeniem reguły, której nikt nie zamawiał — a przy dwóch
 * dzisiejszych operacjach różnicy i tak nie byłoby widać, więc wyszłaby dopiero przy trzeciej.
 *
 * **`teamOwnership` daje `manager` obu rodzajom członków** — tak jak w Zwierzętach i Notatkach.
 * To odwzorowanie STANU FAKTYCZNEGO: dziś członek zespołu-właściciela może w module wszystko, co
 * właściciel. Odwzorowanie „na logikę" (`member: "editor"`) **zabrałoby uprawnienia**, których
 * nikt nie kazał zabierać.
 */
export const resources: ResourceCatalog = {
  "rosliny.space": {
    label: "Przestrzeń roślinna",
    operations: {
      "space.read": "viewer",
      "space.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      const s = await prisma.plantSpace.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!s) return null;
      return { workspaceId: s.workspaceId };
    },
  },

  "rosliny.plant": {
    label: "Roślina",
    operations: {
      "plant.read": "viewer",
      "plant.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      const p = await prisma.plant.findUnique({
        where: { id },
        select: { workspaceId: true, spaceId: true },
      });
      if (!p) return null;
      // Rodzic jest jedynym miejscem, w którym moduł mówi cokolwiek o dziedziczeniu — resztę
      // (kolejność rozstrzygania, łańcuch rodziców, nadania) robi platforma.
      return { workspaceId: p.workspaceId, parent: { type: "rosliny.space", id: p.spaceId } };
    },
  },
};

export default resources;
