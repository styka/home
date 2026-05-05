import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTaskTags } from "@/actions/taskTags";
import { TaskTagsManager } from "@/components/tasks/TaskTagsManager";

export const dynamic = "force-dynamic";

export default async function TaskTagsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const tags = await getTaskTags();

  return <TaskTagsManager initialTags={tags} />;
}
