import { notFound, redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getEpicForAdmin } from "@/modules/qa/contract";
import { EditStoryForm } from "@/components/admin/qa/EditStoryForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { epicSlug?: string };
}

export default async function NewStoryPage({ searchParams }: Props) {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  if (!searchParams.epicSlug) notFound();
  const epic = await getEpicForAdmin(searchParams.epicSlug);
  if (!epic) notFound();

  return <EditStoryForm mode="create" epicSlug={epic.slug} epicTitle={epic.title} />;
}
