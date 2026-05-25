export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPets } from "@/actions/pets";
import { getPetWelfare } from "@/actions/petCare";
import { getMyTeams } from "@/actions/teams";
import { PetsHomePage } from "@/components/pets/PetsHomePage";

export default async function PetsRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.PETS)) redirect("/");

  const [pets, welfare, teams] = await Promise.all([getPets(), getPetWelfare(), getMyTeams()]);

  return (
    <PetsHomePage
      pets={pets}
      agenda={welfare.agenda}
      suggestions={welfare.suggestions}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
