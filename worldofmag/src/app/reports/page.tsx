import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getUserReportsMeta } from "@/modules/reports/contract";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { ReportsHomePage, type ReportSummary } from "@/modules/reports/ui/ReportsHomePage";

export const dynamic = "force-dynamic";

export default async function UserReportsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const reports = await getUserReportsMeta();
  const userId = session.user.id;
  const isAdmin = hasPermission(session, PERMISSIONS.ADMIN);

  const summaries: ReportSummary[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    authorId: r.authorId,
    teamId: r.teamId,
    authorName: r.authorName ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    storage: r.storage,
  }));

  const myCount = summaries.filter((r) => r.authorId === userId).length;
  const teamCount = summaries.filter((r) => r.teamId !== null && r.authorId !== userId).length;

  return (
    <ReportsHomePage
      reports={summaries}
      myCount={myCount}
      teamCount={teamCount}
      isAdmin={isAdmin} viewParams={searchParams ?? {}} />
  );
}
