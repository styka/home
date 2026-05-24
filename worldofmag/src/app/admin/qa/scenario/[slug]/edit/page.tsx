import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getScenarioForAdmin } from "@/actions/qa";
import { EditScenarioForm } from "@/components/admin/qa/EditScenarioForm";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function EditScenarioPage({ params }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const scenario = await getScenarioForAdmin(params.slug);
  if (!scenario) notFound();

  return (
    <EditScenarioForm
      mode="edit"
      storySlug={scenario.story.slug}
      storyTitle={scenario.story.title}
      epicTitle={scenario.story.epic.title}
      initial={{
        slug: scenario.slug,
        title: scenario.title,
        type: scenario.type,
        priority: scenario.priority,
        content: scenario.content,
        order: scenario.order,
      }}
    />
  );
}
