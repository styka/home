import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateInbox } from "@/actions/taskProjects";

export const dynamic = "force-dynamic";

export default async function TasksIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const inbox = await getOrCreateInbox();
  redirect(`/tasks/${inbox.id}`);
}
