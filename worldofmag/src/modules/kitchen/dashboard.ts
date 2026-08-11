import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getTodaysMeals, getExpiringSoon } from "./contract";

/**
 * 050: wkład Kuchni do migawki pulpitu. Treść przeniesiona z trasy **bez zmiany** — te same
 * wywołania kontraktu, to samo mapowanie i ten sam `try/catch` z wartościami zerowymi.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "todayMeals" | "expiringSoon">> = async () => {
  try {
    const [todayMeals, expiring] = await Promise.all([getTodaysMeals(), getExpiringSoon(3)]);
    return {
      todayMeals: todayMeals.map((m) => ({
        id: m.id,
        slot: m.slot,
        title: m.recipe?.title ?? m.customTitle ?? "—",
        servings: m.servings,
        recipeSlug: m.recipe?.slug ?? null,
      })),
      expiringSoon: expiring.length,
    };
  } catch {
    return { todayMeals: [], expiringSoon: 0 };
  }
};

export default wklad;
