import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMemberAccessModule } from "@/lib/teams/memberAccess";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user as { id: string; role?: string };
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/**
 * Z-194 (T-12): warianty `getUserTeamIds` z egzekwowaniem granularnych ról rodzic/dziecko.
 * Zwraca tylko te zespoły, w których użytkownik (wg roli + `moduleAccess`) ma dostęp do
 * współdzielonych zasobów danego modułu. „Rodzic" (OWNER/ADMIN) i „dziecko" bez ograniczeń
 * widzą wszystko — więc dla typowego użytkownika wynik = `getUserTeamIds`.
 * Seam do stopniowego wpięcia w odczyty modułów team-aware (rollout po deployu).
 */
export async function getAccessibleTeamIds(userId: string, moduleId: string): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, role: true, moduleAccess: true },
  });
  return rows
    .filter((r) => canMemberAccessModule(r, moduleId))
    .map((r) => r.teamId);
}
