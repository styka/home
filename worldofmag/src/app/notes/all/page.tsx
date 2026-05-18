export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getNotes } from "@/actions/notes";
import { getNoteGroups } from "@/actions/noteGroups";
import { getTags } from "@/actions/tags";
import { NotesPage } from "@/components/notes/NotesPage";

export default async function NotesAllPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const [notes, groups, tags] = await Promise.all([getNotes(), getNoteGroups(), getTags()]);
  return <NotesPage notes={notes} groups={groups} tags={tags} backHref="/notes" />;
}
