import { MODULE_SERVER } from "@/lib/modules.server";
import { MODULES } from "@/lib/modules";
import { EMPTY_SNAPSHOT, type DashboardSnapshot } from "@/modules/home/contract";
import type { DashboardContext } from "@/platform/dashboard";

/**
 * 050 — KORZEŃ KOMPOZYCJI MIGAWKI PULPITU.
 *
 * Platforma dostarcza typ wkładu, ale nie wolno jej znać modułów (C-36), więc zbieranie robi się
 * tutaj — obok `src/lib/modules.tsx`, w jedynym miejscu, które z definicji zna wszystkich.
 *
 * **Bramkowanie uprawnieniem zostaje po tej stronie i jest WYPROWADZONE Z REJESTRU.** Wcześniej
 * trasa miała dziesięć ręcznych `if (has("module.x"))` — dziś jest jedna pętla czytająca
 * `permission` z deklaracji, więc nie da się pominąć modułu przez przeoczenie. Moduł nie dostaje
 * prawa decydowania o własnej widoczności (C-22).
 *
 * **Moduł z `permission: null` wołamy ZAWSZE.** To nie jest furtka, tylko odwzorowanie stanu
 * faktycznego: Raporty są powierzchnią dostępną każdemu zalogowanemu i dziś nie są bramkowane.
 * Zrzut „bez uprawnień" z T-3 to potwierdził — `recentReports` było tam jedynym niezerowym polem.
 * Bramkowanie ich byłoby cichą zmianą zachowania.
 */
export async function collectDashboardSnapshot(
  userId: string,
  permissions: string[],
  ctx: DashboardContext,
): Promise<DashboardSnapshot> {
  const wkladcy = Object.entries(MODULE_SERVER).filter(([id, server]) => {
    if (!server.dashboard) return false;
    const permission = MODULES.find((m) => m.id === id)?.permission;
    return permission === null || permission === undefined || permissions.includes(permission);
  });

  const fragmenty = await Promise.all(
    wkladcy.map(async ([, server]) => {
      try {
        const mod = await server.dashboard!();
        return await mod.default(userId, ctx);
      } catch {
        // Jeden padnięty wkład nie może wywalić całego pulpitu — dokładnie to robiło osiem
        // osobnych `try/catch` w trasie, tyle że rozsypanych po pliku.
        return {};
      }
    }),
  );

  return Object.assign({ ...EMPTY_SNAPSHOT }, ...fragmenty) as DashboardSnapshot;
}
