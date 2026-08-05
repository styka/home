export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { getNotes } from "@/modules/notes/actions/notes";
import { getNoteGroups } from "@/modules/notes/actions/noteGroups";
import { getTags } from "@/actions/tags";
import { NotesPage } from "@/modules/notes/ui/NotesPage";

interface Props {
  /** 043: stan widoku (filtr, folder, tagi, tryb) czytany przez `useViewState` po stronie klienta. */
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function NotesAllPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const [notes, groups, tags] = await Promise.all([getNotes(), getNoteGroups(), getTags()]);
  return <NotesPage notes={notes} groups={groups} tags={tags} backHref="/notes" viewParams={searchParams ?? {}} />;
}
