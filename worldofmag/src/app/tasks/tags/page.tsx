export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTaskTags } from "@/actions/taskTags";
import { TaskTagsManager } from "@/components/tasks/TaskTagsManager";
import { ChevronLeft } from "lucide-react";

export default async function TaskTagsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const tags = await getTaskTags();

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <Link
          href="/tasks"
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
          Zadania
        </Link>
        <TaskTagsManager initialTags={tags} />
      </div>
    </div>
  );
}
