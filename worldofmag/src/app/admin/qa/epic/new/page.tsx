import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { EditEpicForm } from "@/components/admin/qa/EditEpicForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { module?: string };
}

export default async function NewEpicPage({ searchParams }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  return <EditEpicForm mode="create" defaultModule={searchParams.module} />;
}
