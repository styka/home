import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getEpicForAdmin } from "@/actions/qa";
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
