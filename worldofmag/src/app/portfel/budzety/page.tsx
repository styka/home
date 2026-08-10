export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import portfelModule from "@/modules/portfel/module";
import { getBudgetsWithSpending, getFinanceGoals } from "@/modules/portfel/actions/portfelBudgets";
import { getMyTeams } from "@/actions/teams";
import { BudgetsPage } from "@/modules/portfel/ui/BudgetsPage";

export default async function PortfelBudgetsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, portfelModule.permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const [budgetsData, goals, teams] = await Promise.all([
    getBudgetsWithSpending(),
    getFinanceGoals(),
    getMyTeams().catch(() => []),
  ]);

  return (
    <BudgetsPage
      budgets={budgetsData.budgets}
      periodLabel={budgetsData.periodLabel}
      goals={goals}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
