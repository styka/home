export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import petsModule from "@/modules/pets/module";
import { getPet } from "@/modules/pets/actions/pets";
import { getMyTeams } from "@/actions/teams";
import { PetDetailPage } from "@/modules/pets/ui/PetDetailPage";

export default async function PetDetailRoute({ params, searchParams }: { params: { petId: string }; searchParams?: { tab?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, petsModule.permission)) redirect("/");

  const pet = await getPet(params.petId).catch(() => null);
  if (!pet) notFound();

  const teams = await getMyTeams();

  return <PetDetailPage pet={pet} teams={teams.map((t) => ({ id: t.id, name: t.name }))} viewParams={searchParams ?? {}} />;
}
