export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import petsModule from "@/modules/pets/module";
import { getPets } from "@/modules/pets/actions/pets";
import { getPetWelfare } from "@/modules/pets/actions/petCare";
import { getMyTeams } from "@/actions/teams";
import { PetsHomePage } from "@/modules/pets/ui/PetsHomePage";

export default async function PetsRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, petsModule.permission)) redirect("/");

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
