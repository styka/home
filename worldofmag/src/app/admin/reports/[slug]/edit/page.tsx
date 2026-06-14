import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getReport } from "@/actions/reports";
import { EditReportForm } from "./EditReportForm";

export default async function EditReportPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // getReport hydruje treść z Dysku, jeśli raport jest tam przechowywany.
  const report = await getReport(params.slug);
  if (!report) notFound();

  return (
    <EditReportForm
      report={{
        title: report.title,
        slug: report.slug,
        category: report.category,
        content: report.content,
        storage: report.storage as "db" | "drive",
      }}
    />
  );
}
