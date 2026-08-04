import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getStoryForAdmin } from "@/modules/qa/contract";
import { EditStoryForm } from "@/components/admin/qa/EditStoryForm";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function EditStoryPage({ params }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const story = await getStoryForAdmin(params.slug);
  if (!story) notFound();

  return (
    <EditStoryForm
      mode="edit"
      epicSlug={story.epic.slug}
      epicTitle={story.epic.title}
      initial={{
        slug: story.slug,
        title: story.title,
        description: story.description,
        order: story.order,
      }}
    />
  );
}
