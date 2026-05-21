export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getNotes } from "@/actions/notes";
import { getNoteGroups } from "@/actions/noteGroups";
import { getTags } from "@/actions/tags";
import { NotesHomePage } from "@/components/notes/NotesHomePage";

export default async function NotesRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const [notes, groups, tags] = await Promise.all([getNotes(), getNoteGroups(), getTags()]);

  const recentNotes = notes.slice(0, 5).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    group: n.group ? { id: n.group.id, name: n.group.name } : null,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
  }));

  const pinnedNotes = notes
    .filter((n) => n.pinned)
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      group: n.group ? { id: n.group.id, name: n.group.name } : null,
    }));

  return (
    <NotesHomePage
      recentNotes={recentNotes}
      pinnedNotes={pinnedNotes}
      totalCount={notes.length}
      pinnedCount={notes.filter((n) => n.pinned).length}
      groupCount={groups.length}
      tagCount={tags.length}
    />
  );
}
