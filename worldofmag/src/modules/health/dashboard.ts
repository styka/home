import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getHealthEvents } from "./contract";

/**
 * 050: wkład Zdrowia do migawki pulpitu — nadchodzące wizyty i badania.
 *
 * Treść przeniesiona z trasy **bez zmiany**: ten sam zakres `upcoming`, to samo odsianie
 * odwołanych, licznik liczony **przed** obcięciem listy do czterech pozycji.
 */
const wklad: DashboardContributor<
  Pick<DashboardSnapshot, "healthUpcomingCount" | "healthUpcoming">
> = async () => {
  try {
    const events = await getHealthEvents({ scope: "upcoming" });
    const planned = events.filter((e) => e.status !== "CANCELLED");
    return {
      healthUpcomingCount: planned.length,
      healthUpcoming: planned.slice(0, 4).map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        specialty: e.specialty,
        scheduledAt: new Date(e.scheduledAt).toISOString(),
      })),
    };
  } catch {
    return { healthUpcomingCount: 0, healthUpcoming: [] };
  }
};

export default wklad;
