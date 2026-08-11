import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getCareAgenda } from "./contract";

/**
 * 050: wkład Zwierząt do migawki pulpitu. Treść przeniesiona z trasy **bez zmiany** — te same
 * wywołania kontraktu, to samo mapowanie i ten sam `try/catch` z wartościami zerowymi.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "petCareDue" | "petAgenda">> = async () => {
  try {
    const agenda = await getCareAgenda();
    return {
      petCareDue: agenda.filter((a) => a.bucket === "OVERDUE" || a.bucket === "TODAY").length,
      petAgenda: agenda.slice(0, 4),
    };
  } catch {
    return { petCareDue: 0, petAgenda: [] };
  }
};

export default wklad;
