import type { DashboardContributor, DashboardContext } from "@/platform/dashboard";
import type { DashboardSnapshot, VehicleAlert } from "../home/contract";
import { getVehicles } from "./contract";

/**
 * 050: wkład Floty do migawki pulpitu — liczba pojazdów i alarmy przeglądu/ubezpieczenia.
 *
 * Treść przeniesiona z trasy **bez zmiany**: ten sam horyzont 30 dni liczony od **początku dnia**
 * (nie od „teraz" — inaczej alarm na dziś dawałby ujemną liczbę godzin), ta sama para sprawdzeń na
 * pojazd, to samo sortowanie rosnąco po `daysLeft` i to samo obcięcie do czterech pozycji.
 * `daysLeft` może wyjść ujemny — termin po czasie też jest alarmem i tak było dotąd.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "vehiclesCount" | "vehicleAlerts">> = async (
  _userId,
  ctx: DashboardContext,
) => {
  try {
    const vehicles = await getVehicles();
    const horizon = 30;
    let vehicleAlerts: VehicleAlert[] = [];
    for (const v of vehicles) {
      const checks: Array<["inspection" | "insurance", Date | null]> = [
        ["inspection", v.inspectionDue],
        ["insurance", v.insuranceDue],
      ];
      for (const [type, due] of checks) {
        if (!due) continue;
        const daysLeft = Math.ceil((new Date(due).getTime() - ctx.todayStart.getTime()) / 86_400_000);
        if (daysLeft <= horizon) {
          vehicleAlerts.push({ id: v.id, name: v.name, type, dueAt: new Date(due).toISOString(), daysLeft });
        }
      }
    }
    vehicleAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
    vehicleAlerts = vehicleAlerts.slice(0, 4);
    return { vehiclesCount: vehicles.length, vehicleAlerts };
  } catch {
    return { vehiclesCount: 0, vehicleAlerts: [] };
  }
};

export default wklad;
