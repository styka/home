export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPet } from "@/actions/pets";
import { getMyTeams } from "@/actions/teams";
import { PetDetailPage } from "@/components/pets/PetDetailPage";

export default async function PetDetailRoute({ params }: { params: { petId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PETS)) redirect("/");

  const pet = await getPet(params.petId).catch(() => null);
  if (!pet) notFound();

  const teams = await getMyTeams();

  return <PetDetailPage pet={pet} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />;
}
