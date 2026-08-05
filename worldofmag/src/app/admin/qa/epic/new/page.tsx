import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
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
