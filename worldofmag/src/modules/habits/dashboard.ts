import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getHabits } from "./actions/habits";

/**
 * 115 (Z-INT-17): wkład Nawyków do migawki pulpitu — „N z M odhaczonych dziś".
 *
 * Liczymy tak jak loader modułu (`getHabits` z jego `dataWStrefie`): dzisiejsze = zaplanowane na
 * dziś LUB już dziś odhaczone (nawyk z celem tygodniowym odhaczony dziś przestaje być
 * „zaplanowany", a odhaczenie nadal ma się liczyć do licznika).
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "habitsTodayDone" | "habitsTodayTotal">> = async () => {
  try {
    const habits = await getHabits();
    const dzisiejsze = habits.filter((h) => !h.archived && (h.scheduledToday || h.completedToday));
    return {
      habitsTodayTotal: dzisiejsze.length,
      habitsTodayDone: dzisiejsze.filter((h) => h.completedToday).length,
    };
  } catch {
    return { habitsTodayDone: 0, habitsTodayTotal: 0 };
  }
};

export default wklad;
