import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getEpicForAdmin } from "@/actions/qa";
import { EditEpicForm } from "@/components/admin/qa/EditEpicForm";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function EditEpicPage({ params }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const epic = await getEpicForAdmin(params.slug);
  if (!epic) notFound();

  return (
    <EditEpicForm
      mode="edit"
      initial={{
        slug: epic.slug,
        title: epic.title,
        description: epic.description,
        module: epic.module,
        order: epic.order,
      }}
    />
  );
}
