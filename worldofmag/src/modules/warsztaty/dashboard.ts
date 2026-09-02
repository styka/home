import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot, WorkshopDueItem } from "../home/contract";
import { getMaintenanceOverview } from "./actions/warsztat";

/**
 * 115 (Z-INT-17): wkład Warsztatów do migawki pulpitu — najbliższe przeglądy sprzętu
 * i liczba materiałów na wyczerpaniu. Te same zapytania co agenda `/warsztaty/przeglady`
 * (`getMaintenanceOverview`), obcięte do czterech pozycji jak alarmy Floty.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "workshopDue" | "workshopLowStock">> = async () => {
  try {
    const { due, lowStock } = await getMaintenanceOverview();
    const workshopDue: WorkshopDueItem[] = due.slice(0, 4).map((i) => ({
      id: i.id,
      name: i.name,
      workshopName: i.workshopName,
      dueAt: i.nextServiceAt ? new Date(i.nextServiceAt).toISOString() : null,
      overdue: i.overdue,
    }));
    return { workshopDue, workshopLowStock: lowStock.length };
  } catch {
    return { workshopDue: [], workshopLowStock: 0 };
  }
};

export default wklad;
