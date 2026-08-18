import { prisma } from "@/platform/db/prisma";
import type { ResourceCatalog } from "@/platform/sharing/types";

/**
 * 095 (zadanie 13, moduł 5 z 5 + zadanie 14) — DEKLARACJA ZASOBÓW NOTATEK.
 *
 * Notatki były do tej pory sklasyfikowane jako `zakres`: `assertNoteAccess` sprowadzał się do
 * pytania „czy ta notatka jest w mojej przestrzeni". Klasyfikacja mówiła wprost, że deklaracja
 * dojdzie razem z udostępnianiem — i to jest ten moment. Pytanie kontrolne z rozdz. 14 brzmi
 * dosłownie: *„Czy da się udostępnić notatkę, listę zakupów i przepis — tym samym oknem?"*.
 * Dla notatki odpowiedź brzmiała „nie", bo bez deklaracji `ShareDialog` nie ma czego zapytać.
 *
 * **Odwzorowanie ról jest PŁYTKIE — i to jest zgodność ze stanem faktycznym, nie uproszczenie.**
 * Dzisiejszy guard nie odróżnia odczytu od zapisu: kto ma dostęp do notatki, ten może wszystko.
 * Dlatego `teamOwnership` daje `manager` obu rodzajom członków — `editor` zabrałby prawa, których
 * dziś nikt nikomu nie odbiera. Rozróżnienie `viewer`/`editor` zaczyna działać dopiero dla NADAŃ,
 * czyli tam, gdzie wcześniej nie było niczego.
 *
 * Notatka nie ma rodzica: `NoteGroup` to słownik (jedna z pięciu tabel z `workspace-nullable.json`,
 * z wierszami systemowymi bez właściciela), a nie zasób. Uczynienie go rodzicem oznaczałoby, że
 * udostępnienie folderu systemowego udostępnia cudze notatki.
 */
export const resources: ResourceCatalog = {
  "notes.note": {
    label: "Notatka",
    operations: {
      "note.read": "viewer",
      "note.edit": "editor",
    },
    teamOwnership: { member: "manager", admin: "manager" },
    resolve: async (id) => {
      const n = await prisma.note.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (!n) return null;
      return { workspaceId: n.workspaceId };
    },
  },
};

export default resources;
