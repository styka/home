import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { QaAdminTree } from "@/components/admin/qa/QaAdminTree";

export const dynamic = "force-dynamic";

export default async function QaAdminPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const epicsRaw = await prisma.qaEpic.findMany({
    orderBy: [{ module: "asc" }, { order: "asc" }],
    include: {
      userStories: {
        orderBy: [{ order: "asc" }],
        include: {
          scenarios: {
            orderBy: [{ order: "asc" }],
            select: { id: true, slug: true, title: true, type: true, priority: true, order: true },
          },
        },
      },
    },
  });

  const epics = epicsRaw.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    module: e.module,
    order: e.order,
    stories: e.userStories.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      order: s.order,
      scenarios: s.scenarios,
    })),
  }));

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FlaskConical size={20} style={{ color: "var(--accent-red)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            QA — zarządzanie scenariuszami
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px" }}>
          Hierarchia: <strong>Moduł → Epic → User Story → Scenariusz</strong>. Każdy poziom edytujesz osobno.
        </p>

        <QaAdminTree epics={epics} />
      </div>
    </div>
  );
}
