import { MODULES } from "@/lib/modules";
import { DASHBOARD_CONTRIBUTORS } from "@/lib/dashboardContributors";
import { EMPTY_SNAPSHOT, type DashboardSnapshot } from "@/modules/home/contract";
import type { DashboardContext } from "@/platform/dashboard";

/**
 * 050 — SKŁADANIE MIGAWKI PULPITU.
 *
 * Platforma dostarcza typ wkładu, ale nie wolno jej znać modułów (C-36), więc zbieranie robi się
 * tutaj — obok `src/lib/modules.tsx`, w warstwie, która z definicji zna wszystkich. Listę wkładów
 * trzyma `dashboardContributors.ts` (tam też pomiar, dlaczego jest osobno od `MODULE_SERVER`).
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
  const wkladcy = Object.entries(DASHBOARD_CONTRIBUTORS).filter(([id]) => {
    const modul = MODULES.find((m) => m.id === id);
    // Wkład wskazujący na moduł spoza rejestru NIE jest wołany. Bramka rejestru czyni ten przypadek
    // nieosiągalnym, ale domyślna odpowiedź na „nie wiem, czyj to wkład" musi brzmieć „nie wołaj":
    // gdyby kiedyś bramkę obejść, wersja odwrotna cicho pokazałaby dane bez sprawdzenia uprawnienia.
    if (!modul) return false;
    // `permission: null` = powierzchnia bez uprawnienia modułowego (Raporty) — wołamy zawsze.
    return modul.permission === null || permissions.includes(modul.permission);
  });

  const fragmenty = await Promise.all(
    wkladcy.map(async ([, laduj]) => {
      try {
        const mod = await laduj();
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
