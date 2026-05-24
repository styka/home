import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getStoryForAdmin } from "@/actions/qa";
import { EditScenarioForm } from "@/components/admin/qa/EditScenarioForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { storySlug?: string };
}

export default async function NewScenarioPage({ searchParams }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  if (!searchParams.storySlug) notFound();
  const story = await getStoryForAdmin(searchParams.storySlug);
  if (!story) notFound();

  return (
    <EditScenarioForm
      mode="create"
      storySlug={story.slug}
      storyTitle={story.title}
      epicTitle={story.epic.title}
    />
  );
}
