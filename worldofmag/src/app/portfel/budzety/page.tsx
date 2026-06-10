export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getBudgetsWithSpending, getFinanceGoals } from "@/actions/portfelBudgets";
import { getMyTeams } from "@/actions/teams";
import { BudgetsPage } from "@/components/portfel/BudgetsPage";

export default async function PortfelBudgetsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PORTFEL) && !hasPermission(session, PERMISSIONS.ADMIN)) {
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
