import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EditReportForm } from "./EditReportForm";

export default async function EditReportPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const report = await prisma.report.findUnique({
    where: { slug: params.slug },
    select: { title: true, slug: true, category: true, content: true },
  });
  if (!report) notFound();

  return <EditReportForm report={report} />;
}
