export const dynamic = "force-dynamic";

import { getTags } from "@/actions/tags";
import { TagsManager } from "@/components/notes/TagsManager";

export default async function NotesTagsPage() {
  const tags = await getTags();
  return <TagsManager tags={tags} />;
}
