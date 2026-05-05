export const dynamic = "force-dynamic";

import { getNoteGroups } from "@/actions/noteGroups";
import { GroupsManager } from "@/components/notes/GroupsManager";

export default async function NotesGroupsPage() {
  const groups = await getNoteGroups();
  return <GroupsManager groups={groups} />;
}
