export const dynamic = "force-dynamic";

import { getNotes } from "@/actions/notes";
import { getNoteGroups } from "@/actions/noteGroups";
import { getTags } from "@/actions/tags";
import { NotesPage } from "@/components/notes/NotesPage";

export default async function NotesRootPage() {
  const [notes, groups, tags] = await Promise.all([
    getNotes(),
    getNoteGroups(),
    getTags(),
  ]);

  return <NotesPage notes={notes} groups={groups} tags={tags} />;
}
