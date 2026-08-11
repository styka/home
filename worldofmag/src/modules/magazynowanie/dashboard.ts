import type { DashboardContributor } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getLowStock, getExpiringStorage } from "./contract";

/**
 * 050: wkład Magazynowania do migawki pulpitu. Treść przeniesiona z trasy **bez zmiany** — te same
 * wywołania kontraktu, to samo mapowanie i ten sam `try/catch` z wartościami zerowymi.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "storageLowStock" | "storageExpiring">> = async () => {
  try {
    const [low, expiring] = await Promise.all([getLowStock(), getExpiringStorage(30)]);
    return { storageLowStock: low.length, storageExpiring: expiring.length };
  } catch {
    return { storageLowStock: 0, storageExpiring: 0 };
  }
};

export default wklad;
