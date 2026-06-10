export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getMonthlyReport } from "@/actions/portfelReports";
import { MonthlyReportPage } from "@/components/portfel/MonthlyReportPage";

export default async function PortfelReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PORTFEL) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }

  const initial = await getMonthlyReport(0);
  return <MonthlyReportPage initial={initial} />;
}
