import type { DashboardContributor, DashboardContext } from "@/platform/dashboard";
import type { DashboardSnapshot } from "../home/contract";
import { getWalletOverview } from "./contract";

/**
 * 050: wkład Portfela — wartość netto i trend miesięczny.
 *
 * `try/catch` z `null` przeniesiony bez zmiany: pulpit nigdy nie wywala się przez jeden moduł.
 */
const wklad: DashboardContributor<Pick<DashboardSnapshot, "wallet">> = async () => {
  try {
    const overview = await getWalletOverview();
    return { wallet: { totalNet: overview.totalNet, currency: overview.currency, monthlyRate: overview.monthlyRate } };
  } catch {
    return { wallet: null };
  }
};

export default wklad;
