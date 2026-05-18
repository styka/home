export const dynamic = "force-dynamic";

import Link from "next/link";
import { getNoteGroups } from "@/actions/noteGroups";
import { GroupsManager } from "@/components/notes/GroupsManager";
import { ChevronLeft } from "lucide-react";

export default async function NotesGroupsPage() {
  const groups = await getNoteGroups();
  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <Link
          href="/notes"
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
          Notatki
        </Link>
        <GroupsManager groups={groups} />
      </div>
    </div>
  );
}
